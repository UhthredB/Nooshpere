import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const [{ count: sessions }, { count: domains }, { count: facts }] = await Promise.all([
    supabase.from('artifacts').select('*', { count: 'exact', head: true }),
    supabase.from('domain_nodes').select('*', { count: 'exact', head: true }),
    supabase.from('facts').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    session_count: sessions ?? 0,
    domain_count: domains ?? 0,
    fact_count: facts ?? 0,
  })
}
