// =========================================================================
// SICREM - Control de Operación
// app.js - Lógica completa con autenticación
// =========================================================================

// =========================================================================
// 1. CONFIGURACIÓN SUPABASE
// =========================================================================
const SUPABASE_URL = "https://djvmwlifmzohdostrkag.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdm13bGlmbXpvaGRvc3Rya2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTM2NjIsImV4cCI6MjA5ODQ4OTY2Mn0.gZlHa358_VZmLwYOWUhu_8L7UtQhFcdiPM3aPe2sg3o";

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================================
// 2. BASE DE DATOS LOCAL (IndexedDB con Dexie)
// =========================================================================
const db = new Dexie("SicremLocalDB");

db.version(3).stores({
  equipos: 'id, nombre_equipo, capacidad_nominal',
  minerales: 'id, nombre_mineral, tiene_subcomponente, densidad, porcentaje_subcomponente_defecto',
  viajes_pendientes: '++id_local, id_equipo, id_mineral, volumen_total, sincronizado'
});

// =========================================================================
// 3. ESTADO DE LA SESIÓN
// =========================================================================
let SESION = {
  user: null,       // usuario de Supabase Auth
  id_empresa: null, // uuid de la empresa
  id_usuario: null, // uuid en tabla usuarios
  nombre: ''
};

// =========================================================================
// 4. REFERENCIAS AL DOM
// =========================================================================
// Auth
const pantallaAuth = document.getElementById('pantalla-auth');
const pantallaApp = document.getElementById('pantalla-app');
const tabLogin = document.getElementById('tab-login');
const tabRegistro = document.getElementById('tab-registro');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const loginError = document.getElementById('login-error');
const registroError = document.getElementById('registro-error');
const registroOk = document.getElementById('registro-ok');

// App principal
const lblEmpresa = document.getElementById('lbl-empresa');
const btnLogout = document.getElementById('btn-logout');
const statusIndicator = document.getElementById('connection-status');
const inputFechaTrabajo = document.getElementById('input-fecha-trabajo');
const lblFechaTrabajo = document.getElementById('lbl-fecha-trabajo');

// Navegación
const btnNavRegistro = document.getElementById('btn-nav-registro');
const btnNavCatalogos = document.getElementById('btn-nav-catalogos');
const btnNavReportes = document.getElementById('btn-nav-reportes');
const vistaRegistro = document.getElementById('vista-registro');
const vistaCatalogos = document.getElementById('vista-catalogos');
const vistaReportes = document.getElementById('vista-reportes');

// Formulario de viajes
const formulario = document.getElementById('viaje-form');
const selectEquipo = document.getElementById('select-equipo');
const selectMineral = document.getElementById('select-mineral');
const txtVolumenTotal = document.getElementById('volumen-total');
const txtPorcentajeArena = document.getElementById('porcentaje-arena');
const txtObservaciones = document.getElementById('observaciones');
const lblPendientes = document.getElementById('pendientes-count');

// Formularios de catálogos
const formEquipo = document.getElementById('form-catalogo-equipo');
const formMineral = document.getElementById('form-catalogo-mineral');
const chkMineralSub = document.getElementById('cat-mineral-sub');
const seccionNombreSub = document.getElementById('seccion-nombre-sub');

// =========================================================================
// 5. AUTENTICACIÓN - TABS
// =========================================================================
tabLogin.addEventListener('click', () => {
  formLogin.classList.remove('hidden');
  formRegistro.classList.add('hidden');
  tabLogin.className = "flex-1 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white transition";
  tabRegistro.className = "flex-1 py-2 text-sm font-semibold rounded-md text-slate-400 transition";
  limpiarMensajesAuth();
});

tabRegistro.addEventListener('click', () => {
  formRegistro.classList.remove('hidden');
  formLogin.classList.add('hidden');
  tabRegistro.className = "flex-1 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white transition";
  tabLogin.className = "flex-1 py-2 text-sm font-semibold rounded-md text-slate-400 transition";
  limpiarMensajesAuth();
});

function limpiarMensajesAuth() {
  loginError.classList.add('hidden');
  registroError.classList.add('hidden');
  registroOk.classList.add('hidden');
}

// Toggle ver/ocultar contraseña en registro
document.getElementById('btn-ver-password').addEventListener('click', () => {
  const input = document.getElementById('reg-password');
  const btn = document.getElementById('btn-ver-password');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
});

// =========================================================================
// 6. REGISTRO DE CUENTA NUEVA (Empresa + Usuario)
// =========================================================================
formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensajesAuth();

  const nombreEmpresa = document.getElementById('reg-empresa').value.trim();
  const nit = document.getElementById('reg-nit').value.trim();
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supa.auth.signUp({
    email: email,
    password: password
  });

  if (authError) {
    registroError.textContent = "Error: " + authError.message;
    registroError.classList.remove('hidden');
    return;
  }

  // 2. Crear la empresa
  const { data: empresaData, error: errEmpresa } = await supa.from('empresas').insert([{
    nombre_empresa: nombreEmpresa,
    identificacion: nit
  }]).select().single();

  if (errEmpresa) {
    registroError.textContent = "Error al crear empresa: " + errEmpresa.message;
    registroError.classList.remove('hidden');
    return;
  }

  // 3. Crear el registro de usuario vinculado a la empresa
  const { error: errUsuario } = await supa.from('usuarios').insert([{
    id: authData.user.id,
    id_empresa: empresaData.id,
    nombre: nombre,
    correo: email,
    rol: 'admin'
  }]);

  if (errUsuario) {
    registroError.textContent = "Error al crear usuario: " + errUsuario.message;
    registroError.classList.remove('hidden');
    return;
  }

  registroOk.textContent = "✅ Cuenta creada. Revisa tu correo para confirmar, luego inicia sesión.";
  registroOk.classList.remove('hidden');
  formRegistro.reset();
});

