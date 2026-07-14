/* ============================================================
   VISTA VENTAS — categorías → lista de productos → venta/carrito
   ============================================================ */

// 1) Grilla de categorías
function renderVentasCategorias(root) {
  State.dentroCategoria = false;
  refrescarHeader();
  root.innerHTML = `
    ${bandaSeccion("ventas", "VENTAS")}
    ${gridCategoriasHTML(true)}
  `;
  root.querySelectorAll("[data-cat]").forEach((el) => {
    el.onclick = () => {
      if (el.dataset.cat === "__TODOS__") renderListaProductos(root, "__TODOS__");
      else renderListaProductos(root, el.dataset.cat);
    };
  });
}

// 2) Lista de productos de una categoría (o de TODAS si categoria === "__TODOS__")
function renderListaProductos(root, categoria) {
  State.dentroCategoria = true;
  refrescarHeader();
  const esTodos = categoria === "__TODOS__";
  // agrupar stock por código dentro de la categoría (o todo el stock si es TODOS)
  const items = esTodos ? State.stock.slice() : State.stock.filter((s) => s.categoria === categoria);
  const porCodigo = {};
  items.forEach((s) => {
    // en "TODOS" agrupo por código+categoría para no mezclar el mismo código de distintas categorías
    const clave = esTodos ? s.codigo + "|" + s.categoria : s.codigo;
    if (!porCodigo[clave]) {
      porCodigo[clave] = { codigo: s.codigo, marca: s.marca, precio: s.precio, categoria: s.categoria, variantes: [] };
    }
    porCodigo[clave].variantes.push(s);
  });
  const productos = Object.values(porCodigo);

  const nombreCat = esTodos ? "Todas las categorías" : categoria;
  root.innerHTML = `
    ${bandaSeccion("ventas", "VENTAS", nombreCat)}
    <div id="ventasFiltros"></div>
    <div id="ventasTotal" class="stock-total"></div>
    <div class="prod-list" id="ventasProdList"></div>
  `;

  // talles/colores disponibles en esta categoría para los selects de filtro
  const tallesDisp = [...new Set(items.map((s) => s.talle))];
  const coloresDisp = [...new Set(items.map((s) => s.color))];

  const barra = crearBarraFiltros({
    placeholder: "Buscar por marca o código...",
    campos: [
      { id: "talle", label: "Talle", tipo: "select", opciones: tallesDisp },
      { id: "color", label: "Color", tipo: "select", opciones: coloresDisp },
      { id: "minCant", label: "Cant. mín.", tipo: "number" },
    ],
    onChange: (f) => pintarProductosVentas(root, productos, f),
  });
  document.getElementById("ventasFiltros").appendChild(barra);

  pintarProductosVentas(root, productos, {});
  actualizarBadge();
}

