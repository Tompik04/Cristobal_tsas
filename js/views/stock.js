/* ============================================================
   VISTA STOCK — categorías → cargar nuevo + gestionar existente
   ============================================================ */

const StockUI = { categoria: null, pendientes: [], seleccionadas: new Set() };
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
    <div class="load-actions-bar" id="loadActionsBar" style="display:none">
      <button class="add-all-rows" id="addAllRows"><i class="ti ti-checks"></i> Agregar todas las filas</button>
    </div>
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
  const addAllBtn = document.getElementById("addAllRows");
  if (addAllBtn) addAllBtn.onclick = agregarTodasLasFilas;
  renderExistente(categoria);
  actualizarBarraPendientes();
  actualizarBarraFilasCarga();
}

// muestra u oculta la barra "Agregar todas las filas" según si hay filas de carga escritas
function actualizarBarraFilasCarga() {
  const bar = document.getElementById("loadActionsBar");
  if (!bar) return;
  const filas = document.querySelectorAll("#loadList .srow.is-new");
  bar.style.display = filas.length >= 2 ? "flex" : "none";
}

// recorre todas las filas de carga y agrega a pendientes las que estén completas
function agregarTodasLasFilas() {
  const filas = [...document.querySelectorAll("#loadList .srow.is-new")];
  if (!filas.length) return;
  let agregadas = 0, incompletas = 0;
  filas.forEach((row) => {
    const d = leerFila(row);
    // completar precio/costo desde lo conocido si falta
    if (!d.precio) { const p = precioConocido(d.codigo); if (p != null) d.precio = p; }
    if (!d.costo) { const c = costoConocido(d.codigo); if (c != null) d.costo = c; }
    // validar
    if (!d.codigo || d.codigo.length < 6 || !d.marca || !d.precio || !d.costo || d.costo > d.precio) {
      incompletas++;
      return;
    }
    d.categoria = StockUI.categoria;
    d._pid = "p" + _pendSeq++;
    StockUI.pendientes.push(d);
    // marcar la fila como agregada (check verde)
    const addBtn = row.querySelector('[data-act="add"]');
    if (addBtn) { addBtn.classList.add("confirmed"); addBtn.querySelector("i").className = "ti ti-check"; }
    agregadas++;
  });
  actualizarBarraPendientes();
  if (agregadas && incompletas) toast(`${agregadas} agregadas, ${incompletas} incompletas`);
  else if (agregadas) toast(`${agregadas} prenda${agregadas === 1 ? "" : "s"} agregada${agregadas === 1 ? "" : "s"}`);
  else toast("No hay filas completas para agregar");
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
          <input class="sinput" data-f="codigo" placeholder="Código" maxlength="7" value="${escAttr(d.codigo)}" style="text-transform:uppercase">
        </div>
        <input class="sinput" data-f="marca" placeholder="Marca" value="${escAttr(d.marca)}" readonly>
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
        <button class="s-clear" data-act="clear" title="Limpiar campos"><i class="ti ti-eraser"></i></button>
        <button class="s-rm" data-act="remove" title="Eliminar fila"><i class="ti ti-x"></i></button>
      </div>
    </div>`;
}

function agregarFilaCarga(focus, datos, despuesDe) {
  const id = "r" + _rowSeq++;
  const list = document.getElementById("loadList");
  const trigger = document.getElementById("newTrigger");
  const tmp = document.createElement("div");
  tmp.innerHTML = filaCargaHTML(id, datos);
  const row = tmp.firstElementChild;
  if (despuesDe && despuesDe.nextSibling) {
    // insertar justo debajo de la fila indicada
    list.insertBefore(row, despuesDe.nextSibling);
  } else {
    list.insertBefore(row, trigger);
  }
  bindFilaCarga(row);
  if (focus) row.querySelector('[data-f="codigo"]').focus();
  actualizarBarraFilasCarga();
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
  const cat = StockUI.categoria;
  const enStock = State.stock.find((s) => s.codigo === codigo && s.categoria === cat && s.precio > 0);
  if (enStock) return enStock.precio;
  const enPend = StockUI.pendientes.find((p) => p.codigo === codigo && p.precio > 0);
  if (enPend) return enPend.precio;
  return null;
}
// busca el costo ya conocido de un código (solo en la categoría actual)
function costoConocido(codigo) {
  const cat = StockUI.categoria;
  const enStock = State.stock.find((s) => s.codigo === codigo && s.categoria === cat && s.costo > 0);
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
      // autocompletar precio/costo si el código ya existe, PERO dejarlos editables
      // (si se cambia el precio, se crea un lote nuevo con ese precio)
      if (cConocido != null) {
        if (!costoInput.value) costoInput.value = cConocido;
        costoInput.disabled = false;
        precioHint.textContent = "Precio sugerido (editable)";
      } else { precioHint.textContent = ""; }
      if (pConocido != null && !precioInput.value) precioInput.value = pConocido;
      precioInput.disabled = false;
    } else {
      precioHint.textContent = "";
      precioInput.disabled = false;
      costoInput.disabled = false;
    }
    refrescarGanancia();
  }

  codInput.oninput = () => {
    const cod = codInput.value.trim().toUpperCase();
    if (cod.length >= 3) {
      // marca: primero buscar si el código ya existe EN ESTA CATEGORÍA (marca personalizada),
      // sino por prefijo de marca conocida
      const enStock = State.stock.find((s) => s.codigo === cod && s.categoria === StockUI.categoria && s.marca);
      const nombre = enStock ? enStock.marca : marcaDePrefijo(cod.substring(0, 3));
      if (nombre) { marcaInput.value = nombre; marcaInput.setAttribute("readonly", ""); }
      else marcaInput.removeAttribute("readonly");
    }
    refrescarPrecio();
    addBtn.classList.remove("confirmed");
    addBtn.querySelector("i").className = "ti ti-plus";
  };
  // autocompletado costo↔venta:
  // - si escribo costo y venta está vacía → venta = costo * 2 (editable)
  // - si escribo venta y costo está vacío → costo = venta / 2 (editable)
  // Se marcan como "auto" para poder sobrescribirlas si el usuario las edita después.
  costoInput.oninput = () => {
    const c = Number(costoInput.value) || 0;
    // si la venta está vacía o fue autocompletada, la recalculo
    if (c > 0 && (precioInput.value === "" || precioInput.dataset.auto === "1")) {
      precioInput.value = c * 2;
      precioInput.dataset.auto = "1";
    }
    costoInput.dataset.auto = ""; // lo que escribo a mano ya no es auto
    refrescarGanancia();
  };
  precioInput.oninput = () => {
    const v = Number(precioInput.value) || 0;
    // si el costo está vacío o fue autocompletado, lo recalculo
    if (v > 0 && (costoInput.value === "" || costoInput.dataset.auto === "1")) {
      costoInput.value = Math.round(v / 2);
      costoInput.dataset.auto = "1";
    }
    precioInput.dataset.auto = ""; // lo que escribo a mano ya no es auto
    refrescarGanancia();
  };

  // al cambiar talle, color o cantidad, el botón vuelve de check a "+"
  // (es otra variante, hay que agregarla de nuevo)
  const resetAdd = () => {
    addBtn.classList.remove("confirmed");
    addBtn.querySelector("i").className = "ti ti-plus";
  };
  const talleSel = row.querySelector('[data-f="talle"]');
  const colorSel = row.querySelector('[data-f="color"]');
  const cantInput = row.querySelector('[data-f="cantidad"]');
  if (talleSel) talleSel.onchange = resetAdd;
  if (colorSel) colorSel.onchange = resetAdd;
  if (cantInput) cantInput.oninput = resetAdd;

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
    let ref = row;
    talles.filter((t) => t !== base.talle).forEach((t) => { ref = agregarFilaCarga(false, { ...base, talle: t }, ref); });
    toast(`Duplicado en ${talles.length - 1} talles`);
  };
  row.querySelector('[data-act="all-color"]').onclick = () => {
    const base = leerFila(row);
    let ref = row;
    COLORES.filter((c) => c !== base.color).forEach((c) => { ref = agregarFilaCarga(false, { ...base, color: c }, ref); });
    toast(`Duplicado en ${COLORES.length - 1} colores`);
  };
  row.querySelector('[data-act="dup-talle"]').onclick = () => { agregarFilaCarga(false, leerFila(row), row); toast("Fila duplicada"); };
  row.querySelector('[data-act="dup-color"]').onclick = () => { agregarFilaCarga(false, leerFila(row), row); toast("Fila duplicada"); };

  // agrega la prenda a pendientes (tras validar). Se separa para poder llamarla tras confirmar advertencia.
  function confirmarAgregar(d) {
    d.categoria = StockUI.categoria;
    d._pid = "p" + _pendSeq++;
    StockUI.pendientes.push(d);
    addBtn.classList.add("confirmed");
    addBtn.querySelector("i").className = "ti ti-check";
    refrescarPrecio();
    actualizarBarraPendientes();
    toast(`${d.codigo} ${d.talle}/${d.color} agregado`);
  }

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

    // advertencia: el número del código (dígitos 4-5) no coincide con la categoría actual
    const numCodigo = d.codigo.substring(3, 5);
    const catActual = CATEGORIAS.find((c) => c.nombre === StockUI.categoria);
    if (catActual && numCodigo !== catActual.num) {
      const catDelNum = CATEGORIAS.find((c) => c.num === numCodigo);
      const nombreNum = catDelNum ? catDelNum.nombre : "otra categoría";
      dobleConfirmacion({
        titulo: "Número de categoría distinto",
        mensaje1: `El código ${d.codigo} tiene el número ${numCodigo} (${nombreNum}), pero lo estás cargando en ${StockUI.categoria} (${catActual.num}).`,
        mensaje2: "¿Querés agregarlo igual?",
        textoBoton: "Agregar igual",
        onOk: () => confirmarAgregar(d),
      });
      return;
    }
    confirmarAgregar(d);
  };

  // limpiar todos los campos de la fila (deja la fila, vacía los datos)
  row.querySelector('[data-act="clear"]').onclick = () => {
    codInput.value = "";
    marcaInput.value = "";
    marcaInput.removeAttribute("readonly");
    precioInput.value = "";
    precioInput.disabled = false;
    costoInput.value = "";
    costoInput.disabled = false;
    const cantInp = row.querySelector('[data-f="cantidad"]');
    if (cantInp) cantInp.value = 1;
    const talleSel2 = row.querySelector('[data-f="talle"]');
    const colorSel2 = row.querySelector('[data-f="color"]');
    if (talleSel2) talleSel2.selectedIndex = 0;
    if (colorSel2) colorSel2.value = "Negro";
    // limpiar imagen de la preview
    const simg = row.querySelector(".simg");
    if (simg) { simg.src = ""; simg.style.opacity = ""; }
    // resetear hints y botón de agregar
    if (precioHint) precioHint.textContent = "";
    if (gananciaHint) gananciaHint.textContent = "";
    addBtn.classList.remove("confirmed");
    addBtn.querySelector("i").className = "ti ti-plus";
    codInput.focus();
    toast("Campos limpiados");
  };

  // eliminar fila
  row.querySelector('[data-act="remove"]').onclick = () => { row.remove(); actualizarBarraFilasCarga(); };
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
    // recargar el stock desde la base para que el estado en memoria quede
    // exactamente igual (ids, categorías y lotes correctos) sin desincronización
    const rec = await API.getStock();
    if (rec.ok) State.stock = rec.stock;
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

// ---- Stock existente (agrupado por código, como ventas) ----
function renderExistente(categoria) {
  const list = document.getElementById("existList");
  const items = State.stock.filter((s) => s.categoria === categoria);
  if (!items.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-package-off"></i><p>Todavía no hay stock en ${categoria}.</p></div>`;
    return;
  }

  // agrupar por código + precio (venta y costo): mismo código con distinto precio = fila separada (lote)
  const porGrupo = {};
  items.forEach((s) => {
    const clave = s.codigo + "|" + s.precio + "|" + s.costo;
    if (!porGrupo[clave]) porGrupo[clave] = { clave, codigo: s.codigo, marca: s.marca, precio: s.precio, costo: s.costo, categoria: s.categoria, variantes: [] };
    porGrupo[clave].variantes.push(s);
  });
  const productos = Object.values(porGrupo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo) || a.precio - b.precio);

  // talles/colores disponibles para los filtros
  const tallesDisp = [...new Set(items.map((s) => s.talle))];
  const coloresDisp = [...new Set(items.map((s) => s.color))];

  const barra = crearBarraFiltros({
    placeholder: "Buscar por marca o código...",
    campos: [
      { id: "talle", label: "Talle", tipo: "select", opciones: tallesDisp },
      { id: "color", label: "Color", tipo: "select", opciones: coloresDisp },
      { id: "minCant", label: "Cant. mín.", tipo: "number" },
    ],
    onChange: (f) => pintarStockExistente(productos, f),
  });

  list.innerHTML = "";
  list.appendChild(barra);

  // barra de acciones de selección múltiple (flotante, no empuja el contenido)
  const selBar = document.createElement("div");
  selBar.id = "selBar";
  selBar.className = "sel-fab hidden";
  selBar.innerHTML = `
    <label class="sel-all"><input type="checkbox" id="selAll" class="evar-chk"> Todo</label>
    <span id="selCount">0</span>
    <button class="btn-del-multi" id="delMulti"><i class="ti ti-trash"></i> Borrar</button>`;
  list.appendChild(selBar);

  // contador de total de prendas (según filtro)
  const totalEl = document.createElement("div");
  totalEl.id = "stockTotal";
  totalEl.className = "stock-total";
  list.appendChild(totalEl);

  const cont = document.createElement("div");
  cont.id = "existCont";
  cont.className = "prod-list";
  cont.style.padding = "0";
  list.appendChild(cont);

  StockUI.seleccionadas = new Set();
  StockUI.productos = productos;
  pintarStockExistente(productos, {});

  // acciones de la barra de selección
  document.getElementById("selAll").onchange = (e) => {
    const marcar = e.target.checked;
    document.querySelectorAll("#existCont .evar-chk").forEach((chk) => {
      chk.checked = marcar;
      chk.dispatchEvent(new Event("change", { bubbles: false }));
    });
  };
  document.getElementById("delMulti").onclick = borrarSeleccionadas;
}

