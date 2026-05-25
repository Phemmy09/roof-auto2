import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DEFAULT_FORMULAS } from '@/lib/formula-engine'

export async function POST() {
  // Delete all existing formulas
  await supabase.from('formulas').delete().gte('sort_order', 0)

  // Insert defaults (map camelCase to snake_case)
  const rows = DEFAULT_FORMULAS.map(f => ({
    name: f.name,
    item_name: f.itemName,
    formula_expr: f.formulaExpr,
    unit: f.unit,
    default_color: f.defaultColor,
    default_size: f.defaultSize,
    category: f.category,
    active: f.active,
    sort_order: f.sortOrder,
  }))

  const { data, error } = await supabase
    .from('formulas')
    .insert(rows)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seeded: data.length })
}
