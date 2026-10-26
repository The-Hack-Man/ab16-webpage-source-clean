import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

export const handler = async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const client = createClient(supabaseUrl, supabaseKey)

  const grantStatements = [
    'GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.is_super_admin() TO PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.admin_write_policy_check() TO PUBLIC',
  ]

  for (const stmt of grantStatements) {
    try {
      const { error } = await client.rpc('grant_execute', {
        sql: stmt,
      })
      if (error) {
        throw new Error(`${error.message} (statement: ${stmt})`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      const { error } = await client.rpc('sql', {
        query: stmt,
      })
      if (error) {
        return new Response(
          JSON.stringify({
            error: `Failed to execute SQL: ${msg}. Fallback also failed: ${error.message}`,
            attempted: stmt,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Permissions granted on is_admin, is_super_admin, admin_write_policy_check' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
