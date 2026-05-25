import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const { data, error } = await supabase
    .from('jobs')
    .select('status, processing_stage')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    status: data.status,
    processingStage: data.processing_stage,
  })
}
