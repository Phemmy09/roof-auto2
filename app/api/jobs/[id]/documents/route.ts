import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { connectDB } from '@/lib/mongodb'
import JobDocument from '@/models/Document'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const formData = await req.formData()
    const file = formData.get('file') as File
    const docType = formData.get('doc_type') as string

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Upload to Vercel Blob (no size limits like MongoDB)
    const blob = await put(`jobs/${params.id}/${docType}_${Date.now()}_${file.name}`, file, {
      access: 'public',
    })

    const doc = await JobDocument.create({
      jobId: params.id,
      fileName: file.name,
      docType,
      mimeType: file.type || 'application/pdf',
      blobUrl: blob.url,
    })

    return NextResponse.json(doc.toObject(), { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[documents POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
