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
        <img class="pimg" src="${imgPrenda(p.codigo)}" alt="">
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

// ---- Carrito ---- (el FAB y el badge ahora son globales en app.js)

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

function abrirPopupVenta(lineas) {
  // estado de pago: simple o dividido
  let modoDividido = false;
  let metodo1 = null, metodo2 = null;
  let montoTarjetaManual = null;
  let voucherSel = null; // voucher aplicado

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

      <div class="voucher-select-row">
        <div class="field">
          <label>Voucher (opcional)</label>
          <select id="selVoucher"><option value="">Sin voucher</option></select>
        </div>
      </div>

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
        <div class="modal-line descuento-line" id="descLine" style="display:none"><span id="descLabel">Voucher</span><strong id="descVal">$0</strong></div>
        <div class="modal-line" id="recargoLine" style="display:none"><span>Recargo tarjeta (20%)</span><strong id="recargoVal">$0</strong></div>
        <div class="modal-total"><span>Total a cobrar</span><span id="totalVal">${formatPrecio(base)}</span></div>
      </div>

      <div class="vuelto-box" id="vueltoBox" style="display:none">
        <div class="field">
          <label>Paga con</label>
          <input type="number" id="pagaCon" min="0" placeholder="$ que entrega el cliente">
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

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("cancelar").onclick = cerrarModal;

  // cargar vouchers disponibles en el selector
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
  function descuentoVoucher() {
    if (!voucherSel) return 0;
    if (voucherSel.tipo === "descuento") return base * (voucherSel.descuento / 100);
    return Math.min(voucherSel.monto, base); // monto, tope = base
  }

  function recargoDe(monto, met) {
    return MEDIOS_CON_RECARGO.includes(met) ? monto * CONFIG.RECARGO_TARJETA : 0;
  }

  function recalcular() {
    const desc = descuentoVoucher();
    const baseConDesc = base - desc; // voucher primero
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
      // En modo dividido, el monto1 que escribe la empleada es LO QUE SE COBRA en el método 1
      // (ya con recargo si es tarjeta). Calculamos hacia atrás la parte del producto que cubre.
      const cobra1 = Number(montoM1.value) || 0;
      const factor1 = MEDIOS_CON_RECARGO.includes(m1) ? (1 + CONFIG.RECARGO_TARJETA) : 1;
      const productoM1 = cobra1 / factor1; // parte del producto cubierta por el método 1
      const productoM2 = baseConDesc - productoM1; // parte del producto que cubre el método 2
      const cobra2 = productoM2 + recargoDe(productoM2, m2); // lo que se cobra en el método 2
      montoM2.value = productoM2 >= 0 ? formatPrecio(cobra2) : "—";
      if (productoM1 > 0 && productoM1 < baseConDesc && m1 !== m2) {
        recargo = recargoDe(productoM1, m1) + recargoDe(productoM2, m2);
        valido = true;
      }
    }

    if (recargo > 0) { recargoLine.style.display = "flex"; recargoVal.textContent = formatPrecio(recargo); }
    else recargoLine.style.display = "none";
    totalVal.textContent = formatPrecio(baseConDesc + recargo);
    btnConf.disabled = !valido;

    actualizarVuelto(baseConDesc, recargo);
    return { desc, baseConDesc, recargo };
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
  document.getElementById("pagaCon").addEventListener("input", () => recalcular());
  [selM1, selM2].forEach((el) => el.addEventListener("change", recalcular));

  btnConf.onclick = async () => {
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
      voucherId: voucherSel ? voucherSel.id : null, descuento: desc,
    });

    if (res.ok) {
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
