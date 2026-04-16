// public/js/utils.js
// ─────────────────────────────────────────────────────────
// Funciones utilitarias compartidas entre todas las páginas
// ─────────────────────────────────────────────────────────

const API = '/api';

/** Lee el token JWT guardado en localStorage */
function getToken() {
  return localStorage.getItem('ligamaster_token');
}

/** Lee los datos del usuario autenticado */
function getUsuario() {
  const raw = localStorage.getItem('ligamaster_usuario');
  return raw ? JSON.parse(raw) : null;
}


/**
 * Wrapper de fetch que agrega el token automáticamente.
 * Si la respuesta es 401/403 redirige al login.
 */
async function apiFetch(endpoint, opciones = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...opciones.headers
  };

  const resp = await fetch(API + endpoint, { ...opciones, headers });

  if (resp.status === 401 || resp.status === 403) {
    localStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  return resp;
}

/**
 * Muestra una notificación tipo "toast" en la esquina inferior derecha.
 * tipo: 'success' | 'error' | 'info'
 */
function toast(mensaje, tipo = 'info', duracion = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensaje;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'slideIn 0.25s ease reverse';
    setTimeout(() => el.remove(), 250);
  }, duracion);
}

/** Abre un modal */
function abrirModal(id) {
  document.getElementById(id)?.classList.add('open');
}

/** Cierra un modal */
function cerrarModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/** Formatea una fecha ISO a formato legible en español */
function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/** Formatea un número como moneda mexicana */
function formatMXN(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

/** Badge HTML según plan */
function badgePlan(plan) {
  const clases = { '1 Año': 'badge-oro', '6 Meses': 'badge-plata', '3 Meses': 'badge-bronce' };
  const iconos = { '1 Año': '🗓️', '6 Meses': '📅', '3 Meses': '📆' };
  return `<span class="badge ${clases[plan] || ''}">${iconos[plan] || ''} ${plan}</span>`;
}

/** Badge HTML según estatus_pago */
function badgeEstatus(activo) {
  return activo
    ? `<span class="badge badge-activo">✅ Activo</span>`
    : `<span class="badge badge-inactivo">🔴 Suspendido</span>`;
}

/** Protege las páginas que requieren autenticación y rol específico */
function protegerPagina(rolRequerido = 'superadmin') {
  const token = getToken();
  const usuario = getUsuario();

  if (!token || !usuario) {
    window.location.href = '/login.html';
    return false;
  }

  if (rolRequerido && usuario.rol !== rolRequerido) {
    toast('No tienes permisos para acceder a esta sección.', 'error');
    setTimeout(() => {
      if (usuario.rol === 'superadmin') {
        window.location.href = '/dashboard.html';
      } else if (usuario.rol === 'organizador') {
        window.location.href = '/user-dashboard.html';
      } else {
        window.location.href = '/login.html';
      }
    }, 2000);
    return false;
  }

// public/js/utils.js
  const el = document.getElementById('sidebar-usuario');
  if (el) {
    el.innerHTML = `<strong style="color:var(--text)">${usuario.nombre}</strong><br>
                    <span>${usuario.rol}</span>`;
  }

  document.getElementById('btn-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.replace('/login.html');
  });

  return true;
}

// Global: prevenir navegación atrás a páginas restringidas si no hay sesión
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    // Si la página se supone protegida pero no se ha invocado protegerPagina explícitamente y no hay token, el usuario tratará de ver contenido antiguo
    if (!getToken() && document.getElementById('btn-logout')) {
      window.location.replace('/login.html');
    }
  }
});