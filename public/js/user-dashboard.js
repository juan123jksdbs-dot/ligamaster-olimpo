// public/js/user-dashboard.js — Panel Organizador LigaMaster SaaS

const state = {
  partidos:[], jugadores:[], equipos:[], arbitros:[],
  campos:[], posiciones:[], goleadores:[], aprobaciones:[],
  config:{ tipo_liga:'', categorias_soccer:[], categorias_fut7:[] }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!protegerPagina('organizador')) return;
  configurarBotones();
  configurarCierresDeModal();
  configurarConfigLiga();
  configurarNavSmooth();
  await cargarTodo();
});

function configurarBotones() {
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-generar-rol')?.addEventListener('click', generarRol);
  document.getElementById('btn-agregar-partido')?.addEventListener('click', () => abrirModal('modal-agregar-partido'));
  document.getElementById('btn-agregar-jugador')?.addEventListener('click', () => abrirModal('modal-agregar-jugador'));
  document.getElementById('btn-agregar-equipo')?.addEventListener('click',  () => abrirModal('modal-agregar-equipo'));
  document.getElementById('btn-agregar-campo')?.addEventListener('click',   () => abrirModal('modal-agregar-campo'));
  document.getElementById('btn-agregar-arbitro')?.addEventListener('click', () => abrirModal('modal-agregar-arbitro'));
  document.getElementById('btn-registrar-gol')?.addEventListener('click',   () => abrirModal('modal-registrar-gol'));
  document.getElementById('btn-save-partido')?.addEventListener('click', guardarPartido);
  document.getElementById('btn-save-jugador')?.addEventListener('click', guardarJugador);
  document.getElementById('btn-save-equipo')?.addEventListener('click',  guardarEquipo);
  document.getElementById('btn-save-campo')?.addEventListener('click',   guardarCampo);
  document.getElementById('btn-save-arbitro')?.addEventListener('click', guardarArbitro);
  document.getElementById('btn-save-gol')?.addEventListener('click', guardarGol);
  document.getElementById('btn-save-revisar-jugador')?.addEventListener('click', guardarRevisionJugador);
  document.getElementById('btn-save-config-liga')?.addEventListener('click', guardarConfigLiga);
  document.getElementById('btn-accept-soccer')?.addEventListener('click', guardarConfigLiga);
  document.getElementById('btn-accept-fut7')?.addEventListener('click', guardarConfigLiga);
  document.getElementById('btn-reload-aprobaciones')?.addEventListener('click', cargarAprobaciones);
  document.getElementById('btn-add-evento')?.addEventListener('click', agregarEvento);
  document.getElementById('btn-save-estadisticas')?.addEventListener('click', guardarEstadisticas);
  document.getElementById('btn-ir-goleadores')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('goleadores')?.scrollIntoView({ behavior:'smooth', block:'start' });
  });
}

function configurarCierresDeModal() {
  document.querySelectorAll('.modal-close').forEach(btn =>
    btn.addEventListener('click', () => btn.closest('.modal')?.classList.remove('open'))
  );
}

function configurarNavSmooth() {
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').replace('#','');
      const sec = document.getElementById(id);
      if (sec) { e.preventDefault(); sec.scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
  });
}

function logout() { localStorage.clear(); window.location.href = '/login.html'; }

async function cargarTodo() {
  await Promise.all([
    cargarEquipos(), cargarCampos(), cargarArbitros(),
    cargarPartidos(), cargarJugadores(), cargarPosiciones(),
    cargarGoleadores(), cargarConfigLiga(), cargarAprobaciones()
  ]);
  actualizarMetricas();
}

function actualizarMetricas() {
  document.getElementById('total-jugadores').textContent = state.jugadores.length;
  document.getElementById('partidos-programados').textContent = state.partidos.length;
  document.getElementById('total-equipos').textContent = state.equipos.length;
  document.getElementById('estado-suscripcion').textContent = 'Activa';
  document.getElementById('fecha-vencimiento').textContent = 'Vigente';
}

// ════════════════════════════════════════
// ⚙️ CONFIGURACIÓN DE LIGA
// ════════════════════════════════════════
function configurarConfigLiga() {
  const toggle = () => {
    document.getElementById('bloque-soccer').style.display = document.getElementById('chk-soccer').checked ? 'block' : 'none';
    document.getElementById('bloque-fut7').style.display   = document.getElementById('chk-fut7').checked   ? 'block' : 'none';
    actualizarResumenConfig();
  };
  document.getElementById('chk-soccer')?.addEventListener('change', toggle);
  document.getElementById('chk-fut7')?.addEventListener('change', toggle);
  document.querySelectorAll('.chk-cat-soccer,.chk-cat-fut7').forEach(c => c.addEventListener('change', actualizarResumenConfig));
}

