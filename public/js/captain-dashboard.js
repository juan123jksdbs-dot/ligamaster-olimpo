// public/js/captain-dashboard.js
// ─────────────────────────────────────────────────────────
// Lógica del Panel del Capitán
// ─────────────────────────────────────────────────────────



// ── Autenticación ─────────────────────────────────────────
const token   = localStorage.getItem('ligamaster_token');
const usuario = JSON.parse(localStorage.getItem('ligamaster_usuario') || 'null');

if (!token || !usuario || usuario.rol !== 'capitan') {
  window.location.href = '/login.html';
}

const authHeaders = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// ── Estado ────────────────────────────────────────────────
let allJugadores = [];
let editingId    = null;

// ── Sidebar: usuario info ─────────────────────────────────
document.getElementById('sidebar-user-name').textContent  = usuario?.nombre || '—';
document.getElementById('sidebar-equipo-name').textContent = usuario?.nombre_equipo
  ? `⚽ ${usuario.nombre_equipo}`
  : usuario?.nombre_liga ? `🏆 ${usuario.nombre_liga}` : '—';

// ── Cerrar sesión ─────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/login.html';
});

// ── Navegación de secciones ──────────────────────────────
function showSection(name) {
  document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
  const target = document.getElementById(`section-${name}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.section === name);
  });

  // Cargar datos según sección
  if (name === 'equipo')       loadDashboard();
  if (name === 'jugadores')    loadJugadores();
  if (name === 'suscripcion')  loadPerfil();
}

document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(a.dataset.section);
  });
});

// Botón "Ver todos" redirige a la sección jugadores
document.getElementById('btn-ver-todos').addEventListener('click', () => showSection('jugadores'));

// ── CARGA INICIAL ─────────────────────────────────────────
(async () => {
  await loadDashboard();
  verificarCategoria();
})();

// ══════════════════════════════════════════════════════════
// DASHBOARD (Inicio)
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    // Cargar info del equipo
    const r1 = await fetch(`${API}/capitan/mi-equipo`, { headers: authHeaders });
    if (r1.status === 401 || r1.status === 403) { logout(); return; }
    if (r1.ok) {
      const d1 = await r1.json();
      const eq = d1.equipo;
      document.getElementById('equipo-nombre-display').textContent = eq.nombre || '—';
      document.getElementById('equipo-liga-tag').textContent = `🏆 ${eq.nombre_liga || '—'} · Plan ${eq.plan || '—'}`;
      document.getElementById('equipo-torneo-display').textContent =
        eq.torneo_nombre ? `📋 Torneo: ${eq.torneo_nombre} (${eq.torneo_estatus})` : '📋 Sin torneo asignado';
      
      // Mostrar categoría en el tag si existe
      if (eq.categoria) {
        document.getElementById('equipo-liga-tag').textContent += ` · ${eq.categoria}`;
      }
    }

    // Cargar jugadores para métricas
    const r2 = await fetch(`${API}/capitan/jugadores`, { headers: authHeaders });
    if (r2.ok) {
      const d2 = await r2.json();
      allJugadores = d2.jugadores || [];
      updateMetrics();
      renderMiniTable();
    }
  } catch (err) {
    console.error('Error al cargar dashboard:', err);
  }
}

function updateMetrics() {
  const total = allJugadores.length;
  const conDocs = allJugadores.filter(j => j.ine_pdf_url && j.acta_pdf_url).length;
  const sinDocs = total - conDocs;

  document.getElementById('metric-jugadores').textContent  = total;
  document.getElementById('metric-docs').textContent       = conDocs;
  document.getElementById('metric-pendientes').textContent = sinDocs;
}

function renderMiniTable() {
  const tbody = document.getElementById('mini-jugadores-tbody');
  const recent = allJugadores.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text2); padding:30px;">
      No hay jugadores registrados aún.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(j => jugadorMiniRow(j)).join('');
}

function jugadorMiniRow(j) {
  const fotoHtml = j.foto_url
    ? `<div class="jugador-avatar"><img src="${j.foto_url}" alt="${escHtml(j.nombre)}"></div>`
    : `<div class="jugador-avatar">👤</div>`;

  return `<tr>
    <td>
      <div class="jugador-info">
        ${fotoHtml}
        <div>
          <div class="jugador-nombre">${escHtml(j.nombre)}</div>
          <div class="jugador-numero">#${j.numero_camiseta || '—'}</div>
        </div>
      </div>
    </td>
    <td>${j.posicion ? posEmoji(j.posicion) + ' ' + j.posicion : '—'}</td>
    <td>${docBadge(j.foto_url, '📷')}</td>
    <td>${docBadge(j.ine_pdf_url, '🪪')}</td>
    <td>${docBadge(j.acta_pdf_url, '📜')}</td>
  </tr>`;
}

// ══════════════════════════════════════════════════════════
// JUGADORES
// ══════════════════════════════════════════════════════════
async function loadJugadores() {
  const tbody = document.getElementById('jugadores-tbody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text2); padding:40px;">Cargando...</td></tr>`;
  try {
    const r = await fetch(`${API}/capitan/jugadores`, { headers: authHeaders });
    if (!r.ok) throw new Error('Error al cargar jugadores');
    const data = await r.json();
    allJugadores = data.jugadores || [];
    renderJugadoresTable(allJugadores);
    updateMetrics();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--danger); padding:40px;">${err.message}</td></tr>`;
  }
}

