import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { data, error } = await supabase
    .from('crew_orders')
    .select('*')
    .eq('job_id', params.id)
    .single()

  if (error) return NextResponse.json({ job_id: params.id, data: {} })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { data: body } = await req.json()
  const { data, error } = await supabase
    .from('crew_orders')
    .upsert(
      { job_id: params.id, data: body },
      { onConflict: 'job_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