function actualizarResumenConfig() {
  const s = document.getElementById('chk-soccer')?.checked;
  const f = document.getElementById('chk-fut7')?.checked;
  const cs = [...document.querySelectorAll('.chk-cat-soccer:checked')].map(c=>c.value);
  const cf = [...document.querySelectorAll('.chk-cat-fut7:checked')].map(c=>c.value);
  const partes = [];
  if (s) partes.push('⚽ Fútbol Soccer' + (cs.length ? ' — ' + cs.join(', ') : ''));
  if (f) partes.push('🟢 Fútbol 7' + (cf.length ? ' — ' + cf.join(', ') : ''));
  const r = document.getElementById('config-resumen');
  if (partes.length) { r.style.display='block'; r.innerHTML = '<strong>Activo:</strong> ' + partes.join(' &nbsp;|&nbsp; '); }
  else { r.style.display='none'; }
}

async function cargarConfigLiga() {
  try {
    const resp = await apiFetch('/organizador/config');
    if (!resp || !resp.ok) return;
    const d = await resp.json();
    state.config = d;
    const tipo = d.tipo_liga || '';
    const soccer = tipo === 'Fútbol Soccer' || tipo === 'Ambas';
    const fut7   = tipo === 'Fútbol 7' || tipo === 'Ambas';
    document.getElementById('chk-soccer').checked = soccer;
    document.getElementById('chk-fut7').checked   = fut7;
    document.getElementById('bloque-soccer').style.display = soccer ? 'block' : 'none';
    document.getElementById('bloque-fut7').style.display   = fut7   ? 'block' : 'none';

    const setCats = (list, clss, priceClss) => {
      document.querySelectorAll(`.${clss}`).forEach(chk => {
        const found = list.find(l => l.name === chk.value);
        chk.checked = !!found;
        const parent = chk.closest('.cat-item');
        if (parent) {
          const pInput = parent.querySelector(`.${priceClss}`);
          if (pInput) pInput.value = found ? found.price : 0;
        }
      });
    };

    setCats(d.categorias_soccer || [], 'chk-cat-soccer', 'price-cat-soccer');
    setCats(d.categorias_fut7 || [],   'chk-cat-fut7',   'price-cat-fut7');

    actualizarResumenConfig();
    llenarSelectorCategoriasRol();
    llenarSelectorCategoriasEquipo();
  } catch(e) { console.error('Error config:', e); }
}

