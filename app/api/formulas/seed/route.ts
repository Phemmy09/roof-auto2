import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Formula from '@/models/Formula'
import { DEFAULT_FORMULAS } from '@/lib/formula-engine'

export async function POST() {
  await connectDB()
  await Formula.deleteMany({})
  const formulas = await Formula.insertMany(DEFAULT_FORMULAS)
  return NextResponse.json({ seeded: formulas.length })
}
