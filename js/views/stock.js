/* ============================================================
   VISTA STOCK — categorías → cargar nuevo + gestionar existente
   ============================================================ */

const StockUI = { categoria: null, pendientes: [] };
let _rowSeq = 0;
let _pendSeq = 0;

// 1) Grilla de categorías
function renderStock(root) {
  StockUI.pendientes = [];
  State.dentroCategoria = false;
  refrescarHeader();
  const cards = CATEGORIAS.map(
    (c) => `
    <div class="cat" data-cat="${c.nombre}">
      <div class="cat-img"><img src="img/cat_${c.num}.png" alt="${c.nombre}"></div>
      <span class="cat-name">${c.nombre.toUpperCase()}</span>
    </div>`
  ).join("");
  root.innerHTML = `<p class="view-title">STOCK</p><div class="cat-grid">${cards}</div>`;
  root.querySelectorAll("[data-cat]").forEach((el) => {
    el.onclick = () => renderStockCategoria(root, el.dataset.cat);
  });
}

function marcaDePrefijo(prefijo) {
  const m = MARCAS.find((x) => x.prefijo === prefijo);
  return m ? m.nombre : "";
}

// 2) Pantalla de carga/gestión
function renderStockCategoria(root, categoria) {
  StockUI.categoria = categoria;
  StockUI.pendientes = [];
  State.dentroCategoria = true;
  refrescarHeader();
  root.innerHTML = `
    <p class="view-title">${categoria.toUpperCase()} — STOCK</p>
    <p class="stock-section-title">Cargar prendas</p>
    <div class="stock-list" id="loadList">
      <div class="snew-trigger" id="newTrigger"><i class="ti ti-plus"></i> Nueva prenda</div>
    </div>
    <p class="stock-section-title">Stock existente</p>
    <div class="stock-list" id="existList"></div>
    <button class="pending-bar" id="pendingBar" disabled>
      <span id="pendingLabel"><i class="ti ti-checks"></i> Agregar todo (0)</span>
      <i class="ti ti-chevron-up" id="pendingChevron" style="margin-left:6px"></i>
    </button>
  `;
  document.getElementById("newTrigger").onclick = () => agregarFilaCarga(true);
  document.getElementById("pendingBar").onclick = togglePendientes;
  renderExistente(categoria);
  actualizarBarraPendientes();
}

function selectHTML(opciones, sel) {
  return opciones.map((o) => `<option value="${o}"${o === sel ? " selected" : ""}>${o}</option>`).join("");
}

function filaCargaHTML(id, datos) {
  const d = datos || {};
  const talles = tallesDeCategoria(StockUI.categoria);
  return `
    <div class="srow is-new" data-row="${id}">
      <div class="scell-id">
        <div class="id-top">
          <div class="simg-wrap">
            <img class="simg" src="${d.imagen || ""}" alt="" onerror="this.style.opacity=0.3">
            <button class="simg-edit" data-act="img" title="Imagen"><i class="ti ti-camera"></i></button>
          </div>
          <input class="sinput" data-f="codigo" placeholder="Código" maxlength="7" value="${d.codigo || ""}" style="text-transform:uppercase">
        </div>
        <input class="sinput" data-f="marca" placeholder="Marca" value="${d.marca || ""}" readonly>
      </div>
      <div class="sfield">
        <label>Talle</label>
        <select data-f="talle">${selectHTML(talles, d.talle || talles[0])}</select>
        <div class="mini-acts">
          <button class="mini-btn" data-act="all-talle">+ Todos</button>
          <button class="mini-btn" data-act="dup-talle">Duplicar</button>
        </div>
      </div>
      <div class="sfield">
        <label>Color</label>
        <select data-f="color">${selectHTML(COLORES, d.color || "Negro")}</select>
        <div class="mini-acts">
          <button class="mini-btn" data-act="all-color">+ Todos</button>
          <button class="mini-btn" data-act="dup-color">Duplicar</button>
        </div>
      </div>
      <div class="scell-qty">
        <label>Cantidad</label>
        <input class="qty-input" type="number" min="1" value="${d.cantidad || 1}" data-f="cantidad">
      </div>
      <div class="scell-qty">
        <label>Precio costo</label>
        <input class="price-input" type="number" min="0" placeholder="$" value="${d.costo || ""}" data-f="costo">
        <span class="price-hint" data-f="precioHint"></span>
      </div>
      <div class="scell-qty">
        <label>Precio venta</label>
        <input class="price-input" type="number" min="0" placeholder="$" value="${d.precio || ""}" data-f="precio">
        <span class="price-hint" data-f="gananciaHint"></span>
      </div>
      <div class="srow-acts">
        <button class="s-add" data-act="add" title="Agregar a pendientes"><i class="ti ti-plus"></i></button>
        <button class="s-rm" data-act="remove" title="Eliminar fila"><i class="ti ti-x"></i></button>
      </div>
    </div>`;
}

