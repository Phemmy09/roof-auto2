import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('jobs').select('*').limit(1)
  if (error) {
    console.error('Error fetching jobs:', error.message)
    return
  }
  if (data && data.length > 0) {
    console.log('Columns derived from first row:', Object.keys(data[0]))
  } else {
    // try to insert an empty job to see the schema error, maybe we can parse it
    // Wait, if 0 rows, we don't get the schema using select *.
    // Let's just try to insert a dummy object and catch error text
    const { error: insErr } = await supabase.from('jobs').insert({}).select()
    console.log('Insert error for empty object (gives hints?):', insErr?.message)
  }
}

test()
