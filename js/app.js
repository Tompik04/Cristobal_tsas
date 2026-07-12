/* ============================================================
   APP — router, estado global y header
   ============================================================ */

const State = {
  stock: [],          // todo el stock cargado
  carrito: [],        // líneas agregadas { codigo, marca, talle, color, oferta, cantidad, precio }
  descuentoCarrito: 0, // % de descuento general aplicado a todo el carrito
  vistaActual: "home",
  dentroCategoria: false, // true cuando estás dentro de una categoría (Ventas/Stock)
  privadoHasta: 0,    // timestamp hasta el cual el modo privado está activo
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
  },

  ir(vista, params = {}) {
    // la sección informes es privada: sin código, se pide y no se entra
    if (vista === "informes" && !modoPrivadoActivo()) {
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
  if (!State.carrito.length) { root.innerHTML = ""; return; }
  root.innerHTML = `
    <button class="cart-fab" id="cartFab" title="Ver carrito">
      <i class="ti ti-shopping-cart"></i>
      <span class="cart-badge" id="cartBadge">${unidades}</span>
    </button>`;
  document.getElementById("cartFab").onclick = abrirCarrito;
}

// actualiza el badge / visibilidad del carrito global
function actualizarBadge() {
  renderCartFab();
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
    { id: "cuentas", label: "CTA CTE" },
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
  const iconos = { ventas: "ti-shopping-cart", stock: "ti-stack-2", cambios: "ti-arrows-exchange", vouchers: "ti-ticket", cuentas: "ti-users", informes: "ti-chart-histogram" };
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
    document.getElementById("dcYes2").onclick = () => { cerrarModal(); opts.onOk(); };
  }
  paso1();
}

// ---- Arranque ----
async function iniciarApp() {
  document.getElementById("app").classList.remove("hidden");
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
    const k = s.codigo + "|" + s.talle + "|" + s.color;
    if (mapa[k]) {
      mapa[k].cantidad += s.cantidad;
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
