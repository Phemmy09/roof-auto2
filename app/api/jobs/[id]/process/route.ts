import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Job from '@/models/Job'
import JobDocument from '@/models/Document'
import MaterialsOrder from '@/models/MaterialsOrder'
import CrewOrder from '@/models/CrewOrder'
import Formula from '@/models/Formula'
import { extractDocument, mergeExtractedData } from '@/lib/anthropic'
import { runFormulaEngine } from '@/lib/formula-engine'
import { Measurements } from '@/types'

export const maxDuration = 300

type Params = { params: { id: string } }

export async function POST(_req: NextRequest, { params }: Params) {
  await connectDB()

  const job = await Job.findById(params.id)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const docs = await JobDocument.find({ jobId: params.id })
  if (!docs.length) return NextResponse.json({ error: 'No documents uploaded' }, { status: 400 })

  await Job.findByIdAndUpdate(params.id, { status: 'processing' })

  // Process all documents in parallel — much faster than sequential
  const results = await Promise.allSettled(
    docs.map(async (doc) => {
      console.log(`[process] starting: ${doc.fileName} (${doc.docType})`)
      const extracted = await extractDocument(doc.blobUrl, doc.fileName, doc.docType)
      console.log(`[process] done: ${doc.fileName}`)
      await JobDocument.findByIdAndUpdate(doc._id, { extractedData: extracted, processed: true })
      return { docType: doc.docType, extractedData: extracted }
    })
  )

  const errors: unknown[] = []
  const processedDocs: Array<{ docType: string; extractedData: Record<string, unknown> }> = []

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      processedDocs.push(r.value)
    } else {
      console.error(`[process] FAILED: ${docs[i].fileName}`, r.reason)
      errors.push({ file: docs[i].fileName, error: String(r.reason) })
    }
  }

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

  await Job.findByIdAndUpdate(params.id, { status: 'review' })

  return NextResponse.json({
    status: 'review',
    documentsProcessed: processedDocs.length,
    materialsItems: items.length,
    measurements,
    errors,
  })
}