function renderJugadoresTable(jugadores) {
  const tbody = document.getElementById('jugadores-tbody');
  if (!jugadores.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>No tienes jugadores registrados todavía.<br>¡Agrega tu primer jugador!</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = jugadores.map(j => jugadorRow(j)).join('');
  // Eventos de editar
  tbody.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => abrirEditar(parseInt(btn.dataset.edit)))
  );
  // Ver PDF
  tbody.querySelectorAll('[data-pdf]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(link.dataset.pdf, '_blank');
    });
  });
}

function jugadorRow(j) {
  const fotoHtml = j.foto_url
    ? `<div class="jugador-avatar"><img src="${j.foto_url}" alt="${escHtml(j.nombre)}"></div>`
    : `<div class="jugador-avatar">👤</div>`;

  const nacimiento = j.fecha_nacimiento
    ? new Date(j.fecha_nacimiento).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
    : '—';

  let estatusBadge = '';
  if (j.estatus === 'pendiente') {
    estatusBadge = '<span style="background:var(--yellow); color:#000; padding:3px 8px; border-radius:12px; font-size:0.8rem">Pendiente</span>';
  } else if (j.estatus === 'autorizado') {
    estatusBadge = '<span style="background:var(--cap-green2); color:#fff; padding:3px 8px; border-radius:12px; font-size:0.8rem">Autorizado</span>';
  } else if (j.estatus === 'rechazado') {
    estatusBadge = `<span style="background:var(--danger); color:#fff; padding:3px 8px; border-radius:12px; font-size:0.8rem; cursor:help;" title="${j.observaciones||'Sin observaciones'}">Rechazado ℹ️</span>`;
  } else if (j.estatus === 'Baja Solicitada') {
    estatusBadge = '<span style="background:#e67e22; color:#fff; padding:3px 8px; border-radius:12px; font-size:0.8rem">Baja Solicitada</span>';
  }

  return `<tr>
    <td>
      <div class="jugador-info">
        ${fotoHtml}
        <div>
          <div class="jugador-nombre">${escHtml(j.nombre)}</div>
          ${j.curp ? `<div class="jugador-numero">CURP: ${escHtml(j.curp)}</div>` : ''}
        </div>
      </div>
    </td>
    <td><strong>${j.numero_camiseta || '—'}</strong></td>
    <td>${j.posicion ? posEmoji(j.posicion) + ' ' + j.posicion : '—'}</td>
    <td>${nacimiento}</td>
    <td>${j.foto_url ? `<a href="#" data-pdf="${j.foto_url}" style="color:var(--cap-green)">📷 Ver</a>` : docBadge(null, '📷')}</td>
    <td>${j.ine_pdf_url  ? `<a href="#" data-pdf="${j.ine_pdf_url}" style="color:var(--cap-green)">📄 Ver</a>` : docBadge(null, '🪪')}</td>
    <td>${j.acta_pdf_url ? `<a href="#" data-pdf="${j.acta_pdf_url}" style="color:var(--cap-green)">📄 Ver</a>` : docBadge(null, '📜')}</td>
    <td>${estatusBadge}</td>
    <td>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-ghost btn-sm" data-edit="${j.id}" ${j.estatus==='autorizado' ? 'disabled style="opacity:0.5;cursor:not-allowed;" title="Ya está autorizado"' : 'title="Editar"'}>✏️ Editar</button>
        ${j.estatus !== 'Baja Solicitada' ? `<button class="btn btn-ghost btn-danger btn-sm" onclick="solicitarBajaJugador(${j.id})">🛑 Baja</button>` : ''}
      </div>
    </td>
  </tr>`;
}

