import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import MaterialsOrder from '@/models/MaterialsOrder'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  await connectDB()
  const order = await MaterialsOrder.findOne({ jobId: params.id }).lean()
  return NextResponse.json(order ?? { jobId: params.id, items: [] })
}

export async function PUT(req: NextRequest, { params }: Params) {
  await connectDB()
  const { items } = await req.json()
  const order = await MaterialsOrder.findOneAndUpdate(
    { jobId: params.id },
    { jobId: params.id, items },
    { upsert: true, new: true }
  ).lean()
  return NextResponse.json(order)
}
