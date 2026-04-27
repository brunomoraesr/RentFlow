import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Verify caller is admin
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: { user }, error: authErr } = await anon.auth.getUser()
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401)
    if (user.app_metadata?.role !== 'admin') return json({ error: 'Acesso negado' }, 403)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Fetch all data in parallel ────────────────────────────────────────────
    const [usersRes, bookingsRes, propsRes, logsRes] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from('bookings').select('user_id, value, source').neq('source', 'cancelled'),
      admin.from('properties').select('user_id, type, location'),
      admin.from('error_logs')
        .select('created_at, user_id, error_type, message, context')
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    const authUsers = usersRes.data?.users ?? []
    const bookings  = bookingsRes.data ?? []
    const props     = propsRes.data ?? []
    const rawLogs   = logsRes.data ?? []

    // ── Build per-user maps ───────────────────────────────────────────────────
    const revenueByUser: Record<string, number> = {}
    for (const b of bookings) {
      if (b.source === 'blocked') continue
      revenueByUser[b.user_id] = (revenueByUser[b.user_id] ?? 0) + (Number(b.value) || 0)
    }

    const propsByUser: Record<string, number> = {}
    for (const p of props) {
      propsByUser[p.user_id] = (propsByUser[p.user_id] ?? 0) + 1
    }

    // ── Build user email map for logs ─────────────────────────────────────────
    const emailById: Record<string, string> = {}
    for (const u of authUsers) emailById[u.id] = u.email ?? '—'

    // ── 30-day activity threshold ─────────────────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const users = authUsers.map(u => ({
      id:            u.id,
      email:         u.email ?? '—',
      created_at:    u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned:        !!u.banned_until && new Date(u.banned_until) > new Date(),
      role:          (u.app_metadata?.role as string) ?? 'user',
      phone:         (u.user_metadata?.phone_number as string) ?? '—',
      properties:    propsByUser[u.id] ?? 0,
      revenue:       revenueByUser[u.id] ?? 0,
    }))

    const stats = {
      total_users:   users.length,
      active_users:  users.filter(u => u.last_sign_in_at && u.last_sign_in_at >= thirtyDaysAgo).length,
      total_revenue: Object.values(revenueByUser).reduce((a, b) => a + b, 0),
    }

    const error_logs = rawLogs.map(l => ({
      ...l,
      user_email: emailById[l.user_id] ?? '—',
    }))

    return json({ stats, users, error_logs, properties: props })

  } catch (err) {
    console.error('admin-data error:', String(err))
    return json({ error: 'Erro interno' }, 500)
  }
})