function agregarFilaCarga(focus, datos) {
  const id = "r" + _rowSeq++;
  const list = document.getElementById("loadList");
  const trigger = document.getElementById("newTrigger");
  const tmp = document.createElement("div");
  tmp.innerHTML = filaCargaHTML(id, datos);
  const row = tmp.firstElementChild;
  list.insertBefore(row, trigger);
  bindFilaCarga(row);
  if (focus) row.querySelector('[data-f="codigo"]').focus();
  return row;
}

function leerFila(row) {
  return {
    codigo: row.querySelector('[data-f="codigo"]').value.trim().toUpperCase(),
    marca: row.querySelector('[data-f="marca"]').value.trim(),
    talle: row.querySelector('[data-f="talle"]').value,
    color: row.querySelector('[data-f="color"]').value,
    cantidad: Number(row.querySelector('[data-f="cantidad"]').value) || 1,
    precio: Number(row.querySelector('[data-f="precio"]').value) || 0,
    costo: Number(row.querySelector('[data-f="costo"]').value) || 0,
    imagen: row.querySelector(".simg").getAttribute("src") || "",
  };
}

// busca el precio de venta ya conocido de un código
function precioConocido(codigo) {
  const enStock = State.stock.find((s) => s.codigo === codigo && s.precio > 0);
  if (enStock) return enStock.precio;
  const enPend = StockUI.pendientes.find((p) => p.codigo === codigo && p.precio > 0);
  if (enPend) return enPend.precio;
  return null;
}
// busca el costo ya conocido de un código
function costoConocido(codigo) {
  const enStock = State.stock.find((s) => s.codigo === codigo && s.costo > 0);
  if (enStock) return enStock.costo;
  const enPend = StockUI.pendientes.find((p) => p.codigo === codigo && p.costo > 0);
  if (enPend) return enPend.costo;
  return null;
}

