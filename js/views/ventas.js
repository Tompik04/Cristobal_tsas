/* ============================================================
   VISTA VENTAS — categorías → lista de productos → venta/carrito
   ============================================================ */

// 1) Grilla de categorías
function renderVentasCategorias(root) {
  State.dentroCategoria = false;
  refrescarHeader();
  const cards = CATEGORIAS.map(
    (c) => `
    <div class="cat" data-cat="${c.nombre}">
      <div class="cat-img"><img src="img/cat_${c.num}.png" alt="${c.nombre}"></div>
      <span class="cat-name">${c.nombre.toUpperCase()}</span>
    </div>`
  ).join("");

  root.innerHTML = `
    <p class="view-title">VENTAS</p>
    <div class="cat-grid">${cards}</div>
  `;
  root.querySelectorAll("[data-cat]").forEach((el) => {
    el.onclick = () => renderListaProductos(root, el.dataset.cat);
  });
}

// 2) Lista de productos de una categoría
function renderListaProductos(root, categoria) {
  State.dentroCategoria = true;
  refrescarHeader();
  // agrupar stock por código dentro de la categoría
  const items = State.stock.filter((s) => s.categoria === categoria);
  const porCodigo = {};
  items.forEach((s) => {
    if (!porCodigo[s.codigo]) {
      porCodigo[s.codigo] = { codigo: s.codigo, marca: s.marca, precio: s.precio, variantes: [] };
    }
    porCodigo[s.codigo].variantes.push(s);
  });
  const productos = Object.values(porCodigo);

  root.innerHTML = `
    <p class="view-title">${categoria.toUpperCase()} — VENTAS</p>
    <div id="ventasFiltros"></div>
    <div class="prod-list" id="ventasProdList"></div>
    ${cartFabHTML()}
  `;

  // talles/colores disponibles en esta categoría para los selects de filtro
  const tallesDisp = [...new Set(items.map((s) => s.talle))];
  const coloresDisp = [...new Set(items.map((s) => s.color))];

  const barra = crearBarraFiltros({
    placeholder: "Buscar por marca o código...",
    campos: [
      { id: "talle", label: "Talle", tipo: "select", opciones: tallesDisp },
      { id: "color", label: "Color", tipo: "select", opciones: coloresDisp },
      { id: "soloStock", label: "Con stock", tipo: "select", opciones: ["Sí"] },
    ],
    onChange: (f) => pintarProductosVentas(root, productos, f),
  });
  document.getElementById("ventasFiltros").appendChild(barra);

  pintarProductosVentas(root, productos, {});
  bindCartFab(root);
  actualizarBadge();
}

function pintarProductosVentas(root, productos, f) {
  const cont = document.getElementById("ventasProdList");
  let lista = productos.slice();

  if (f.q) lista = lista.filter((p) => coincideTexto({ marca: p.marca, codigo: p.codigo }, f.q, ["marca", "codigo"]));
  if (f.talle) lista = lista.filter((p) => p.variantes.some((v) => v.talle === f.talle));
  if (f.color) lista = lista.filter((p) => p.variantes.some((v) => v.color === f.color));
  if (f.soloStock) lista = lista.filter((p) => p.variantes.some((v) => v.cantidad > 0));

  if (!lista.length) {
    cont.innerHTML = `<div class="soon"><i class="ti ti-search-off"></i><p>Sin resultados.</p></div>`;
    return;
  }
  cont.innerHTML = lista.map(filaProductoHTML).join("");
  lista.forEach((p) => bindFila(root, p));
}

function filaProductoHTML(p) {
  const talles = [...new Set(p.variantes.map((v) => v.talle))];
  const tallesOpt = talles
    .map((t) => {
      const stockT = p.variantes.filter((v) => v.talle === t).reduce((a, v) => a + v.cantidad, 0);
      return stockT > 0
        ? `<option value="${t}">${t}</option>`
        : `<option value="${t}" disabled>${t} (0)</option>`;
    })
    .join("");

  const ofertasOpt = OFERTAS.map(
    (o) => `<option value="pct:${o}"${o === 0 ? " selected" : ""}>${o}%</option>`
  ).join("") +
  `<option value="costo">Precio costo</option>` +
  `<option value="regalo">100% (regalo)</option>`;

  return `
    <div class="prow" data-cod="${p.codigo}">
      <div class="pcell">
        <img class="pimg" src="img/${p.codigo.toLowerCase()}.png" alt="">
        <div class="pinfo">
          <span class="pmarca">${p.marca}</span>
          <span class="pcod">${p.codigo}</span>
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
      <div class="field">
        <label>Oferta</label>
        <select data-f="oferta">${ofertasOpt}</select>
      </div>
      <div class="field">
        <label data-f="cantLabel">Cant.</label>
        <select data-f="cantidad"></select>
      </div>
      <div class="pacts">
        <button class="pact check" data-act="check" title="Venta única"><i class="ti ti-check"></i></button>
        <button class="pact" data-act="cart" title="Agregar al carrito"><i class="ti ti-shopping-cart-plus"></i></button>
      </div>
    </div>`;
}

