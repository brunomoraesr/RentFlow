/* ── Admin Panel ── */

const SUPABASE_FN = SUPABASE_URL + '/functions/v1'

let currentSession = null
let pendingAction  = null   // { action, target_id, label }
let allUsers       = []     // cache para filtro de busca

// ── Init ─────────────────────────────────────────────────────────────────────

;(async () => {
  const { data: { session } } = await db.auth.getSession()
  if (!session) { window.location.href = 'login.html'; return }

  const meta = session.user?.app_metadata
  if (meta?.role !== 'admin') {
    document.getElementById('loadingOverlay').innerHTML =
      '<span style="font-size:15px;color:#c73b4b">Acesso negado. Você não é administrador.</span>'
    return
  }

  currentSession = session
  await loadData()
  document.getElementById('loadingOverlay').style.display = 'none'
})()

// ── Load data ─────────────────────────────────────────────────────────────────

async function loadData() {
  const [res, propsRes] = await Promise.all([
    fetch(`${SUPABASE_FN}/admin-data`, {
      headers: {
        'Authorization': `Bearer ${currentSession.access_token}`,
        'Content-Type':  'application/json',
      },
    }),
    db.from('properties').select('type, location'),
  ])

  if (!res.ok) { showToast('Erro ao carregar dados'); return }

  const data = await res.json()
  renderKpis(data.stats, data.error_logs.length)
  renderCities(propsRes.data || [])
  renderUsers(data.users)
  renderLogs(data.error_logs)
  await loadEvents()
}

// ── Cities by property ────────────────────────────────────────────────────────

function renderCities(properties) {
  const TYPE_ICONS = { 'Casa': '🏡', 'Apartamento': '🏙️', 'Chalé': '🌿', 'Flat/Studio': '🛋️' }

  const cityMap = {}
  for (const p of properties) {
    const raw = (p.location || '').trim()
    if (!raw) continue
    const [rawCity, rawUf] = raw.split(',')
    const city = rawCity.trim()
    const uf   = rawUf ? rawUf.trim() : ''
    // Chave normalizada para evitar duplicatas por espaçamento diferente
    const key  = `${city.toLowerCase()}|${uf.toLowerCase()}`
    const displayLoc = uf ? `${city}, ${uf}` : city
    if (!cityMap[key]) cityMap[key] = { city, uf, loc: displayLoc, types: {}, total: 0 }
    const type = p.type || 'Casa'
    cityMap[key].types[type] = (cityMap[key].types[type] || 0) + 1
    cityMap[key].total++
  }

  const cities = Object.values(cityMap).sort((a, b) => b.total - a.total)
  document.getElementById('citiesCount').textContent = cities.length

  if (!cities.length) {
    document.getElementById('citiesWrap').innerHTML =
      '<div class="adm-empty">Nenhum imóvel cadastrado pelos usuários ainda.</div>'
    return
  }

  const rows = cities.map(c => {
    const typePills = Object.entries(c.types)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) =>
        `<span class="city-type-pill">${TYPE_ICONS[type] || '🏠'} ${esc(type)} <strong>×${count}</strong></span>`
      ).join('')

    return `
      <div class="city-row">
        <div class="city-head">
          <span class="city-name">${esc(c.city)}</span>
          ${c.uf ? `<span class="city-uf">${esc(c.uf)}</span>` : ''}
          <span class="city-total">${c.total} ${c.total !== 1 ? 'imóveis' : 'imóvel'}</span>
        </div>
        <div class="city-types">${typePills}</div>
        <div class="adm-actions">
          <button class="btn-act btn-act-edit" data-city-loc="${esc(c.loc)}">+ Evento</button>
        </div>
      </div>`
  }).join('')

  document.getElementById('citiesWrap').innerHTML =
    `<div class="adm-table-wrap" style="padding:0">${rows}</div>`
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function renderKpis(stats, errorCount) {
  document.getElementById('kpiUsers').textContent = stats.total_users
  document.getElementById('kpiUsersActive').textContent =
    `${stats.active_users} ativo${stats.active_users !== 1 ? 's' : ''} nos últimos 30 dias`
  document.getElementById('kpiRevenue').textContent =
    'R$ ' + stats.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  document.getElementById('kpiErrors').textContent = errorCount
}