function bindFilaCarga(row) {
  const codInput = row.querySelector('[data-f="codigo"]');
  const marcaInput = row.querySelector('[data-f="marca"]');
  const precioInput = row.querySelector('[data-f="precio"]');
  const costoInput = row.querySelector('[data-f="costo"]');
  const precioHint = row.querySelector('[data-f="precioHint"]');
  const gananciaHint = row.querySelector('[data-f="gananciaHint"]');
  const addBtn = row.querySelector('[data-act="add"]');

  function refrescarGanancia() {
    const v = Number(precioInput.value) || 0;
    const c = Number(costoInput.value) || 0;
    if (v > 0 && c > 0) {
      if (c > v) {
        gananciaHint.textContent = "Costo > venta";
        gananciaHint.style.color = "var(--danger)";
        precioInput.style.borderColor = "var(--danger)";
      } else {
        gananciaHint.textContent = `+${gananciaPct(v, c)}% ganancia`;
        gananciaHint.style.color = "var(--gold)";
        precioInput.style.borderColor = "";
      }
    } else {
      gananciaHint.textContent = "";
      precioInput.style.borderColor = "";
    }
  }

  function refrescarPrecio() {
    const cod = codInput.value.trim().toUpperCase();
    if (cod.length >= 6) {
      const pConocido = precioConocido(cod);
      const cConocido = costoConocido(cod);
      if (cConocido != null) {
        costoInput.value = cConocido; costoInput.disabled = true;
        precioHint.textContent = "Costo del código";
      } else { costoInput.disabled = false; precioHint.textContent = ""; }
      if (pConocido != null) {
        precioInput.value = pConocido; precioInput.disabled = true;
      } else { precioInput.disabled = false; }
    } else {
      precioInput.disabled = false; precioHint.textContent = "";
      costoInput.disabled = false;
    }
    refrescarGanancia();
  }

  codInput.oninput = () => {
    const cod = codInput.value.trim().toUpperCase();
    if (cod.length >= 3) {
      const nombre = marcaDePrefijo(cod.substring(0, 3));
      if (nombre) { marcaInput.value = nombre; marcaInput.setAttribute("readonly", ""); }
      else marcaInput.removeAttribute("readonly");
    }
    refrescarPrecio();
    addBtn.classList.remove("confirmed");
    addBtn.querySelector("i").className = "ti ti-plus";
  };
  precioInput.oninput = refrescarGanancia;
  costoInput.oninput = refrescarGanancia;

  refrescarPrecio();

  row.querySelector('[data-act="img"]').onclick = () => {
    const cod = codInput.value.trim().toUpperCase();
    if (!cod || cod.length < 6) return toast("Primero ingresá el código de la prenda");
    seleccionarYSubirImagen(cod, (url) => {
      // mostrar la nueva imagen en la preview de la fila (con cache-busting)
      row.querySelector(".simg").src = url + "?t=" + Date.now();
    });
  };

  row.querySelector('[data-act="all-talle"]').onclick = () => {
    const base = leerFila(row);
    const talles = tallesDeCategoria(StockUI.categoria);
    talles.filter((t) => t !== base.talle).forEach((t) => agregarFilaCarga(false, { ...base, talle: t }));
    toast(`Duplicado en ${talles.length - 1} talles`);
  };
  row.querySelector('[data-act="all-color"]').onclick = () => {
    const base = leerFila(row);
    COLORES.filter((c) => c !== base.color).forEach((c) => agregarFilaCarga(false, { ...base, color: c }));
    toast(`Duplicado en ${COLORES.length - 1} colores`);
  };
  row.querySelector('[data-act="dup-talle"]').onclick = () => { agregarFilaCarga(false, leerFila(row)); toast("Fila duplicada"); };
  row.querySelector('[data-act="dup-color"]').onclick = () => { agregarFilaCarga(false, leerFila(row)); toast("Fila duplicada"); };

  // agregar a pendientes — la fila NO desaparece
  addBtn.onclick = () => {
    const d = leerFila(row);
    if (!d.codigo || d.codigo.length < 6) return toast("Código incompleto");
    if (!d.marca) return toast("Falta la marca");
    if (!d.precio) {
      const p = precioConocido(d.codigo);
      if (p != null) d.precio = p;
    }
    if (!d.costo) {
      const c = costoConocido(d.codigo);
      if (c != null) d.costo = c;
    }
    if (!d.precio) return toast("Falta el precio de venta");
    if (!d.costo) return toast("Falta el precio de costo");
    if (d.costo > d.precio) return toast("El costo no puede ser mayor a la venta");
    d._pid = "p" + _pendSeq++;
    StockUI.pendientes.push(d);
    addBtn.classList.add("confirmed");
    addBtn.querySelector("i").className = "ti ti-check";
    refrescarPrecio();
    actualizarBarraPendientes();
    toast(`${d.codigo} ${d.talle}/${d.color} agregado`);
  };

  // eliminar fila
  row.querySelector('[data-act="remove"]').onclick = () => row.remove();
}

function actualizarBarraPendientes() {
  const bar = document.getElementById("pendingBar");
  if (!bar) return;
  const n = StockUI.pendientes.length;
  document.getElementById("pendingLabel").innerHTML = `<i class="ti ti-checks"></i> Agregar todo (${n})`;
  bar.disabled = n === 0;
  // si el drawer está abierto, refrescarlo
  if (document.getElementById("pendDrawer")) abrirPendientes(true);
}

