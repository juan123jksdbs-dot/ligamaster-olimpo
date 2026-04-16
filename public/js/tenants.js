// public/js/tenants.js
// ─────────────────────────────────────────────────────────
// JavaScript para la gestión de tenants (ligas) desde el navegador.
// Maneja el CRUD completo: listar, crear, editar, eliminar, pagos, etc.
// ─────────────────────────────────────────────────────────

// ── Variables globales ───────────────────────────────────
let tenants = []; // Array para almacenar la lista de tenants

// ── Al cargar la página ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Proteger página: solo superadmin puede acceder
  if (!protegerPagina('superadmin')) return;

  // Mostrar datos del usuario en sidebar
  const usuario = getUsuario();
  if (usuario) {
    document.getElementById('sidebar-usuario').textContent = usuario.nombre;
  }

  cargarTenants();
  configurarEventos();
});

// ── Configurar eventos ───────────────────────────────────
function configurarEventos() {
  // Botón nueva liga
  const btnNuevaLiga = document.getElementById('btn-nueva-liga');
  if (btnNuevaLiga) {
    btnNuevaLiga.addEventListener('click', () => abrirModalCrear());
  }

  // Botón guardar tenant
  const btnGuardar = document.getElementById('btn-guardar-tenant');
  if (btnGuardar) {
    btnGuardar.addEventListener('click', guardarTenant);
  }

  // Botón confirmar pago
  const btnConfirmarPago = document.getElementById('btn-confirmar-pago');
  if (btnConfirmarPago) {
    btnConfirmarPago.addEventListener('click', confirmarPago);
  }

  // Botón enviar recordatorio
  const btnRecordatorio = document.getElementById('btn-enviar-recordatorio');
  if (btnRecordatorio) {
    btnRecordatorio.addEventListener('click', enviarRecordatorio);
  }

  // Botón logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = '/login.html';
    });
  }
}

// ── Cargar lista de tenants ───────────────────────────────
async function cargarTenants() {
  try {
    const response = await apiFetch('/superadmin/tenants');

    if (!response || !response.ok) {
      throw new Error('Error al cargar tenants');
    }

    tenants = await response.json();
    renderizarTabla(tenants);
  } catch (error) {
    console.error(error);
    toast('Error al cargar ligas: ' + error.message, 'error');
  }
}