// filtra los productos agrupados y los pinta
function pintarStockExistente(productos, f) {
  const cont = document.getElementById("existCont");
  let lista = productos.slice();

  if (f.q) lista = lista.filter((p) => coincideTexto({ marca: p.marca, codigo: p.codigo }, f.q, ["marca", "codigo"]));
  // filtros de talle/color: dejan solo los productos que tengan esa variante
  if (f.talle) lista = lista.filter((p) => p.variantes.some((v) => v.talle === f.talle));
  if (f.color) lista = lista.filter((p) => p.variantes.some((v) => v.color === f.color));
  if (f.minCant) {
    const min = Number(f.minCant);
    lista = lista.filter((p) => p.variantes.reduce((a, v) => a + v.cantidad, 0) >= min);
  }

  // total de prendas (según filtro)
  const totalEl = document.getElementById("stockTotal");
  if (totalEl) {
    const totalUnidades = lista.reduce((a, p) => a + p.variantes.reduce((b, v) => {
      if (f.talle && v.talle !== f.talle) return b;
      if (f.color && v.color !== f.color) return b;
      return b + (Number(v.cantidad) || 0);
    }, 0), 0);
    const hayFiltro = !!(f.q || f.talle || f.color || f.minCant);
    totalEl.innerHTML = `<i class="ti ti-hanger"></i> Total de prendas: ${totalUnidades}${hayFiltro ? " (filtrado)" : ""}`;
  }

  if (!lista.length) {
    cont.innerHTML = `<div class="soon"><i class="ti ti-search-off"></i><p>Sin resultados.</p></div>`;
    return;
  }
  cont.innerHTML = lista.map((p, i) => srowAgrupadaHTML(p, f, i)).join("");
  lista.forEach((p, i) => bindSrowAgrupada(cont, p, f, i));
  actualizarBarraSeleccion();
}

