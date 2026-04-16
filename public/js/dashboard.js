// public/js/dashboard.js
// ─────────────────────────────────────────────────────────
// Lógica del Dashboard — carga métricas desde la API
// ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar que el usuario sea superadmin y redirigir si no lo es
  if (!protegerPagina('superadmin')) return;

  // Mostrar datos del usuario en sidebar
  const usuario = getUsuario();
  if (usuario) {
    document.getElementById('sidebar-usuario').textContent = usuario.nombre;
  }

  // Botón logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = '/login.html';
    });
  }

  await cargarDashboard();
});

async function cargarDashboard() {
  try {
    const resp = await apiFetch('/superadmin/dashboard');
    if (!resp || !resp.ok) {
      toast('Error al cargar el dashboard.', 'error');
      return;
    }

    const data = await resp.json();

    // ── Métricas numéricas ────────────────────────────────
    document.getElementById('m-activas').textContent   = data.metricas.activas   || 0;
    document.getElementById('m-inactivas').textContent = data.metricas.inactivas || 0;
    document.getElementById('m-total').textContent     = data.metricas.total     || 0;
    document.getElementById('m-ingresos').textContent  = formatMXN(data.ingresos_mes);

    // ── Distribución por plan ────────────────────────────
    const planesEl = document.getElementById('planes-lista');
    if (data.por_plan && data.por_plan.length > 0) {
      const total = parseInt(data.metricas.total) || 1;
      planesEl.innerHTML = data.por_plan.map(p => `
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:13px;">
            ${badgePlan(p.plan)}
            <span style="color:var(--text2)">${p.cantidad} liga(s)</span>
          </div>
          <div style="background:var(--bg3); border-radius:20px; height:6px; overflow:hidden;">
            <div style="
              background: ${p.plan === '1 Año' ? 'var(--gold)' : p.plan === '6 Meses' ? 'var(--silver)' : 'var(--bronze)'};
              width: ${Math.round((p.cantidad / total) * 100)}%;
              height: 100%;
              border-radius: 20px;
              transition: width 0.8s ease;">
            </div>
          </div>
        </div>
      `).join('');
    } else {
      planesEl.innerHTML = '<div class="empty-state"><p>Sin datos de planes</p></div>';
    }

    // ── Últimas ligas ────────────────────────────────────
    const tbody = document.getElementById('ultimas-ligas-tbody');
    if (data.ultimas_ligas && data.ultimas_ligas.length > 0) {
      tbody.innerHTML = data.ultimas_ligas.map(t => `
        <tr>
          <td>
            <strong>${t.nombre_liga}</strong><br>
            <span style="color:var(--text2); font-size:11px;">${t.slug}</span>
          </td>
          <td>${badgePlan(t.plan)}</td>
          <td>${badgeEstatus(t.estatus_pago)}</td>
          <td style="color:var(--text2); font-size:12px;">${formatFecha(t.fecha_registro)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `
        <tr><td colspan="4">
          <div class="empty-state">
            <div class="empty-icon">🏟️</div>
            <p>No hay ligas registradas aún.</p>
          </div>
        </td></tr>`;
    }

  } catch (err) {
    console.error(err);
    toast('Error de conexión con el servidor.', 'error');
  }
}