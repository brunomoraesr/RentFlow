import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Parser iCal ──────────────────────────────────────────────────────────────

interface ICalEvent {
  uid: string
  dtstart: string   // YYYY-MM-DD
  dtend: string     // YYYY-MM-DD
  summary: string
}

function parseDate(raw: string): string {
  // Extrai apenas YYYYMMDD independente do formato
  const digits = raw.replace(/[TZ]/g, '').replace(/[^0-9]/g, '')
  const d = digits.slice(0, 8)
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function unfold(ical: string): string {
  // Remove line folding (RFC 5545: CRLF seguido de espaço/tab)
  return ical.replace(/\r\n[ \t]/g, '').replace(/\r/g, '')
}

function parseIcal(raw: string): ICalEvent[] {
  const text = unfold(raw)
  const events: ICalEvent[] = []
  const blocks = text.split('BEGIN:VEVENT').slice(1)

  for (const block of blocks) {
    const end = block.indexOf('END:VEVENT')
    if (end === -1) continue
    const body = block.slice(0, end)

    const uid     = body.match(/^UID[^:]*:([^\n]+)/m)?.[1]?.trim()
    const start   = body.match(/^DTSTART[^:\n]*:([^\n]+)/m)?.[1]?.trim()
    const end_    = body.match(/^DTEND[^:\n]*:([^\n]+)/m)?.[1]?.trim()
    const summary = body.match(/^SUMMARY:([^\n]+)/m)?.[1]?.trim() ?? 'Bloqueado'

    if (!uid || !start || !end_) continue
    // Ignora eventos exportados pelo próprio RentFlow (evita loop)
    if (uid.startsWith('rentflow-')) continue

    events.push({
      uid,
      dtstart: parseDate(start),
      dtend:   parseDate(end_),
      summary,
    })
  }

  return events
}

// ── Validação de URL (previne SSRF) ──────────────────────────────────────────

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(h)) return false
    if (/^(10|192\.168|169\.254)\./.test(h)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
    return true
  } catch { return false }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Verifica autenticação
  const authHeader = req.headers.get('Authorization') ?? ''
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) {
    return new Response('Não autorizado', { status: 401, headers: CORS })
  }

  const body = await req.json().catch(() => ({}))
  const propertyId: string | undefined = body.property_id

  // Busca feeds configurados
  let q = supabaseAdmin.from('ical_feeds').select('*').eq('user_id', user.id)
  if (propertyId) q = q.eq('property_id', propertyId)

  const { data: feeds, error: feedErr } = await q
  if (feedErr) return new Response('Erro ao buscar feeds', { status: 500, headers: CORS })
  if (!feeds?.length) {
    return new Response(
      JSON.stringify({ synced: 0, message: 'Nenhum feed configurado' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const results = []

  for (const feed of feeds) {
    try {
      if (!isSafeUrl(feed.ical_url)) throw new Error('URL inválida ou insegura')

      // Busca o iCal externo
      const resp = await fetch(feed.ical_url, {
        headers: { 'User-Agent': 'RentFlow-iCal-Sync/1.0' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const text   = await resp.text()
      const events = parseIcal(text)

      const importedUids = new Set<string>()

      // Upsert cada evento como bloqueio
      for (const ev of events) {
        const { error: upsertErr } = await supabaseAdmin.from('bookings').upsert(
          {
            property_id:  feed.property_id,
            user_id:      user.id,
            guest:        ev.summary.slice(0, 100),
            checkin:      ev.dtstart,
            checkout:     ev.dtend,
            source:       'blocked',
            value:        0,
            guests_count: 1,
            notes:        `Importado do ${feed.source === 'airbnb' ? 'Airbnb' : 'Booking.com'}`,
            ical_uid:     ev.uid,
            ical_source:  feed.source,
          },
          { onConflict: 'property_id,ical_uid' }
        )
        if (upsertErr) {
          console.error('upsert error:', upsertErr.message, ev.uid)
          continue
        }
        importedUids.add(ev.uid)
      }

      // Remove bloqueios que sumiram do calendário externo
      const { data: existing } = await supabaseAdmin
        .from('bookings')
        .select('id, ical_uid')
        .eq('property_id', feed.property_id)
        .eq('ical_source', feed.source)
        .not('ical_uid', 'is', null)

      const toDelete = (existing ?? []).filter(b => b.ical_uid && !importedUids.has(b.ical_uid))
      if (toDelete.length) {
        await supabaseAdmin.from('bookings').delete().in('id', toDelete.map(b => b.id))
      }

      // Atualiza timestamp do último sync
      await supabaseAdmin
        .from('ical_feeds')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', feed.id)

      results.push({ source: feed.source, events: events.length, removed: toDelete.length, ok: true })
    } catch (err) {
      results.push({ source: feed.source, error: String(err), ok: false })
    }
  }

  return new Response(
    JSON.stringify({ synced: results.filter(r => r.ok).length, results }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