// =========================================================================
// 7. LOGIN
// =========================================================================
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensajesAuth();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { data, error } = await supa.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    loginError.textContent = "Error: " + error.message;
    loginError.classList.remove('hidden');
    return;
  }

  await cargarSesionUsuario(data.user);
});

// =========================================================================
// 8. CARGAR DATOS DEL USUARIO AUTENTICADO
// =========================================================================
async function cargarSesionUsuario(user) {
  // Obtener datos del usuario desde la tabla 'usuarios'
  const { data: datosUsuario, error } = await supa.from('usuarios')
    .select('*, empresas(nombre_empresa)')
    .eq('id', user.id)
    .single();

  if (error || !datosUsuario) {
    loginError.textContent = "No se encontró el perfil de usuario.";
    loginError.classList.remove('hidden');
    await supa.auth.signOut();
    return;
  }

  SESION.user = user;
  SESION.id_empresa = datosUsuario.id_empresa;
  SESION.id_usuario = datosUsuario.id;
  SESION.nombre = datosUsuario.nombre;

  // Mostrar app principal
  pantallaAuth.classList.add('hidden');
  pantallaApp.classList.remove('hidden');
  pantallaApp.classList.add('fade-in');

  lblEmpresa.textContent = datosUsuario.empresas?.nombre_empresa || 'Mi Empresa';

  // Inicializar fecha de trabajo
  inicializarFechaTrabajo();

  // Cargar catálogos y pendientes
  await cargarCatalogosDesdeBD();
  await actualizarContadorPendientes();
  await cargarViajesDelDia();
  iniciarSincronizacionAutomatica();
  intentarSincronizar();
}

// =========================================================================
// 9. LOGOUT
// =========================================================================
btnLogout.addEventListener('click', async () => {
  await supa.auth.signOut();
  SESION = { user: null, id_empresa: null, id_usuario: null, nombre: '' };
  pantallaApp.classList.add('hidden');
  pantallaAuth.classList.remove('hidden');
  formLogin.reset();
  formRegistro.reset();
  limpiarMensajesAuth();
});

// =========================================================================
// 10. VERIFICAR SESIÓN AL CARGAR LA PÁGINA
// =========================================================================
async function verificarSesionExistente() {
  const { data: { session } } = await supa.auth.getSession();
  if (session && session.user) {
    await cargarSesionUsuario(session.user);
  }
}

// =========================================================================
// 11. NAVEGACIÓN ENTRE VISTAS
// =========================================================================
const navInactivo = "py-3 px-2 w-full text-center hover:text-slate-200";
const navActivo = "py-3 px-2 text-blue-400 border-b-2 border-blue-400 w-full text-center";

btnNavRegistro.addEventListener('click', () => {
  vistaRegistro.classList.remove('hidden');
  vistaCatalogos.classList.add('hidden');
  vistaReportes.classList.add('hidden');
  btnNavRegistro.className = navActivo;
  btnNavCatalogos.className = navInactivo;
  btnNavReportes.className = navInactivo;
});

btnNavCatalogos.addEventListener('click', () => {
  vistaCatalogos.classList.remove('hidden');
  vistaRegistro.classList.add('hidden');
  vistaReportes.classList.add('hidden');
  btnNavCatalogos.className = navActivo;
  btnNavRegistro.className = navInactivo;
  btnNavReportes.className = navInactivo;
});

btnNavReportes.addEventListener('click', () => {
  vistaReportes.classList.remove('hidden');
  vistaRegistro.classList.add('hidden');
  vistaCatalogos.classList.add('hidden');
  btnNavReportes.className = navActivo;
  btnNavRegistro.className = navInactivo;
  btnNavCatalogos.className = navInactivo;
  // Pre-llenar fechas con el mes actual
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = hoy.toISOString().split('T')[0];
  document.getElementById('reporte-fecha-desde').value = primerDia;
  document.getElementById('reporte-fecha-hasta').value = ultimoDia;
});

// =========================================================================
// 11b. FECHA DE TRABAJO
// =========================================================================
function inicializarFechaTrabajo() {
  const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  inputFechaTrabajo.value = hoy;
  actualizarLabelFecha();
}

function actualizarLabelFecha() {
  const fecha = inputFechaTrabajo.value;
  if (!fecha) return;
  const [year, month, day] = fecha.split('-');
  lblFechaTrabajo.textContent = `${day}/${month}/${year}`;
}

// El listener de cambio de fecha está en la sección 17 (lista de viajes del día)

function obtenerFechaViaje() {
  // Combina la fecha de trabajo con la hora actual
  const fecha = inputFechaTrabajo.value; // YYYY-MM-DD
  const ahora = new Date();
  const hora = ahora.toTimeString().split(' ')[0]; // HH:MM:SS
  return new Date(`${fecha}T${hora}`).toISOString();
}

