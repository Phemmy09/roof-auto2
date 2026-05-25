import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { extractDocument, analyzeImages, mergeExtractedData } from '@/lib/anthropic'
import { runFormulaEngine } from '@/lib/formula-engine'
import { sendCompletionEmail } from '@/lib/email'
import { Measurements } from '@/types'

export const maxDuration = 300

type Params = { params: { id: string } }

async function setStage(jobId: string, stage: string) {
  await supabase
    .from('jobs')
    .update({ processing_stage: stage })
    .eq('id', jobId)
}

async function setStatus(jobId: string, status: string, stage?: string) {
  const update: Record<string, unknown> = { status }
  if (stage) update.processing_stage = stage
  await supabase.from('jobs').update(update).eq('id', jobId)
}

export async function POST(_req: NextRequest, { params }: Params) {
  // Step 1: Fetch job and documents
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('*')
    .eq('job_id', params.id)

  if (docsErr || !docs || docs.length === 0) {
    return NextResponse.json({ error: 'No documents uploaded' }, { status: 400 })
  }

  await setStatus(params.id, 'processing', 'downloading')

  // Step 2: Separate image files from PDF documents
  const imageDocs = docs.filter(d => d.mime_type?.startsWith('image/'))
  const pdfDocs = docs.filter(d => !d.mime_type?.startsWith('image/'))

  await setStage(params.id, 'extracting')

  const errors: unknown[] = []
  const processedDocs: Array<{ docType: string; extractedData: Record<string, unknown> }> = []

  // Step 3: Process PDF documents in parallel
  const pdfResults = await Promise.allSettled(
    pdfDocs.map(async (doc) => {
      console.log(`[process] pdf: ${doc.file_name} (${doc.doc_type})`)
      const extracted = await extractDocument(doc.file_url, doc.file_name, doc.doc_type)
      console.log(`[process] done: ${doc.file_name}`)
      await supabase
        .from('documents')
        .update({ extracted_data: extracted, processed: true })
        .eq('id', doc.id)
      return { docType: doc.doc_type, extractedData: extracted }
    })
  )

  for (let i = 0; i < pdfResults.length; i++) {
    const r = pdfResults[i]
    if (r.status === 'fulfilled') {
      processedDocs.push(r.value)
    } else {
      console.error(`[process] FAILED: ${pdfDocs[i].file_name}`, r.reason)
      errors.push({ file: pdfDocs[i].file_name, error: String(r.reason) })
    }
  }

  // Step 4: Process image files in batches of 5 using vision analysis
  if (imageDocs.length > 0) {
    await setStage(params.id, 'analyzing')
    console.log(`[process] analyzing ${imageDocs.length} image(s) in batches`)
    try {
      const imageUrls = imageDocs.map(d => d.file_url)
      const extracted = await analyzeImages(imageUrls)
      // Mark all image docs as processed
      await Promise.all(
        imageDocs.map(d =>
          supabase
            .from('documents')
            .update({ extracted_data: extracted, processed: true })
            .eq('id', d.id)
        )
      )
      processedDocs.push({ docType: 'photos', extractedData: extracted })
    } catch (e) {
      console.error('[process] image analysis FAILED', e)
      errors.push({ file: 'photos', error: String(e) })
    }
  }

  // Step 5: Merge all extracted data and run formula engine
  await setStage(params.id, 'calculating')

  const merged = mergeExtractedData(processedDocs)
  await supabase
    .from('jobs')
    .update({ extracted_data: merged })
    .eq('id', params.id)

  // Load formulas from Supabase
  const { data: formulaRows } = await supabase
    .from('formulas')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const formulas = (formulaRows || []).map(f => ({
    _id: f.id,
    name: f.name,
    itemName: f.item_name,
    formulaExpr: f.formula_expr,
    unit: f.unit,
    defaultColor: f.default_color,
    defaultSize: f.default_size,
    category: f.category,
    active: f.active,
    sortOrder: f.sort_order,
    createdAt: f.created_at,
  }))

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

  const items = runFormulaEngine(formulas, measurements)

  // Step 6: Save materials order and crew order
  await supabase
    .from('materials_orders')
    .upsert(
      { job_id: params.id, items },
      { onConflict: 'job_id' }
    )

  await supabase
    .from('crew_orders')
    .upsert(
      {
        job_id: params.id,
        data: { measurements, special_notes: merged.special_notes ?? '' },
      },
      { onConflict: 'job_id' }
    )

  // Build final report
  const finalReport = {
    summary: merged.summary || 'Roof analysis complete',
    damage_assessment: merged.damage_assessment || null,
    measurements,
    materials: items,
    recommendations: merged.recommendations || [],
    urgency_level: (merged.urgency_level as string) || 'medium',
    customer_name: merged.customer_name || job.customer_name || '',
    address: merged.address || job.address || '',
    handwritten_notes: merged.handwritten_notes || null,
    insurance_company: merged.insurance_company || null,
    claim_number: merged.claim_number || null,
    approved_amount: merged.approved_amount || null,
    deductible: merged.deductible || null,
    special_notes: merged.special_notes || null,
  }

  // Save final report to job result
  await supabase
    .from('jobs')
    .update({ result: finalReport })
    .eq('id', params.id)

  // Step 7: Send email notification (replaces n8n)
  if (processedDocs.length > 0) {
    try {
      await sendCompletionEmail({
        customerName: job.customer_name || job.name,
        jobId: params.id,
        summary: typeof finalReport.summary === 'string'
          ? finalReport.summary
          : JSON.stringify(finalReport.summary),
        urgencyLevel: finalReport.urgency_level,
        recipientEmail: job.email || undefined,
      })
    } catch (e) {
      console.warn('[process] email notification failed (non-fatal):', String(e))
    }
  }

  // Step 8: Update final status
  const finalStatus = processedDocs.length > 0 ? 'complete' : 'failed'
  const finalStage = processedDocs.length > 0 ? 'done' : 'failed'
  const errorText = errors.length > 0 ? JSON.stringify(errors) : null

  await supabase
    .from('jobs')
    .update({
      status: finalStatus,
      processing_stage: finalStage,
      error: errorText,
    })
    .eq('id', params.id)

  return NextResponse.json({
    status: finalStatus,
    documentsProcessed: processedDocs.length,
    materialsItems: items.length,
    measurements,
    report: finalReport,
    errors,
  })
}
