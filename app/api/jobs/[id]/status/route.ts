import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Job from '@/models/Job'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  await connectDB()
  const job = await Job.findById(params.id).select('status processingStage').lean()
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}
