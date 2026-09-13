/* ============================================================
   APP — router, estado global y header
   ============================================================ */

const State = {
  stock: [],          // todo el stock cargado
  carrito: [],        // carrito ACTIVO (líneas). Es un alias del carrito seleccionado en Carritos.
  descuentoCarrito: 0, // % de descuento general aplicado al carrito activo
  vistaActual: "home",
  dentroCategoria: false, // true cuando estás dentro de una categoría (Ventas/Stock)
  privadoHasta: 0,    // timestamp hasta el cual el modo privado está activo
  // Cambio en curso: se arranca desde Cambios eligiendo lo que DEVUELVE el cliente
  // y después se eligen las prendas nuevas en Ventas. { ids:[], fecha } o null.
  cambioEnCurso: null,
};

/* ===== MÚLTIPLES CARRITOS (para atender varios clientes a la vez) =====
   Se mantienen varios carritos y uno "activo". State.carrito siempre apunta
   al activo, así el resto del código no cambia. Persisten en localStorage. */
const Carritos = {
  lista: [],       // [{ id, nombre, items:[], descuento:0 }]
  activoId: null,
  CLAVE: "cristobal_carritos",

  init() {
    this.cargar();
    if (!this.lista.length) this.crear();
    else this.activar(this.activoId || this.lista[0].id, true);
  },

  cargar() {
    try {
      const raw = localStorage.getItem(this.CLAVE);
      if (raw) {
        const d = JSON.parse(raw);
        this.lista = Array.isArray(d.lista) ? d.lista : [];
        this.activoId = d.activoId || (this.lista[0] && this.lista[0].id);
      }
    } catch (e) { this.lista = []; }
  },

  guardar() {
    try {
      // sincronizar el carrito activo antes de guardar
      const a = this.lista.find((c) => c.id === this.activoId);
      if (a) { a.items = State.carrito; a.descuento = State.descuentoCarrito || 0; }
      localStorage.setItem(this.CLAVE, JSON.stringify({
        lista: this.lista, activoId: this.activoId,
      }));
    } catch (e) { /* ignore */ }
  },

  // menor entero positivo no usado por un carrito llamado "Cliente N"
  numeroLibre() {
    const usados = new Set();
    this.lista.forEach((c) => {
      const m = /^Cliente (\d+)$/.exec(c.nombre || "");
      if (m) usados.add(parseInt(m[1], 10));
    });
    let n = 1;
    while (usados.has(n)) n++;
    return n;
  },

  crear(nombre) {
    const id = "cart-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    let num = null, n;
    if (nombre) {
      n = nombre;
    } else {
      num = this.numeroLibre();
      n = "Cliente " + num;
    }
    const nuevo = { id, nombre: n, items: [], descuento: 0 };
    // los "Cliente N" se insertan en orden (entre el menor y el mayor);
    // los renombrados a mano se agregan al final
    if (num != null) {
      let idx = this.lista.length;
      for (let i = 0; i < this.lista.length; i++) {
        const m = /^Cliente (\d+)$/.exec(this.lista[i].nombre || "");
        if (m && parseInt(m[1], 10) > num) { idx = i; break; }
      }
      this.lista.splice(idx, 0, nuevo);
    } else {
      this.lista.push(nuevo);
    }
    this.activar(id);
    return id;
  },

  activar(id, sinGuardarPrevio) {
    // guardar el estado del carrito que estaba activo
    if (!sinGuardarPrevio) {
      const prev = this.lista.find((c) => c.id === this.activoId);
      if (prev) { prev.items = State.carrito; prev.descuento = State.descuentoCarrito || 0; }
    }
    const c = this.lista.find((x) => x.id === id) || this.lista[0];
    if (!c) return;
    this.activoId = c.id;
    State.carrito = c.items || [];
    State.descuentoCarrito = c.descuento || 0;
    this.guardar();
  },

  cerrar(id) {
    const idx = this.lista.findIndex((c) => c.id === id);
    if (idx < 0) return;
    this.lista.splice(idx, 1);
    if (!this.lista.length) { this.crear(); return; }
    if (this.activoId === id) this.activar(this.lista[Math.max(0, idx - 1)].id, true);
    else this.guardar();
  },

  activo() { return this.lista.find((c) => c.id === this.activoId); },

  // sincroniza el carrito activo con State (llamar tras modificar State.carrito)
  sync() {
    const a = this.activo();
    if (a) { a.items = State.carrito; a.descuento = State.descuentoCarrito || 0; }
    this.guardar();
  },
};

