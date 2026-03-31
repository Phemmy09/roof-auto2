import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Job from '@/models/Job'

export async function GET() {
  await connectDB()
  const jobs = await Job.find().sort({ createdAt: -1 }).lean()
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const job = await Job.create({
    name: body.name,
    customerName: body.customerName ?? '',
    address: body.address ?? '',
    notes: body.notes ?? '',
  })
  return NextResponse.json(job, { status: 201 })
}
