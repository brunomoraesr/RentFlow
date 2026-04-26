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
  const res = await fetch(`${SUPABASE_FN}/admin-data`, {
    headers: {
      'Authorization': `Bearer ${currentSession.access_token}`,
      'Content-Type':  'application/json',
    },
  })
  if (!res.ok) { showToast('Erro ao carregar dados'); return }

  const data = await res.json()
  renderKpis(data.stats, data.error_logs.length)
  renderUsers(data.users)
  renderLogs(data.error_logs)
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

async function executeConfirm() {
  if (!pendingAction) return
  const action = { ...pendingAction }
  closeConfirmModal()
  await callAction(action)
  await loadData()
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
  const btn = e.target.closest('[data-action]')
  if (!btn) return
  const { action, id, email } = btn.dataset
  if (action && id) askAction(action, id, email ?? '')
})

// Close modals on backdrop click
document.getElementById('inviteModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeInviteModal()
})
document.getElementById('confirmModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeConfirmModal()
})