// =========================================================================
// 12. INTERFAZ DINÁMICA (subcomponente, cálculos)
// =========================================================================
chkMineralSub.addEventListener('change', (e) => {
  seccionNombreSub.classList.toggle('hidden', !e.target.checked);
});

selectMineral.addEventListener('change', (e) => {
  const option = e.target.selectedOptions[0];
  if (!option) return;
  const tieneSubcomponente = option.getAttribute('data-subcomponente') === 'true';

  if (tieneSubcomponente) {
    document.getElementById('seccion-subcomponente').classList.remove('hidden');
    txtPorcentajeArena.setAttribute('required', 'required');
    // Precargar % por defecto del catálogo
    const porcentajeDefecto = option.getAttribute('data-porcentaje-defecto') || 0;
    txtPorcentajeArena.value = porcentajeDefecto;
    calcularDesglose();
  } else {
    document.getElementById('seccion-subcomponente').classList.add('hidden');
    txtPorcentajeArena.removeAttribute('required');
    txtPorcentajeArena.value = '';
    calcularDesglose();
  }
});

async function calcularDesglose() {
  const cantidadConteo = parseFloat(txtVolumenTotal.value) || 0;
  const idEquipo = selectEquipo.value;

  if (!idEquipo) return;

  const datosEquipo = await db.equipos.get(idEquipo);
  if (!datosEquipo) return;

  const totalVolumen = cantidadConteo * (datosEquipo.capacidad_nominal || 0);
  const porcentaje = parseFloat(txtPorcentajeArena.value) || 0;

  const arena = totalVolumen * (porcentaje / 100);
  const grava = totalVolumen - arena;

  document.getElementById('preview-arena').textContent = arena.toFixed(2);
  document.getElementById('preview-grava').textContent = grava.toFixed(2);
}

txtVolumenTotal.addEventListener('input', calcularDesglose);
txtPorcentajeArena.addEventListener('input', calcularDesglose);
selectEquipo.addEventListener('change', calcularDesglose);

// =========================================================================
// 13. CARGA DE CATÁLOGOS (Supabase → Local → Selects)
// =========================================================================
async function cargarCatalogosDesdeBD() {
  try {
    if (navigator.onLine) {
      const { data: bdequipos } = await supa.from('equipos').select('*')
        .eq('id_empresa', SESION.id_empresa).eq('activo', true);
      const { data: bdminerales } = await supa.from('minerales').select('*')
        .eq('id_empresa', SESION.id_empresa).eq('activo', true);

      if (bdequipos) {
        await db.equipos.clear();
        await db.equipos.bulkAdd(bdequipos);
      }
      if (bdminerales) {
        await db.minerales.clear();
        await db.minerales.bulkAdd(bdminerales);
      }
    }
  } catch (err) {
    console.warn("Usando almacenamiento local offline para catálogos.", err);
  }

  const listaEquipos = await db.equipos.toArray();
  selectEquipo.innerHTML = '<option value="">Seleccione un equipo...</option>';
  listaEquipos.forEach(eq => {
    selectEquipo.innerHTML += `<option value="${eq.id}">${eq.nombre_equipo} ${eq.placa_interno ? `(${eq.placa_interno})` : ''}</option>`;
  });
  renderizarListaEquipos(listaEquipos);

  const listaMinerales = await db.minerales.toArray();
  selectMineral.innerHTML = '<option value="">Seleccione el material...</option>';
  listaMinerales.forEach(min => {
    selectMineral.innerHTML += `<option value="${min.id}" data-subcomponente="${min.tiene_subcomponente}" data-porcentaje-defecto="${min.porcentaje_subcomponente_defecto || 0}">${min.nombre_mineral}</option>`;
  });
  renderizarListaMinerales(listaMinerales);
}

// =========================================================================
// 14. ALTA DE CATÁLOGOS (Equipos y Minerales) + VALIDACIÓN DUPLICADOS
// =========================================================================
formEquipo.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombreEquipo = document.getElementById('cat-equipo-nombre').value.trim();
  const placaEquipo = document.getElementById('cat-equipo-placa').value.trim();

  if (!navigator.onLine) { mostrarAlerta("Necesitas conexión a internet para guardar equipos.", "warning"); return; }

  // MODO EDICIÓN
  if (editandoEquipoId) {
    const datosActualizar = {
      nombre_equipo: nombreEquipo,
      placa_interno: placaEquipo,
      capacidad_nominal: parseFloat(document.getElementById('cat-equipo-capacidad').value) || 0
    };
    const { error } = await supa.from('equipos').update(datosActualizar).eq('id', editandoEquipoId);
    if (error) { mostrarAlerta("Error: " + error.message, "error"); return; }
    mostrarAlerta("Equipo actualizado correctamente.", "success");
    resetearFormEquipo();
    await cargarCatalogosDesdeBD();
    return;
  }

  // MODO CREACIÓN - Validar duplicado por placa
  if (placaEquipo) {
    const equiposExistentes = await db.equipos.toArray();
    const duplicado = equiposExistentes.find(eq =>
      eq.placa_interno && eq.placa_interno.toLowerCase() === placaEquipo.toLowerCase()
    );
    if (duplicado) {
      mostrarAlerta("Ya existe un equipo con el código/placa: " + placaEquipo, "warning");
      return;
    }
  }

  const nuevoEquipo = {
    id_empresa: SESION.id_empresa,
    nombre_equipo: nombreEquipo,
    placa_interno: placaEquipo,
    capacidad_nominal: parseFloat(document.getElementById('cat-equipo-capacidad').value) || 0,
    activo: true
  };

  const { error } = await supa.from('equipos').insert([nuevoEquipo]);
  if (error) { mostrarAlerta("Error: " + error.message, "error"); return; }

  mostrarAlerta("Equipo guardado correctamente.", "success");
  resetearFormEquipo();
  await cargarCatalogosDesdeBD();
});

