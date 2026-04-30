import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Não autorizado' }, 401)

    // Verify caller is admin using anon client
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: { user }, error: authErr } = await anon.auth.getUser()
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)
    if (user.app_metadata?.role !== 'admin') return json({ error: 'Acesso negado' }, 403)

    // Admin client bypasses RLS
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const body = await req.json().catch(() => null)
    const { action, target_id, email } = body ?? {}

    // ── invite ────────────────────────────────────────────────────────────────
    if (action === 'invite') {
      if (!email || !EMAIL_RE.test(email)) return json({ error: 'E-mail inválido' }, 400)
      const { error } = await admin.auth.admin.inviteUserByEmail(email)
      if (error) {
        console.error('invite error:', String(error))
        return json({ error: 'Erro ao enviar convite. Verifique se o e-mail já está cadastrado.' }, 500)
      }
      return json({ ok: true })
    }

    // ── actions that require a target_id ──────────────────────────────────────
    if (!target_id || !UUID_RE.test(target_id)) return json({ error: 'ID inválido' }, 400)
    if (target_id === user.id) return json({ error: 'Não é possível agir sobre si mesmo' }, 400)

    if (action === 'ban') {
      const { error } = await admin.auth.admin.updateUserById(target_id, { ban_duration: '876600h' })
      if (error) { console.error('ban error:', JSON.stringify(error)); return json({ error: error.message }, 500) }
      return json({ ok: true })
    }

    if (action === 'unban') {
      const { error } = await admin.auth.admin.updateUserById(target_id, { ban_duration: 'none' })
      if (error) { console.error('unban error:', JSON.stringify(error)); return json({ error: error.message }, 500) }
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(target_id)
      if (error) { console.error('delete error:', JSON.stringify(error)); return json({ error: error.message }, 500) }
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida' }, 400)

  } catch (err) {
    console.error('admin-action error:', String(err))
    return json({ error: 'Erro interno ao executar a ação' }, 500)
  }
})