// ¿está activo el modo privado (datos históricos visibles)?
function modoPrivadoActivo() {
  return Date.now() < State.privadoHasta;
}
// activar modo privado por 1 hora
function activarModoPrivado() {
  State.privadoHasta = Date.now() + 60 * 60 * 1000;
}

// refresca solo el header (para reflejar si la sección actual es "volver")
function refrescarHeader() {
  const headerEl = document.getElementById("appHeader");
  if (headerEl && State.vistaActual !== "home") {
    headerEl.innerHTML = headerHTML(State.vistaActual);
    bindHeader();
  }
}

const Router = {
  vistas: {
    home: renderHome,
    ventas: renderVentasCategorias,
    stock: renderStock,
    cambios: renderCambios,
    vouchers: renderVouchers,
    historial: renderHistorial,
    gastos: renderGastos,
    caja: renderCaja,
    cuentas: renderCuentas,
    informes: renderInformes,
    facturas: renderFacturas,
  },

  ir(vista, params = {}) {
    // la sección informes es privada: sin código, se pide y no se entra
    if ((vista === "informes" || vista === "facturas") && !modoPrivadoActivo()) {
      abrirCodigoPrivado();
      return;
    }
    State.vistaActual = vista;
    State.dentroCategoria = false;
    const viewEl = document.getElementById("view");
    const headerEl = document.getElementById("appHeader");

    // El header ahora se muestra en todas las vistas, incluida la home
    headerEl.style.display = "flex";
    headerEl.innerHTML = headerHTML(vista);
    bindHeader();

    pintarFondoLogo(vista);

    const fn = this.vistas[vista];
    viewEl.innerHTML = "";
    if (fn) fn(viewEl, params);
    renderCartFab();
    renderBarraCambio(); // el cambio en curso acompaña en todas las secciones
    window.scrollTo(0, 0);
  },

  // repinta la vista actual (sin resetear dentroCategoria)
  recargar() {
    const vista = State.vistaActual || "home";
    const headerEl = document.getElementById("appHeader");
    headerEl.innerHTML = headerHTML(vista); bindHeader();
    pintarFondoLogo(vista);
    const viewEl = document.getElementById("view");
    const fn = this.vistas[vista];
    viewEl.innerHTML = "";
    if (fn) fn(viewEl);
    renderCartFab();
  },
};

// Carrito flotante global (visible en todas las secciones si hay items)
function renderCartFab() {
  const root = document.getElementById("cartRoot");
  if (!root) return;
  const unidades = State.carrito.reduce((a, l) => a + l.cantidad, 0);
  // ¿cuántos carritos (además del activo) tienen prendas? para avisar visualmente
  const otrosConItems = (typeof Carritos !== "undefined")
    ? Carritos.lista.filter((c) => c.id !== Carritos.activoId && (c.items || []).length).length
    : 0;
  if (!State.carrito.length && !otrosConItems) { root.innerHTML = ""; return; }
  root.innerHTML = `
    <button class="cart-fab" id="cartFab" title="Ver carrito">
      <i class="ti ti-shopping-cart"></i>
      ${unidades ? `<span class="cart-badge" id="cartBadge">${unidades}</span>` : ""}
      ${otrosConItems ? `<span class="cart-fab-otros" title="${otrosConItems} carrito(s) más con prendas">+${otrosConItems}</span>` : ""}
    </button>`;
  document.getElementById("cartFab").onclick = abrirCarrito;
}

// actualiza el badge / visibilidad del carrito global
function actualizarBadge() {
  renderCartFab();
  renderBarraCambio();
}

/* ===== BARRA DEL CAMBIO EN CURSO =====
   El cambio arranca en Cambios (elegís lo que devuelve el cliente) y sigue en
   Ventas (elegís lo que se lleva). Antes era al revés: había que adivinar la
   prenda nueva y cargarla al carrito ANTES de saber qué devolvía.
   Esta barra mantiene el contexto mientras recorrés las categorías: qué se
   devuelve, cuánto se acredita y cuánto falta o sobra en vivo. */