// ── Users table ───────────────────────────────────────────────────────────────

function filterUsers() {
  const q = document.getElementById('usersSearch').value.trim().toLowerCase()
  const filtered = q
    ? allUsers.filter(u =>
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      )
    : allUsers
  renderUsersTable(filtered)
}

function renderUsersTable(users) {
  if (!users.length) {
    document.getElementById('usersWrap').innerHTML =
      '<div class="adm-empty">Nenhum usuário encontrado.</div>'
    return
  }

  const rows = users.map(u => {
    const joinedAt    = formatDate(u.created_at)
    const lastSignIn  = u.last_sign_in_at ? formatDate(u.last_sign_in_at) : '—'
    const statusBadge = u.banned
      ? '<span class="badge badge-banned">Bloqueado</span>'
      : (u.role === 'admin'
        ? '<span class="badge badge-admin">Admin</span>'
        : '<span class="badge badge-ok">Ativo</span>')
    const revenue = 'R$ ' + u.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

    const banBtn = u.role !== 'admin'
      ? (u.banned
        ? `<button class="btn-act btn-act-unban" data-action="unban" data-id="${esc(u.id)}" data-email="${esc(u.email)}">Desbloquear</button>`
        : `<button class="btn-act btn-act-ban"   data-action="ban"   data-id="${esc(u.id)}" data-email="${esc(u.email)}">Bloquear</button>`)
      : ''

    const delBtn = u.role !== 'admin'
      ? `<button class="btn-act btn-act-del" data-action="delete" data-id="${esc(u.id)}" data-email="${esc(u.email)}">Remover</button>`
      : ''

    return `
      <tr>
        <td class="email-cell">${esc(u.email ?? '—')}</td>
        <td>${statusBadge}</td>
        <td>${esc(u.phone ?? '—')}</td>
        <td class="mono">${joinedAt}</td>
        <td class="mono">${lastSignIn}</td>
        <td>${u.properties}</td>
        <td class="mono">${revenue}</td>
        <td><div class="adm-actions">${banBtn}${delBtn}</div></td>
      </tr>`
  }).join('')

  document.getElementById('usersWrap').innerHTML = `
    <div class="adm-scroll-hint">← deslize para ver mais →</div>
    <div class="adm-table-scroll">
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Status</th>
              <th>Celular</th>
              <th>Cadastro</th>
              <th>Último acesso</th>
              <th>Imóveis</th>
              <th>Receita</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}

function renderUsers(users) {
  allUsers = users
  document.getElementById('usersCount').textContent = users.length
  renderUsersTable(users)
}

// ── Error logs ────────────────────────────────────────────────────────────────

function renderLogs(logs) {
  document.getElementById('logsCount').textContent = logs.length

  if (!logs.length) {
    document.getElementById('logsWrap').innerHTML =
      '<div class="adm-empty">Nenhum erro registrado.</div>'
    return
  }

  const rows = logs.map(log => {
    const ctx = log.context ? JSON.stringify(log.context) : '—'
    return `
      <tr>
        <td class="mono" style="white-space:nowrap">${formatDate(log.created_at)}</td>
        <td>${esc(log.user_email)}</td>
        <td><span class="log-type">${esc(log.error_type)}</span></td>
        <td><span class="log-msg" title="${esc(log.message)}">${esc(log.message)}</span></td>
        <td><span class="log-ctx" title="${esc(ctx)}">${esc(ctx)}</span></td>
      </tr>`
  }).join('')

  document.getElementById('logsWrap').innerHTML = `
    <div class="adm-scroll-hint">← deslize para ver mais →</div>
    <div class="adm-table-scroll">
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Usuário</th>
              <th>Tipo</th>
              <th>Mensagem</th>
              <th>Contexto</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}

// ── Actions ───────────────────────────────────────────────────────────────────

