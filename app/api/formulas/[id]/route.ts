import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Formula from '@/models/Formula'

type Params = { params: { id: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  await connectDB()
  const body = await req.json()
  const formula = await Formula.findByIdAndUpdate(params.id, body, { new: true }).lean()
  if (!formula) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(formula)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await connectDB()
  await Formula.findByIdAndDelete(params.id)
  return new NextResponse(null, { status: 204 })
}
