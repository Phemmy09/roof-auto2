import { NextRequest, NextResponse } from 'next/server'
import { evaluateFormula } from '@/lib/formula-engine'
import { Measurements } from '@/types'

export async function POST(req: NextRequest) {
  const { formula_expr, measurements } = await req.json()
  try {
    const result = evaluateFormula(formula_expr, measurements as Measurements)
    return NextResponse.json({ result, error: null })
  } catch (e) {
    return NextResponse.json({ result: 0, error: String(e) })
  }
}
