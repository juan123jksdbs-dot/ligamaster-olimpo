// public/js/login.js
// ─────────────────────────────────────────────────────────
// Lógica del formulario de login
// Incluye invalidación robusta de bfcache
// ─────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────
function getToken()   { return localStorage.getItem('ligamaster_token'); }
function getUsuario() {
  const r = localStorage.getItem('ligamaster_usuario');
  return r ? JSON.parse(r) : null;
}

function redirigirSegunRol(rol) {
  const destino = {
    superadmin: '/dashboard.html',
    organizador: '/user-dashboard.html',
    capitan: '/captain-dashboard.html'
  }[rol] || '/dashboard.html';
  window.location.replace(destino);
}

// ── Verificar sesión y redirigir si ya está logueado ──────
function verificarYRedirigir() {
  const tok = getToken();
  const usr = getUsuario();
  if (tok && usr) {
    redirigirSegunRol(usr.rol);
    return true; // hay sesión activa
  }
  return false;
}

// ── BFCACHE: bloquear restauración desde caché si hay sesión
// Se dispara ANTES de DOMContentLoaded cuando la página viene del bfcache
window.addEventListener('pageshow', (e) => {
  // e.persisted = true → página restaurada del bfcache (botón atrás/adelante)
  if (e.persisted) {
    verificarYRedirigir();
  }
});

// ── También desactivar el bfcache para login.html ─────────
// Al salir de login, marcamos la página como "no almacenable"
window.addEventListener('pagehide', () => {
  // Vaciar el formulario al salir ayuda a que el navegador
  // no restaure un estado con credenciales visibles
  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('password');
  if (emailEl) emailEl.value = '';
  if (passEl)  passEl.value  = '';
});

// ── DOMContentLoaded ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión, redirigir inmediatamente y NO mostrar el formulario
  if (verificarYRedirigir()) return;

  // Asegurarse de que el formulario esté visible y activo
  inicializarFormularioLogin();
});

// ── Formulario de login ───────────────────────────────────
function inicializarFormularioLogin() {
  const btnLogin   = document.getElementById('btn-login');
  const inputEmail = document.getElementById('email');
  const inputPass  = document.getElementById('password');
  const errorMsg   = document.getElementById('error-msg');

  // Permitir login con Enter
  inputPass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') iniciarSesion();
  });
  inputEmail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') iniciarSesion();
  });

  btnLogin.addEventListener('click', iniciarSesion);

  async function iniciarSesion() {
    const email    = inputEmail.value.trim();
    const password = inputPass.value;

    if (!email || !password) {
      mostrarError('Por favor ingresa tu email y contraseña.');
      return;
    }

    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner"></span> Iniciando sesión...';
    errorMsg.style.display = 'none';

    try {
      const resp = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        mostrarError(data.error || 'Error al iniciar sesión.');
        return;
      }

      localStorage.setItem('ligamaster_token', data.token);
      localStorage.setItem('ligamaster_usuario', JSON.stringify(data.usuario));

      if (typeof toast === 'function') {
        toast(`¡Bienvenido, ${data.usuario.nombre}!`, 'success', 1500);
      }

      // Pequeño delay para que el toast sea visible, luego redirigir
      setTimeout(() => redirigirSegunRol(data.usuario.rol), 600);

    } catch (err) {
      mostrarError('No se pudo conectar al servidor. Error: ' + err.message);
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = 'Iniciar Sesión';
    }
  }

  function mostrarError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
}
