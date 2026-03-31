import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import CrewOrder from '@/models/CrewOrder'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  await connectDB()
  const order = await CrewOrder.findOne({ jobId: params.id }).lean()
  return NextResponse.json(order ?? { jobId: params.id, data: {} })
}

export async function PUT(req: NextRequest, { params }: Params) {
  await connectDB()
  const { data } = await req.json()
  const order = await CrewOrder.findOneAndUpdate(
    { jobId: params.id },
    { jobId: params.id, data },
    { upsert: true, new: true }
  ).lean()
  return NextResponse.json(order)
}
