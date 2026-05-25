import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.itemName !== undefined) update.item_name = body.itemName
  if (body.formulaExpr !== undefined) update.formula_expr = body.formulaExpr
  if (body.unit !== undefined) update.unit = body.unit
  if (body.defaultColor !== undefined) update.default_color = body.defaultColor
  if (body.defaultSize !== undefined) update.default_size = body.defaultSize
  if (body.category !== undefined) update.category = body.category
  if (body.active !== undefined) update.active = body.active
  if (body.sortOrder !== undefined) update.sort_order = body.sortOrder

  const { data, error } = await supabase
    .from('formulas')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await supabase.from('formulas').delete().eq('id', params.id)
  return new NextResponse(null, { status: 204 })
}
