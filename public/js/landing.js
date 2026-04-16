// public/js/landing.js
// ─────────────────────────────────────────────────────────
// Lógica completa del Landing Page de LigaMaster
// - Modales "Crear Liga" e "Inscribir Equipo"
// - Buscador de ligas en tiempo real
// - Validación de nombre de equipo (duplicados)
// - Registro vía API + pago simulado
// ─────────────────────────────────────────────────────────

const API = '/api';

// ── Helper functions for localstorage ──────────── 
function getToken() { return localStorage.getItem('ligamaster_token'); }
function getUsuario() { 
  const r = localStorage.getItem('ligamaster_usuario'); 
  return r ? JSON.parse(r) : null; 
}

// ── Estado global ─────────────────────────────────────────
const state = {
  liga: {
    nombre: '', plan: '3 Meses', telefono: '',
    adminNombre: '', adminEmail: '', adminPass: '',
    tenantId: null, usuarioId: null, pagoToken: null
  },
  equipo: {
    ligaId: null, ligaNombre: '', ligaPlan: '',
    nombreEquipo: '', nombreEquipoDisponible: false,
    capitanNombre: '', capitanEmail: '', capitanPass: '',
    categoria: '', precio: 0,
    usuarioId: null, pagoToken: null
  }
};

// ── Toast ─────────────────────────────────────────────────
function toast(msg, tipo = 'success', duracion = 3500) {
  const container = document.getElementById('lm-toast');
  const el = document.createElement('div');
  el.className = `lm-toast-item ${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => el.remove(), 300);
  }, duracion);
}

// ── Helpers de modal ──────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-liga')   resetModalLiga();
  if (id === 'modal-equipo') resetModalEquipo();
}

function showStep(prefix, n) {
  document.querySelectorAll(`[id^="${prefix}-step-"]`).forEach(el => el.classList.remove('active'));
  const step = document.getElementById(`${prefix}-step-${n}`);
  if (step) step.classList.add('active');
}

// ── CTAs — abrir modales ──────────────────────────────────
document.querySelectorAll('#btn-crear-liga-hero, #btn-crear-liga-rol, #btn-crear-liga-cta')
  .forEach(btn => btn?.addEventListener('click', () => openModal('modal-liga')));

document.querySelectorAll('#btn-inscribir-equipo-hero, #btn-inscribir-equipo-rol, #btn-inscribir-equipo-cta')
  .forEach(btn => btn?.addEventListener('click', () => openModal('modal-equipo')));

document.getElementById('footer-crear-liga')?.addEventListener('click', (e) => {
  e.preventDefault(); openModal('modal-liga');
});
document.getElementById('footer-inscribir-equipo')?.addEventListener('click', (e) => {
  e.preventDefault(); openModal('modal-equipo');
});

// Cerrar con botones [data-close]
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// Cerrar al clic en overlay
document.getElementById('modal-liga').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal('modal-liga');
});
document.getElementById('modal-equipo').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal('modal-equipo');
});

// ── NAVBAR: siempre muestra "Iniciar Sesión" — sin lógica de sesión ──
// El index es una página pública. No se modifica el botón de login.

// ══════════════════════════════════════════════════════════
// MODAL CREAR LIGA
// ══════════════════════════════════════════════════════════

const planPrecios = { '3 Meses': 897, '6 Meses': 1554, '1 Año': 2748 };

function resetModalLiga() {
  showStep('liga', 1);
  ['liga-nombre','liga-ciudad','liga-telefono','liga-admin-nombre','liga-admin-email','liga-admin-pass','liga-admin-pass2']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('liga-plan').value = '3 Meses';
  Object.assign(state.liga, { nombre:'', plan:'3 Meses', tenantId:null, usuarioId:null, pagoToken:null });
}

// Paso 1 → 2
document.getElementById('liga-next-1').addEventListener('click', () => {
  const nombre = document.getElementById('liga-nombre').value.trim();
  const plan   = document.getElementById('liga-plan').value;
  if (!nombre) { toast('El nombre de tu liga es requerido.', 'error'); return; }
  state.liga.nombre    = nombre;
  state.liga.plan      = plan;
  state.liga.telefono  = document.getElementById('liga-telefono').value.trim();
  document.getElementById('liga-pago-monto').textContent = `$${planPrecios[plan]}`;
  showStep('liga', 2);
});

document.getElementById('liga-back-2').addEventListener('click', () => showStep('liga', 1));

document.getElementById('liga-next-2').addEventListener('click', async () => {
  const nombre = document.getElementById('liga-admin-nombre').value.trim();
  const email  = document.getElementById('liga-admin-email').value.trim();
  const pass   = document.getElementById('liga-admin-pass').value;
  const pass2  = document.getElementById('liga-admin-pass2').value;

  if (!nombre || !email || !pass)  { toast('Completa todos los campos requeridos.', 'error'); return; }
  if (pass.length < 6)             { toast('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
  if (pass !== pass2)              { toast('Las contraseñas no coinciden.', 'error'); return; }

  const btn = document.getElementById('liga-next-2');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Creando cuenta...';

  try {
    const resp = await fetch(`${API}/auth/registro-organizador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre, email, password: pass,
        nombre_liga: state.liga.nombre,
        telefono: state.liga.telefono,
        plan: state.liga.plan
      })
    });
    const data = await resp.json();
    if (!resp.ok) { toast(data.error || 'Error al crear la cuenta.', 'error'); return; }

    state.liga.tenantId  = data.tenant_id;
    state.liga.usuarioId = data.usuario_id;
    state.liga.pagoToken = data.token;
    state.liga.adminEmail = email;

    showStep('liga', 3);
    toast('Cuenta creada. Completa el pago para activar tu liga.', 'info');
  } catch (err) {
    toast('No se pudo conectar al servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Siguiente →';
  }
});