// fila de stock agrupada por código+precio (lote)
function srowAgrupadaHTML(p, f, idx) {
  const talles = [...new Set(p.variantes.map((v) => v.talle))];
  const tallesOpt = talles.map((t) => `<option value="${t}">${t}</option>`).join("");
  return `
    <div class="prow srow-agrup" data-idx="${idx}">
      <div class="pcell">
        <div class="pimg-wrap">
          <img class="pimg zoomable" src="${imgPrenda(p.codigo, p.categoria)}" alt="" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='${imgPrenda(p.codigo)}';}else{this.style.opacity=0.3;}">
          <button class="pimg-edit" data-act="editimg" title="Cambiar imagen"><i class="ti ti-camera"></i></button>
        </div>
        <div class="pinfo">
          <span class="pmarca">${escAttr(p.marca)}</span>
          <span class="pcod">${escAttr(p.codigo)}</span>
        </div>
      </div>
      <div class="field">
        <label>Talle</label>
        <select data-f="talle">${tallesOpt}</select>
      </div>
      <div class="field">
        <label>Color</label>
        <select data-f="color"></select>
      </div>
      <div class="eprice">
        <div class="eprice-stack">
          <span class="eprice-val">${formatPrecio(p.precio)}</span>
          <span class="eprice-cost">Costo ${formatPrecio(p.costo)} · +${gananciaPct(p.precio, p.costo)}%</span>
        </div>
        <button class="e-editprice" data-act="editprice" title="Editar datos y precios"><i class="ti ti-pencil"></i></button>
      </div>
      <div class="stepper">
        <button class="step-btn" data-act="minus">&minus;</button>
        <span class="step-qty" data-f="qty">0</span>
        <button class="step-btn" data-act="plus">+</button>
      </div>
      <button class="e-del" data-act="del" title="Eliminar esta variante"><i class="ti ti-trash"></i></button>
      <label class="evar-check"><input type="checkbox" class="evar-chk" data-idx="${idx}"></label>
    </div>`;
}

