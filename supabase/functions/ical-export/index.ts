import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function foldLine(line: string): string {
  const MAX = 75
  if (line.length <= MAX) return line
  let out = ''
  while (line.length > MAX) {
    out += line.slice(0, MAX) + '\r\n '
    line = line.slice(MAX)
  }
  return out + line
}

function formatDate(iso: string): string {
  return iso.replace(/-/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response('Token ausente', { status: 400, headers: CORS })
  }

  // Busca token → property_id
  const { data: tk, error: tkErr } = await supabase
    .from('ical_tokens')
    .select('property_id')
    .eq('token', token)
    .single()

  if (tkErr || !tk) {
    return new Response('Token inválido', { status: 401, headers: CORS })
  }

  // Busca reservas do imóvel (exceto canceladas)
  const { data: bookings, error: bkErr } = await supabase
    .from('bookings')
    .select('id, guest, checkin, checkout, source, notes')
    .eq('property_id', tk.property_id)
    .not('source', 'eq', 'cancelled')
    .order('checkin')

  if (bkErr) {
    return new Response('Erro ao buscar reservas', { status: 500, headers: CORS })
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RentFlow//RentFlow//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:RentFlow',
  ]

  for (const b of bookings ?? []) {
    const summary = b.source === 'blocked'
      ? `Bloqueado${b.notes ? ' - ' + b.notes : ''}`
      : `Reservado - ${b.guest}`

    lines.push(
      'BEGIN:VEVENT',
      foldLine(`UID:rentflow-${b.id}@rentflow`),
      `DTSTART;VALUE=DATE:${formatDate(b.checkin)}`,
      `DTEND;VALUE=DATE:${formatDate(b.checkout)}`,
      foldLine(`SUMMARY:${summary}`),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      ...CORS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rentflow.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
})