function renderBarraCambio() {
  const root = document.getElementById("cambioRoot");
  if (!root) return;
  const c = State.cambioEnCurso;
  if (!c || !c.ventas || !c.ventas.length) { root.innerHTML = ""; return; }

  // lo que se le acredita: el valor de cada prenda devuelta
  const credito = c.ventas.reduce((a, v) => a + (v.precioProducto != null ? v.precioProducto : (v.precioBase || 0)), 0);
  // lo que se lleva: el carrito activo
  const nuevas = State.carrito.reduce((a, l) => a + precioLinea(l), 0);
  const dif = nuevas - credito;
  const unidades = State.carrito.reduce((a, l) => a + l.cantidad, 0);

  const detalle = c.ventas.map((v) => `${escAttr(v.marca || v.codigo)} ${v.talle}/${v.color}`).join(" + ");
  let estado, clase;
  if (!unidades) { estado = "Elegí las prendas que se lleva"; clase = "espera"; }
  else if (Math.abs(dif) < 0.5) { estado = "Justo, sin diferencia"; clase = "ok"; }
  else if (dif > 0) { estado = `Falta pagar ${formatPrecio(dif)}`; clase = "paga"; }
  else { estado = `A favor ${formatPrecio(-dif)}`; clase = "favor"; }

  root.innerHTML = `
    <div class="cambio-bar">
      <div class="cambio-bar-info">
        <span class="cambio-bar-tag"><i class="ti ti-arrows-exchange"></i> Cambiando</span>
        <span class="cambio-bar-prendas">${detalle}</span>
        <span class="cambio-bar-credito">Se le acredita ${formatPrecio(credito)}</span>
      </div>
      <span class="cambio-bar-estado ${clase}">${estado}</span>
      <div class="cambio-bar-der">
        <button class="btn-ghost" id="cambioCancelar">Cancelar</button>
        <button class="btn-primary" id="cambioConfirmar" ${unidades ? "" : "disabled"}>Confirmar cambio</button>
      </div>
    </div>`;

  document.getElementById("cambioCancelar").onclick = () => {
    dobleConfirmacion({
      titulo: "Cancelar el cambio",
      mensaje1: `Vas a cancelar el cambio de ${detalle}.`,
      mensaje2: "Las prendas que hayas agregado quedan en el carrito. ¿Confirmás?",
      textoBoton: "Cancelar el cambio",
      onOk: () => { State.cambioEnCurso = null; renderBarraCambio(); toast("Cambio cancelado"); },
    });
  };
  document.getElementById("cambioConfirmar").onclick = () => {
    if (!State.carrito.length) return toast("Agregá las prendas que se lleva el cliente");
    abrirIntercambio(State.cambioEnCurso.ventas);
  };
}

// Respaldo del ocultamiento de la barra. El CSS lo hace con :has(), pero si un
// navegador no lo soporta la barra volvería a tapar los botones del popup de
// intercambio, que es justo lo que rompía el cambio. Esto marca el body con una
// clase cada vez que entra o sale un modal.
function vigilarModales() {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  const marcar = () => document.body.classList.toggle("con-modal", !!root.querySelector(".modal"));
  new MutationObserver(marcar).observe(root, { childList: true, subtree: true });
  marcar();
}

// arranca un cambio desde la vista Cambios y manda a elegir las prendas nuevas
function iniciarCambio(ventas) {
  State.cambioEnCurso = { ventas: Array.isArray(ventas) ? ventas : [ventas] };
  Router.ir("ventas");
  toast("Elegí las prendas que se lleva el cliente");
}

// pinta el logo de fondo con un tinte según la sección
function pintarFondoLogo(vista) {
  const bg = document.getElementById("bgLogo");
  if (!bg) return;
  if (!bg.dataset.cargado) { bg.innerHTML = LOGO_SVG; bg.dataset.cargado = "1"; }
  bg.className = "bg-logo bg-" + vista;
}

