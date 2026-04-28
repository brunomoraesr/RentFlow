/* profile.js — Perfil do Usuário */

let _toastTimer = null

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.toggle('prf-toast-error', type === 'error')
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500)
}

function togglePwd(id, btn) {
  const input = document.getElementById(id)
  const isText = input.type === 'text'
  input.type = isText ? 'password' : 'text'
  btn.style.opacity = isText ? '.5' : '1'
}

// ── Init ─────────────────────────────────────────────────────────────────────

let _userEmail = ''

;(async () => {
  const { data: { session } } = await db.auth.getSession()
  if (!session) { window.location.href = 'login.html'; return }

  const user = session.user
  const meta = user.user_metadata || {}

  // Dados já coletados no cadastro
  const firstName = meta.first_name || ''
  const lastName  = meta.last_name  || ''
  _userEmail = user.email || ''

  document.getElementById('firstName').value = firstName
  document.getElementById('lastName').value  = lastName
  document.getElementById('userEmail').value = _userEmail

  updateHero(firstName, lastName, _userEmail)

  document.getElementById('loadingOverlay').style.display = 'none'
})()

function updateHero(firstName, lastName, email) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  document.getElementById('prfHeroName').textContent  = fullName  || 'Sem nome cadastrado'
  document.getElementById('prfHeroEmail').textContent = email     || '—'

  // Avatar: iniciais ou primeiro char do email
  const initials = firstName && lastName
    ? (firstName[0] + lastName[0]).toUpperCase()
    : firstName
      ? firstName[0].toUpperCase()
      : email[0].toUpperCase()
  document.getElementById('prfAvatar').textContent = initials
}

// ── Salvar dados pessoais ─────────────────────────────────────────────────────

async function saveProfile() {
  const firstName = document.getElementById('firstName').value.trim()
  const lastName  = document.getElementById('lastName').value.trim()

  if (!firstName) { showToast('Informe seu nome.', 'error'); return }

  const btn = document.getElementById('btnSaveProfile')
  btn.disabled = true
  btn.textContent = 'Salvando…'

  const { error } = await db.auth.updateUser({
    data: { first_name: firstName, last_name: lastName }
  })

  btn.disabled = false
  btn.textContent = 'Salvar dados'

  if (error) {
    showToast('Erro ao salvar: ' + error.message, 'error')
    return
  }

  updateHero(firstName, lastName, document.getElementById('userEmail').value)
  showToast('Dados atualizados com sucesso!')
}

// ── Alterar senha ─────────────────────────────────────────────────────────────

async function savePassword() {
  const currentPwd = document.getElementById('currentPassword').value
  const newPwd     = document.getElementById('newPassword').value
  const confirmPwd = document.getElementById('confirmPassword').value

  if (!currentPwd)           { showToast('Informe sua senha atual.', 'error'); return }
  if (!newPwd)               { showToast('Informe a nova senha.', 'error'); return }
  if (newPwd.length < 6)     { showToast('A nova senha deve ter ao menos 6 caracteres.', 'error'); return }
  if (newPwd !== confirmPwd) { showToast('As senhas não coincidem.', 'error'); return }
  if (newPwd === currentPwd) { showToast('A nova senha deve ser diferente da atual.', 'error'); return }

  const btn = document.getElementById('btnSavePassword')
  btn.disabled = true
  btn.textContent = 'Verificando…'

  // Valida senha atual via re-autenticação
  const { error: signInErr } = await db.auth.signInWithPassword({
    email: _userEmail,
    password: currentPwd,
  })

  if (signInErr) {
    btn.disabled = false
    btn.textContent = 'Alterar senha'
    showToast('Senha atual incorreta.', 'error')
    return
  }

  btn.textContent = 'Alterando…'
  const { error } = await db.auth.updateUser({ password: newPwd })

  btn.disabled = false
  btn.textContent = 'Alterar senha'

  if (error) {
    showToast('Erro ao alterar senha: ' + error.message, 'error')
    return
  }

  document.getElementById('currentPassword').value = ''
  document.getElementById('newPassword').value     = ''
  document.getElementById('confirmPassword').value = ''
  showToast('Senha alterada com sucesso!')
}