function bindFila(root, p) {
  const row = root.querySelector(`.prow[data-cod="${p.codigo}"]`);
  const selTalle = row.querySelector('[data-f="talle"]');
  const selColor = row.querySelector('[data-f="color"]');
  const selCant = row.querySelector('[data-f="cantidad"]');
  const lblCant = row.querySelector('[data-f="cantLabel"]');
  const selOferta = row.querySelector('[data-f="oferta"]');

  function coloresDeTalle(talle) {
    return p.variantes.filter((v) => v.talle === talle && v.cantidad > 0);
  }
  function stockActual() {
    const v = p.variantes.find(
      (x) => x.talle === selTalle.value && x.color === selColor.value
    );
    return v ? v.cantidad : 0;
  }
  function refrescarColores() {
    const cols = coloresDeTalle(selTalle.value);
    selColor.innerHTML = cols.map((v) => `<option value="${v.color}">${v.color}</option>`).join("");
    refrescarCantidad();
  }
  function refrescarCantidad() {
    const max = stockActual();
    lblCant.textContent = `Cant. (disp. ${max})`;
    let opts = "";
    for (let i = 1; i <= max; i++) opts += `<option value="${i}">${i}</option>`;
    selCant.innerHTML = opts || `<option value="0">0</option>`;
  }

  selTalle.onchange = refrescarColores;
  selColor.onchange = refrescarCantidad;
  // primer talle no deshabilitado
  const primer = [...selTalle.options].find((o) => !o.disabled);
  if (primer) selTalle.value = primer.value;
  refrescarColores();

  function costoActual() {
    const v = p.variantes.find((x) => x.talle === selTalle.value && x.color === selColor.value);
    return v ? (v.costo || 0) : 0;
  }

  function lineaActual() {
    const ofVal = selOferta.value; // "pct:15" | "costo" | "regalo"
    let tipoOferta = "pct", ofertaPct = 0;
    if (ofVal === "costo") tipoOferta = "costo";
    else if (ofVal === "regalo") tipoOferta = "regalo";
    else ofertaPct = Number(ofVal.split(":")[1]) || 0;
    return {
      codigo: p.codigo,
      marca: p.marca,
      talle: selTalle.value,
      color: selColor.value,
      tipoOferta,
      oferta: ofertaPct,
      cantidad: Number(selCant.value),
      precio: p.precio,
      costo: costoActual(),
    };
  }

  row.querySelector('[data-act="check"]').onclick = () => {
    const l = lineaActual();
    if (l.cantidad < 1) return toast("Sin stock disponible");
    abrirPopupVenta([l]);
  };
  row.querySelector('[data-act="cart"]').onclick = () => {
    const l = lineaActual();
    if (l.cantidad < 1) return toast("Sin stock disponible");
    State.carrito.push(l);
    actualizarBadge();
    toast(`${l.codigo} agregado al carrito`);
  };
}

// ---- Carrito ----
function cartFabHTML() {
  return `
    <button class="cart-fab" id="cartFab" title="Ver carrito">
      <i class="ti ti-shopping-cart"></i>
      <span class="cart-badge" id="cartBadge">0</span>
    </button>`;
}
function bindCartFab(root) {
  const fab = root.querySelector("#cartFab");
  if (fab) fab.onclick = abrirCarrito;
}
function actualizarBadge() {
  const b = document.getElementById("cartBadge");
  if (b) b.textContent = State.carrito.reduce((a, l) => a + l.cantidad, 0);
}