function headerHTML(actual) {
  const links = [
    { id: "ventas", label: "VENTAS" },
    { id: "stock", label: "STOCK" },
    { id: "cambios", label: "CAMBIOS" },
    { id: "vouchers", label: "VOUCHERS" },
    { id: "cuentas", label: "CTA CTE / SEÑA" },
  ];
  const nav = links
    .map((l) => {
      const bell = l.id === "vouchers" ? `<span class="nav-bell hidden" id="navBell"></span>` : "";
      if (l.id === actual) {
        // si estamos dentro de una categoría, la sección actual vuelve a la grilla
        if (State.dentroCategoria && (actual === "ventas" || actual === "stock")) {
          return `<a data-reset="${l.id}" class="current-back nav-link-wrap">${l.label}${bell}</a>`;
        }
        return `<a class="current nav-link-wrap">${l.label}${bell}</a>`;
      }
      return `<a data-nav="${l.id}" class="nav-link-wrap">${l.label}${bell}</a>`;
    })
    .join("");
  return `
    <div class="h-left">
      <button class="h-hist" id="hHist" aria-label="Historial" title="Historial de ventas"><i class="ti ti-clock-hour-4"></i></button>
      <button class="h-hist" id="hCaja" aria-label="Caja" title="Caja"><i class="ti ti-cash"></i></button>
      <button class="h-hist" id="hGastos" aria-label="Gastos" title="Gastos del local"><i class="ti ti-receipt-2"></i></button>
    </div>
    <nav class="h-nav">${nav}</nav>
    <div class="h-right">
      ${modoPrivadoActivo() ? `<button class="h-informes" id="hFacturas" aria-label="Facturas" title="Facturas"><i class="ti ti-file-invoice"></i></button>` : ""}
      ${modoPrivadoActivo() ? `<button class="h-informes" id="hInformes" aria-label="Informes" title="Informes de ventas"><i class="ti ti-chart-histogram"></i></button>` : ""}
      <div class="h-logo" id="hLogo" title="Cristóbal">${LOGO_SVG}</div>
    </div>
  `;
}

function bindHeader() {
  const hist = document.getElementById("hHist");
  if (hist) hist.onclick = () => Router.ir("historial");
  const caja = document.getElementById("hCaja");
  if (caja) caja.onclick = () => Router.ir("caja");
  const gastos = document.getElementById("hGastos");
  if (gastos) gastos.onclick = () => Router.ir("gastos");
  const informes = document.getElementById("hInformes");
  if (informes) informes.onclick = () => Router.ir("informes");
  const facturas = document.getElementById("hFacturas");
  if (facturas) facturas.onclick = () => Router.ir("facturas");
  const logo = document.getElementById("hLogo");
  if (logo) logo.onclick = () => {
    if (modoPrivadoActivo()) {
      // ya está desbloqueado: ofrecer bloquear de nuevo
      abrirGestionPrivado();
    } else {
      abrirCodigoPrivado();
    }
  };
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.onclick = () => Router.ir(a.dataset.nav);
  });
  document.querySelectorAll("[data-reset]").forEach((a) => {
    a.onclick = () => Router.ir(a.dataset.reset);
  });
  actualizarCampanitaVouchers();
}

// consulta vouchers y muestra/oculta la campanita roja en el header
async function actualizarCampanitaVouchers() {
  const bell = document.getElementById("navBell");
  if (!bell) return;
  try {
    const res = await API.getVouchers();
    if (!res.ok) return;
    const hayRoja = res.vouchers.some((v) => estadoAlarmaVoucher(v) === "roja");
    if (hayRoja) {
      bell.classList.remove("hidden");
      bell.classList.add("bell-red");
      bell.classList.remove("bell-yellow");
      bell.innerHTML = `<i class="ti ti-bell-filled"></i>`;
    } else {
      bell.classList.add("hidden");
    }
  } catch (e) { /* sin red, no muestra */ }
}

