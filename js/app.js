/* ============================================================
   APP — router, estado global y header
   ============================================================ */

const State = {
  stock: [],          // todo el stock cargado
  carrito: [],        // líneas agregadas { codigo, marca, talle, color, oferta, cantidad, precio }
  vistaActual: "home",
  dentroCategoria: false, // true cuando estás dentro de una categoría (Ventas/Stock)
};

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
  },

  ir(vista, params = {}) {
    State.vistaActual = vista;
    State.dentroCategoria = false;
    const viewEl = document.getElementById("view");
    const headerEl = document.getElementById("appHeader");

    // La home no lleva header
    if (vista === "home") {
      headerEl.innerHTML = "";
      headerEl.style.display = "none";
    } else {
      headerEl.style.display = "flex";
      headerEl.innerHTML = headerHTML(vista);
      bindHeader();
    }

    const fn = this.vistas[vista];
    viewEl.innerHTML = "";
    if (fn) fn(viewEl, params);
    renderCartFab();
    window.scrollTo(0, 0);
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

function headerHTML(actual) {
  const links = [
    { id: "ventas", label: "VENTAS" },
    { id: "stock", label: "STOCK" },
    { id: "cambios", label: "CAMBIOS" },
    { id: "vouchers", label: "VOUCHERS" },
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
      <button class="h-home" id="hHome" aria-label="Inicio"><i class="ti ti-home"></i></button>
      <button class="h-hist" id="hHist" aria-label="Historial" title="Historial de ventas"><i class="ti ti-clock-hour-4"></i></button>
    </div>
    <nav class="h-nav">${nav}</nav>
    <div class="h-logo">${LOGO_SVG}</div>
  `;
}

function bindHeader() {
  const home = document.getElementById("hHome");
  if (home) home.onclick = () => Router.ir("home");
  const hist = document.getElementById("hHist");
  if (hist) hist.onclick = () => Router.ir("historial");
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
