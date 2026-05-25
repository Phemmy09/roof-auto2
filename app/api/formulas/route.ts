import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('formulas')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('formulas')
    .insert({
      name: body.name,
      item_name: body.itemName ?? body.item_name,
      formula_expr: body.formulaExpr ?? body.formula_expr,
      unit: body.unit,
      default_color: body.defaultColor ?? body.default_color ?? '',
      default_size: body.defaultSize ?? body.default_size ?? '',
      category: body.category ?? 'main',
      active: body.active ?? true,
      sort_order: body.sortOrder ?? body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