formMineral.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombreMineral = document.getElementById('cat-mineral-nombre').value.trim();

  if (!navigator.onLine) { mostrarAlerta("Necesitas conexión a internet para guardar minerales.", "warning"); return; }

  const tieneSub = chkMineralSub.checked;

  // MODO EDICIÓN
  if (editandoMineralId) {
    const datosActualizar = {
      nombre_mineral: nombreMineral,
      tiene_subcomponente: tieneSub,
      nombre_subcomponente: tieneSub ? document.getElementById('cat-mineral-nombre-sub').value.trim() : null,
      porcentaje_subcomponente_defecto: tieneSub ? parseFloat(document.getElementById('cat-mineral-porcentaje-defecto').value) || 0 : 0,
      densidad: parseFloat(document.getElementById('cat-mineral-densidad').value) || 1.0
    };
    const { error } = await supa.from('minerales').update(datosActualizar).eq('id', editandoMineralId);
    if (error) { mostrarAlerta("Error: " + error.message, "error"); return; }
    mostrarAlerta("Mineral actualizado correctamente.", "success");
    resetearFormMineral();
    await cargarCatalogosDesdeBD();
    return;
  }

  // MODO CREACIÓN - Validar duplicado por nombre
  const mineralesExistentes = await db.minerales.toArray();
  const duplicado = mineralesExistentes.find(min =>
    min.nombre_mineral.toLowerCase() === nombreMineral.toLowerCase()
  );
  if (duplicado) {
    mostrarAlerta("Ya existe un mineral con el nombre: " + nombreMineral, "warning");
    return;
  }

  const nuevoMineral = {
    id_empresa: SESION.id_empresa,
    nombre_mineral: nombreMineral,
    tiene_subcomponente: tieneSub,
    nombre_subcomponente: tieneSub ? document.getElementById('cat-mineral-nombre-sub').value.trim() : null,
    porcentaje_subcomponente_defecto: tieneSub ? parseFloat(document.getElementById('cat-mineral-porcentaje-defecto').value) || 0 : 0,
    densidad: parseFloat(document.getElementById('cat-mineral-densidad').value) || 1.0
  };

  const { error } = await supa.from('minerales').insert([nuevoMineral]);
  if (error) { mostrarAlerta("Error: " + error.message, "error"); return; }

  mostrarAlerta("Mineral guardado correctamente.", "success");
  resetearFormMineral();
  await cargarCatalogosDesdeBD();
});

// =========================================================================
// 14b. RENDERIZAR LISTAS DE CATÁLOGOS
// =========================================================================
let editandoEquipoId = null;
let editandoMineralId = null;

function renderizarListaEquipos(equipos) {
  const contenedor = document.getElementById('lista-equipos');
  if (equipos.length === 0) {
    contenedor.innerHTML = '<p class="text-xs text-slate-500 italic">Sin equipos aún</p>';
    return;
  }
  contenedor.innerHTML = equipos.map(eq => `
    <div class="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 cursor-pointer hover:border-blue-500/50 transition" onclick="editarEquipo('${eq.id}')">
      <div>
        <p class="text-sm text-slate-200 font-medium">${eq.nombre_equipo}</p>
        <p class="text-xs text-slate-500">${eq.placa_interno || 'Sin código'} · ${eq.capacidad_nominal} m³</p>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-blue-400 text-xs">✏️</span>
        <button onclick="event.stopPropagation(); eliminarEquipo('${eq.id}')" class="text-rose-400 hover:text-rose-300 text-xs px-2 py-1">✕</button>
      </div>
    </div>
  `).join('');
}

function renderizarListaMinerales(minerales) {
  const contenedor = document.getElementById('lista-minerales');
  if (minerales.length === 0) {
    contenedor.innerHTML = '<p class="text-xs text-slate-500 italic">Sin minerales aún</p>';
    return;
  }
  contenedor.innerHTML = minerales.map(min => `
    <div class="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 cursor-pointer hover:border-blue-500/50 transition" onclick="editarMineral('${min.id}')">
      <div>
        <p class="text-sm text-slate-200 font-medium">${min.nombre_mineral}</p>
        <p class="text-xs text-slate-500">Densidad: ${min.densidad} Ton/m³${min.tiene_subcomponente ? ` · Sub: ${min.porcentaje_subcomponente_defecto || 0}%` : ''}</p>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-blue-400 text-xs">✏️</span>
        <button onclick="event.stopPropagation(); eliminarMineral('${min.id}')" class="text-rose-400 hover:text-rose-300 text-xs px-2 py-1">✕</button>
      </div>
    </div>
  `).join('');
}

