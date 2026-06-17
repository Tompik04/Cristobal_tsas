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
    window.scrollTo(0, 0);
  },
};

function headerHTML(actual) {
  const links = [
    { id: "ventas", label: "VENTAS" },
    { id: "stock", label: "STOCK" },
    { id: "cambios", label: "CAMBIOS" },
    { id: "vouchers", label: "VOUCHERS" },
  ];
  const nav = links
    .map((l) => {
      if (l.id === actual) {
        // si estamos dentro de una categoría, la sección actual vuelve a la grilla
        if (State.dentroCategoria && (actual === "ventas" || actual === "stock")) {
          return `<a data-reset="${l.id}" class="current-back">${l.label}</a>`;
        }
        return `<a class="current">${l.label}</a>`;
      }
      return `<a data-nav="${l.id}">${l.label}</a>`;
    })
    .join("");
  return `
    <button class="h-home" id="hHome" aria-label="Inicio"><i class="ti ti-home"></i></button>
    <nav class="h-nav">${nav}</nav>
    <div class="h-logo">${LOGO_SVG}</div>
  `;
}

function bindHeader() {
  const home = document.getElementById("hHome");
  if (home) home.onclick = () => Router.ir("home");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.onclick = () => Router.ir(a.dataset.nav);
  });
  document.querySelectorAll("[data-reset]").forEach((a) => {
    a.onclick = () => Router.ir(a.dataset.reset);
  });
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

// ---- Arranque ----
async function iniciarApp() {
  document.getElementById("app").classList.remove("hidden");
  // Precarga del stock
  const res = await API.getStock();
  if (res.ok) State.stock = res.stock;
  Router.ir("home");
}

window.addEventListener("DOMContentLoaded", () => {
  if (Auth.sesionActiva()) {
    document.getElementById("login").classList.add("hidden");
    iniciarApp();
  } else {
    initLogin(iniciarApp);
  }
});