document.getElementById('liga-back-3').addEventListener('click', () => showStep('liga', 2));

document.getElementById('liga-pagar').addEventListener('click', async () => {
  const btn = document.getElementById('liga-pagar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Procesando...';

  try {
    const resp = await fetch(`${API}/auth/simular-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'organizador', tenant_id: state.liga.tenantId })
    });
    const data = await resp.json();
    if (!resp.ok) { toast(data.error || 'Error en el pago.', 'error'); return; }

    document.getElementById('liga-success-msg').textContent =
      `¡Tu liga "${state.liga.nombre}" está activa! Inicia sesión con ${state.liga.adminEmail} para empezar.`;
    showStep('liga', 4);
  } catch (err) {
    toast('Error al procesar el pago.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✅ Confirmar y Activar';
  }
});

document.querySelectorAll('#modal-liga .pago-method').forEach(m => {
  m.addEventListener('click', () => {
    document.querySelectorAll('#modal-liga .pago-method').forEach(x => x.classList.remove('selected'));
    m.classList.add('selected');
  });
});

// ══════════════════════════════════════════════════════════
// MODAL INSCRIBIR EQUIPO
// ══════════════════════════════════════════════════════════

function resetModalEquipo() {
  showStep('equipo', 1);
  document.getElementById('liga-search-input').value = '';
  document.getElementById('liga-search-results').classList.remove('visible');
  document.getElementById('liga-search-results').innerHTML = '';
  document.getElementById('liga-selected-container').style.display = 'none';
  document.getElementById('equipo-nombre').value = '';
  document.getElementById('equipo-nombre-status').style.display = 'none';
  document.getElementById('equipo-next-1').disabled = true;
  document.getElementById('equipo-next-2').disabled = true;
  ['capitan-nombre','capitan-email','capitan-pass','capitan-pass2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  Object.assign(state.equipo, {
    ligaId:null, ligaNombre:'', ligaPlan:'',
    nombreEquipo:'', nombreEquipoDisponible:false,
    capitanNombre:'', capitanEmail:'', capitanPass:'',
    usuarioId:null, pagoToken:null
  });
}

let searchTimeout;
const searchInput   = document.getElementById('liga-search-input');
const searchResults = document.getElementById('liga-search-results');

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 1) {
    searchResults.classList.remove('visible');
    searchResults.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(() => buscarLigas(q), 300);
});

async function buscarLigas(q) {
  searchResults.innerHTML = '<div style="padding:12px 16px; font-size:13px; color:var(--text2);">Buscando...</div>';
  searchResults.classList.add('visible');
  try {
    const resp = await fetch(`${API}/public/ligas?q=${encodeURIComponent(q)}`);
    const data = await resp.json();
    renderLigas(data.ligas || []);
  } catch {
    searchResults.innerHTML = '<div style="padding:12px 16px; font-size:13px; color:var(--text2);">Error al buscar ligas.</div>';
  }
}

function renderLigas(ligas) {
  if (!ligas.length) {
    searchResults.innerHTML = '<div style="padding:12px 16px; font-size:13px; color:var(--text2); text-align:center;">No se encontraron ligas activas.</div>';
    return;
  }
  searchResults.innerHTML = ligas.map(l => `
    <div class="liga-result-item" data-id="${l.id}" data-nombre="${escapeHtml(l.nombre_liga)}" data-plan="${l.plan}">
      <div class="liga-result-icon">🏆</div>
      <div class="liga-result-info">
        <div class="name">${escapeHtml(l.nombre_liga)}</div>
        <div class="meta">Plan ${l.plan} · ${l.email_contacto}</div>
      </div>
    </div>
  `).join('');

  searchResults.querySelectorAll('.liga-result-item').forEach(item => {
    item.addEventListener('click', () => seleccionarLiga(
      parseInt(item.dataset.id),
      item.dataset.nombre,
      item.dataset.plan
    ));
  });
}

async function seleccionarLiga(id, nombre, plan) {
  state.equipo.ligaId    = id;
  state.equipo.ligaNombre = nombre;
  state.equipo.ligaPlan  = plan;

  document.getElementById('liga-selected-name').textContent = nombre;
  document.getElementById('liga-selected-plan').textContent = `Plan ${plan}`;
  document.getElementById('liga-selected-container').style.display = 'block';
  document.getElementById('liga-search-input').value = nombre;
  searchResults.classList.remove('visible');
  document.getElementById('equipo-next-1').disabled = false;
  
  // Cargar categorías preventivamente
  const catSel = document.getElementById('equipo-categoria');
  catSel.innerHTML = '<option value="">Cargando categorías...</option>';
  try {
    const resp = await fetch(`${API}/public/liga-config?tenant_id=${id}`);
    const data = await resp.json();
    const allCats = [...(data.categorias_soccer || []), ...(data.categorias_fut7 || [])];
    if (allCats.length === 0) {
      catSel.innerHTML = '<option value="Única">Categoría Única</option>';
      state.equipo.categoria = 'Única';
      state.equipo.precio = 0;
    } else {
      catSel.innerHTML = '<option value="">Selecciona una categoría...</option>';
      allCats.forEach(c => {
        catSel.innerHTML += `<option value="${c.name}" data-price="${c.price}">${c.name} — $${c.price}</option>`;
      });
    }
  } catch (err) {
    catSel.innerHTML = '<option value="">Error al cargar categorías</option>';
  }

  toast(`Liga "${nombre}" seleccionada.`, 'success', 2000);
}

document.getElementById('btn-cambiar-liga').addEventListener('click', () => {
  state.equipo.ligaId    = null;
  state.equipo.ligaNombre = '';
  document.getElementById('liga-selected-container').style.display = 'none';
  document.getElementById('liga-search-input').value = '';
  document.getElementById('equipo-next-1').disabled = true;
  searchInput.focus();
});

document.getElementById('equipo-next-1').addEventListener('click', () => {
  if (!state.equipo.ligaId) { toast('Selecciona una liga primero.', 'error'); return; }
  document.getElementById('equipo-liga-label').textContent = state.equipo.ligaNombre;
  document.getElementById('equipo-nombre').value = '';
  document.getElementById('equipo-nombre-status').style.display = 'none';
  showStep('equipo', 2);
});

document.getElementById('equipo-categoria').addEventListener('change', (e) => {
  const opt = e.target.options[e.target.selectedIndex];
  state.equipo.categoria = e.target.value;
  state.equipo.precio = opt ? (parseFloat(opt.dataset.price) || 0) : 0;
  
  // Actualizar el monto de pago (aunque se muestra en el paso 4, lo seteamos ya)
  document.getElementById('equipo-pago-monto').textContent = `$${state.equipo.precio}`;
  
  // Validar si podemos seguir
  const nextBtn = document.getElementById('equipo-next-2');
  nextBtn.disabled = !(state.equipo.nombreEquipoDisponible && state.equipo.categoria);
});

document.getElementById('equipo-back-2').addEventListener('click', () => showStep('equipo', 1));

let checkTimeout;
document.getElementById('equipo-nombre').addEventListener('input', () => {
  clearTimeout(checkTimeout);
  const nombre = document.getElementById('equipo-nombre').value.trim();
  const statusEl = document.getElementById('equipo-nombre-status');
  const nextBtn  = document.getElementById('equipo-next-2');

  if (!nombre) {
    statusEl.style.display = 'none';
    nextBtn.disabled = true;
    return;
  }

  statusEl.style.display = 'flex';
  statusEl.className = 'nombre-status loading';
  statusEl.textContent = '⏳ Verificando disponibilidad...';
  nextBtn.disabled = true;

  checkTimeout = setTimeout(() => verificarNombreEquipo(nombre, statusEl, nextBtn), 500);
});

async function verificarNombreEquipo(nombre, statusEl, nextBtn) {
  try {
    const resp = await fetch(
      `${API}/public/check-equipo?tenant_id=${state.equipo.ligaId}&nombre=${encodeURIComponent(nombre)}`
    );
    const data = await resp.json();
    if (data.disponible) {
      statusEl.className = 'nombre-status ok';
      statusEl.innerHTML = '✅ ¡Nombre disponible! Puedes usar este nombre.';
      state.equipo.nombreEquipo = nombre;
      state.equipo.nombreEquipoDisponible = true;
      nextBtn.disabled = false;
    } else {
      statusEl.className = 'nombre-status taken';
      statusEl.innerHTML = '❌ Ese nombre ya está en uso. Elige otro nombre para tu equipo.';
      state.equipo.nombreEquipoDisponible = false;
      nextBtn.disabled = true;
    }
  } catch {
    statusEl.className = 'nombre-status loading';
    statusEl.textContent = '⚠️ No se pudo verificar. Intenta de nuevo.';
    nextBtn.disabled = true;
  }
}

document.getElementById('equipo-next-2').addEventListener('click', () => {
  if (!state.equipo.nombreEquipoDisponible) { toast('El nombre de equipo no está disponible.', 'error'); return; }
  showStep('equipo', 3);
});

document.getElementById('equipo-back-3').addEventListener('click', () => showStep('equipo', 2));

document.getElementById('equipo-next-3').addEventListener('click', async () => {
  const nombre = document.getElementById('capitan-nombre').value.trim();
  const email  = document.getElementById('capitan-email').value.trim();
  const pass   = document.getElementById('capitan-pass').value;
  const pass2  = document.getElementById('capitan-pass2').value;

  if (!nombre || !email || !pass) { toast('Completa todos los campos.', 'error'); return; }
  if (pass.length < 6)            { toast('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
  if (pass !== pass2)             { toast('Las contraseñas no coinciden.', 'error'); return; }

  const btn = document.getElementById('equipo-next-3');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Registrando...';

  try {
    const resp = await fetch(`${API}/auth/registro-capitan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre, email, password: pass,
        nombre_equipo: state.equipo.nombreEquipo,
        tenant_id: state.equipo.ligaId,
        categoria: state.equipo.categoria
      })
    });
    const data = await resp.json();
    if (!resp.ok) { toast(data.error || 'Error al registrar.', 'error'); return; }

    state.equipo.usuarioId  = data.usuario_id;
    state.equipo.pagoToken  = data.token;
    state.equipo.capitanEmail = email;
    showStep('equipo', 4);
  } catch (err) {
    toast('No se pudo conectar al servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Siguiente →';
  }
});