// ---- Modo privado: pedir código para desbloquear datos históricos ----
function abrirCodigoPrivado() {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ovPriv"></div>
    <div class="modal" style="max-width:360px">
      <h2>Acceso privado</h2>
      <p class="login-sub" style="text-align:center">Ingresá el código para ver los datos históricos completos.</p>
      <div class="field"><input class="sinput" type="password" id="codPriv" inputmode="numeric" placeholder="Código" style="text-align:center;letter-spacing:0.3em"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="codCancel">Cancelar</button>
        <button class="btn-primary" id="codOk">Desbloquear</button>
      </div>
    </div>`;
  const input = document.getElementById("codPriv");
  input.focus();
  document.getElementById("ovPriv").onclick = cerrarModal;
  document.getElementById("codCancel").onclick = cerrarModal;
  const confirmar = async () => {
    const cod = input.value.trim();
    if (!cod) return;
    const res = await API.validarCodigoPrivado(cod);
    if (res.ok) {
      activarModoPrivado();
      cerrarModal();
      toast("Modo privado activado por 1 hora");
      Router.recargar();
    } else {
      input.value = "";
      input.placeholder = "Código incorrecto";
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
    }
  };
  document.getElementById("codOk").onclick = confirmar;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirmar(); });
}

// si ya está desbloqueado, permitir volver a bloquear
function abrirGestionPrivado() {
  const restante = Math.ceil((State.privadoHasta - Date.now()) / 60000);
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ovPriv"></div>
    <div class="modal" style="max-width:360px">
      <h2>Modo privado activo</h2>
      <p class="login-sub" style="text-align:center">Los datos históricos están visibles. Quedan ${restante} min.</p>
      <div class="modal-actions">
        <button class="btn-ghost" id="codCerrar">Cerrar</button>
        <button class="btn-primary" id="codBloquear">Bloquear ahora</button>
      </div>
    </div>`;
  document.getElementById("ovPriv").onclick = cerrarModal;
  document.getElementById("codCerrar").onclick = cerrarModal;
  document.getElementById("codBloquear").onclick = () => {
    State.privadoHasta = 0;
    cerrarModal();
    toast("Modo privado desactivado");
    Router.recargar();
  };
}

// banda distintiva de sección con ícono grande y color propio (para diferenciar ventas de stock, etc.)
function bandaSeccion(seccion, titulo, subtitulo) {
  const iconos = { ventas: "ti-shopping-cart", stock: "ti-stack-2", cambios: "ti-arrows-exchange", vouchers: "ti-ticket", cuentas: "ti-users", informes: "ti-chart-histogram", facturas: "ti-file-invoice" };
  const ic = iconos[seccion] || "ti-tag";
  return `
    <div class="section-band band-${seccion}">
      <i class="ti ${ic} band-icon"></i>
      <div class="band-text">
        <span class="band-title">${titulo}</span>
        ${subtitulo ? `<span class="band-sub">${subtitulo}</span>` : ""}
      </div>
    </div>`;
}

// Toast simple
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// Cierra cualquier modal/drawer abierto
function cerrarModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