function pintarProductosVentas(root, productos, f) {
  const cont = document.getElementById("ventasProdList");
  let lista = productos.slice();

  // ocultar productos sin stock en ninguna variante (no hay nada que vender)
  lista = lista.filter((p) => p.variantes.some((v) => v.cantidad > 0));

  if (f.q) lista = lista.filter((p) => coincideTexto({ marca: p.marca, codigo: p.codigo }, f.q, ["marca", "codigo"]));
  if (f.talle) lista = lista.filter((p) => p.variantes.some((v) => v.talle === f.talle));
  if (f.color) lista = lista.filter((p) => p.variantes.some((v) => v.color === f.color));
  if (f.minCant) {
    const min = Number(f.minCant);
    lista = lista.filter((p) => p.variantes.reduce((a, v) => a + v.cantidad, 0) >= min);
  }

  // total de prendas (suma de stock de las variantes visibles, según filtro)
  const totalEl = document.getElementById("ventasTotal");
  if (totalEl) {
    const totalUnidades = lista.reduce((a, p) => {
      return a + p.variantes.reduce((b, v) => {
        if (f.talle && v.talle !== f.talle) return b;
        if (f.color && v.color !== f.color) return b;
        return b + (Number(v.cantidad) || 0);
      }, 0);
    }, 0);
    const hayFiltro = !!(f.q || f.talle || f.color || f.minCant);
    totalEl.innerHTML = `<i class="ti ti-hanger"></i> Total de prendas: ${totalUnidades}${hayFiltro ? " (filtrado)" : ""}`;
  }

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
        <img class="pimg zoomable" src="${imgPrenda(p.codigo, p.categoria)}" alt="">
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

  const imgEl = row.querySelector(".pimg.zoomable");
  if (imgEl) imgEl.onclick = () => verImagenAmpliada(p.codigo, p.marca, p.categoria);

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

// ---- Carrito ---- (el FAB y el badge ahora son globales en app.js)

// total del carrito con el descuento general aplicado
function totalConDescuentoCarrito() {
  const base = State.carrito.reduce((a, l) => a + precioLinea(l), 0);
  const desc = State.descuentoCarrito || 0;
  return base * (1 - desc / 100);
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
  const enModoCuenta = !!State.cuentaDestino;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <aside class="drawer">
      <div class="drawer-head">
        <h2>${enModoCuenta ? "Agregar a cuenta" : "Carrito"}</h2>
        ${State.carrito.length ? `<button class="drawer-clear" id="vaciarCarrito"><i class="ti ti-trash"></i> Vaciar</button>` : ""}
      </div>
      <div class="drawer-items">${items}</div>
      <div class="modal-total"><span>Total</span><span id="carritoTotal">${formatPrecio(total)}</span></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="cerrar">Seguir</button>
        ${enModoCuenta
          ? `<button class="btn-primary" id="aCuenta" ${State.carrito.length ? "" : "disabled"}>Agregar a cuenta</button>`
          : `<button class="btn-primary" id="cobrar" ${State.carrito.length ? "" : "disabled"}>Cobrar</button>`}
      </div>
    </aside>`;

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cerrar").onclick = cerrarModal;

  // vaciar carrito completo (confirma solo si hay varias prendas)
  const btnVaciar = document.getElementById("vaciarCarrito");
  if (btnVaciar) btnVaciar.onclick = () => {
    const vaciar = () => {
      State.carrito = [];
      State.descuentoCarrito = 0;
      actualizarBadge();
      renderCartFab();
      cerrarModal();
      toast("Carrito vaciado");
    };
    if (State.carrito.length > 1) {
      dobleConfirmacion({
        titulo: "Vaciar carrito",
        mensaje1: `Vas a quitar las ${State.carrito.length} prendas del carrito.`,
        mensaje2: "¿Confirmás?",
        textoBoton: "Vaciar todo",
        onOk: vaciar,
      });
    } else {
      vaciar();
    }
  };

  const btnCobrar = document.getElementById("cobrar");
  if (btnCobrar) btnCobrar.onclick = () => {
    cerrarModal();
    abrirPopupVenta(State.carrito.slice(), { descuentoCarrito: State.descuentoCarrito || 0, esCarrito: true });
  };
  const btnCuenta = document.getElementById("aCuenta");
  if (btnCuenta) btnCuenta.onclick = async () => {
    const cuentaId = State.cuentaDestino;
    const res = await API.agregarItemsCuenta(cuentaId, State.carrito.slice());
    if (res.ok) {
      // descontar stock localmente
      State.carrito.forEach((l) => {
        const s = State.stock.find((x) => x.codigo === l.codigo && x.talle === l.talle && x.color === l.color);
        if (s) s.cantidad -= l.cantidad;
      });
      State.carrito = [];
      State.cuentaDestino = null;
      actualizarBadge();
      renderCartFab();
      cerrarModal();
      toast("Prendas agregadas a la cuenta");
      Router.ir("cuentas");
    } else {
      toast("Error al agregar a la cuenta");
    }
  };
  document.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = () => {
      State.carrito.splice(Number(b.dataset.rm), 1);
      actualizarBadge();
      if (State.carrito.length) abrirCarrito();
      else cerrarModal();
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

function abrirPopupVenta(lineas, opts) {
  opts = opts || {};
  const descuentoCarrito = opts.descuentoCarrito || 0;
  const esCarrito = !!opts.esCarrito;
  // estado de pago: simple o dividido
  let modoDividido = false;
  let metodo1 = null, metodo2 = null;
  let montoTarjetaManual = null;
  let voucherSel = null; // voucher aplicado
  // estado del ajuste manual (descuento o adicional: lo define el número ingresado)
  let ajusActivo = false;
  let ajusMontoFinal = null; // monto final a cobrar (antes de recargo y voucher)
  // estado del panel de factura
  let facturaAbierta = false;
  let bancosDisponibles = [];
  // estado de la seña
  let senaActiva = false;

  const subtotalLineas = lineas.reduce((a, l) => a + precioLinea(l), 0);
  // el base ya considera el descuento general del carrito
  const base = subtotalLineas * (1 - descuentoCarrito / 100);

  const detalle = lineas
    .map((l) => `<div class="modal-line"><span>${l.codigo} · ${l.talle}/${l.color} · x${l.cantidad}</span><strong>${formatPrecio(precioLinea(l))}</strong></div>`)
    .join("");

  const pagos1 = MEDIOS_PAGO.map((m) => `<button class="pay-opt" data-m1="${m}">${m}</button>`).join("");

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal modal-venta">
      <h2>Confirmar venta</h2>
      <div class="venta-detalle">${detalle}</div>
      <div class="modal-line"><span>Subtotal</span><strong>${formatPrecio(base)}</strong></div>

      <label class="desc-check-row voucher-check">
        <input type="checkbox" id="voucherCheck" class="evar-chk">
        <span>Aplicar voucher</span>
      </label>
      <div class="voucher-select-row" id="voucherWrap" style="display:none">
        <div class="field">
          <select id="selVoucher"><option value="">Sin voucher</option></select>
        </div>
      </div>

      <div class="venta-fields fechas-row">
        <div class="field">
          <label>Fecha y hora de venta</label>
          <input type="datetime-local" id="fechaVenta" value="${ahoraLocalInput()}">
        </div>
        <div class="field">
          <label>Inicio período cambio</label>
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

      <div class="venta-extras">
      <div class="desc-pago-box">
        <label class="desc-check-row">
          <input type="checkbox" id="ajusCheck" class="evar-chk">
          <span>Aplicar desc/adic</span>
        </label>
        <div id="ajusCampos" class="desc-campos" style="display:none">
          <div class="split-row">
            <div class="field">
              <label>Nuevo monto ($)</label>
              <input type="number" id="ajusMonto" class="sinput" min="0" placeholder="$">
            </div>
            <div class="field">
              <label>Variación (%)</label>
              <input type="number" id="ajusPct" class="sinput" placeholder="-20 / +10">
            </div>
          </div>
          <div class="field rec-field" id="ajusRecWrap" style="display:none">
            <label id="ajusRecLabel">Monto final con recargo</label>
            <input type="number" id="ajusMontoRec" class="sinput" min="0" placeholder="$">
          </div>
          <p class="desc-info" id="ajusInfo"></p>
        </div>
      </div>

      <div class="desc-pago-box sena-box">
        <label class="desc-check-row">
          <input type="checkbox" id="senaCheck" class="evar-chk">
          <span>Seña (reservar y pagar en cuotas)</span>
        </label>
        <div id="senaCampos" class="desc-campos" style="display:none">
          <div class="split-row">
            <div class="field">
              <label>Nombre y apellido</label>
              <input type="text" id="senaNom" class="sinput" placeholder="Nombre del cliente">
            </div>
            <div class="field">
              <label>Teléfono</label>
              <input type="text" id="senaTel" class="sinput" placeholder="Teléfono" inputmode="numeric">
            </div>
          </div>
          <div class="field">
            <label>Monto que entrega ahora ($)</label>
            <input type="number" id="senaMonto" class="sinput" min="0" placeholder="$">
          </div>
          <p class="desc-info sena-info" id="senaInfo"></p>
        </div>
      </div>
      </div>

      <div class="swap-diff" style="border-top:1px solid var(--oak-20);padding-top:1rem">
        <div class="modal-line descuento-line" id="descLine" style="display:none"><span id="descLabel">Voucher</span><strong id="descVal">$0</strong></div>
        <div class="modal-line" id="recargoLine" style="display:none"><span>Recargo tarjeta (${Math.round(CONFIG.RECARGO_TARJETA * 100)}%)</span><strong id="recargoVal">$0</strong></div>
        <div class="modal-total"><span>Total a cobrar</span><span id="totalVal">${formatPrecio(base)}</span></div>
      </div>

      <div class="vuelto-box" id="vueltoBox" style="display:none">
        <div class="field">
          <label>Paga con</label>
          <input type="number" id="pagaCon" class="sinput" min="0" placeholder="$ que entrega el cliente">
        </div>
        <div class="modal-total"><span>Vuelto</span><span id="vueltoVal">$0</span></div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" id="cancelar">Cancelar</button>
        <button class="btn-primary" id="confirmar" disabled>Confirmar</button>
      </div>
    </div>`;

  const btnConf = document.getElementById("confirmar");
  const recargoLine = document.getElementById("recargoLine");
  const recargoVal = document.getElementById("recargoVal");
  const descLine = document.getElementById("descLine");
  const descVal = document.getElementById("descVal");
  const descLabel = document.getElementById("descLabel");
  const totalVal = document.getElementById("totalVal");
  const paySimple = document.getElementById("paySimple");
  const payDividido = document.getElementById("payDividido");
  const selM1 = document.getElementById("selM1");
  const selM2 = document.getElementById("selM2");
  const montoM1 = document.getElementById("montoM1");
  const montoM2 = document.getElementById("montoM2");
  const selVoucher = document.getElementById("selVoucher");

  // el voucher aparece solo si se tilda (deja el popup más corto)
  const voucherCheck = document.getElementById("voucherCheck");
  const voucherWrap = document.getElementById("voucherWrap");
  voucherCheck.onchange = () => {
    voucherWrap.style.display = voucherCheck.checked ? "" : "none";
    if (!voucherCheck.checked) {
      selVoucher.value = "";
      voucherSel = null;
      recalcular();
    }
  };

  // al cambiar la fecha de venta, el inicio del período de cambio la acompaña
  // (después se puede modificar a mano si hace falta)
  const inpFechaVenta = document.getElementById("fechaVenta");
  const inpInicioCambio = document.getElementById("fechaInicioCambio");
  inpFechaVenta.addEventListener("change", () => {
    if (!inpFechaVenta.value) return;
    inpInicioCambio.value = inpFechaVenta.value.slice(0, 10); // solo la parte de la fecha
  });

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cancelar").onclick = cerrarModal;

  // --- ajuste manual: descuento o adicional (lo define el número ingresado) ---
  const ajusCheck = document.getElementById("ajusCheck");
  const ajusCampos = document.getElementById("ajusCampos");
  const ajusMontoInput = document.getElementById("ajusMonto");
  const ajusPctInput = document.getElementById("ajusPct");
  const ajusMontoRecInput = document.getElementById("ajusMontoRec");
  const ajusRecWrap = document.getElementById("ajusRecWrap");
  const ajusInfo = document.getElementById("ajusInfo");

  // ¿el método elegido tiene recargo de tarjeta? (en pago dividido no aplica este atajo)
  function factorRecargo() {
    if (modoDividido) return 1;
    return MEDIOS_CON_RECARGO.includes(metodo1) ? (1 + CONFIG.RECARGO_TARJETA) : 1;
  }
  // muestra/oculta el campo "monto con recargo" según el método elegido
  function actualizarCamposRecargo() {
    const f = factorRecargo();
    const hayRecargo = f > 1;
    const pct = Math.round(CONFIG.RECARGO_TARJETA * 100);
    const lbl = document.getElementById("ajusRecLabel");
    if (lbl) lbl.textContent = `Monto final con recargo (${pct}%)`;
    if (ajusRecWrap) ajusRecWrap.style.display = hayRecargo ? "block" : "none";
    if (hayRecargo && ajusMontoFinal != null && ajusMontoRecInput) {
      ajusMontoRecInput.value = Math.round(ajusMontoFinal * f);
    }
  }

  // el signo de la diferencia decide si es descuento o adicional
  function refrescarAjusInfo() {
    if (!ajusActivo || ajusMontoFinal == null) { ajusInfo.textContent = ""; ajusInfo.className = "desc-info"; return; }
    const dif = ajusMontoFinal - base;
    if (Math.abs(dif) < 1) { ajusInfo.textContent = "Sin cambios sobre el precio."; ajusInfo.className = "desc-info"; return; }
    const pct = base > 0 ? Math.abs(Math.round((dif / base) * 100)) : 0;
    if (dif < 0) {
      ajusInfo.className = "desc-info";
      ajusInfo.innerHTML = `<strong>Descuento</strong> de ${formatPrecio(-dif)} (−${pct}%) sobre ${formatPrecio(base)}`;
    } else {
      ajusInfo.className = "desc-info adic-info";
      ajusInfo.innerHTML = `<strong>Adicional</strong> de ${formatPrecio(dif)} (+${pct}%) sobre ${formatPrecio(base)}`;
    }
  }

  ajusCheck.onchange = () => {
    ajusActivo = ajusCheck.checked;
    ajusCampos.style.display = ajusActivo ? "block" : "none";
    if (!ajusActivo) {
      ajusMontoFinal = null;
      ajusMontoInput.value = "";
      ajusPctInput.value = "";
      if (ajusMontoRecInput) ajusMontoRecInput.value = "";
      ajusInfo.textContent = "";
    }
    actualizarCamposRecargo();
    recalcular();
  };

  // monto SIN recargo → calcula el % y el monto con recargo
  ajusMontoInput.oninput = () => {
    let m = Number(ajusMontoInput.value);
    if (isNaN(m) || ajusMontoInput.value === "") {
      ajusMontoFinal = null; ajusPctInput.value = "";
      if (ajusMontoRecInput) ajusMontoRecInput.value = "";
      refrescarAjusInfo(); recalcular(); return;
    }
    if (m < 0) m = 0;
    ajusMontoFinal = m;
    const pct = base > 0 ? ((m - base) / base) * 100 : 0; // negativo = descuento
    ajusPctInput.value = Math.round(pct * 100) / 100;
    if (ajusMontoRecInput) ajusMontoRecInput.value = Math.round(m * factorRecargo());
    refrescarAjusInfo();
    recalcular();
  };

  // % (negativo = descuento, positivo = adicional) → calcula el monto
  ajusPctInput.oninput = () => {
    let p = Number(ajusPctInput.value);
    if (isNaN(p) || ajusPctInput.value === "" || ajusPctInput.value === "-") {
      ajusMontoFinal = null; ajusMontoInput.value = "";
      if (ajusMontoRecInput) ajusMontoRecInput.value = "";
      refrescarAjusInfo(); recalcular(); return;
    }
    if (p < -100) p = -100;
    ajusMontoFinal = base * (1 + p / 100);
    ajusMontoInput.value = Math.round(ajusMontoFinal);
    if (ajusMontoRecInput) ajusMontoRecInput.value = Math.round(ajusMontoFinal * factorRecargo());
    refrescarAjusInfo();
    recalcular();
  };

  // monto final CON recargo → se calcula hacia atrás el monto sin recargo
  if (ajusMontoRecInput) ajusMontoRecInput.oninput = () => {
    const f = factorRecargo();
    let total = Number(ajusMontoRecInput.value);
    if (isNaN(total) || ajusMontoRecInput.value === "") {
      ajusMontoFinal = null; ajusMontoInput.value = ""; ajusPctInput.value = "";
      refrescarAjusInfo(); recalcular(); return;
    }
    if (total < 0) total = 0;
    const m = total / f;
    ajusMontoFinal = m;
    ajusMontoInput.value = Math.round(m);
    const pct = base > 0 ? ((m - base) / base) * 100 : 0;
    ajusPctInput.value = Math.round(pct * 100) / 100;
    refrescarAjusInfo();
    recalcular();
  };


  let vouchersDisp = [];
  API.getVouchers().then((res) => {
    if (res.ok) {
      vouchersDisp = res.vouchers.filter((v) => !v.usado && diasParaVencer(v.vencimiento) >= 0);
      vouchersDisp.forEach((v) => {
        const txt = v.tipo === "monto" ? formatPrecio(v.monto) : `${v.descuento}%`;
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.nombre} · ${txt}`;
        selVoucher.appendChild(opt);
      });
    }
  });

  selVoucher.onchange = () => {
    voucherSel = vouchersDisp.find((v) => v.id === selVoucher.value) || null;
    recalcular();
  };

  // descuento del voucher sobre la base
  function descuentoVoucher(baseRef) {
    const b = baseRef != null ? baseRef : base;
    if (!voucherSel) return 0;
    if (voucherSel.tipo === "descuento") return b * (voucherSel.descuento / 100);
    return Math.min(voucherSel.monto, b); // monto, tope = base
  }

  function recargoDe(monto, met) {
    return MEDIOS_CON_RECARGO.includes(met) ? monto * CONFIG.RECARGO_TARJETA : 0;
  }

  // base efectivo: base con el descuento o el adicional aplicado (si están activos)
  function baseEfectivo() {
    if (ajusActivo && ajusMontoFinal != null && ajusMontoFinal >= 0) {
      return ajusMontoFinal; // menor al precio = descuento, mayor = adicional
    }
    return base;
  }

  function recalcular() {
    const baseUsado = baseEfectivo();
    const desc = descuentoVoucher(baseUsado);
    const baseConDesc = baseUsado - desc; // voucher primero
    let recargo = 0, valido = false;

    if (desc > 0) {
      descLine.style.display = "flex";
      descLabel.textContent = voucherSel.tipo === "descuento" ? `Voucher (${voucherSel.descuento}%)` : "Voucher";
      descVal.textContent = "−" + formatPrecio(desc);
    } else descLine.style.display = "none";

    if (!modoDividido) {
      if (metodo1) { recargo = recargoDe(baseConDesc, metodo1); valido = true; }
    } else {
      const m1 = selM1.value, m2 = selM2.value;
      const cobra1 = Number(montoM1.value) || 0;
      const factor1 = MEDIOS_CON_RECARGO.includes(m1) ? (1 + CONFIG.RECARGO_TARJETA) : 1;
      const productoM1 = cobra1 / factor1;
      const productoM2 = baseConDesc - productoM1;
      const cobra2 = productoM2 + recargoDe(productoM2, m2);
      montoM2.value = productoM2 >= 0 ? formatPrecio(cobra2) : "—";
      if (productoM1 > 0 && productoM1 < baseConDesc && combinacionPagoValida(m1, m2)) {
        recargo = recargoDe(productoM1, m1) + recargoDe(productoM2, m2);
        valido = true;
      }
    }

    if (recargo > 0) { recargoLine.style.display = "flex"; recargoVal.textContent = formatPrecio(recargo); }
    else recargoLine.style.display = "none";
    totalVal.textContent = formatPrecio(baseConDesc + recargo);
    btnConf.disabled = !valido;

    actualizarVuelto(baseConDesc, recargo);
    return { desc, baseConDesc, recargo, baseUsado };
  }

  // muestra el campo de vuelto si la venta tiene parte en efectivo
  function efectivoACobrar(baseConDesc, recargo) {
    if (!modoDividido) {
      return metodo1 === "Efectivo" ? baseConDesc + recargo : 0;
    }
    // dividido: el efectivo es lo que se cobra en el método que sea efectivo
    const cobra1 = Number(montoM1.value) || 0;
    const totalCobrar = baseConDesc + recargo;
    const cobra2 = totalCobrar - cobra1;
    let ef = 0;
    if (selM1.value === "Efectivo") ef += cobra1;
    if (selM2.value === "Efectivo") ef += cobra2;
    return ef;
  }

  function actualizarVuelto(baseConDesc, recargo) {
    const box = document.getElementById("vueltoBox");
    const ef = efectivoACobrar(baseConDesc, recargo);
    if (ef > 0) {
      box.style.display = "";
      const paga = Number(document.getElementById("pagaCon").value) || 0;
      const vuelto = paga - ef;
      const vueltoEl = document.getElementById("vueltoVal");
      vueltoEl.textContent = formatPrecio(vuelto >= 0 ? vuelto : 0);
      vueltoEl.style.color = paga > 0 && vuelto < 0 ? "var(--danger)" : "";
      if (paga > 0 && vuelto < 0) vueltoEl.textContent = "Falta " + formatPrecio(-vuelto);
    } else {
      box.style.display = "none";
    }
  }

  document.getElementById("modoSimple").onclick = () => {
    modoDividido = false;
    document.getElementById("modoSimple").classList.add("selected");
    document.getElementById("modoDiv").classList.remove("selected");
    paySimple.style.display = ""; payDividido.style.display = "none";
    actualizarCamposRecargo();
    recalcular();
  };
  document.getElementById("modoDiv").onclick = () => {
    modoDividido = true;
    document.getElementById("modoDiv").classList.add("selected");
    document.getElementById("modoSimple").classList.remove("selected");
    paySimple.style.display = "none"; payDividido.style.display = "";
    actualizarCamposRecargo();
    recalcular();
  };

  // ===== PANEL DE FACTURA (lateral, tipo papel) =====
  async function abrirPanelFactura(metodo) {
    if (facturaAbierta) {
      // ya está abierto: solo actualizar el método
      const mp = document.getElementById("facMetodo");
      if (mp) mp.textContent = metodo;
      // los campos de tarjeta solo aplican a débito/crédito
      const zonaTarjeta = document.getElementById("facZonaTarjeta");
      if (zonaTarjeta) zonaTarjeta.style.display = (metodo === "Transferencia") ? "none" : "block";
      return;
    }
    facturaAbierta = true;

    // cargar bancos y el próximo número de factura
    const [resB, resN] = await Promise.all([API.getBancos(), API.siguienteNumeroFactura()]);
    bancosDisponibles = resB.ok ? resB.bancos : [];
    const numero = resN.numero || "0001";

    const panel = document.createElement("aside");
    panel.className = "factura-panel";
    panel.id = "facturaPanel";
    panel.innerHTML = `
      <div class="factura-head">
        <h3>Factura</h3>
        <button class="factura-close" id="facCerrar" title="Cerrar"><i class="ti ti-x"></i></button>
      </div>
      <div class="factura-body">
        <div class="fac-row">
          <label>N° Factura</label>
          <input type="text" id="facNumero" value="${numero}">
        </div>
        <div class="fac-row">
          <label>Nombre y apellido</label>
          <input type="text" id="facNombre" placeholder="Nombre del cliente">
        </div>
        <div class="fac-row">
          <label>DNI</label>
          <input type="text" id="facDni" placeholder="DNI">
        </div>
        <div class="fac-row">
          <label>Teléfono</label>
          <input type="text" id="facTel" placeholder="Teléfono">
        </div>
        <div id="facZonaTarjeta" style="display:${metodo === "Transferencia" ? "none" : "block"}">
          <div class="fac-row">
            <label>Tipo de tarjeta</label>
            <input type="text" id="facTarjeta" list="listaTarjetas" placeholder="Visa, Mastercard...">
            <datalist id="listaTarjetas">
              <option value="Visa"><option value="Mastercard"><option value="American Express">
              <option value="Cabal"><option value="Naranja"><option value="Maestro">
            </datalist>
          </div>
          <div class="fac-row">
            <label>Banco</label>
            <input type="text" id="facBanco" list="listaBancos" placeholder="Escribí o elegí un banco">
            <datalist id="listaBancos">${bancosDisponibles.map((b) => `<option value="${escAttr(b)}">`).join("")}</datalist>
          </div>
          <div class="fac-row">
            <label>Cantidad de cuotas</label>
            <input type="number" id="facCuotas" min="1" value="1">
          </div>
        </div>
        <p class="fac-metodo">Pago: <strong id="facMetodo">${metodo}</strong></p>
        <label class="fac-incompleto">
          <input type="checkbox" id="facIncompleto">
          <span>Agregar incompleto (faltan datos, los completo después)</span>
        </label>
      </div>`;
    document.getElementById("modalRoot").appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("abierto"));
    document.getElementById("facCerrar").onclick = () => {
      // si es débito/crédito la factura es obligatoria: avisar
      if (metodo1 === "Débito" || metodo1 === "Crédito") {
        toast("La factura es obligatoria para débito y crédito");
        return;
      }
      cerrarPanelFactura();
    };
  }

  function cerrarPanelFactura() {
    const p = document.getElementById("facturaPanel");
    if (p) p.remove();
    facturaAbierta = false;
  }

  // lee los datos del panel de factura (o null si no está abierto)
  function leerFactura() {
    if (!facturaAbierta) return null;
    return {
      numero: (document.getElementById("facNumero") || {}).value || "",
      nombre: (document.getElementById("facNombre") || {}).value || "",
      dni: (document.getElementById("facDni") || {}).value || "",
      telefono: (document.getElementById("facTel") || {}).value || "",
      tipoTarjeta: (document.getElementById("facTarjeta") || {}).value || "",
      banco: (document.getElementById("facBanco") || {}).value || "",
      cuotas: Number((document.getElementById("facCuotas") || {}).value) || 1,
    };
  }

  // --- seña (reservar prendas y pagar en cuotas) ---
  const senaCheck = document.getElementById("senaCheck");
  const senaCampos = document.getElementById("senaCampos");
  const senaMontoInput = document.getElementById("senaMonto");
  const senaInfo = document.getElementById("senaInfo");

  function refrescarSenaInfo() {
    const entrega = Number(senaMontoInput.value) || 0;
    if (!senaActiva || entrega <= 0) { senaInfo.textContent = ""; return; }
    const totalPrendas = baseEfectivo();
    const saldo = totalPrendas - entrega;
    if (entrega >= totalPrendas) {
      senaInfo.innerHTML = `Entrega el total (${formatPrecio(totalPrendas)}): no hace falta seña.`;
      return;
    }
    senaInfo.innerHTML = `Entrega <strong>${formatPrecio(entrega)}</strong> · Queda debiendo <strong>${formatPrecio(saldo)}</strong> de ${formatPrecio(totalPrendas)}`;
  }

  senaCheck.onchange = () => {
    senaActiva = senaCheck.checked;
    senaCampos.style.display = senaActiva ? "block" : "none";
    // en seña se cobra solo una parte: el botón cambia de texto
    btnConf.textContent = senaActiva ? "Registrar seña" : "Confirmar venta";
    refrescarSenaInfo();
    recalcular();
  };
  senaMontoInput.oninput = () => { refrescarSenaInfo(); recalcular(); };

  document.querySelectorAll("[data-m1]").forEach((b) => {
    b.onclick = () => {
      const metodo = b.dataset.m1;
      const yaEstaba = (metodo1 === metodo);
      document.querySelectorAll(".pay-opt").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      metodo1 = metodo;

      // Factura: obligatoria para débito y crédito.
      // Para transferencia: el primer click no hace nada; el segundo (ya seleccionada) abre la factura.
      if (metodo === "Débito" || metodo === "Crédito") {
        abrirPanelFactura(metodo);
      } else if (metodo === "Transferencia") {
        if (yaEstaba) abrirPanelFactura(metodo); // segundo click sobre transferencia ya elegida
        else cerrarPanelFactura();
      } else {
        cerrarPanelFactura();
      }
      actualizarCamposRecargo();
      recalcular();
    };
  });
  [selM1, selM2, montoM1].forEach((el) => el.addEventListener("input", recalcular));
  document.getElementById("pagaCon").addEventListener("input", () => recalcular());
  [selM1, selM2].forEach((el) => el.addEventListener("change", recalcular));

  btnConf.onclick = async () => {
    // ---- SEÑA: en vez de una venta, se registra una reserva con pago parcial ----
    if (senaActiva) {
      const nombre = document.getElementById("senaNom").value.trim();
      const telefono = document.getElementById("senaTel").value.trim();
      const entrega = Number(senaMontoInput.value) || 0;
      const totalPrendas = baseEfectivo();

      if (!nombre) return toast("Falta el nombre del cliente");
      if (!telefono) return toast("Falta el teléfono");
      if (entrega <= 0) return toast("Ingresá el monto que entrega");
      if (entrega >= totalPrendas) return toast("Entrega el total: cobrá como venta normal, no como seña");
      if (!metodo1 && !modoDividido) return toast("Elegí el método de pago de la seña");

      btnConf.disabled = true;
      btnConf.textContent = "Registrando...";

      // usar la fecha elegida en el popup (puede ser de un día anterior), no la de hoy
      const fSena = document.getElementById("fechaVenta").value;
      const fechaSena = fSena ? new Date(fSena).toISOString() : new Date().toISOString();

      const idSena = "SE-" + Date.now();
      const res = await API.crearSena(
        { id: idSena, nombre, telefono, fecha: fechaSena },
        lineas,
        { monto: entrega, metodoPago: modoDividido ? selM1.value : metodo1 }
      );

      if (!res.ok) {
        btnConf.disabled = false;
        btnConf.textContent = "Registrar seña";
        return toast("No se pudo registrar la seña");
      }

      // descontar del stock en memoria (ya se descontó en la base)
      lineas.forEach((l) => {
        const s = State.stock.find((x) => x.codigo === l.codigo && x.talle === l.talle && x.color === l.color);
        if (s) s.cantidad -= l.cantidad;
      });
      if (lineas === State.carrito || lineas.length === State.carrito.length) {
        State.carrito = [];
        State.descuentoCarrito = 0;
      }
      cerrarModal();
      actualizarBadge();
      toast(`Seña registrada · Entregó ${formatPrecio(entrega)} de ${formatPrecio(totalPrendas)}`);
      Router.ir("cuentas");
      return;
    }

    // la factura es obligatoria para débito y crédito
    const metodosUsados = modoDividido ? [selM1.value, selM2.value] : [metodo1];
    const necesitaFactura = metodosUsados.some((m) => m === "Débito" || m === "Crédito");
    const datosFac = leerFactura();
    const incompleta = !!(document.getElementById("facIncompleto") || {}).checked;
    if (necesitaFactura && !incompleta) {
      if (!datosFac) return toast("Falta completar la factura (obligatoria en débito/crédito)");
      if (!datosFac.numero) return toast("Falta el número de factura");
      if (!datosFac.nombre) return toast("Falta el nombre del cliente");
      if (!datosFac.dni) return toast("Falta el DNI");
    }

    btnConf.disabled = true;
    btnConf.textContent = "Procesando...";

    const { desc, baseConDesc, recargo } = recalcular();
    const precioFinal = baseConDesc + recargo;
    const fechaVenta = document.getElementById("fechaVenta").value;
    const inicioCambio = document.getElementById("fechaInicioCambio").value;

    let pago;
    if (!modoDividido) {
      // pago simple: todo lo cobrado va al único método
      pago = { tipo: "simple", metodo: metodo1, partes: [{ metodo: metodo1, monto: precioFinal }] };
    } else {
      // pago dividido: monto1 es lo que se cobra en el método 1 (con recargo si es tarjeta);
      // el método 2 cubre el resto de lo cobrado
      const cobra1 = Number(montoM1.value) || 0;
      const cobra2 = precioFinal - cobra1;
      pago = { tipo: "dividido", partes: [
        { metodo: selM1.value, monto: cobra1 },
        { metodo: selM2.value, monto: cobra2 },
      ] };
    }

    const res = await API.registrarVenta(lineas, pago, {
      precioBase: baseConDesc, precioFinal, fechaVenta, inicioCambio,
      // valor real del producto: con descuento/adicional aplicado, SIN recargo de tarjeta
      precioProducto: baseEfectivo(),
      voucherId: voucherSel ? voucherSel.id : null, descuento: desc,
    });

    if (res.ok) {
      // guardar la factura si el panel estaba abierto (aunque le falten datos)
      if (datosFac) {
        await API.crearFactura({
          numero: datosFac.numero || "",
          ventaId: res.idVenta,
          nombre: datosFac.nombre, dni: datosFac.dni, telefono: datosFac.telefono,
          tipoTarjeta: datosFac.tipoTarjeta, banco: datosFac.banco, cuotas: datosFac.cuotas,
          monto: precioFinal,
          metodoPago: modoDividido ? `${selM1.value} + ${selM2.value}` : metodo1,
          fecha: fechaVenta ? new Date(fechaVenta).toISOString() : new Date().toISOString(),
        });
        // si el banco es nuevo, guardarlo para próximas facturas (retroalimentación)
        if (datosFac.banco && !bancosDisponibles.includes(datosFac.banco)) {
          await API.agregarBanco(datosFac.banco);
        }
      }
      // marcar voucher usado y generar sobrante si corresponde
      if (voucherSel) {
        await API.usarVoucher(voucherSel.id);
        if (voucherSel.tipo === "monto" && voucherSel.monto > base) {
          const sobra = voucherSel.monto - base;
          const vence = new Date(); vence.setDate(vence.getDate() + CONFIG.DIAS_VENCIMIENTO_VOUCHER);
          await API.crearVoucher({
            id: "VCH-" + Date.now(), tipo: "monto", fecha: new Date().toISOString(),
            vencimiento: vence.toISOString().slice(0, 10), monto: sobra,
            nombre: voucherSel.nombre || "", telefono: voucherSel.telefono || "",
            origen: `Saldo de ${voucherSel.id}`, avisado: false, usado: false,
          });
        }
      }
      lineas.forEach((l) => {
        const v = State.stock.find((x) => x.codigo === l.codigo && x.talle === l.talle && x.color === l.color);
        if (v) v.cantidad -= l.cantidad;
      });
      if (lineas === State.carrito || lineas.length === State.carrito.length) {
        State.carrito = [];
        State.descuentoCarrito = 0;
      }
      cerrarModal();
      actualizarBadge();
      const msg = voucherSel
        ? (voucherSel.tipo === "monto" && voucherSel.monto > base ? "Venta registrada · Voucher aplicado (queda saldo)" : "Venta registrada · Voucher aplicado")
        : "Venta registrada";
      toast(msg);
      renderVentasCategorias(document.getElementById("view"));
    } else {
      toast("Error al registrar la venta");
      btnConf.disabled = false;
      btnConf.textContent = "Confirmar";
    }
  };

  recalcular();
}