function askAction(action, targetId, email) {
  pendingAction = { action, target_id: targetId }
  const labels = {
    ban:    ['Bloquear usuário', `Deseja bloquear ${email}? O usuário não conseguirá mais fazer login.`],
    unban:  ['Desbloquear usuário', `Deseja desbloquear ${email}?`],
    delete: ['Remover usuário', `Deseja remover permanentemente ${email}? Esta ação não pode ser desfeita.`],
  }
  const [title, desc] = labels[action] || ['Confirmar', '']
  document.getElementById('confirmTitle').textContent = title
  document.getElementById('confirmDesc').textContent  = desc
  document.getElementById('confirmModal').classList.add('open')
}

function closeConfirmModal() {
  pendingAction = null
  document.getElementById('confirmModal').classList.remove('open')
}

async function callAction(payload) {
  const res = await fetch(`${SUPABASE_FN}/admin-action`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${currentSession.access_token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) {
    showToast('Erro: ' + (json.error ?? res.status))
  } else {
    const msgs = { ban: 'Usuário bloqueado', unban: 'Usuário desbloqueado', delete: 'Usuário removido', invite: 'Convite enviado!' }
    showToast(msgs[payload.action] ?? 'Feito!')
  }
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function openInviteModal() {
  document.getElementById('inviteEmail').value = ''
  document.getElementById('inviteModal').classList.add('open')
}

function closeInviteModal() {
  document.getElementById('inviteModal').classList.remove('open')
}

async function confirmInvite() {
  const email = document.getElementById('inviteEmail').value.trim()
  if (!email) { showToast('Informe um e-mail'); return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('E-mail inválido'); return }
  const btn = document.querySelector('#inviteModal .btn-modal-confirm')
  btn.disabled = true
  btn.textContent = 'Enviando…'
  try {
    await callAction({ action: 'invite', email })
    closeInviteModal()
    await loadData()
  } finally {
    btn.disabled = false
    btn.textContent = 'Enviar convite'
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

let toastTimer = null
function showToast(msg) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000)
}

// Delegated action buttons (avoids XSS via inline onclick string interpolation)
document.addEventListener('click', e => {
  const actBtn = e.target.closest('[data-action]')
  if (actBtn) {
    const { action, id, email } = actBtn.dataset
    if (action && id) askAction(action, id, email ?? '')
    return
  }

  const cityBtn = e.target.closest('[data-city-loc]')
  if (cityBtn) {
    openEventModal()
    document.getElementById('evLocation').value = cityBtn.dataset.cityLoc
  }
})

// Close modals on backdrop click
document.getElementById('inviteModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeInviteModal()
})
document.getElementById('confirmModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeConfirmModal()
})
document.getElementById('eventModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEventModal()
})

// ── Events CRUD ───────────────────────────────────────────────────────────────

let editingEventId = null
const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

async function loadEvents() {
  const { data, error } = await db.from('events').select('*').order('date_start')
  if (error) {
    document.getElementById('eventsWrap').innerHTML =
      '<div class="adm-empty">Tabela de eventos não encontrada. Crie-a no Supabase primeiro.</div>'
    document.getElementById('eventsCount').textContent = '0'
    return
  }
  renderAdminEvents(data || [])
}

function renderAdminEvents(events) {
  document.getElementById('eventsCount').textContent = events.length

  if (!events.length) {
    document.getElementById('eventsWrap').innerHTML =
      '<div class="adm-empty">Nenhum evento cadastrado.</div>'
    return
  }

  const rows = events.map(ev => {
    const d     = new Date(ev.date_start + 'T00:00:00')
    const day   = d.getDate()
    const mon   = MONTHS_SHORT[d.getMonth()]
    const catLbl = ev.category === 'contest' ? 'Concurso' : 'Evento'
    const catCls = ev.category === 'contest' ? 'badge-contest' : 'badge-event'
    return `
      <div class="adm-event-row">
        <div class="adm-event-date">${day}<br>${mon}</div>
        <div class="adm-event-body">
          <div class="adm-event-name">${esc(ev.title)}</div>
          <div class="adm-event-meta">
            <span class="badge ${catCls}">${catLbl}</span>
            &nbsp;📍 ${esc(ev.location)}
            ${ev.description ? ' — ' + esc(ev.description.slice(0,80)) + (ev.description.length > 80 ? '…' : '') : ''}
          </div>
        </div>
        <div class="adm-actions">
          <button class="btn-act btn-act-edit" onclick="openEventModal('${esc(ev.id)}')">Editar</button>
          <button class="btn-act btn-act-del"  onclick="askDeleteEvent('${esc(ev.id)}', '${esc(ev.title)}')">Excluir</button>
        </div>
      </div>`
  }).join('')

  document.getElementById('eventsWrap').innerHTML =
    `<div class="adm-table-wrap" style="padding:0">${rows}</div>`
}

