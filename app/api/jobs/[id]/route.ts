import { NextRequest, NextResponse } from 'next/server'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [docsResult, materialsResult, crewResult] = await Promise.all([
    supabase.from('documents').select('*').eq('job_id', params.id),
    supabase.from('materials_orders').select('*').eq('job_id', params.id).single(),
    supabase.from('crew_orders').select('*').eq('job_id', params.id).single(),
  ])

  return NextResponse.json({
    ...job,
    documents: docsResult.data || [],
    materialsOrder: materialsResult.data || null,
    crewOrder: crewResult.data || null,
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const body = await req.json()

  // Map camelCase from frontend to snake_case for Supabase
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.customerName !== undefined) update.customer_name = body.customerName
  if (body.address !== undefined) update.address = body.address
  if (body.notes !== undefined) update.notes = body.notes
  if (body.status !== undefined) update.status = body.status
  if (body.processingStage !== undefined) update.processing_stage = body.processingStage
  if (body.extractedData !== undefined) update.extracted_data = body.extractedData
  if (body.email !== undefined) update.email = body.email
  // Also allow snake_case directly
  Object.entries(body).forEach(([k, v]) => {
    if (k.includes('_')) update[k] = v
  })

  const { data, error } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  // Get document file paths to delete from storage
  const { data: docs } = await supabase
    .from('documents')
    .select('file_url')
    .eq('job_id', params.id)

  if (docs && docs.length > 0) {
    // Extract storage paths from public URLs
    const paths = docs
      .map(d => {
        try {
          const url = new URL(d.file_url)
          const bucketPrefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`
          const idx = url.pathname.indexOf(bucketPrefix)
          if (idx >= 0) return decodeURIComponent(url.pathname.slice(idx + bucketPrefix.length))
          return null
        } catch {
          return null
        }
      })
      .filter((p): p is string => p !== null)

    if (paths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    }
  }

  // Cascade delete handles documents, materials_orders, crew_orders
  await supabase.from('jobs').delete().eq('id', params.id)
  return new NextResponse(null, { status: 204 })
}
