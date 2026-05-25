import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name) {
      return NextResponse.json({ error: 'Job name is required' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        name: body.name,
        customer_name: body.customerName ?? '',
        email: body.email ?? '',
        address: body.address ?? '',
        notes: body.notes ?? '',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/jobs] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