function openEventModal(id) {
  editingEventId = id || null
  const isEdit = !!editingEventId

  document.getElementById('eventModalTitle').textContent = isEdit ? 'Editar Evento' : 'Adicionar Evento'
  document.getElementById('btnSaveEvent').textContent    = isEdit ? 'Salvar alterações' : 'Salvar'

  if (isEdit) {
    db.from('events').select('*').eq('id', editingEventId).single().then(({ data }) => {
      if (!data) return
      document.getElementById('evTitle').value     = data.title      || ''
      document.getElementById('evCategory').value  = data.category   || 'event'
      document.getElementById('evLocation').value  = data.location   || ''
      document.getElementById('evDateStart').value = data.date_start || ''
      document.getElementById('evDateEnd').value   = data.date_end   || ''
      document.getElementById('evDesc').value      = data.description || ''
    })
  } else {
    document.getElementById('evTitle').value     = ''
    document.getElementById('evCategory').value  = 'event'
    document.getElementById('evLocation').value  = ''
    document.getElementById('evDateStart').value = ''
    document.getElementById('evDateEnd').value   = ''
    document.getElementById('evDesc').value      = ''
  }
  document.getElementById('eventModal').classList.add('open')
  initCityAutocomplete(document.getElementById('evLocation'))
}

function closeEventModal() {
  editingEventId = null
  document.getElementById('eventModal').classList.remove('open')
}

async function saveEvent() {
  const title     = document.getElementById('evTitle').value.trim()
  const category  = document.getElementById('evCategory').value
  const location  = document.getElementById('evLocation').value.trim()
  const dateStart = document.getElementById('evDateStart').value
  const dateEnd   = document.getElementById('evDateEnd').value || null
  const desc      = document.getElementById('evDesc').value.trim() || null

  if (!title)     { showToast('Informe o título do evento'); return }
  if (!location)  { showToast('Informe a localização'); return }
  if (!dateStart) { showToast('Informe a data de início'); return }

  const btn = document.getElementById('btnSaveEvent')
  btn.disabled = true

  const payload = { title, category, location, date_start: dateStart, date_end: dateEnd, description: desc }

  let error
  if (editingEventId) {
    ({ error } = await db.from('events').update(payload).eq('id', editingEventId))
  } else {
    ({ error } = await db.from('events').insert(payload))
  }

  btn.disabled = false
  if (error) { showToast('Erro ao salvar: ' + error.message); return }

  showToast(editingEventId ? 'Evento atualizado!' : 'Evento adicionado!')
  closeEventModal()
  await loadEvents()
}

function askDeleteEvent(id, title) {
  pendingAction = { action: '_deleteEvent', event_id: id }
  document.getElementById('confirmTitle').textContent = 'Excluir evento'
  document.getElementById('confirmDesc').textContent  = `Deseja excluir "${title}"? Esta ação não pode ser desfeita.`
  document.getElementById('confirmModal').classList.add('open')
}

async function executeConfirm() {
  if (!pendingAction) return
  const action = { ...pendingAction }
  closeConfirmModal()
  if (action.action === '_deleteEvent') {
    const { error } = await db.from('events').delete().eq('id', action.event_id)
    if (error) { showToast('Erro ao excluir: ' + error.message); return }
    showToast('Evento excluído!')
    await loadEvents()
  } else {
    await callAction(action)
    await loadData()
  }
}