document.getElementById('equipo-back-4').addEventListener('click', () => showStep('equipo', 3));

document.getElementById('equipo-pagar').addEventListener('click', async () => {
  const btn = document.getElementById('equipo-pagar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Procesando...';

  try {
    const resp = await fetch(`${API}/auth/simular-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'capitan', usuario_id: state.equipo.usuarioId })
    });
    const data = await resp.json();
    if (!resp.ok) { toast(data.error || 'Error en el pago.', 'error'); return; }

    document.getElementById('equipo-success-msg').textContent =
      `¡Tu equipo "${state.equipo.nombreEquipo}" está inscrito en "${state.equipo.ligaNombre}"! ` +
      `Inicia sesión con ${state.equipo.capitanEmail} para agregar tus jugadores.`;
    showStep('equipo', 5);
  } catch {
    toast('Error al procesar el pago.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✅ Confirmar y Activar';
  }
});

document.querySelectorAll('#modal-equipo .pago-method').forEach(m => {
  m.addEventListener('click', () => {
    document.querySelectorAll('#modal-equipo .pago-method').forEach(x => x.classList.remove('selected'));
    m.classList.add('selected');
  });
});

// ── Navbar: scroll effect ─────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 40) {
    nav.style.background = 'rgba(8,12,20,0.98)';
  } else {
    nav.style.background = 'rgba(8,12,20,0.85)';
  }
});

// ── Smooth scroll para links del navbar ──────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Escape para cerrar modales ────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('modal-liga');
    closeModal('modal-equipo');
  }
});

// ── Helper: sanitizar HTML ────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

console.log('🚀 LigaMaster Landing cargado correctamente.');
