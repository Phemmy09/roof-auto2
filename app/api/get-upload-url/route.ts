import { NextRequest, NextResponse } from 'next/server'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase'

// Returns a signed upload URL for the client to upload directly to Supabase Storage
export async function POST(req: NextRequest) {
  try {
    const { fileName, jobId, docType } = await req.json()

    if (!fileName || !jobId) {
      return NextResponse.json({ error: 'fileName and jobId are required' }, { status: 400 })
    }

    const storagePath = `jobs/${jobId}/${docType || 'file'}_${Date.now()}_${fileName}`

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error) {
      console.error('[get-upload-url] error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get the public URL for after upload
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
      publicUrl: publicUrlData.publicUrl,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[get-upload-url] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