// Cargar equipo en formulario para editar
async function editarEquipo(id) {
  const equipo = await db.equipos.get(id);
  if (!equipo) return;

  editandoEquipoId = id;
  document.getElementById('cat-equipo-nombre').value = equipo.nombre_equipo;
  document.getElementById('cat-equipo-placa').value = equipo.placa_interno || '';
  document.getElementById('cat-equipo-capacidad').value = equipo.capacidad_nominal || 0;

  // Cambiar botón a "Actualizar"
  const btnSubmit = formEquipo.querySelector('button[type="submit"]');
  btnSubmit.textContent = "Actualizar Equipo";
  btnSubmit.className = "w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold p-2 rounded-lg transition";

  // Scroll al formulario
  formEquipo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Cargar mineral en formulario para editar
async function editarMineral(id) {
  const mineral = await db.minerales.get(id);
  if (!mineral) return;

  editandoMineralId = id;
  document.getElementById('cat-mineral-nombre').value = mineral.nombre_mineral;
  document.getElementById('cat-mineral-densidad').value = mineral.densidad || 1.0;
  
  chkMineralSub.checked = mineral.tiene_subcomponente || false;
  if (mineral.tiene_subcomponente) {
    seccionNombreSub.classList.remove('hidden');
    document.getElementById('cat-mineral-nombre-sub').value = mineral.nombre_subcomponente || 'Arena de Río';
    document.getElementById('cat-mineral-porcentaje-defecto').value = mineral.porcentaje_subcomponente_defecto || 0;
  } else {
    seccionNombreSub.classList.add('hidden');
  }

  // Cambiar botón a "Actualizar"
  const btnSubmit = formMineral.querySelector('button[type="submit"]');
  btnSubmit.textContent = "Actualizar Mineral";
  btnSubmit.className = "w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold p-2 rounded-lg transition";

  // Scroll al formulario
  formMineral.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetearFormEquipo() {
  editandoEquipoId = null;
  formEquipo.reset();
  const btnSubmit = formEquipo.querySelector('button[type="submit"]');
  btnSubmit.textContent = "Guardar Equipo";
  btnSubmit.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold p-2 rounded-lg transition";
}

function resetearFormMineral() {
  editandoMineralId = null;
  formMineral.reset();
  seccionNombreSub.classList.add('hidden');
  const btnSubmit = formMineral.querySelector('button[type="submit"]');
  btnSubmit.textContent = "Guardar Mineral";
  btnSubmit.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold p-2 rounded-lg transition";
}

// Eliminar (desactivar) equipo
async function eliminarEquipo(id) {
  const confirmar = await mostrarConfirmacion("¿Desactivar este equipo? No aparecerá más en los registros.");
  if (!confirmar) return;
  const { error } = await supa.from('equipos').update({ activo: false }).eq('id', id);
  if (error) { mostrarAlerta("Error: " + error.message, "error"); return; }
  resetearFormEquipo();
  await cargarCatalogosDesdeBD();
}

// Eliminar (desactivar) mineral
async function eliminarMineral(id) {
  const confirmar = await mostrarConfirmacion("¿Desactivar este mineral? No aparecerá más en los registros.");
  if (!confirmar) return;
  const { error } = await supa.from('minerales').update({ activo: false }).eq('id', id);
  if (error) { mostrarAlerta("Error: " + error.message, "error"); return; }
  resetearFormMineral();
  await cargarCatalogosDesdeBD();
}

// =========================================================================
// 15. REGISTRO DE VIAJES
// =========================================================================
let editandoViajeId = null;

formulario.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idEquipo = selectEquipo.value;
  const idMineral = selectMineral.value;
  const cantidadConteo = parseFloat(txtVolumenTotal.value);

  const datosEquipo = await db.equipos.get(idEquipo);
  const datosMineral = await db.minerales.get(idMineral);

  if (!datosEquipo || !datosMineral) {
    mostrarAlerta("No se encontraron los parámetros requeridos.", "error");
    return;
  }

  const volumenTotalCalculado = cantidadConteo * (datosEquipo.capacidad_nominal || 0);

  const optionMineral = selectMineral.selectedOptions[0];
  const tieneSubcomponente = optionMineral.getAttribute('data-subcomponente') === 'true';
  const porcentajeSubcomponente = tieneSubcomponente ? parseFloat(txtPorcentajeArena.value) || 0 : 0;

  const volumenSubcomponenteNeto = volumenTotalCalculado * (porcentajeSubcomponente / 100);
  const volumenPrincipalNeto = volumenTotalCalculado - volumenSubcomponenteNeto;

  const toneladasEstimadas = volumenTotalCalculado * (datosMineral.densidad || 1.0);

  const datosViaje = {
    id_empresa: SESION.id_empresa,
    id_usuario: SESION.id_usuario,
    id_equipo: idEquipo,
    id_mineral: idMineral,
    fecha_viaje: obtenerFechaViaje(),
    volumen_total: parseFloat(volumenTotalCalculado.toFixed(2)),
    porcentaje_subcomponente: porcentajeSubcomponente,
    volumen_principal_neto: parseFloat(volumenPrincipalNeto.toFixed(2)),
    volumen_subcomponente_neto: parseFloat(volumenSubcomponenteNeto.toFixed(2)),
    cantidad_conteo: cantidadConteo,
    capacidad_equipo_usada: datosEquipo.capacidad_nominal || 0,
    densidad_usada: datosMineral.densidad || 1.0,
    toneladas_estimadas: parseFloat(toneladasEstimadas.toFixed(2)),
    observaciones: txtObservaciones.value.trim(),
    sincronizado: 0
  };

  try {
    if (editandoViajeId) {
      // MODO EDICIÓN
      const viajeExistente = await db.viajes_pendientes.get(editandoViajeId);
      
      if (viajeExistente && viajeExistente.sincronizado && viajeExistente.id_supabase) {
        // Ya está en Supabase → actualizar allá también
        datosViaje.sincronizado = 1;
        const { id_empresa, id_usuario, sincronizado, ...datosUpdate } = datosViaje;
        const { error } = await supa.from('registro_viajes').update(datosUpdate).eq('id', viajeExistente.id_supabase);
        if (error) {
          // Si falla el update remoto, marcarlo como pendiente de re-sincronizar
          datosViaje.sincronizado = 0;
        }
      } else {
        datosViaje.sincronizado = 0;
      }

      await db.viajes_pendientes.update(editandoViajeId, datosViaje);
      mostrarAlerta("Registro actualizado correctamente.", "success");
      resetearFormViaje();
    } else {
      // MODO CREACIÓN
      await db.viajes_pendientes.add(datosViaje);
      mostrarAlerta("Registro guardado correctamente.", "success");
      formulario.reset();
      txtVolumenTotal.value = "1";
      document.getElementById('seccion-subcomponente').classList.add('hidden');
    }
    await actualizarContadorPendientes();
    await cargarViajesDelDia();
    intentarSincronizar();
  } catch (error) {
    mostrarAlerta("Error al guardar el registro local.", "error");
  }
});