// Popup para ver una imagen de prenda ampliada (se abre tocando la foto)
function verImagenAmpliada(codigo, marca, categoria) {
  const src = imgPrenda(codigo, categoria);
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="imgOv"></div>
    <div class="img-zoom">
      <button class="img-zoom-close" id="imgClose" aria-label="Cerrar"><i class="ti ti-x"></i></button>
      <img class="img-zoom-pic" src="${src}" alt="${escAttr(marca || codigo)}" onerror="this.style.opacity=0.3">
      <div class="img-zoom-cap">${escAttr(marca || "")} ${marca ? "·" : ""} ${escAttr(codigo)}</div>
    </div>`;
  document.getElementById("imgOv").onclick = cerrarModal;
  document.getElementById("imgClose").onclick = cerrarModal;
}

// Popup de DOBLE confirmación para acciones excepcionales/peligrosas.
// Pide confirmar dos veces (segundo paso con texto distinto) antes de ejecutar onOk.
function dobleConfirmacion(opts) {
  // opts: { titulo, mensaje1, mensaje2, textoBoton, onOk }
  const root = document.getElementById("modalRoot");
  function paso1() {
    root.innerHTML = `
      <div class="modal-overlay" id="dcOv"></div>
      <div class="modal">
        <h2>${opts.titulo || "Confirmar"}</h2>
        <p class="dc-msg">${opts.mensaje1}</p>
        <div class="modal-actions">
          <button class="btn-ghost" id="dcNo">Cancelar</button>
          <button class="btn-primary" id="dcYes">Continuar</button>
        </div>
      </div>`;
    document.getElementById("dcOv").onclick = cerrarModal;
    document.getElementById("dcNo").onclick = cerrarModal;
    document.getElementById("dcYes").onclick = paso2;
  }
  function paso2() {
    root.innerHTML = `
      <div class="modal-overlay" id="dcOv2"></div>
      <div class="modal">
        <h2>¿Estás seguro?</h2>
        <p class="dc-msg dc-warn">${opts.mensaje2 || "Esta acción es excepcional y no se puede deshacer fácilmente."}</p>
        <div class="modal-actions">
          <button class="btn-ghost" id="dcNo2">No, volver</button>
          <button class="btn-danger" id="dcYes2">${opts.textoBoton || "Sí, confirmar"}</button>
        </div>
      </div>`;
    document.getElementById("dcOv2").onclick = cerrarModal;
    document.getElementById("dcNo2").onclick = cerrarModal;
    // traba contra el doble disparo: acá pasan casi todas las operaciones
    // destructivas (borrar, cancelar, restaurar), y un segundo click las
    // ejecutaba dos veces. Ver unaVez() más abajo.
    let confirmado = false;
    document.getElementById("dcYes2").onclick = () => {
      if (confirmado) return;
      confirmado = true;
      cerrarModal();
      opts.onOk();
    };
  }
  paso1();
}

/* ===== TRABA CONTRA EL DOBLE DISPARO =====
   El `disabled` del botón no alcanza: el 12/09 se registró dos veces la misma
   venta con 162 ms de diferencia, con el botón deshabilitado de por medio.
   unaVez() envuelve el handler con un flag propio, que corta la segunda llamada
   venga de donde venga (doble click, doble toque en el celular, Enter + click).

   Si al terminar el botón ya no está en pantalla (la operación cerró el modal),
   no se reactiva. Si sigue estando, se libera para poder reintentar. */
function unaVez(btn, fn, textoMientras) {
  if (!btn) return;
  let corriendo = false;
  const textoOriginal = btn.textContent;
  btn.onclick = async (e) => {
    if (corriendo) return;
    corriendo = true;
    btn.disabled = true;
    if (textoMientras) btn.textContent = textoMientras;
    try {
      await fn(e);
    } finally {
      if (document.body.contains(btn)) {
        corriendo = false;
        btn.disabled = false;
        btn.textContent = textoOriginal;
      }
    }
  };
}

// ---- Arranque ----
// Abre el calendario nativo al tocar cualquier parte del input de fecha
// (por defecto solo se abre al clickear el iconito).
document.addEventListener("click", (e) => {
  const inp = e.target.closest('input[type="date"], input[type="datetime-local"]');
  if (!inp || inp.disabled || inp.readOnly) return;
  if (typeof inp.showPicker === "function") {
    try { inp.showPicker(); } catch (err) { /* algunos navegadores lo bloquean, se ignora */ }
  }
});

async function iniciarApp() {
  document.getElementById("app").classList.remove("hidden");
  vigilarModales();
  // leer el recargo de tarjeta configurado en Supabase (si existe).
  // Si falla, avisar: antes quedaba en silencio usando el valor por defecto y
  // cambiar el recargo en Supabase no tenía ningún efecto visible.
  const resRecargo = await API.cargarRecargoTarjeta();
  if (!resRecargo.ok) {
    console.warn("No se pudo leer el recargo de tarjeta:", resRecargo.error);
    toast(`No se pudo leer el recargo: se usa ${Math.round(CONFIG.RECARGO_TARJETA * 100)}%`);
  }
  Carritos.init(); // recuperar carritos guardados (o crear el primero)
  // Precarga del stock
  const res = await API.getStock();
  if (res.ok) State.stock = consolidarStock(res.stock);
  Router.ir("home");
}

// Unifica filas repetidas de la misma combinación código+talle+color
// (suma cantidades). Evita que duplicados en la planilla rompan la UI.
function consolidarStock(stock) {
  const mapa = {};
  stock.forEach((s) => {
    // MISMA clave que usa agregarStock en api.js: una prenda = una fila, sin los
    // precios. Agrupando con el precio, dos lotes del mismo talle/color se veían
    // como dos productos distintos en la lista, y si después se igualaba el precio
    // quedaban dos entradas idénticas.
    const k = s.codigo + "|" + s.talle + "|" + s.color + "|" + s.categoria;
    if (mapa[k]) {
      mapa[k].cantidad += s.cantidad;
      // ante filas repetidas gana el precio de la que tenga stock: es el lote vivo
      if (s.cantidad > 0 && mapa[k].cantidad === s.cantidad) {
        mapa[k].precio = s.precio;
        mapa[k].costo = s.costo;
      }
    } else {
      mapa[k] = Object.assign({}, s);
    }
  });
  return Object.values(mapa);
}

window.addEventListener("DOMContentLoaded", () => {
  if (Auth.sesionActiva()) {
    document.getElementById("login").classList.add("hidden");
    iniciarApp();
  } else {
    initLogin(iniciarApp);
  }
});