// ---- Drawer de pendientes ----
let _pendAbierto = false;
function togglePendientes() {
  if (_pendAbierto) cerrarPendientes();
  else abrirPendientes();
}
function cerrarPendientes() {
  _pendAbierto = false;
  cerrarModal();
  const ch = document.getElementById("pendingChevron");
  if (ch) ch.className = "ti ti-chevron-up";
  ch && (ch.style.marginLeft = "6px");
}
function abrirPendientes(soloRefrescar) {
  _pendAbierto = true;
  const items = StockUI.pendientes.length
    ? StockUI.pendientes.map((p) => `
        <div class="drawer-item">
          <div class="di-info">
            <strong>${p.codigo}</strong>
            <span class="di-sub">${p.talle} · ${p.color} · x${p.cantidad}</span>
          </div>
          <button class="di-rm" data-prm="${p._pid}"><i class="ti ti-trash"></i></button>
        </div>`).join("")
    : `<p class="drawer-empty">Nada pendiente todavía.</p>`;

  const totalU = StockUI.pendientes.reduce((a, p) => a + p.cantidad, 0);

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <aside class="drawer" id="pendDrawer">
      <h2>Pendientes de agregar</h2>
      <div class="drawer-items">${items}</div>
      <div class="modal-total"><span>Total unidades</span><span>${totalU}</span></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="pcerrar">Seguir</button>
        <button class="btn-primary" id="pconfirm" ${StockUI.pendientes.length ? "" : "disabled"}>Agregar todo</button>
      </div>
    </aside>`;

  document.getElementById("ov").onclick = cerrarPendientes;
  document.getElementById("pcerrar").onclick = cerrarPendientes;
  document.getElementById("pconfirm").onclick = confirmarPendientes;
  document.querySelectorAll("[data-prm]").forEach((b) => {
    b.onclick = () => {
      const pid = b.dataset.prm;
      StockUI.pendientes = StockUI.pendientes.filter((p) => p._pid !== pid);
      actualizarBarraPendientes();
      abrirPendientes(true);
    };
  });

  const ch = document.getElementById("pendingChevron");
  if (ch) ch.className = "ti ti-chevron-down";
}

async function confirmarPendientes() {
  const btn = document.getElementById("pconfirm");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
  const res = await API.agregarStock(StockUI.pendientes);
  if (res.ok) {
    StockUI.pendientes.forEach((p) => {
      const existente = State.stock.find(
        (s) => s.codigo === p.codigo && s.talle === p.talle && s.color === p.color
      );
      if (existente) { existente.cantidad += p.cantidad; }
      else State.stock.push({
        codigo: p.codigo, categoria: StockUI.categoria, marca: p.marca,
        talle: p.talle, color: p.color, precio: p.precio || 0, costo: p.costo || 0, cantidad: p.cantidad,
      });
    });
    StockUI.pendientes = [];
    _pendAbierto = false;
    cerrarModal();
    toast("Stock actualizado");
    renderStockCategoria(document.getElementById("view"), StockUI.categoria);
  } else {
    toast("Error al guardar");
    if (btn) { btn.disabled = false; btn.textContent = "Agregar todo"; }
  }
}

// ---- Stock existente ----
function renderExistente(categoria) {
  const list = document.getElementById("existList");
  const items = State.stock
    .filter((s) => s.categoria === categoria)
    .sort((a, b) => (a.codigo + a.talle + a.color).localeCompare(b.codigo + b.talle + b.color));
  if (!items.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-package-off"></i><p>Todavía no hay stock en ${categoria}.</p></div>`;
    return;
  }

  // barra de filtros encima de la lista
  const tallesDisp = [...new Set(items.map((s) => s.talle))];
  const coloresDisp = [...new Set(items.map((s) => s.color))];

  const barra = crearBarraFiltros({
    placeholder: "Buscar por marca o código...",
    campos: [
      { id: "talle", label: "Talle", tipo: "select", opciones: tallesDisp },
      { id: "color", label: "Color", tipo: "select", opciones: coloresDisp },
      { id: "minCant", label: "Cant. mín.", tipo: "number" },
    ],
    onChange: (f) => pintarStockExistente(items, f),
  });
  list.innerHTML = "";
  list.appendChild(barra);
  const cont = document.createElement("div");
  cont.id = "existCont";
  cont.className = "stock-list";
  cont.style.padding = "0";
  list.appendChild(cont);

  pintarStockExistente(items, {});
}

