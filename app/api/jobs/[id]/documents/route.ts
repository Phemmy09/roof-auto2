import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import JobDocument from '@/models/Document'

type Params = { params: { id: string } }

// The browser uploads the file directly to Vercel Blob and sends us
// just the resulting blobUrl + metadata — no file bytes pass through here.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const body = await req.json()
    const { blobUrl, fileName, mimeType, docType } = body

    if (!blobUrl || !fileName || !docType) {
      return NextResponse.json({ error: 'Missing blobUrl, fileName or docType' }, { status: 400 })
    }

    const doc = await JobDocument.create({
      jobId: params.id,
      fileName,
      docType,
      mimeType: mimeType || 'application/pdf',
      blobUrl,
    })

    return NextResponse.json(doc.toObject(), { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[documents POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