// Cargar viaje en formulario para editar
async function editarViaje(idLocal) {
  const viaje = await db.viajes_pendientes.get(idLocal);
  if (!viaje) return;

  editandoViajeId = idLocal;

  // Llenar el formulario
  selectEquipo.value = viaje.id_equipo;
  selectMineral.value = viaje.id_mineral;
  txtVolumenTotal.value = viaje.cantidad_conteo || 1;
  txtObservaciones.value = viaje.observaciones || '';

  // Disparar el cambio de mineral para mostrar subcomponente si aplica
  const optMineral = selectMineral.selectedOptions[0];
  if (optMineral && optMineral.getAttribute('data-subcomponente') === 'true') {
    document.getElementById('seccion-subcomponente').classList.remove('hidden');
    txtPorcentajeArena.value = viaje.porcentaje_subcomponente || 0;
  } else {
    document.getElementById('seccion-subcomponente').classList.add('hidden');
  }

  calcularDesglose();

  // Cambiar botón
  const btnSubmit = formulario.querySelector('button[type="submit"]');
  btnSubmit.innerHTML = "Actualizar Registro";
  btnSubmit.className = "w-full bg-amber-600 hover:bg-amber-500 text-white font-bold p-3 rounded-lg transition shadow-lg flex justify-center items-center gap-2";

  // Scroll al formulario
  formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetearFormViaje() {
  editandoViajeId = null;
  formulario.reset();
  txtVolumenTotal.value = "1";
  document.getElementById('seccion-subcomponente').classList.add('hidden');
  const btnSubmit = formulario.querySelector('button[type="submit"]');
  btnSubmit.innerHTML = "Guardar Registro";
  btnSubmit.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-3 rounded-lg transition shadow-lg flex justify-center items-center gap-2";
}

// =========================================================================
// 16. SINCRONIZACIÓN
// =========================================================================
async function actualizarContadorPendientes() {
  const pendientes = await db.viajes_pendientes.where('sincronizado').equals(0).count();
  lblPendientes.textContent = pendientes;
}

function mostrarEstadoOnline() {
  statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> En Línea`;
  statusIndicator.className = "flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/20";
}

function mostrarEstadoOffline() {
  statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Offline`;
  statusIndicator.className = "flex items-center gap-2 bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-semibold border border-rose-500/20";
}

async function intentarSincronizar() {
  if (!navigator.onLine) { mostrarEstadoOffline(); return; }

  const viajesPendientes = await db.viajes_pendientes.where('sincronizado').equals(0).toArray();
  if (viajesPendientes.length === 0) { mostrarEstadoOnline(); return; }

  statusIndicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Sincronizando...`;
  statusIndicator.className = "flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/20";

  for (const viaje of viajesPendientes) {
    const { id_local, sincronizado, id_supabase, ...datosParaSupabase } = viaje;
    try {
      const { data, error } = await supa.from('registro_viajes').insert([datosParaSupabase]).select('id').single();
      if (error) throw error;
      await db.viajes_pendientes.update(viaje.id_local, { sincronizado: 1, id_supabase: data.id });
    } catch (err) {
      console.warn("Error sincronizando viaje:", err);
      mostrarEstadoOffline();
      return;
    }
  }
  mostrarEstadoOnline();
  await actualizarContadorPendientes();
  await cargarViajesDelDia(); // Refrescar lista para actualizar iconos
}

// Sincronización automática cada 30 segundos si hay conexión
let intervaloSync = null;

function iniciarSincronizacionAutomatica() {
  if (intervaloSync) clearInterval(intervaloSync);
  intervaloSync = setInterval(async () => {
    if (navigator.onLine && SESION.id_empresa) {
      const pendientes = await db.viajes_pendientes.where('sincronizado').equals(0).count();
      if (pendientes > 0) {
        await intentarSincronizar();
      }
    }
  }, 30000); // cada 30 segundos
}

window.addEventListener('online', () => { 
  intentarSincronizar(); 
  cargarCatalogosDesdeBD(); 
});
window.addEventListener('offline', mostrarEstadoOffline);

// =========================================================================
// 17. LISTA DE VIAJES DEL DÍA
// =========================================================================
async function cargarViajesDelDia() {
  const fechaTrabajo = inputFechaTrabajo.value; // YYYY-MM-DD
  const contenedor = document.getElementById('lista-viajes-dia');
  const lblTotal = document.getElementById('lbl-total-viajes-dia');
  const resumenDiv = document.getElementById('resumen-dia');

  let viajesDelDia = [];

  // 1. Traer viajes de Supabase para esta fecha (si hay conexión)
  if (navigator.onLine && SESION.id_empresa) {
    try {
      const inicioFecha = `${fechaTrabajo}T00:00:00`;
      const finFecha = `${fechaTrabajo}T23:59:59`;
      const { data: viajesRemoto } = await supa.from('registro_viajes')
        .select('*')
        .eq('id_empresa', SESION.id_empresa)
        .gte('fecha_viaje', inicioFecha)
        .lte('fecha_viaje', finFecha)
        .order('fecha_viaje', { ascending: true });

      if (viajesRemoto && viajesRemoto.length > 0) {
        viajesDelDia = viajesRemoto.map(v => ({
          ...v,
          id_local: null,
          id_supabase: v.id,
          sincronizado: 1
        }));
      }
    } catch (err) {
      console.warn("No se pudieron cargar viajes remotos:", err);
    }
  }

  // 2. Agregar viajes locales pendientes (no sincronizados) de esta fecha
  const viajesLocales = await db.viajes_pendientes.toArray();
  const pendientesDelDia = viajesLocales.filter(v => {
    if (!v.fecha_viaje) return false;
    return v.fecha_viaje.startsWith(fechaTrabajo) && !v.sincronizado;
  });

  viajesDelDia = [...viajesDelDia, ...pendientesDelDia];

  // Ordenar por fecha
  viajesDelDia.sort((a, b) => new Date(a.fecha_viaje) - new Date(b.fecha_viaje));

  if (viajesDelDia.length === 0) {
    contenedor.innerHTML = '<p class="text-xs text-slate-500 italic text-center py-2">Sin viajes registrados este día</p>';
    lblTotal.textContent = "0 registros";
    resumenDiv.classList.add('hidden');
    return;
  }

  // Obtener nombres de equipos y minerales
  const equipos = await db.equipos.toArray();
  const minerales = await db.minerales.toArray();
  const mapEquipos = Object.fromEntries(equipos.map(e => [e.id, e]));
  const mapMinerales = Object.fromEntries(minerales.map(m => [m.id, m]));

  let totalVolumen = 0;
  let totalToneladas = 0;

  contenedor.innerHTML = viajesDelDia.map((v, index) => {
    const equipo = mapEquipos[v.id_equipo];
    const mineral = mapMinerales[v.id_mineral];
    const hora = v.fecha_viaje ? new Date(v.fecha_viaje).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const estadoSync = v.sincronizado ? '☁️' : '⏳';

    totalVolumen += parseFloat(v.volumen_total) || 0;
    totalToneladas += parseFloat(v.toneladas_estimadas) || 0;

    // Desglose subcomponente
    const porcentajeSub = parseFloat(v.porcentaje_subcomponente) || 0;
    const tieneDesglose = porcentajeSub > 0;
    const desgloseHTML = tieneDesglose ? `
            <div class="flex items-center gap-3 mt-1">
              <span class="text-xs text-emerald-400">Grava: ${v.volumen_principal_neto} m³</span>
              <span class="text-xs text-amber-400">Arena: ${v.volumen_subcomponente_neto} m³ (${porcentajeSub}%)</span>
            </div>` : '';

    // Solo editables los locales pendientes
    const esLocal = v.id_local != null;
    const claseClick = esLocal ? 'cursor-pointer hover:border-blue-500/50' : '';
    const onClickViaje = esLocal ? `onclick="editarViaje(${v.id_local})"` : '';
    const iconoEditar = esLocal ? '<span class="text-blue-400 text-xs">✏️</span>' : '';

    return `
      <div class="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50 transition ${claseClick}" ${onClickViaje}>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">${hora}</span>
              <span class="text-xs">${estadoSync}</span>
              <span class="text-xs font-medium text-slate-200">${equipo?.nombre_equipo || 'Equipo'} ${equipo?.placa_interno ? '(' + equipo.placa_interno + ')' : ''}</span>
              ${iconoEditar}
            </div>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-xs text-slate-400">${mineral?.nombre_mineral || 'Material'}</span>
              <span class="text-xs text-blue-400 font-medium">${v.cantidad_conteo || 1} viaje(s) · ${v.volumen_total} m³</span>
            </div>${desgloseHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');

  lblTotal.textContent = viajesDelDia.length + " registro" + (viajesDelDia.length > 1 ? "s" : "");

  // Calcular totales de subcomponentes
  let totalGrava = 0;
  let totalArena = 0;
  viajesDelDia.forEach(v => {
    totalGrava += parseFloat(v.volumen_principal_neto) || 0;
    totalArena += parseFloat(v.volumen_subcomponente_neto) || 0;
  });

  // Resumen
  resumenDiv.classList.remove('hidden');
  document.getElementById('resumen-volumen').textContent = totalVolumen.toFixed(2) + " m³";
  document.getElementById('resumen-toneladas').textContent = totalToneladas.toFixed(2) + " Ton";
  document.getElementById('resumen-desglose').innerHTML = totalArena > 0
    ? `<div class="flex justify-between text-xs text-slate-400">
        <span>Grava neta:</span>
        <span class="text-emerald-400 font-semibold">${totalGrava.toFixed(2)} m³</span>
      </div>
      <div class="flex justify-between text-xs text-slate-400">
        <span>Arena neta:</span>
        <span class="text-amber-400 font-semibold">${totalArena.toFixed(2)} m³</span>
      </div>`
    : '';
}

// Recargar lista cuando cambia la fecha de trabajo
inputFechaTrabajo.addEventListener('change', () => {
  actualizarLabelFecha();
  cargarViajesDelDia();
});

// =========================================================================
// 17b. EXPORTAR A EXCEL
// =========================================================================
async function exportarExcel() {
  const desde = document.getElementById('reporte-fecha-desde').value;
  const hasta = document.getElementById('reporte-fecha-hasta').value;

  if (!desde || !hasta) {
    mostrarAlerta("Selecciona las fechas del rango a exportar.", "warning");
    return;
  }

  // Obtener viajes del rango (desde local)
  const todosViajes = await db.viajes_pendientes.toArray();
  const viajesFiltrados = todosViajes.filter(v => {
    if (!v.fecha_viaje) return false;
    const fechaViaje = v.fecha_viaje.split('T')[0];
    return fechaViaje >= desde && fechaViaje <= hasta;
  });

  if (viajesFiltrados.length === 0) {
    mostrarAlerta("No hay viajes en el rango de fechas seleccionado.", "warning");
    return;
  }

  // Obtener nombres de equipos y minerales
  const equipos = await db.equipos.toArray();
  const minerales = await db.minerales.toArray();
  const mapEquipos = Object.fromEntries(equipos.map(e => [e.id, e]));
  const mapMinerales = Object.fromEntries(minerales.map(m => [m.id, m]));

  // Construir datos para Excel
  const datos = viajesFiltrados.map(v => {
    const equipo = mapEquipos[v.id_equipo];
    const mineral = mapMinerales[v.id_mineral];
    const fecha = v.fecha_viaje ? new Date(v.fecha_viaje) : null;

    return {
      'Fecha': fecha ? fecha.toLocaleDateString('es') : '',
      'Hora': fecha ? fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '',
      'Equipo': equipo?.nombre_equipo || '',
      'Placa/Código': equipo?.placa_interno || '',
      'Material': mineral?.nombre_mineral || '',
      'Cantidad': v.cantidad_conteo || 1,
      'Capacidad (m³)': v.capacidad_equipo_usada || 0,
      'Vol. Total (m³)': v.volumen_total || 0,
      '% Subcomponente': v.porcentaje_subcomponente || 0,
      'Vol. Principal (m³)': v.volumen_principal_neto || 0,
      'Vol. Arena (m³)': v.volumen_subcomponente_neto || 0,
      'Densidad (Ton/m³)': v.densidad_usada || 0,
      'Toneladas Est.': v.toneladas_estimadas || 0,
      'Observaciones': v.observaciones || '',
      'Sincronizado': v.sincronizado ? 'Sí' : 'No'
    };
  });

  // Crear archivo Excel
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Viajes");

  // Ajustar anchos de columna
  ws['!cols'] = [
    { wch: 12 }, { wch: 6 }, { wch: 20 }, { wch: 12 },
    { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 20 }, { wch: 10 }
  ];

  // Descargar
  const nombreArchivo = `SICREM_Viajes_${desde}_a_${hasta}.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
  mostrarAlerta("Archivo descargado: " + nombreArchivo, "success");
}

function mostrarAlerta(mensaje, tipo = "info") {
  const modal = document.getElementById('modal-alerta');
  const icono = document.getElementById('modal-icono');
  const texto = document.getElementById('modal-mensaje');

  const iconos = {
    success: "✅",
    warning: "⚠️",
    error: "❌",
    info: "ℹ️"
  };

  icono.textContent = iconos[tipo] || iconos.info;
  texto.textContent = mensaje;
  modal.classList.remove('hidden');
}

function cerrarAlerta() {
  document.getElementById('modal-alerta').classList.add('hidden');
}

let _resolverConfirmacion = null;

function mostrarConfirmacion(mensaje) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirmar');
    const texto = document.getElementById('confirmar-mensaje');
    texto.textContent = mensaje;
    modal.classList.remove('hidden');
    _resolverConfirmacion = resolve;
  });
}

function resolverConfirmacion(valor) {
  document.getElementById('modal-confirmar').classList.add('hidden');
  if (_resolverConfirmacion) {
    _resolverConfirmacion(valor);
    _resolverConfirmacion = null;
  }
}

// =========================================================================
// 18. INICIALIZACIÓN
// =========================================================================
verificarSesionExistente();