function pintarStockExistente(items, f) {
  const cont = document.getElementById("existCont");
  let lista = items.slice();
  if (f.q) lista = lista.filter((s) => coincideTexto(s, f.q, ["marca", "codigo"]));
  if (f.talle) lista = lista.filter((s) => s.talle === f.talle);
  if (f.color) lista = lista.filter((s) => s.color === f.color);
  if (f.minCant) lista = lista.filter((s) => s.cantidad >= Number(f.minCant));

  if (!lista.length) {
    cont.innerHTML = `<div class="soon"><i class="ti ti-search-off"></i><p>Sin resultados.</p></div>`;
    return;
  }
  cont.innerHTML = lista.map(erowHTML).join("");
  lista.forEach((it) => bindErow(cont, it));
}

function erowKey(it) { return `${it.codigo}__${it.talle}__${it.color}`; }

function erowHTML(it) {
  const pct = gananciaPct(it.precio, it.costo);
  return `
    <div class="erow" data-key="${erowKey(it)}">
      <div class="pcell">
        <div class="pimg-wrap">
          <img class="pimg" src="${imgPrenda(it.codigo)}" alt="" onerror="this.style.opacity=0.3">
          <button class="pimg-edit" data-act="editimg" title="Cambiar imagen"><i class="ti ti-camera"></i></button>
        </div>
        <div class="pinfo"><span class="pmarca">${it.marca}</span><span class="pcod">${it.codigo}</span></div>
      </div>
      <div class="evar">Talle <strong>${it.talle}</strong> · Color <strong>${it.color}</strong></div>
      <div class="eprice">
        <div class="eprice-stack">
          <span class="eprice-val">${formatPrecio(it.precio)}</span>
          <span class="eprice-cost">Costo ${formatPrecio(it.costo)} · +${pct}%</span>
        </div>
        <button class="e-editprice" data-act="editprice" title="Editar precios del código"><i class="ti ti-pencil"></i></button>
      </div>
      <div class="stepper">
        <button class="step-btn" data-act="minus">&minus;</button>
        <span class="step-qty">${it.cantidad}</span>
        <button class="step-btn" data-act="plus">+</button>
      </div>
      <button class="e-del" data-act="del" title="Eliminar stock"><i class="ti ti-trash"></i></button>
    </div>`;
}

function bindErow(list, it) {
  const row = list.querySelector(`.erow[data-key="${erowKey(it)}"]`);
  const qtyEl = row.querySelector(".step-qty");
  const ref = () => State.stock.find((s) => s.codigo === it.codigo && s.talle === it.talle && s.color === it.color);
  row.querySelector('[data-act="plus"]').onclick = async () => {
    const r = ref(); r.cantidad++; qtyEl.textContent = r.cantidad;
    await API.ajustarStock(it.codigo, it.talle, it.color, +1);
  };
  row.querySelector('[data-act="minus"]').onclick = async () => {
    const r = ref(); if (r.cantidad <= 0) return;
    r.cantidad--; qtyEl.textContent = r.cantidad;
    await API.ajustarStock(it.codigo, it.talle, it.color, -1);
  };
  row.querySelector('[data-act="del"]').onclick = () => {
    dobleConfirmacion({
      titulo: "Eliminar stock",
      mensaje1: `Vas a eliminar todo el stock de ${it.codigo} (talle ${it.talle}, color ${it.color}).`,
      mensaje2: "Se borra la combinación completa del inventario. ¿Confirmás?",
      textoBoton: "Eliminar",
      onOk: async () => {
        const r = ref(); const idx = State.stock.indexOf(r);
        if (idx >= 0) State.stock.splice(idx, 1);
        await API.eliminarStock(it.codigo, it.talle, it.color);
        row.remove();
        toast(`${it.codigo} ${it.talle}/${it.color} eliminado`);
      },
    });
  };
  row.querySelector('[data-act="editprice"]').onclick = () => abrirEditarPrecio(it.codigo);
  row.querySelector('[data-act="editimg"]').onclick = () => {
    seleccionarYSubirImagen(it.codigo, (url) => {
      // refrescar todas las imágenes de ese código en pantalla (con cache-busting)
      const nueva = url + "?t=" + Date.now();
      document.querySelectorAll(".erow .pimg").forEach((img) => {
        if (img.closest(".erow").querySelector(".pcod").textContent === it.codigo) img.src = nueva;
      });
    });
  };
}