function bindSrowAgrupada(cont, p, f, idx) {
  const row = cont.querySelector(`.srow-agrup[data-idx="${idx}"]`);
  if (!row) return;
  const selTalle = row.querySelector('[data-f="talle"]');
  const selColor = row.querySelector('[data-f="color"]');
  const qtyEl = row.querySelector('[data-f="qty"]');

  function coloresDeTalle(talle) {
    return p.variantes.filter((v) => v.talle === talle);
  }
  function varianteActual() {
    return p.variantes.find((v) => v.talle === selTalle.value && v.color === selColor.value);
  }
  function refrescarColores() {
    const cols = coloresDeTalle(selTalle.value);
    selColor.innerHTML = cols.map((v) => `<option value="${escAttr(v.color)}">${v.color}</option>`).join("");
    refrescarCantidad();
  }
  function refrescarCantidad() {
    const v = varianteActual();
    qtyEl.textContent = v ? v.cantidad : 0;
  }

  // preseleccionar según filtro de talle/color si está puesto
  if (f && f.talle && [...selTalle.options].some((o) => o.value === f.talle)) selTalle.value = f.talle;
  refrescarColores();
  if (f && f.color && [...selColor.options].some((o) => o.value === f.color)) { selColor.value = f.color; refrescarCantidad(); }

  selTalle.onchange = refrescarColores;
  selColor.onchange = refrescarCantidad;

  // referencia a la fila real en State.stock (por id único)
  const refVar = () => {
    const v = varianteActual();
    return v ? State.stock.find((s) => s.id === v.id) : null;
  };

  row.querySelector('[data-act="plus"]').onclick = async () => {
    const r = refVar(); if (!r) return;
    r.cantidad++; qtyEl.textContent = r.cantidad;
    await API.ajustarStock(r.id, +1);
  };
  row.querySelector('[data-act="minus"]').onclick = async () => {
    const r = refVar(); if (!r || r.cantidad <= 0) return;
    if (r.cantidad === 1) {
      // al bajar de 1 a 0, se elimina esa variante para que no quede el talle en 0
      const idx = State.stock.indexOf(r);
      if (idx >= 0) State.stock.splice(idx, 1);
      await API.eliminarStock(r.id);
      toast(`${r.codigo} ${r.talle}/${r.color} agotado, se quitó`);
      renderStockCategoria(document.getElementById("view"), StockUI.categoria);
      return;
    }
    r.cantidad--; qtyEl.textContent = r.cantidad;
    await API.ajustarStock(r.id, -1);
  };
  row.querySelector('[data-act="del"]').onclick = () => {
    const r = refVar(); if (!r) return;
    dobleConfirmacion({
      titulo: "Eliminar stock",
      mensaje1: `Vas a eliminar el stock de ${r.codigo} (talle ${r.talle}, color ${r.color}).`,
      mensaje2: "Se borra esa combinación del inventario. ¿Confirmás?",
      textoBoton: "Eliminar",
      onOk: async () => {
        const idx = State.stock.indexOf(r);
        if (idx >= 0) State.stock.splice(idx, 1);
        await API.eliminarStock(r.id);
        toast(`${r.codigo} ${r.talle}/${r.color} eliminado`);
        renderStockCategoria(document.getElementById("view"), StockUI.categoria);
      },
    });
  };
  row.querySelector('[data-act="editprice"]').onclick = () => abrirEditarPrecio(p);
  const imgEl = row.querySelector(".pimg.zoomable");
  if (imgEl) imgEl.onclick = () => verImagenAmpliada(p.codigo, p.marca, p.categoria);
  row.querySelector('[data-act="editimg"]').onclick = () => {
    seleccionarYSubirImagen(p.codigo, (url) => {
      const nueva = url + "?t=" + Date.now();
      row.querySelector(".pimg").src = nueva;
    }, p.categoria);
  };

  // checkbox de selección múltiple (opera sobre la clave del grupo)
  const chk = row.querySelector(".evar-chk");
  chk.onchange = () => {
    if (chk.checked) StockUI.seleccionadas.add(p.clave);
    else StockUI.seleccionadas.delete(p.clave);
    row.classList.toggle("row-sel", chk.checked);
    actualizarBarraSeleccion();
  };
  if (StockUI.seleccionadas.has(p.clave)) { chk.checked = true; row.classList.add("row-sel"); }
}

