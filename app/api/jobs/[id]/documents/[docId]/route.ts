import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { connectDB } from '@/lib/mongodb'
import JobDocument from '@/models/Document'

type Params = { params: { id: string; docId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  await connectDB()
  const doc = await JobDocument.findById(params.docId)
  if (doc?.blobUrl) {
    try { await del(doc.blobUrl) } catch { /* blob may already be gone */ }
  }
  await JobDocument.findByIdAndDelete(params.docId)
  return new NextResponse(null, { status: 204 })
}
