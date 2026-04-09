import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Job from '@/models/Job'

export async function GET() {
  await connectDB()
  const jobs = await Job.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    if (!body.name) {
      return NextResponse.json({ error: 'Job name is required' }, { status: 400 })
    }
    const job = await Job.create({
      name: body.name,
      customerName: body.customerName ?? '',
      address: body.address ?? '',
      notes: body.notes ?? '',
    })
    return NextResponse.json(job, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/jobs] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
