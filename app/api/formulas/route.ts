import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Formula from '@/models/Formula'

export async function GET() {
  await connectDB()
  const formulas = await Formula.find().sort({ sortOrder: 1 }).lean()
  return NextResponse.json(formulas)
}

export async function POST(req: NextRequest) {
  await connectDB()
  const body = await req.json()
  const formula = await Formula.create(body)
  return NextResponse.json(formula, { status: 201 })
}