function llenarSelectorCategoriasEquipo() {
  const sel = document.getElementById('form-equipo-categoria');
  if (!sel) return;
  sel.innerHTML = '<option value="">Sin categoría</option>';
  
  const cats = [];
  if (state.config.tipo_liga === 'Fútbol Soccer' || state.config.tipo_liga === 'Ambas') {
    (state.config.categorias_soccer || []).forEach(c => cats.push(c.name));
  }
  if (state.config.tipo_liga === 'Fútbol 7' || state.config.tipo_liga === 'Ambas') {
    (state.config.categorias_fut7 || []).forEach(c => cats.push(c.name));
  }
  
  cats.forEach(c => {
    sel.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

function llenarSelectorCategoriasRol() {
  const sel = document.getElementById('select-categoria-rol');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="General">Todas las Categorías (Copa)</option>';
  
  const cats = [];
  if (document.getElementById('chk-soccer').checked) {
    [...document.querySelectorAll('.chk-cat-soccer:checked')].forEach(c => cats.push(c.value));
  }
  if (document.getElementById('chk-fut7').checked) {
    [...document.querySelectorAll('.chk-cat-fut7:checked')].forEach(c => cats.push(c.value));
  }
  
  cats.forEach(c => {
    sel.innerHTML += `<option value="${c}">${c}</option>`;
  });
  if (cats.includes(current)) sel.value = current;
}

async function guardarConfigLiga() {
  const s = document.getElementById('chk-soccer').checked;
  const f = document.getElementById('chk-fut7').checked;
  if (!s && !f) { toast('Selecciona al menos una modalidad.','error'); return; }
  const tipo_liga = s && f ? 'Ambas' : s ? 'Fútbol Soccer' : 'Fútbol 7';

  const getSelected = (clss, priceClss) => {
    return [...document.querySelectorAll(`.${clss}:checked`)].map(chk => {
      const parent = chk.closest('.cat-item');
      const pInput = parent ? parent.querySelector(`.${priceClss}`) : null;
      return {
        name: chk.value,
        price: pInput ? parseFloat(pInput.value) || 0 : 0
      };
    });
  };

  const body = {
    tipo_liga,
    categorias_soccer: getSelected('chk-cat-soccer', 'price-cat-soccer'),
    categorias_fut7:   getSelected('chk-cat-fut7',   'price-cat-fut7')
  };

  const btn = document.getElementById('btn-save-config-liga');
  if (btn) { btn.disabled=true; btn.textContent='Guardando...'; }

  try {
    const resp = await apiFetch('/organizador/config', {
      method:'PUT', body: JSON.stringify(body)
    });
    if (!resp||!resp.ok) throw new Error((await resp.json()).error||'Error');
    toast('Configuración guardada.','success');
    await cargarConfigLiga();
  } catch(err) { toast(err.message,'error'); }
  finally { if (btn) { btn.disabled=false; btn.textContent='Guardar Configuración'; } }
}

// ════════════════════════════════════════
// ✅ APROBACIONES POR EQUIPO
// ════════════════════════════════════════
async function cargarAprobaciones() {
  const c = document.getElementById('aprobaciones-container');
  c.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px;">Cargando...</p>';
  try {
    const resp = await apiFetch('/organizador/jugadores/pendientes-equipo');
    if (!resp||!resp.ok) throw new Error();
    const d = await resp.json();
    state.aprobaciones = d.grupos || [];
    renderAprobaciones();
    const total = state.aprobaciones.reduce((s,g)=>s+g.jugadores.length, 0);
    const badge = document.getElementById('badge-pendientes');
    if (badge) { badge.textContent = total; badge.style.display = total ? 'inline-block' : 'none'; }
  } catch {
    c.innerHTML = '<p style="color:var(--text2);text-align:center;padding:30px;">No hay solicitudes pendientes.</p>';
  }
}

function renderAprobaciones() {
  const c = document.getElementById('aprobaciones-container');
  if (!state.aprobaciones.length) {
    c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);"><div style="font-size:2rem;margin-bottom:10px;">✅</div><div>Sin solicitudes pendientes.</div></div>';
    return;
  }
  c.innerHTML = state.aprobaciones.map(g => `
    <div class="aprobacion-equipo-card">
      <div class="aprobacion-equipo-header">
        <span>🏟️ ${escHtml(g.equipo_nombre)}</span>
        <span style="font-size:12px;font-weight:400;color:var(--text2);">${g.jugadores.length} solicitud${g.jugadores.length!==1?'es':''}</span>
      </div>
      ${g.jugadores.map(j => {
        const badge = j.estatus==='pendiente'
          ? `<span class="badge-pend">Alta Pendiente</span>`
          : `<span class="badge-baja">Baja Solicitada</span>`;
        const docs = [
          j.foto_url     ? `<a href="${j.foto_url}"     target="_blank" style="font-size:12px;">📷 Foto</a>`  : '',
          j.ine_pdf_url  ? `<a href="${j.ine_pdf_url}"  target="_blank" style="font-size:12px;">🪪 INE</a>`   : '',
          j.acta_pdf_url ? `<a href="${j.acta_pdf_url}" target="_blank" style="font-size:12px;">📜 Acta</a>`  : ''
        ].filter(Boolean).join(' ');
        const acc = j.estatus==='pendiente'
          ? `<button class="btn btn-sm btn-primary" onclick="accionJugador(${j.id},'autorizado')">✅ Autorizar</button>
             <button class="btn btn-sm btn-danger"  onclick="accionJugador(${j.id},'rechazado')">❌ Rechazar</button>`
          : `<button class="btn btn-sm btn-danger"    onclick="accionJugador(${j.id},'rechazado')">✅ Confirmar Baja</button>
             <button class="btn btn-sm btn-secondary" onclick="accionJugador(${j.id},'autorizado')">↩️ Mantener</button>`;
        return `<div class="aprobacion-jugador-row">
          <div class="aprobacion-jugador-info">
            <div class="nombre">${escHtml(j.nombre)} ${j.numero_camiseta ? '#'+j.numero_camiseta : ''}</div>
            <div class="meta">${j.posicion||'—'} &nbsp;${badge}</div>
            ${docs ? '<div style="margin-top:4px;">'+docs+'</div>' : ''}
            ${j.observaciones ? `<div style="font-size:11px;color:var(--text3);margin-top:3px;">${escHtml(j.observaciones)}</div>` : ''}
          </div>
          <div class="aprobacion-actions">${acc}</div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

window.accionJugador = async (id, estatus) => {
  const obs = estatus === 'rechazado' ? (prompt('Motivo (opcional):') || '') : '';
  try {
    const resp = await apiFetch(`/organizador/jugadores/${id}/estatus`, {
      method:'PUT', body: JSON.stringify({ estatus, observaciones: obs })
    });
    if (!resp||!resp.ok) throw new Error((await resp.json()).error||'Error');
    toast(estatus==='autorizado' ? 'Jugador autorizado ✅' : 'Jugador rechazado', estatus==='autorizado'?'success':'error');
    await Promise.all([cargarAprobaciones(), cargarJugadores()]);
  } catch(err) { toast(err.message,'error'); }
};

// ════════════════════════════════════════
// 📅 PARTIDOS
// ════════════════════════════════════════
async function cargarPartidos() {
  try {
    const resp = await apiFetch('/organizador/partidos');
    if (!resp||!resp.ok) throw new Error();
    state.partidos = await resp.json();
    renderPartidos(); llenarSelectorPartidos();
  } catch {
    document.getElementById('partidos-table').innerHTML=`<tr><td colspan="6" class="empty-state">Error al cargar partidos</td></tr>`;
  }
}
function renderPartidos() {
  const tb = document.getElementById('partidos-table'); if (!tb) return;
  if (!state.partidos.length) { tb.innerHTML=`<tr><td colspan="6" class="empty-state">No hay partidos programados.</td></tr>`; return; }
  tb.innerHTML = state.partidos.map(p=>`
    <tr>
      <td>${new Date(p.fecha_hora).toLocaleString('es-ES')}</td>
      <td>${escHtml(p.equipo_local)}</td><td>${escHtml(p.equipo_visitante)}</td>
      <td>${p.arbitro||'—'}</td><td>${p.goles_local} - ${p.goles_visitante}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="abrirModalEstadisticas(${p.id})">📊 Stats</button></td>
    </tr>`).join('');
}
async function guardarPartido() {
  const f=document.getElementById('form-fecha-hora').value,
        l=document.getElementById('form-equipo-local').value,
        v=document.getElementById('form-equipo-visitante').value,
        a=document.getElementById('form-arbitro').value,
        c=document.getElementById('form-campo-partido').value;
  if (!f||!l||!v) { toast('Completa los campos obligatorios.','error'); return; }
  try {
    const resp = await apiFetch('/organizador/partidos',{method:'POST',body:JSON.stringify({
      equipo_local_id:+l,equipo_visitante_id:+v,arbitro_id:a?+a:null,campo_id:c?+c:null,fecha_hora:f
    })});
    if (!resp||!resp.ok) throw new Error((await resp.json()).error||'Error');
    cerrarModal('modal-agregar-partido'); toast('Partido programado.','success'); await cargarPartidos();
  } catch(err) { toast(err.message,'error'); }
}

// ════════════════════════════════════════
// 👥 JUGADORES
// ════════════════════════════════════════
async function cargarJugadores() {
  try {
    const resp = await apiFetch('/organizador/jugadores');
    if (!resp||!resp.ok) throw new Error();
    state.jugadores = await resp.json();
    renderJugadores(); llenarSelectorJugadores();
  } catch { document.getElementById('jugadores-table').innerHTML=`<tr><td colspan="6" class="empty-state">Error</td></tr>`; }
}
function renderJugadores() {
  const tb = document.getElementById('jugadores-table'); if (!tb) return;
  if (!state.jugadores.length) { tb.innerHTML=`<tr><td colspan="6" class="empty-state">No hay jugadores.</td></tr>`; return; }
  const B = {pendiente:'<span class="badge-pend">Pendiente</span>',autorizado:'<span class="badge-auto">Autorizado</span>',rechazado:'<span class="badge-rech">Rechazado</span>','Baja Solicitada':'<span class="badge-baja">Baja Solicitada</span>'};
  tb.innerHTML = state.jugadores.map(j => {
    const docs=[j.foto_url?`<a href="${j.foto_url}" target="_blank">📷</a>`:'', j.ine_pdf_url?`<a href="${j.ine_pdf_url}" target="_blank">🪪</a>`:'', j.acta_pdf_url?`<a href="${j.acta_pdf_url}" target="_blank">📜</a>`:''].filter(Boolean).join(' ')||'—';
    return `<tr><td>${escHtml(j.nombre)}</td><td>${j.equipo||'—'}</td><td>${j.posicion||'—'}</td><td>${docs}</td><td>${B[j.estatus]||j.estatus}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="abrirRevisarJugador(${j.id})">Revisar</button> <button class="btn btn-sm btn-danger" onclick="eliminarJugador(${j.id})">Eliminar</button></td></tr>`;
  }).join('');
}
window.abrirRevisarJugador = (id) => {
  const j = state.jugadores.find(x=>x.id===id); if (!j) return;
  document.getElementById('rev-jugador-id').value = j.id;
  document.getElementById('rev-jugador-nombre').textContent = j.nombre;
  const fe=document.getElementById('rev-jugador-foto'), ie=document.getElementById('rev-jugador-ine'), ae=document.getElementById('rev-jugador-acta');
  fe.href=j.foto_url||'#'; fe.style.display=j.foto_url?'inline':'none';
  ie.href=j.ine_pdf_url||'#'; ie.style.display=j.ine_pdf_url?'inline':'none';
  ae.href=j.acta_pdf_url||'#'; ae.style.display=j.acta_pdf_url?'inline':'none';
  document.getElementById('rev-jugador-estatus').value=j.estatus||'pendiente';
  document.getElementById('rev-jugador-obs').value=j.observaciones||'';
  abrirModal('modal-revisar-jugador');
};
async function guardarRevisionJugador() {
  const btn=document.getElementById('btn-save-revisar-jugador'); btn.disabled=true; btn.textContent='Guardando...';
  const id=document.getElementById('rev-jugador-id').value,estatus=document.getElementById('rev-jugador-estatus').value,obs=document.getElementById('rev-jugador-obs').value;
  try {
    const resp=await apiFetch(`/organizador/jugadores/${id}/estatus`,{method:'PUT',body:JSON.stringify({estatus,observaciones:obs})});
    if (!resp||!resp.ok) throw new Error((await resp.json()).error||'Error');
    toast('Revisión guardada.','success'); cerrarModal('modal-revisar-jugador');
    await Promise.all([cargarJugadores(),cargarAprobaciones()]);
  } catch(err){toast(err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar Revisión';}
}
async function guardarJugador() {
  const n=document.getElementById('form-jugador-nombre').value,e=document.getElementById('form-jugador-equipo').value,
        p=document.getElementById('form-jugador-posicion').value,num=document.getElementById('form-jugador-numero').value,
        f=document.getElementById('form-jugador-fecha').value;
  if (!n||!e||!p||!f){toast('Completa campos obligatorios.','error');return;}
  try{
    const resp=await apiFetch('/organizador/jugadores',{method:'POST',body:JSON.stringify({nombre:n,equipo_id:+e,posicion:p,numero_camiseta:num?+num:null,fecha_nacimiento:f})});
    if(!resp||!resp.ok)throw new Error((await resp.json()).error||'Error');
    cerrarModal('modal-agregar-jugador');toast('Jugador agregado.','success');await cargarJugadores();
  }catch(err){toast(err.message,'error');}
}
async function eliminarJugador(id) {
  if (!confirm('¿Eliminar este jugador?')) return;
  try{ await apiFetch(`/organizador/jugadores/${id}`,{method:'DELETE'}); toast('Jugador eliminado.','success'); await cargarJugadores(); }
  catch(err){toast(err.message,'error');}
}

// ════════════════════════════════════════
// 🏟️ EQUIPOS
// ════════════════════════════════════════
async function cargarEquipos(){
  try{const r=await apiFetch('/organizador/equipos');if(!r||!r.ok)throw new Error();state.equipos=await r.json();renderEquipos();llenarSelectorEquipos();actualizarMetricas();}
  catch{document.getElementById('equipos-table').innerHTML=`<tr><td colspan="4" class="empty-state">Error</td></tr>`;}
}
function renderEquipos(){
  const tb=document.getElementById('equipos-table');if(!tb)return;
  if(!state.equipos.length){tb.innerHTML=`<tr><td colspan="5" class="empty-state">No hay equipos.</td></tr>`;return;}
  tb.innerHTML=state.equipos.map(e=>`<tr><td>${escHtml(e.nombre)}</td><td>${escHtml(e.categoria || '—')}</td><td>${e.entrenador||'—'}</td><td>${e.escudo_url?`<a href="${e.escudo_url}" target="_blank">Ver</a>`:'—'}</td><td><button class="btn btn-sm btn-danger" onclick="eliminarEquipo(${e.id})">Eliminar</button></td></tr>`).join('');
}
async function guardarEquipo(){
  const n=document.getElementById('form-equipo-nombre').value;
  const cat=document.getElementById('form-equipo-categoria').value;
  if(!n){toast('El nombre es obligatorio.','error');return;}
  try{const r=await apiFetch('/organizador/equipos',{method:'POST',body:JSON.stringify({
    nombre:n,
    categoria:cat,
    entrenador:document.getElementById('form-equipo-entrenador').value,
    escudo_url:document.getElementById('form-equipo-escudo').value
  })});
    if(!r||!r.ok)throw new Error((await r.json()).error||'Error');cerrarModal('modal-agregar-equipo');toast('Equipo creado.','success');await cargarEquipos();}
  catch(err){toast(err.message,'error');}
}
async function eliminarEquipo(id){if(!confirm('¿Eliminar equipo?'))return;try{await apiFetch(`/organizador/equipos/${id}`,{method:'DELETE'});toast('Equipo eliminado.','success');await cargarEquipos();}catch(err){toast(err.message,'error');}}

// ════════════════════════════════════════
// 📍 CAMPOS
// ════════════════════════════════════════
async function cargarCampos(){
  try{const r=await apiFetch('/organizador/campos');if(!r||!r.ok)throw new Error();state.campos=await r.json();renderCampos();llenarSelectorCampos();}
  catch{document.getElementById('campos-table').innerHTML=`<tr><td colspan="5" class="empty-state">Error</td></tr>`;}
}
function renderCampos(){
  const tb=document.getElementById('campos-table');if(!tb)return;
  if(!state.campos.length){tb.innerHTML=`<tr><td colspan="5" class="empty-state">No hay campos.</td></tr>`;return;}
  tb.innerHTML=state.campos.map(c=>`<tr><td>${escHtml(c.nombre)}</td><td>${c.direccion||'—'}</td><td>${c.capacidad||'—'}</td><td>${c.activo?'<span style="color:var(--primary)">Activo</span>':'<span style="color:#e74c3c">Inactivo</span>'}</td><td><button class="btn btn-sm btn-danger" onclick="eliminarCampo(${c.id})">Eliminar</button></td></tr>`).join('');
}
async function guardarCampo(){
  const n=document.getElementById('form-campo-nombre').value;if(!n){toast('El nombre es obligatorio.','error');return;}
  try{const r=await apiFetch('/organizador/campos',{method:'POST',body:JSON.stringify({nombre:n,direccion:document.getElementById('form-campo-direccion').value,capacidad:document.getElementById('form-campo-capacidad').value?+document.getElementById('form-campo-capacidad').value:null})});
    if(!r||!r.ok)throw new Error((await r.json()).error||'Error');cerrarModal('modal-agregar-campo');toast('Campo creado.','success');await cargarCampos();}
  catch(err){toast(err.message,'error');}
}
async function eliminarCampo(id){if(!confirm('¿Eliminar campo?'))return;try{await apiFetch(`/organizador/campos/${id}`,{method:'DELETE'});toast('Campo eliminado.','success');await cargarCampos();}catch(err){toast(err.message,'error');}}

// ════════════════════════════════════════
// 🟨 ÁRBITROS
// ════════════════════════════════════════
async function cargarArbitros(){
  try{const r=await apiFetch('/organizador/arbitros');if(!r||!r.ok)throw new Error();state.arbitros=await r.json();renderArbitros();llenarSelectorArbitros();}
  catch{document.getElementById('arbitros-table').innerHTML=`<tr><td colspan="3" class="empty-state">Error</td></tr>`;}
}
function renderArbitros(){
  const tb=document.getElementById('arbitros-table');if(!tb)return;
  if(!state.arbitros.length){tb.innerHTML=`<tr><td colspan="3" class="empty-state">No hay árbitros.</td></tr>`;return;}
  tb.innerHTML=state.arbitros.map(a=>`<tr><td>${escHtml(a.nombre)}</td><td>${a.certificacion||'—'}</td><td><button class="btn btn-sm btn-danger" onclick="eliminarArbitro(${a.id})">Eliminar</button></td></tr>`).join('');
}
async function guardarArbitro(){
  const n=document.getElementById('form-arbitro-nombre').value;if(!n){toast('El nombre es obligatorio.','error');return;}
  try{const r=await apiFetch('/organizador/arbitros',{method:'POST',body:JSON.stringify({nombre:n,certificacion:document.getElementById('form-arbitro-certificacion').value})});
    if(!r||!r.ok)throw new Error((await r.json()).error||'Error');cerrarModal('modal-agregar-arbitro');toast('Árbitro agregado.','success');await cargarArbitros();}
  catch(err){toast(err.message,'error');}
}
async function eliminarArbitro(id){if(!confirm('¿Eliminar árbitro?'))return;try{await apiFetch(`/organizador/arbitros/${id}`,{method:'DELETE'});toast('Árbitro eliminado.','success');await cargarArbitros();}catch(err){toast(err.message,'error');}}

// ════════════════════════════════════════
// 🏆 POSICIONES & 🥅 GOLEADORES
// ════════════════════════════════════════
async function cargarPosiciones(){
  try{const r=await apiFetch('/organizador/posiciones');if(!r||!r.ok)throw new Error();state.posiciones=await r.json();renderPosiciones();}
  catch{document.getElementById('posiciones-table').innerHTML=`<tr><td colspan="7" class="empty-state">Error</td></tr>`;}
}
function renderPosiciones(){
  const tb=document.getElementById('posiciones-table');if(!tb)return;
  if(!state.posiciones.length){tb.innerHTML=`<tr><td colspan="7" class="empty-state">Aún sin resultados.</td></tr>`;return;}
  tb.innerHTML=state.posiciones.map((e,i)=>`<tr><td>${i+1}</td><td>${escHtml(e.equipo)}</td><td>${e.partidos_jugados}</td><td>${e.ganados}</td><td>${e.empatados}</td><td>${e.perdidos}</td><td><strong>${e.puntos}</strong></td></tr>`).join('');
}
async function cargarGoleadores(){
  try{const r=await apiFetch('/organizador/goleadores');if(!r||!r.ok)throw new Error();state.goleadores=await r.json();renderGoleadores();}
  catch{document.getElementById('goleadores-table').innerHTML=`<tr><td colspan="4" class="empty-state">Error</td></tr>`;}
}
function renderGoleadores(){
  const tb=document.getElementById('goleadores-table');if(!tb)return;
  if(!state.goleadores.length){tb.innerHTML=`<tr><td colspan="4" class="empty-state">Sin goles registrados.</td></tr>`;return;}
  tb.innerHTML=state.goleadores.map((g,i)=>`<tr><td>${i+1}</td><td>${escHtml(g.jugador)}</td><td>${escHtml(g.equipo)}</td><td><strong>${g.goles} ⚽</strong></td></tr>`).join('');
}
async function guardarGol(){
  const p=document.getElementById('form-gol-partido').value,j=document.getElementById('form-gol-jugador').value,
        m=document.getElementById('form-gol-minuto').value,a=document.getElementById('form-gol-autogol').value==='true';
  if(!p||!j||!m){toast('Completa los campos obligatorios.','error');return;}
  try{const r=await apiFetch('/organizador/goles',{method:'POST',body:JSON.stringify({partido_id:+p,jugador_id:+j,minuto:+m,es_autogol:a})});
    if(!r||!r.ok)throw new Error((await r.json()).error||'Error');cerrarModal('modal-registrar-gol');toast('Gol registrado.','success');await Promise.all([cargarGoleadores(),cargarPartidos()]);}
  catch(err){toast(err.message,'error');}
}

// ════════════════════════════════════════
// 🔄 ROL AUTOMÁTICO
// ════════════════════════════════════════
async function generarRol(){
  const categoria = document.getElementById('select-categoria-rol').value;
  try{
    const body = { overwrite: false, categoria };
    const r=await apiFetch('/organizador/jornadas/generar',{method:'POST',body:JSON.stringify(body)});
    if(!r)return;
    if(!r.ok){
      const err=await r.json();
      if(r.status===409&&confirm(`${err.error} ¿Regenerar el rol?`)){
        const r2=await apiFetch('/organizador/jornadas/generar',{method:'POST',body:JSON.stringify({overwrite:true, categoria})});
        if(!r2||!r2.ok){toast((await r2.json()).error||'Error','error');return;}
        toast('Rol regenerado.','success');await cargarPartidos();return;
      }
      throw new Error(err.error||'Error');
    }
    toast((await r.json()).mensaje||'Rol generado.','success');await cargarPartidos();
  }catch(err){toast(err.message,'error');}
}

// ════════════════════════════════════════
// 📊 ESTADÍSTICAS DE PARTIDO
// ════════════════════════════════════════
window.switchTab=(event,tabId)=>{
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');
};
let currentMatchStats={lineup:[],eventos:[]};
window.abrirModalEstadisticas=async(id)=>{
  const p=state.partidos.find(x=>x.id===id);if(!p)return;
  document.getElementById('est-partido-id').value=id;
  document.getElementById('est-partido-info').textContent=`${p.equipo_local} vs ${p.equipo_visitante}`;
  document.getElementById('est-local-nombre').textContent=p.equipo_local;
  document.getElementById('est-visitante-nombre').textContent=p.equipo_visitante;
  try{const r=await apiFetch(`/organizador/partidos/${id}/estadisticas`);if(!r.ok)throw new Error();
    currentMatchStats=await r.json();renderLineup(p);renderEventos();llenarSelectEventos(p);abrirModal('modal-estadisticas-partido');}
  catch{toast('Error al cargar estadísticas','error');}
};
function renderLineup(p){
  const draw=(js,c)=>{c.innerHTML=js.map(j=>{const s=currentMatchStats.lineup.some(l=>l.jugador_id===j.id);return`<div class="lineup-item"><input type="checkbox" id="chk-j-${j.id}" ${s?'checked':''} onchange="togglePlayerLineup(${j.id},${j.equipo_id})"><label for="chk-j-${j.id}">${escHtml(j.nombre)} (${j.posicion})</label></div>`;}).join('');};
  draw(state.jugadores.filter(j=>j.equipo===p.equipo_local),    document.getElementById('est-local-lineup'));
  draw(state.jugadores.filter(j=>j.equipo===p.equipo_visitante),document.getElementById('est-visitante-lineup'));
}
window.togglePlayerLineup=(jId,eqId)=>{const i=currentMatchStats.lineup.findIndex(l=>l.jugador_id===jId);if(i>-1)currentMatchStats.lineup.splice(i,1);else currentMatchStats.lineup.push({jugador_id:jId,equipo_id:eqId,minutos_jugados:90});};
function renderEventos(){document.getElementById('est-eventos-list').innerHTML=currentMatchStats.eventos.map((e,i)=>`<li class="evento-item"><span>${e.tipo.toUpperCase()} — ${e.jugador_nombre||'Autogol'} (${e.minuto}')</span><span class="btn-remove" onclick="removeEvento(${i})">&times;</span></li>`).join('');}
function llenarSelectEventos(p){
  const sel=document.getElementById('est-form-jugador');
  const js=state.jugadores.filter(j=>j.equipo===p.equipo_local||j.equipo===p.equipo_visitante);
  sel.innerHTML='<option value="">Jugador (opcional)</option>'+js.map(j=>`<option value="${j.id}" data-equipo="${j.equipo_id}">${escHtml(j.nombre)} (${j.equipo})</option>`).join('');
}
function agregarEvento(){
  const sel=document.getElementById('est-form-jugador'),tipo=document.getElementById('est-form-tipo').value,min=document.getElementById('est-form-minuto').value;
  if(!min){toast('Ingresa el minuto','error');return;}
  const opt=sel.options[sel.selectedIndex];
  currentMatchStats.eventos.push({jugador_id:sel.value?+sel.value:null,equipo_id:opt.dataset.equipo?+opt.dataset.equipo:null,tipo,minuto:+min,jugador_nombre:sel.value?opt.text:'Autogol'});
  renderEventos();
}
window.removeEvento=(i)=>{currentMatchStats.eventos.splice(i,1);renderEventos();};
async function guardarEstadisticas(){
  const id=document.getElementById('est-partido-id').value,btn=document.getElementById('btn-save-estadisticas');
  btn.disabled=true;btn.textContent='Guardando...';
  try{const r=await apiFetch(`/organizador/partidos/${id}/estadisticas`,{method:'POST',body:JSON.stringify(currentMatchStats)});
    if(!r.ok)throw new Error();toast('Estadísticas guardadas.','success');cerrarModal('modal-estadisticas-partido');await cargarPartidos();}
  catch(err){toast(err.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar Estadísticas';}
}

// ── Selectores ────────────────────────────────────────────
function llenarSelectorEquipos(){llenarSelect('form-equipo-local',state.equipos,'Selecciona');llenarSelect('form-equipo-visitante',state.equipos,'Selecciona');llenarSelect('form-jugador-equipo',state.equipos,'Selecciona');}
function llenarSelectorArbitros(){llenarSelect('form-arbitro',state.arbitros,'Sin árbitro');}
function llenarSelectorCampos(){llenarSelect('form-campo-partido',state.campos,'Sin campo');}
function llenarSelectorPartidos(){const s=document.getElementById('form-gol-partido');if(!s)return;s.innerHTML='<option value="">Selecciona partido</option>'+state.partidos.map(p=>`<option value="${p.id}">${new Date(p.fecha_hora).toLocaleDateString('es-ES')} — ${p.equipo_local} vs ${p.equipo_visitante}</option>`).join('');}
function llenarSelectorJugadores(){llenarSelect('form-gol-jugador',state.jugadores,'Selecciona jugador');}
function llenarSelect(id,items,ph,fn=i=>i.nombre||i.id){const s=document.getElementById(id);if(!s)return;s.innerHTML=`<option value="">${ph}</option>`+items.map(i=>`<option value="${i.id}">${fn(i)}</option>`).join('');}

function escHtml(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