// Búsqueda de jugadores
document.getElementById('jugador-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtrados = allJugadores.filter(j =>
    j.nombre.toLowerCase().includes(q) ||
    (j.posicion || '').toLowerCase().includes(q) ||
    (j.numero_camiseta?.toString() || '').includes(q)
  );
  renderJugadoresTable(filtrados);
});

// ══════════════════════════════════════════════════════════
// PERFIL / SUSCRIPCIÓN
// ══════════════════════════════════════════════════════════
async function loadPerfil() {
  try {
    const r = await fetch(`${API}/capitan/perfil`, { headers: authHeaders });
    if (!r.ok) return;
    const data = await r.json();
    const p = data.perfil;

    const dot   = document.getElementById('sus-dot');
    const texto = document.getElementById('sus-status-text');
    const sub   = document.getElementById('sus-status-sub');

    // Usamos el flag calculado por el servidor que ya verificó el torneo
    if (usuario.suscripcion_activa) {
      dot.className = 'status-dot-big active';
      texto.textContent = '✅ Suscripción activa';
      sub.textContent   = 'Tu pago para este torneo ha sido confirmado.';
    } else {
      dot.className = 'status-dot-big inactive';
      texto.textContent = '❌ Suscripción inactiva o por renovar';
      sub.textContent   = 'Debes inscribirte en el torneo actual para participar.';
    }

    document.getElementById('sus-liga').textContent = p.nombre_liga || '—';
    if (usuario.categoria) {
      document.getElementById('sus-liga').textContent += ` (Categoría: ${usuario.categoria})`;
    }
  } catch (err) {
    console.error('Error al cargar perfil:', err);
  }
}

// ── CATEGORÍA MANDATORIA ──────────────────────────────────
async function verificarCategoria() {
  // Si ya tiene categoría, no hacer nada
  if (usuario.categoria) return;

  const modal = document.getElementById('modal-seleccionar-categoria');
  if (!modal) return;
  modal.classList.add('open');
  
  const sel = document.getElementById('select-categoria-obligatoria');
  const btn = document.getElementById('btn-confirmar-categoria');

  try {
    const resp = await fetch(`/api/public/liga-config?tenant_id=${usuario.tenant_id}`);
    const data = await resp.json();
    const allCats = [...(data.categorias_soccer || []), ...(data.categorias_fut7 || [])];
    
    if (allCats.length === 0) {
      sel.innerHTML = '<option value="Única">Categoría Única</option>';
    } else {
      sel.innerHTML = '<option value="">Selecciona tu división...</option>';
      allCats.forEach(c => {
        sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
      });
    }
  } catch (err) {
    sel.innerHTML = '<option value="">Error al cargar categorías</option>';
  }

  sel.addEventListener('change', () => {
    btn.disabled = !sel.value;
  });

  btn.addEventListener('click', async () => {
    const cat = sel.value;
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    try {
      const r = await fetch(`${API}/capitan/mi-equipo/categoria`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ categoria: cat })
      });
      if (!r.ok) throw new Error();
      
      // Actualizar usuario local
      usuario.categoria = cat;
      localStorage.setItem('ligamaster_usuario', JSON.stringify(usuario));
      
      modal.classList.remove('open');
      toast('Categoría asignada correctamente.', 'success');
      loadDashboard();
    } catch {
      toast('Error al guardar categoría.', 'error');
      btn.disabled = false;
      btn.textContent = 'Confirmar Selección →';
    }
  });
}