function abrirCarrito() {
  const items = State.carrito.length
    ? State.carrito
        .map(
          (l, i) => `
        <div class="drawer-item">
          <div class="di-info">
            <strong>${l.codigo}</strong>
            <span class="di-sub">${l.talle} · ${l.color} · x${l.cantidad}${ofertaLabel(l) ? " · " + ofertaLabel(l) : ""}</span>
          </div>
          <span>${formatPrecio(precioLinea(l))}</span>
          <button class="di-rm" data-rm="${i}"><i class="ti ti-trash"></i></button>
        </div>`
        )
        .join("")
    : `<p class="drawer-empty">El carrito está vacío.</p>`;

  const total = State.carrito.reduce((a, l) => a + precioLinea(l), 0);

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <aside class="drawer">
      <h2>Carrito</h2>
      <div class="drawer-items">${items}</div>
      <div class="modal-total"><span>Total</span><span>${formatPrecio(total)}</span></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="cerrar">Seguir</button>
        <button class="btn-primary" id="cobrar" ${State.carrito.length ? "" : "disabled"}>Cobrar</button>
      </div>
    </aside>`;

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cerrar").onclick = cerrarModal;
  document.getElementById("cobrar").onclick = () => {
    cerrarModal();
    abrirPopupVenta(State.carrito.slice());
  };
  document.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = () => {
      State.carrito.splice(Number(b.dataset.rm), 1);
      actualizarBadge();
      abrirCarrito();
    };
  });
}

// ---- Popup de venta (único o carrito) ----
function precioLinea(l) {
  if (l.tipoOferta === "regalo") return 0;
  if (l.tipoOferta === "costo") return (l.costo || 0) * l.cantidad;
  return l.precio * l.cantidad * (1 - l.oferta / 100);
}

// etiqueta legible de la oferta aplicada
function ofertaLabel(l) {
  if (l.tipoOferta === "regalo") return "Regalo";
  if (l.tipoOferta === "costo") return "A costo";
  return l.oferta ? `${l.oferta}% off` : "";
}

// fecha/hora local en formato para input datetime-local
function ahoraLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
// fecha de hoy (yyyy-mm-dd) para input date
function hoyInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function abrirPopupVenta(lineas) {
  // estado de pago: simple o dividido
  let modoDividido = false;
  let metodo1 = null, metodo2 = null;
  let montoTarjetaManual = null; // cuánto va en el método con tarjeta (modo dividido)

  const base = lineas.reduce((a, l) => a + precioLinea(l), 0);

  const detalle = lineas
    .map((l) => `<div class="modal-line"><span>${l.codigo} · ${l.talle}/${l.color} · x${l.cantidad}</span><strong>${formatPrecio(precioLinea(l))}</strong></div>`)
    .join("");

  const pagos1 = MEDIOS_PAGO.map((m) => `<button class="pay-opt" data-m1="${m}">${m}</button>`).join("");

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Confirmar venta</h2>
      <div>${detalle}</div>
      <div class="modal-line"><span>Subtotal</span><strong>${formatPrecio(base)}</strong></div>

      <div class="venta-fields">
        <div class="field">
          <label>Fecha y hora de venta</label>
          <input type="datetime-local" id="fechaVenta" value="${ahoraLocalInput()}">
        </div>
        <div class="field">
          <label>Inicio del período de cambio</label>
          <input type="date" id="fechaInicioCambio" value="${hoyInput()}">
        </div>
      </div>

      <div class="pay-mode">
        <button class="pay-mode-btn selected" id="modoSimple">Pago simple</button>
        <button class="pay-mode-btn" id="modoDiv">Pago dividido</button>
      </div>

      <div id="paySimple">
        <p class="login-sub" style="text-align:center">Método de pago</p>
        <div class="pay-grid">${pagos1}</div>
      </div>

      <div id="payDividido" style="display:none">
        <div class="split-row">
          <div class="field">
            <label>Método 1</label>
            <select id="selM1">${MEDIOS_PAGO.map((m) => `<option value="${m}">${m}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Monto en método 1</label>
            <input type="number" id="montoM1" min="0" placeholder="$" value="">
          </div>
        </div>
        <div class="split-row">
          <div class="field">
            <label>Método 2 (resto)</label>
            <select id="selM2">${MEDIOS_PAGO.map((m, i) => `<option value="${m}"${i === 1 ? " selected" : ""}>${m}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Monto en método 2</label>
            <input type="text" id="montoM2" disabled value="—">
          </div>
        </div>
      </div>

      <div class="swap-diff" style="border-top:1px solid var(--oak-20);padding-top:1rem">
        <div class="modal-line" id="recargoLine" style="display:none"><span>Recargo tarjeta (20%)</span><strong id="recargoVal">$0</strong></div>
        <div class="modal-total"><span>Total a cobrar</span><span id="totalVal">${formatPrecio(base)}</span></div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" id="cancelar">Cancelar</button>
        <button class="btn-primary" id="confirmar" disabled>Confirmar</button>
      </div>
    </div>`;

  const btnConf = document.getElementById("confirmar");
  const recargoLine = document.getElementById("recargoLine");
  const recargoVal = document.getElementById("recargoVal");
  const totalVal = document.getElementById("totalVal");
  const paySimple = document.getElementById("paySimple");
  const payDividido = document.getElementById("payDividido");
  const selM1 = document.getElementById("selM1");
  const selM2 = document.getElementById("selM2");
  const montoM1 = document.getElementById("montoM1");
  const montoM2 = document.getElementById("montoM2");

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cancelar").onclick = cerrarModal;

  // recargo: solo sobre la parte que va en débito/crédito
  function recargoDe(monto, met) {
    return MEDIOS_CON_RECARGO.includes(met) ? monto * CONFIG.RECARGO_TARJETA : 0;
  }

  function recalcular() {
    let recargo = 0, valido = false;

    if (!modoDividido) {
      if (metodo1) {
        recargo = recargoDe(base, metodo1);
        valido = true;
      }
    } else {
      const m1 = selM1.value, m2 = selM2.value;
      const monto1 = Number(montoM1.value) || 0;
      const monto2 = base - monto1;
      montoM2.value = monto2 >= 0 ? formatPrecio(monto2) : "—";
      if (monto1 > 0 && monto1 < base && m1 !== m2) {
        recargo = recargoDe(monto1, m1) + recargoDe(monto2, m2);
        valido = true;
      }
    }

    if (recargo > 0) { recargoLine.style.display = "flex"; recargoVal.textContent = formatPrecio(recargo); }
    else recargoLine.style.display = "none";
    totalVal.textContent = formatPrecio(base + recargo);
    btnConf.disabled = !valido;
    return recargo;
  }

  // toggle modos
  document.getElementById("modoSimple").onclick = () => {
    modoDividido = false;
    document.getElementById("modoSimple").classList.add("selected");
    document.getElementById("modoDiv").classList.remove("selected");
    paySimple.style.display = ""; payDividido.style.display = "none";
    recalcular();
  };
  document.getElementById("modoDiv").onclick = () => {
    modoDividido = true;
    document.getElementById("modoDiv").classList.add("selected");
    document.getElementById("modoSimple").classList.remove("selected");
    paySimple.style.display = "none"; payDividido.style.display = "";
    recalcular();
  };

  document.querySelectorAll("[data-m1]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".pay-opt").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      metodo1 = b.dataset.m1;
      recalcular();
    };
  });
  [selM1, selM2, montoM1].forEach((el) => el.addEventListener("input", recalcular));
  [selM1, selM2].forEach((el) => el.addEventListener("change", recalcular));

  btnConf.onclick = async () => {
    btnConf.disabled = true;
    btnConf.textContent = "Procesando...";

    const recargo = recalcular();
    const precioFinal = base + recargo;
    const fechaVenta = document.getElementById("fechaVenta").value;
    const inicioCambio = document.getElementById("fechaInicioCambio").value;

    let pago;
    if (!modoDividido) {
      pago = { tipo: "simple", metodo: metodo1 };
    } else {
      const monto1 = Number(montoM1.value) || 0;
      pago = { tipo: "dividido", partes: [
        { metodo: selM1.value, monto: monto1 },
        { metodo: selM2.value, monto: base - monto1 },
      ] };
    }

    const res = await API.registrarVenta(lineas, pago, {
      precioBase: base, precioFinal, fechaVenta, inicioCambio,
    });

    if (res.ok) {
      lineas.forEach((l) => {
        const v = State.stock.find((x) => x.codigo === l.codigo && x.talle === l.talle && x.color === l.color);
        if (v) v.cantidad -= l.cantidad;
      });
      if (lineas === State.carrito || lineas.length === State.carrito.length) {
        State.carrito = [];
      }
      cerrarModal();
      actualizarBadge();
      toast("Venta registrada");
      renderVentasCategorias(document.getElementById("view"));
    } else {
      toast("Error al registrar la venta");
      btnConf.disabled = false;
      btnConf.textContent = "Confirmar";
    }
  };

  recalcular();
}