// Editar precio y costo a nivel código (afecta todas las variantes)
function abrirEditarPrecio(codigo) {
  const precioAct = precioConocido(codigo) || 0;
  const costoAct = costoConocido(codigo) || 0;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Editar precios</h2>
      <p class="modal-line"><span>Código</span><strong>${codigo}</strong></p>
      <p class="login-sub" style="text-align:center">Se aplica a todas las variantes de este código</p>
      <div class="field">
        <label>Precio de costo</label>
        <input class="price-input" id="newCost" type="number" min="0" value="${costoAct}" style="font-size:16px">
      </div>
      <div class="field">
        <label>Precio de venta</label>
        <input class="price-input" id="newPrice" type="number" min="0" value="${precioAct}" style="font-size:16px">
      </div>
      <p class="modal-line"><span>Ganancia</span><strong id="gananciaPreview">+${gananciaPct(precioAct, costoAct)}%</strong></p>
      <div class="modal-actions">
        <button class="btn-ghost" id="cancelP">Cancelar</button>
        <button class="btn-primary" id="saveP">Guardar</button>
      </div>
    </div>`;
  const pIn = document.getElementById("newPrice");
  const cIn = document.getElementById("newCost");
  const prev = document.getElementById("gananciaPreview");
  const upd = () => {
    const p = Number(pIn.value) || 0;
    const c = Number(cIn.value) || 0;
    if (c > p && p > 0) { prev.textContent = "Costo > venta"; prev.style.color = "var(--danger)"; }
    else { prev.textContent = `+${gananciaPct(p, c)}%`; prev.style.color = ""; }
  };
  pIn.oninput = upd; cIn.oninput = upd;
  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cancelP").onclick = cerrarModal;
  document.getElementById("saveP").onclick = async () => {
    const nuevoP = Number(pIn.value) || 0;
    const nuevoC = Number(cIn.value) || 0;
    if (nuevoP <= 0) return toast("Precio de venta inválido");
    if (nuevoC <= 0) return toast("Precio de costo inválido");
    if (nuevoC > nuevoP) return toast("El costo no puede ser mayor a la venta");
    State.stock.forEach((s) => { if (s.codigo === codigo) { s.precio = nuevoP; s.costo = nuevoC; } });
    await API.actualizarPrecio(codigo, nuevoP, nuevoC);
    cerrarModal();
    toast(`Precios de ${codigo} actualizados`);
    renderStockCategoria(document.getElementById("view"), StockUI.categoria);
  };
}

// Abre el selector de archivos, sube la imagen del código a Supabase y llama onListo(url).
function seleccionarYSubirImagen(codigo, onListo) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("La imagen es muy grande (máx 5MB)");
    toast("Subiendo imagen...");
    const res = await API.subirImagenCodigo(codigo, file);
    if (res.ok) {
      toast("Imagen actualizada");
      if (onListo) onListo(res.url);
    } else {
      toast("Error al subir la imagen");
    }
  };
  input.click();
}
