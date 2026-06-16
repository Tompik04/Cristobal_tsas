/* ============================================================
   VISTA STOCK — categorías → cargar nuevo + gestionar existente
   ============================================================ */

const StockUI = { categoria: null, pendientes: [] };

// 1) Grilla de categorías (igual que ventas, título STOCK)
function renderStock(root) {
  StockUI.pendientes = [];
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

// 2) Pantalla de carga/gestión de una categoría
function renderStockCategoria(root, categoria) {
  StockUI.categoria = categoria;
  StockUI.pendientes = [];
  root.innerHTML = `
    <p class="view-title">${categoria.toUpperCase()} — STOCK</p>
    <p class="stock-section-title">Cargar prendas</p>
    <div class="stock-list" id="loadList">
      <div class="snew-trigger" id="newTrigger"><i class="ti ti-plus"></i> Nueva prenda</div>
    </div>
    <p class="stock-section-title">Stock existente</p>
    <div class="stock-list" id="existList"></div>
    <button class="pending-bar" id="pendingBar" disabled><i class="ti ti-checks"></i> Agregar todo (0)</button>
  `;
  document.getElementById("newTrigger").onclick = () => agregarFilaCarga(true);
  document.getElementById("pendingBar").onclick = confirmarPendientes;
  renderExistente(categoria);
  actualizarBarraPendientes();
}

function selectHTML(opciones, sel) {
  return opciones.map((o) => `<option value="${o}"${o === sel ? " selected" : ""}>${o}</option>`).join("");
}

function filaCargaHTML(id, datos) {
  const d = datos || {};
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
        <select data-f="talle">${selectHTML(TALLES, d.talle || "M")}</select>
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
      <div class="srow-acts">
        <button class="s-add" data-act="add" title="Agregar a pendientes"><i class="ti ti-plus"></i></button>
      </div>
    </div>`;
}

let _rowSeq = 0;
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
    id: row.dataset.row,
    codigo: row.querySelector('[data-f="codigo"]').value.trim().toUpperCase(),
    marca: row.querySelector('[data-f="marca"]').value.trim(),
    talle: row.querySelector('[data-f="talle"]').value,
    color: row.querySelector('[data-f="color"]').value,
    cantidad: Number(row.querySelector('[data-f="cantidad"]').value) || 1,
    imagen: row.querySelector(".simg").getAttribute("src") || "",
  };
}

function bindFilaCarga(row) {
  const codInput = row.querySelector('[data-f="codigo"]');
  const marcaInput = row.querySelector('[data-f="marca"]');

  codInput.oninput = () => {
    const cod = codInput.value.trim().toUpperCase();
    if (cod.length >= 3) {
      const nombre = marcaDePrefijo(cod.substring(0, 3));
      if (nombre) { marcaInput.value = nombre; marcaInput.setAttribute("readonly", ""); }
      else marcaInput.removeAttribute("readonly");
    }
  };

  row.querySelector('[data-act="img"]').onclick = () => {
    const cod = codInput.value.trim().toLowerCase();
    row.querySelector(".simg").src = cod ? `img/${cod}.png` : "";
  };

  row.querySelector('[data-act="all-talle"]').onclick = () => {
    const base = leerFila(row);
    TALLES.filter((t) => t !== base.talle).forEach((t) => agregarFilaCarga(false, { ...base, talle: t }));
    toast(`Duplicado en ${TALLES.length - 1} talles`);
  };
  row.querySelector('[data-act="all-color"]').onclick = () => {
    const base = leerFila(row);
    COLORES.filter((c) => c !== base.color).forEach((c) => agregarFilaCarga(false, { ...base, color: c }));
    toast(`Duplicado en ${COLORES.length - 1} colores`);
  };
  row.querySelector('[data-act="dup-talle"]').onclick = () => { agregarFilaCarga(false, leerFila(row)); toast("Fila duplicada"); };
  row.querySelector('[data-act="dup-color"]').onclick = () => { agregarFilaCarga(false, leerFila(row)); toast("Fila duplicada"); };

  row.querySelector('[data-act="add"]').onclick = () => {
    const d = leerFila(row);
    if (!d.codigo || d.codigo.length < 6) return toast("Código incompleto");
    if (!d.marca) return toast("Falta la marca");
    StockUI.pendientes.push(d);
    row.remove();
    actualizarBarraPendientes();
    toast(`${d.codigo} ${d.talle}/${d.color} agregado`);
  };
}

function actualizarBarraPendientes() {
  const bar = document.getElementById("pendingBar");
  if (!bar) return;
  const n = StockUI.pendientes.length;
  bar.innerHTML = `<i class="ti ti-checks"></i> Agregar todo (${n})`;
  bar.disabled = n === 0;
}

async function confirmarPendientes() {
  const bar = document.getElementById("pendingBar");
  bar.disabled = true;
  bar.innerHTML = `<i class="ti ti-loader"></i> Guardando...`;
  const res = await API.agregarStock(StockUI.pendientes);
  if (res.ok) {
    StockUI.pendientes.forEach((p) => {
      const existente = State.stock.find(
        (s) => s.codigo === p.codigo && s.talle === p.talle && s.color === p.color
      );
      if (existente) existente.cantidad += p.cantidad;
      else State.stock.push({
        codigo: p.codigo, categoria: StockUI.categoria, marca: p.marca,
        talle: p.talle, color: p.color, precio: p.precio || 0, cantidad: p.cantidad,
      });
    });
    StockUI.pendientes = [];
    toast("Stock actualizado");
    renderStockCategoria(document.getElementById("view"), StockUI.categoria);
  } else {
    toast("Error al guardar");
    actualizarBarraPendientes();
  }
}

function renderExistente(categoria) {
  const list = document.getElementById("existList");
  const items = State.stock
    .filter((s) => s.categoria === categoria)
    .sort((a, b) => (a.codigo + a.talle + a.color).localeCompare(b.codigo + b.talle + b.color));
  if (!items.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-package-off"></i><p>Todavía no hay stock en ${categoria}.</p></div>`;
    return;
  }
  list.innerHTML = items.map(erowHTML).join("");
  items.forEach((it) => bindErow(list, it));
}

function erowKey(it) { return `${it.codigo}__${it.talle}__${it.color}`; }

function erowHTML(it) {
  return `
    <div class="erow" data-key="${erowKey(it)}">
      <div class="pcell">
        <img class="pimg" src="img/${it.codigo.toLowerCase()}.png" alt="" onerror="this.style.opacity=0.3">
        <div class="pinfo"><span class="pmarca">${it.marca}</span><span class="pcod">${it.codigo}</span></div>
      </div>
      <div class="evar">Talle <strong>${it.talle}</strong> · Color <strong>${it.color}</strong></div>
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
  row.querySelector('[data-act="del"]').onclick = async () => {
    const r = ref(); const idx = State.stock.indexOf(r);
    if (idx >= 0) State.stock.splice(idx, 1);
    await API.eliminarStock(it.codigo, it.talle, it.color);
    row.remove();
    toast(`${it.codigo} ${it.talle}/${it.color} eliminado`);
  };
}
