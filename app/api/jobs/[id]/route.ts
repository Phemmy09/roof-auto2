import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { connectDB } from '@/lib/mongodb'
import Job from '@/models/Job'
import JobDocument from '@/models/Document'
import MaterialsOrder from '@/models/MaterialsOrder'
import CrewOrder from '@/models/CrewOrder'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  await connectDB()
  const job = await Job.findById(params.id).lean()
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [docs, materials, crew] = await Promise.all([
    JobDocument.find({ jobId: params.id }).select('-fileData').lean(),
    MaterialsOrder.findOne({ jobId: params.id }).lean(),
    CrewOrder.findOne({ jobId: params.id }).lean(),
  ])

  return NextResponse.json({ ...job, documents: docs, materialsOrder: materials, crewOrder: crew })
}

export async function PUT(req: NextRequest, { params }: Params) {
  await connectDB()
  const body = await req.json()
  const job = await Job.findByIdAndUpdate(params.id, body, { new: true }).lean()
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await connectDB()
  // Delete all blobs for this job's documents
  const docs = await JobDocument.find({ jobId: params.id }).select('blobUrl')
  await Promise.all(
    docs.filter(d => d.blobUrl).map(d => del(d.blobUrl).catch(() => {}))
  )
  await JobDocument.deleteMany({ jobId: params.id })
  await MaterialsOrder.deleteOne({ jobId: params.id })
  await CrewOrder.deleteOne({ jobId: params.id })
  await Job.findByIdAndDelete(params.id)
  return new NextResponse(null, { status: 204 })
}