// ── Renderizar tabla de tenants ──────────────────────────
function renderizarTabla(tenants) {
  const tbody = document.getElementById('tenants-tbody');
  tbody.innerHTML = '';

  if (tenants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">No hay ligas registradas</td></tr>';
    return;
  }

  tenants.forEach((tenant, index) => {
    const row = document.createElement('tr');

    // estatus_pago es un booleano: true = activa, false = suspendida
    const estatusClass = tenant.estatus_pago ? 'badge-activo' : 'badge-inactivo';
    const estatusTexto = tenant.estatus_pago ? '✅ Activa' : '🔴 Suspendida';

    row.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${tenant.nombre_liga}</strong><br><span style="font-size:11px; color:var(--text2);">${tenant.email_contacto}</span></td>
      <td><code>${tenant.slug}</code></td>
      <td>${badgePlan(tenant.plan)}</td>
      <td>${tenant.nombre_organizador || 'Sin asignar'}</td>
      <td><span class="badge ${estatusClass}">${estatusTexto}</span></td>
      <td style="font-size:12px; color:var(--text2);">${formatFecha(tenant.fecha_vencimiento)}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="abrirModalEditar(${tenant.id})">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="abrirModalPago(${tenant.id})">💳</button>
        <button class="btn btn-sm btn-ghost" onclick="verHistorial(${tenant.id})">📋</button>
        <button class="btn btn-sm btn-danger" onclick="if(confirm('¿Eliminar definitivamente?')) eliminarTenant(${tenant.id})">🗑️</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// ── Abrir modal para crear tenant ────────────────────────
function abrirModalCrear() {
  document.getElementById('modal-title').textContent = 'Nueva Liga';
  document.getElementById('tenant-id').value = '';
  limpiarFormulario();
  document.getElementById('seccion-organizador').style.display = 'block';
  abrirModal('modal-tenant');
}

// ── Abrir modal para editar tenant ───────────────────────
async function abrirModalEditar(id) {
  try {
    const response = await apiFetch(`/superadmin/tenants/${id}`);

    if (!response || !response.ok) {
      throw new Error('Error al cargar tenant');
    }

    const tenant = await response.json();

    document.getElementById('modal-title').textContent = 'Editar Liga';
    document.getElementById('tenant-id').value = tenant.id;
    document.getElementById('f-nombre').value = tenant.nombre_liga;
    document.getElementById('f-slug').value = tenant.slug;
    document.getElementById('f-email').value = tenant.email_contacto;
    document.getElementById('f-telefono').value = tenant.telefono || '';
    document.getElementById('f-plan').value = tenant.plan;

    document.getElementById('seccion-organizador').style.display = 'none';
    abrirModal('modal-tenant');
  } catch (error) {
    console.error(error);
    toast('Error al cargar liga: ' + error.message, 'error');
  }
}

// ── Guardar tenant (crear o editar) ──────────────────────
async function guardarTenant() {
  const id = document.getElementById('tenant-id').value;
  const data = {
    nombre_liga: document.getElementById('f-nombre').value,
    slug: document.getElementById('f-slug').value,
    email_contacto: document.getElementById('f-email').value,
    telefono: document.getElementById('f-telefono').value || null,
    plan: document.getElementById('f-plan').value
  };

  // Si es creación, incluir datos del organizador
  if (!id) {
    data.nombre_organizador = document.getElementById('f-org-nombre')?.value;
    data.email_org = document.getElementById('f-org-email')?.value;
    data.password_org = document.getElementById('f-org-password')?.value;
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/superadmin/tenants/${id}` : '/superadmin/tenants';

    const response = await apiFetch(endpoint, {
      method: method,
      body: JSON.stringify(data)
    });

    if (!response || !response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al guardar liga');
    }

    const result = await response.json();
    toast(result.mensaje || 'Liga guardada correctamente', 'success');
    cerrarModal('modal-tenant');
    cargarTenants();
  } catch (error) {
    console.error(error);
    toast('Error al guardar liga: ' + error.message, 'error');
  }
}

// ── Eliminar tenant ──────────────────────────────────────
async function eliminarTenant(id) {
  try {
    const response = await apiFetch(`/superadmin/tenants/${id}`, {
      method: 'DELETE'
    });

    if (!response || !response.ok) {
      throw new Error('Error al eliminar liga');
    }

    toast('Liga eliminada correctamente', 'success');
    cargarTenants();
  } catch (error) {
    console.error(error);
    toast('Error al eliminar liga: ' + error.message, 'error');
  }
}

// ── Abrir modal de pago ──────────────────────────────────
async function abrirModalPago(id) {
  const tenant = tenants.find(t => t.id === id);
  if (!tenant) return;

  document.getElementById('pago-tenant-id').value = id;
  document.getElementById('pago-nombre-liga').value = tenant.nombre_liga;
  document.getElementById('pago-monto').value = tenant.plan === '3 Meses' ? 299 : tenant.plan === '6 Meses' ? 599 : 999;
  
  if (document.getElementById('recordatorio-msg')) {
    document.getElementById('recordatorio-msg').value = `Tu suscripción de la liga "${tenant.nombre_liga}" está por vencer. Realiza el pago para continuar.`;
  }

  abrirModal('modal-pago');
}

// ── Confirmar pago ───────────────────────────────────────
async function confirmarPago() {
  const id = document.getElementById('pago-tenant-id').value;
  const data = {
    monto: parseFloat(document.getElementById('pago-monto').value),
    metodo_pago: document.getElementById('pago-metodo')?.value || 'Simulado'
  };

  try {
    const response = await apiFetch(`/superadmin/tenants/${id}/pago`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response || !response.ok) {
      throw new Error('Error al confirmar pago');
    }

    const result = await response.json();
    toast(result.mensaje || 'Pago confirmado correctamente', 'success');
    cerrarModal('modal-pago');
    cargarTenants();
  } catch (error) {
    console.error(error);
    toast('Error al confirmar pago: ' + error.message, 'error');
  }
}

// ── Enviar recordatorio ───────────────────────────────────
async function enviarRecordatorio() {
  const id = document.getElementById('pago-tenant-id').value;
  const mensaje = document.getElementById('recordatorio-msg')?.value || '';

  try {
    const response = await apiFetch(`/superadmin/tenants/${id}/recordatorio`, {
      method: 'POST',
      body: JSON.stringify({ mensaje })
    });

    if (!response || !response.ok) {
      throw new Error('Error al enviar recordatorio');
    }

    const result = await response.json();
    toast(result.mensaje || 'Recordatorio enviado correctamente', 'success');
  } catch (error) {
    console.error(error);
    toast('Error al enviar recordatorio: ' + error.message, 'error');
  }
}

// ── Ver historial de suscripciones ───────────────────────
async function verHistorial(id) {
  try {
    const response = await apiFetch(`/superadmin/tenants/${id}/suscripciones`);

    if (!response || !response.ok) {
      throw new Error('Error al cargar historial');
    }

    const historial = await response.json();
    renderizarHistorial(historial);
    abrirModal('modal-historial');
  } catch (error) {
    toast('Error al cargar historial: ' + error.message, 'error');
  }
}

// ── Renderizar historial ─────────────────────────────────
function renderizarHistorial(historial) {
  const tbody = document.getElementById('historial-tbody');
  tbody.innerHTML = '';

  if (historial.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay pagos registrados</td></tr>';
    return;
  }

  historial.forEach(pago => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatearFecha(pago.fecha_pago)}</td>
      <td>$${pago.monto}</td>
      <td>${pago.metodo_pago}</td>
      <td>${pago.periodo_inicio} - ${pago.periodo_fin}</td>
      <td><span class="badge badge-success">${pago.estatus}</span></td>
    `;
    tbody.appendChild(row);
  });
}

// ── Funciones auxiliares ─────────────────────────────────
function limpiarFormulario() {
  document.getElementById('f-nombre').value = '';
  document.getElementById('f-slug').value = '';
  document.getElementById('f-email').value = '';
  document.getElementById('f-telefono').value = '';
  document.getElementById('f-plan').value = '3 Meses';
  document.getElementById('f-org-nombre').value = '';
  document.getElementById('f-org-email').value = '';
  document.getElementById('f-org-password').value = '';
}

function formatearFecha(fecha) {
  if (!fecha) return 'N/A';
  return new Date(fecha).toLocaleDateString('es-ES');
}
