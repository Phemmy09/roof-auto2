import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Job from '@/models/Job'
import JobDocument from '@/models/Document'
import MaterialsOrder from '@/models/MaterialsOrder'
import CrewOrder from '@/models/CrewOrder'
import Formula from '@/models/Formula'
import { extractDocument, analyzeImages, mergeExtractedData } from '@/lib/anthropic'
import { runFormulaEngine } from '@/lib/formula-engine'
import { Measurements } from '@/types'

export const maxDuration = 300

type Params = { params: { id: string } }

async function setStage(jobId: string, stage: string) {
  await Job.findByIdAndUpdate(jobId, { processingStage: stage })
}

export async function POST(_req: NextRequest, { params }: Params) {
  await connectDB()

  const job = await Job.findById(params.id)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const docs = await JobDocument.find({ jobId: params.id })
  if (!docs.length) return NextResponse.json({ error: 'No documents uploaded' }, { status: 400 })

  await Job.findByIdAndUpdate(params.id, { status: 'processing', processingStage: 'downloading' })

  // Separate image files (photos) from PDF documents
  const imageDocs = docs.filter(d => d.mimeType?.startsWith('image/'))
  const pdfDocs = docs.filter(d => !d.mimeType?.startsWith('image/'))

  await setStage(params.id, 'extracting')

  const errors: unknown[] = []
  const processedDocs: Array<{ docType: string; extractedData: Record<string, unknown> }> = []

  // Process PDF documents in parallel
  const pdfResults = await Promise.allSettled(
    pdfDocs.map(async (doc) => {
      console.log(`[process] pdf: ${doc.fileName} (${doc.docType})`)
      const extracted = await extractDocument(doc.blobUrl, doc.fileName, doc.docType)
      console.log(`[process] done: ${doc.fileName}`)
      await JobDocument.findByIdAndUpdate(doc._id, { extractedData: extracted, processed: true })
      return { docType: doc.docType, extractedData: extracted }
    })
  )

  for (let i = 0; i < pdfResults.length; i++) {
    const r = pdfResults[i]
    if (r.status === 'fulfilled') {
      processedDocs.push(r.value)
    } else {
      console.error(`[process] FAILED: ${pdfDocs[i].fileName}`, r.reason)
      errors.push({ file: pdfDocs[i].fileName, error: String(r.reason) })
    }
  }

  // Process image files in batches of 5 using vision analysis
  if (imageDocs.length > 0) {
    await setStage(params.id, 'analyzing')
    console.log(`[process] analyzing ${imageDocs.length} image(s) in batches`)
    try {
      const imageUrls = imageDocs.map(d => d.blobUrl)
      const extracted = await analyzeImages(imageUrls)
      // Mark all image docs as processed
      await Promise.all(
        imageDocs.map(d => JobDocument.findByIdAndUpdate(d._id, { extractedData: extracted, processed: true }))
      )
      processedDocs.push({ docType: 'photos', extractedData: extracted })
    } catch (e) {
      console.error('[process] image analysis FAILED', e)
      errors.push({ file: 'photos', error: String(e) })
    }
  }

  await setStage(params.id, 'calculating')

  const merged = mergeExtractedData(processedDocs)
  await Job.findByIdAndUpdate(params.id, { extractedData: merged })

  const formulas = await Formula.find({ active: true }).sort({ sortOrder: 1 }).lean()
  const measurements: Measurements = {
    squares:    Number(merged.squares)    || 0,
    pitch:      Number(merged.pitch)      || 0,
    ridges:     Number(merged.ridges)     || 0,
    hips:       Number(merged.hips)       || 0,
    valleys:    Number(merged.valleys)    || 0,
    rakes:      Number(merged.rakes)      || 0,
    eaves:      Number(merged.eaves)      || 0,
    pipe_boots: Number(merged.pipe_boots) || 0,
    vents:      Number(merged.vents)      || 0,
  }

  const items = runFormulaEngine(
    formulas.map((f) => ({ ...f, _id: f._id.toString(), createdAt: f.createdAt?.toString() ?? '' })),
    measurements
  )

  await MaterialsOrder.findOneAndUpdate(
    { jobId: params.id },
    { jobId: params.id, items },
    { upsert: true, new: true }
  )

  await CrewOrder.findOneAndUpdate(
    { jobId: params.id },
    { jobId: params.id, data: { measurements, special_notes: merged.special_notes ?? '' } },
    { upsert: true, new: true }
  )

  // Notify n8n with lightweight JSON payload (no file bytes — n8n fetches URLs itself if needed)
  const n8nUrl = process.env.N8N_WEBHOOK_URL
  if (n8nUrl && processedDocs.length > 0) {
    try {
      const fileUrls = docs.map(d => d.blobUrl)
      await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: params.id,
          customer_name: job.customerName,
          file_urls: fileUrls,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      })
      console.log('[process] n8n notified')
    } catch (e) {
      console.warn('[process] n8n notification failed (non-fatal):', String(e))
    }
  }

  const finalStatus = processedDocs.length > 0 ? 'review' : 'pending'
  const finalStage = processedDocs.length > 0 ? 'done' : 'failed'
  await Job.findByIdAndUpdate(params.id, { status: finalStatus, processingStage: finalStage })

  return NextResponse.json({
    status: finalStatus,
    documentsProcessed: processedDocs.length,
    materialsItems: items.length,
    measurements,
    errors,
  })
}
