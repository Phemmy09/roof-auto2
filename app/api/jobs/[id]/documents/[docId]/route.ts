import { NextRequest, NextResponse } from 'next/server'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'

type Params = { params: { id: string; docId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  // Get the document to find its storage path
  const { data: doc } = await supabase
    .from('documents')
    .select('file_url')
    .eq('id', params.docId)
    .single()

  if (doc?.file_url) {
    try {
      const url = new URL(doc.file_url)
      const bucketPrefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`
      const idx = url.pathname.indexOf(bucketPrefix)
      if (idx >= 0) {
        const path = decodeURIComponent(url.pathname.slice(idx + bucketPrefix.length))
        await supabase.storage.from(STORAGE_BUCKET).remove([path])
      }
    } catch { /* storage file may already be gone */ }
  }

  await supabase.from('documents').delete().eq('id', params.docId)
  return new NextResponse(null, { status: 204 })
}