// escapa para usar en selector CSS (querySelector con data-cod)
function cssEsc(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/["\\\]]/g, "\\$&");
}

// actualiza la barra de selección múltiple (contador + visibilidad)
function actualizarBarraSeleccion() {
  const bar = document.getElementById("selBar");
  if (!bar) return;
  const n = StockUI.seleccionadas ? StockUI.seleccionadas.size : 0;
  const countEl = document.getElementById("selCount");
  if (countEl) countEl.textContent = `${n} sel.`;
  bar.classList.toggle("hidden", n === 0);
}

// borra los grupos (código+precio) seleccionados, con doble confirmación
function borrarSeleccionadas() {
  const claves = [...(StockUI.seleccionadas || [])];
  if (!claves.length) return;
  // reunir las variantes (filas con id) de cada grupo seleccionado
  const grupos = (StockUI.productos || []).filter((p) => claves.includes(p.clave));
  const codigosTxt = [...new Set(grupos.map((g) => g.codigo))].join(", ");
  const totalFilas = grupos.reduce((a, g) => a + g.variantes.length, 0);
  dobleConfirmacion({
    titulo: "Borrar seleccionadas",
    mensaje1: `Vas a eliminar ${totalFilas} variante${totalFilas === 1 ? "" : "s"} de: ${codigosTxt}.`,
    mensaje2: "Se borran del inventario. ¿Confirmás?",
    textoBoton: "Borrar todo",
    onOk: async () => {
      for (const g of grupos) {
        for (const v of g.variantes) {
          await API.eliminarStock(v.id);
          const idx = State.stock.findIndex((s) => s.id === v.id);
          if (idx >= 0) State.stock.splice(idx, 1);
        }
      }
      StockUI.seleccionadas.clear();
      toast(`${totalFilas} variante${totalFilas === 1 ? "" : "s"} eliminada${totalFilas === 1 ? "" : "s"}`);
      renderStockCategoria(document.getElementById("view"), StockUI.categoria);
    },
  });
}

// Editar datos (marca, código) y precios de un grupo (código+precio+categoría)
function abrirEditarPrecio(p) {
  const marcaAct = p.marca || "";
  const codigoAct = p.codigo || "";
  const precioAct = p.precio || 0;
  const costoAct = p.costo || 0;
  const categoria = p.categoria || StockUI.categoria;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Editar prenda</h2>
      <p class="login-sub" style="text-align:center">Se aplica a todas las variantes (talles y colores) de este lote</p>
      <div class="field">
        <label>Marca / nombre</label>
        <input class="sinput" id="newMarca" value="${escAttr(marcaAct)}" placeholder="Marca">
      </div>
      <div class="field">
        <label>Código</label>
        <input class="sinput" id="newCodigo" value="${escAttr(codigoAct)}" maxlength="7" style="text-transform:uppercase" placeholder="Código">
      </div>
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
  const mIn = document.getElementById("newMarca");
  const codIn = document.getElementById("newCodigo");
  const prev = document.getElementById("gananciaPreview");
  const upd = () => {
    const pp = Number(pIn.value) || 0;
    const cc = Number(cIn.value) || 0;
    if (cc > pp && pp > 0) { prev.textContent = "Costo > venta"; prev.style.color = "var(--danger)"; }
    else { prev.textContent = `+${gananciaPct(pp, cc)}%`; prev.style.color = ""; }
  };
  pIn.oninput = upd; cIn.oninput = upd;
  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cancelP").onclick = cerrarModal;
  document.getElementById("saveP").onclick = async () => {
    const nuevoP = Number(pIn.value) || 0;
    const nuevoC = Number(cIn.value) || 0;
    const nuevaMarca = mIn.value.trim();
    const nuevoCodigo = codIn.value.trim().toUpperCase();
    if (nuevoP <= 0) return toast("Precio de venta inválido");
    if (nuevoC <= 0) return toast("Precio de costo inválido");
    if (nuevoC > nuevoP) return toast("El costo no puede ser mayor a la venta");
    if (!nuevaMarca) return toast("La marca no puede quedar vacía");
    if (!nuevoCodigo) return toast("El código no puede quedar vacío");

    // actualizar en memoria las variantes de este grupo (por id)
    const idsGrupo = p.variantes.map((v) => v.id);
    State.stock.forEach((s) => {
      if (idsGrupo.includes(s.id)) {
        s.precio = nuevoP; s.costo = nuevoC; s.marca = nuevaMarca; s.codigo = nuevoCodigo;
      }
    });
    // actualizar en la base, fila por fila (por id, para no tocar otros lotes)
    for (const id of idsGrupo) {
      await API.editarStockFila(id, { marca: nuevaMarca, codigo: nuevoCodigo, precio: nuevoP, costo: nuevoC });
    }
    cerrarModal();
    toast(`Prenda actualizada`);
    renderStockCategoria(document.getElementById("view"), StockUI.categoria);
  };
}

// Abre el selector de archivos, sube la imagen del código a Supabase y llama onListo(url).
function seleccionarYSubirImagen(codigo, onListo, categoria) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("La imagen es muy grande (máx 5MB)");
    toast("Subiendo imagen...");
    const res = await API.subirImagenCodigo(codigo, file, categoria || StockUI.categoria);
    if (res.ok) {
      toast("Imagen actualizada");
      if (onListo) onListo(res.url);
    } else {
      toast("Error al subir la imagen");
    }
  };
  input.click();
}