// ══════════════════════════════════════════════════════════
// MODAL JUGADOR
// ══════════════════════════════════════════════════════════
const modalJugador = document.getElementById('modal-jugador');

function abrirModal(editar = false) {
  modalJugador.classList.add('open');
  document.getElementById('modal-jugador-title').textContent =
    editar ? '✏️ Editar Jugador' : '➕ Agregar Jugador';
  if (!editar) resetFormJugador();
}

function cerrarModal() {
  modalJugador.classList.remove('open');
  editingId = null;
  resetFormJugador();
}

document.getElementById('close-modal-jugador').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar-jugador').addEventListener('click', cerrarModal);
modalJugador.addEventListener('click', (e) => { if (e.target === modalJugador) cerrarModal(); });

// Abrir desde botones
[
  document.getElementById('btn-agregar-jugador'),
  document.getElementById('btn-agregar-jugador-quick')
].forEach(btn => btn?.addEventListener('click', () => { editingId = null; abrirModal(false); }));

// Reset form
function resetFormJugador() {
  ['jugador-id','j-nombre','j-curp','j-numero','j-telefono','j-peso','j-talla','j-domicilio']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('j-posicion').value   = '';
  document.getElementById('j-nacimiento').value = '';
  document.getElementById('j-foto').value  = '';
  document.getElementById('j-ine').value   = '';
  document.getElementById('j-acta').value  = '';
  ['preview-foto','preview-ine','preview-acta'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

// Abrir editar
function abrirEditar(id) {
  const j = allJugadores.find(x => x.id === id);
  if (!j) return;
  editingId = id;

  document.getElementById('jugador-id').value    = j.id;
  document.getElementById('j-nombre').value      = j.nombre || '';
  document.getElementById('j-curp').value        = j.curp || '';
  document.getElementById('j-numero').value      = j.numero_camiseta || '';
  document.getElementById('j-posicion').value    = j.posicion || '';
  document.getElementById('j-nacimiento').value  = j.fecha_nacimiento ? j.fecha_nacimiento.split('T')[0] : '';
  document.getElementById('j-telefono').value    = j.telefono || '';
  document.getElementById('j-peso').value        = j.peso_kg || '';
  document.getElementById('j-talla').value       = j.talla_cm || '';
  document.getElementById('j-domicilio').value   = j.domicilio || '';

  // Mostrar archivos existentes
  mostrarDocExistente('preview-foto', 'preview-foto-name', j.foto_url, 'Foto actual');
  mostrarDocExistente('preview-ine',  'preview-ine-name',  j.ine_pdf_url,  'INE actual');
  mostrarDocExistente('preview-acta', 'preview-acta-name', j.acta_pdf_url, 'Acta actual');

  if (j.foto_url) {
    document.getElementById('preview-foto-img').src = j.foto_url;
  }

  abrirModal(true);
}

function mostrarDocExistente(previewId, nameId, url, label) {
  if (url) {
    document.getElementById(previewId).style.display = 'flex';
    document.getElementById(nameId).textContent = label + ': ' + url.split('/').pop();
  }
}

// ── Previews de archivos ──────────────────────────────────
setupFilePreview('j-foto', 'preview-foto', 'preview-foto-name', true);
setupFilePreview('j-ine',  'preview-ine',  'preview-ine-name',  false);
setupFilePreview('j-acta', 'preview-acta', 'preview-acta-name', false);

function setupFilePreview(inputId, previewId, nameId, isImage) {
  document.getElementById(inputId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) { document.getElementById(previewId).style.display = 'none'; return; }
    document.getElementById(nameId).textContent = file.name;
    document.getElementById(previewId).style.display = 'flex';
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('preview-foto-img').src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Drag & drop
  const zone = document.getElementById(inputId).closest('.upload-zone');
  if (zone) {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById(inputId);
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  }
}

// ── Guardar jugador ───────────────────────────────────────
document.getElementById('btn-guardar-jugador').addEventListener('click', guardarJugador);

async function guardarJugador() {
  const nombre = document.getElementById('j-nombre').value.trim();
  if (!nombre) { toast('El nombre del jugador es requerido.', 'error'); return; }

  const btn = document.getElementById('btn-guardar-jugador');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  // Usar FormData para archivos
  const fd = new FormData();
  fd.append('nombre',          nombre);
  fd.append('curp',            document.getElementById('j-curp').value.trim());
  fd.append('numero_camiseta', document.getElementById('j-numero').value);
  fd.append('posicion',        document.getElementById('j-posicion').value);
  fd.append('fecha_nacimiento',document.getElementById('j-nacimiento').value);
  fd.append('telefono',        document.getElementById('j-telefono').value.trim());
  fd.append('peso_kg',         document.getElementById('j-peso').value);
  fd.append('talla_cm',        document.getElementById('j-talla').value);
  fd.append('domicilio',       document.getElementById('j-domicilio').value.trim());

  const foto  = document.getElementById('j-foto').files[0];
  const ine   = document.getElementById('j-ine').files[0];
  const acta  = document.getElementById('j-acta').files[0];
  if (foto)  fd.append('foto', foto);
  if (ine)   fd.append('ine',  ine);
  if (acta)  fd.append('acta', acta);

  const url    = editingId ? `${API}/capitan/jugadores/${editingId}` : `${API}/capitan/jugadores`;
  const method = editingId ? 'PUT' : 'POST';

  try {
    const r = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    const data = await r.json();
    if (!r.ok) { toast(data.error || 'Error al guardar.', 'error'); return; }

    toast(editingId ? 'Jugador actualizado correctamente.' : 'Jugador registrado correctamente.', 'success');
    cerrarModal();
    loadJugadores();

    // Si estamos en el inicio, actualizar métricas
    if (document.getElementById('section-equipo').style.display !== 'none') {
      loadDashboard();
    }
  } catch (err) {
    toast('Error de conexión.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Guardar Jugador';
  }
}

// Función para solicitar baja
window.solicitarBajaJugador = async (id) => {
  if (!confirm('¿Estás seguro de solicitar la baja de este jugador? El administrador deberá aprobarla.')) return;
  try {
    const r = await fetch(`${API}/capitan/jugadores/${id}/baja`, {
      method: 'PUT',
      headers: authHeaders
    });
    if (!r.ok) {
      const data = await r.json();
      throw new Error(data.error || 'Error al solicitar baja');
    }
    toast('Se ha solicitado la baja del jugador.', 'success');
    loadJugadores();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
function docBadge(url, icon) {
  if (url) return `<span class="doc-badge doc-ok">${icon} ✓</span>`;
  return `<span class="doc-badge doc-miss">${icon} —</span>`;
}

function posEmoji(pos) {
  const map = { Portero:'🧤', Defensa:'🛡️', Mediocampista:'⚙️', Delantero:'⚡' };
  return map[pos] || '';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function logout() {
  localStorage.removeItem('ligamaster_token');
  localStorage.removeItem('ligamaster_usuario');
  window.location.href = '/login.html';
}

// Toast reutiliza la función de utils.js si existe, si no usa inline
if (typeof toast === 'undefined') {
  window.toast = function(msg, tipo='success', dur=3000) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${tipo}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), dur + 400);
  };
}
