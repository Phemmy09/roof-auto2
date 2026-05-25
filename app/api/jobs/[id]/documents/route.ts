import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = { params: { id: string } }

// The browser uploads the file directly to Supabase Storage and sends us
// just the resulting publicUrl + metadata — no file bytes pass through here.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json()
    const { fileUrl, fileName, mimeType, docType } = body

    if (!fileUrl || !fileName || !docType) {
      return NextResponse.json({ error: 'Missing fileUrl, fileName or docType' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        job_id: params.id,
        file_name: fileName,
        doc_type: docType,
        mime_type: mimeType || 'application/pdf',
        file_type: mimeType || 'application/pdf',
        file_url: fileUrl,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[documents POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
