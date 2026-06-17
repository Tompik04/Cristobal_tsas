/* ============================================================
   VISTA CAMBIOS — ventas de los últimos 30 días con su estado
   ============================================================ */

function renderCambios(root) {
  root.innerHTML = `<p class="view-title">CAMBIOS</p><div class="cambios-list" id="cambiosList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando ventas...</p></div></div>`;
  cargarCambios();
}

async function cargarCambios() {
  const list = document.getElementById("cambiosList");
  const res = await API.getVentas();
  if (!res.ok) { list.innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las ventas.</p></div>`; return; }

  // filtrar últimos N días
  const limiteDias = CONFIG.DIAS_HISTORIAL_CAMBIOS;
  const ahora = new Date();
  const desde = new Date(); desde.setDate(desde.getDate() - limiteDias);

  const ventas = res.ventas
    .filter((v) => new Date(v.fechaHora) >= desde)
    .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));

  if (!ventas.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-receipt-off"></i><p>No hay ventas en los últimos ${limiteDias} días.</p></div>`;
    return;
  }

  list.innerHTML = ventas.map(crowHTML).join("");
  ventas.forEach((v) => bindCrow(list, v));
}

// estado de la ventana de cambio de una venta
function estadoCambio(v) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const inicio = v.inicioCambio ? new Date(v.inicioCambio + "T00:00:00") : null;
  const limite = v.limiteCambio ? new Date(v.limiteCambio + "T00:00:00") : null;
  if (!inicio || !limite) return { tipo: "no", label: "Sin datos de cambio" };
  if (hoy < inicio) return { tipo: "espera", label: `Cambio desde ${fmtFecha(v.inicioCambio)}` };
  if (hoy > limite) return { tipo: "no", label: "Fuera de período" };
  return { tipo: "ok", label: `Cambio hasta ${fmtFecha(v.limiteCambio)}` };
}

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " " +
         d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function crowHTML(v) {
  const est = estadoCambio(v);
  const cambiable = est.tipo === "ok";
  const claseFila = est.tipo === "no" ? "expirado" : (est.tipo === "espera" ? "pendiente-ventana" : "");
  const ofertaTxt = v.oferta ? ` · ${v.oferta}% off` : "";
  return `
    <div class="crow ${claseFila}" data-id="${v.id}">
      <div class="pcell">
        <img class="pimg" src="img/${v.codigo.toLowerCase()}.png" alt="" onerror="this.style.opacity=0.3">
        <div class="pinfo"><span class="pmarca">${v.marca}</span><span class="pcod">${v.codigo}</span></div>
      </div>
      <div class="c-meta">
        <span class="c-vars">Talle <strong>${v.talle}</strong> · Color <strong>${v.color}</strong> · x${v.cantidad}${ofertaTxt}</span>
        <span class="c-fecha">${fmtFechaHora(v.fechaHora)}</span>
        <span class="c-estado ${est.tipo}">${est.label}</span>
      </div>
      <div class="c-precio">${formatPrecio(v.precioBase)}</div>
      <button class="c-swap" data-act="swap" ${cambiable ? "" : "disabled"} title="${cambiable ? "Realizar cambio" : "No disponible para cambio"}">
        <i class="ti ti-arrows-exchange"></i>
      </button>
    </div>`;
}

function bindCrow(list, v) {
  const row = list.querySelector(`.crow[data-id="${v.id}"]`);
  const swap = row.querySelector('[data-act="swap"]');
  if (swap && !swap.disabled) {
    swap.onclick = () => abrirIntercambio(v);
  }
}

// ---- Popup de intercambio ----
function abrirIntercambio(venta) {
  if (!State.carrito.length) {
    return toast("Primero agregá las prendas nuevas al carrito (en Ventas)");
  }

  const totalNuevas = State.carrito.reduce((a, l) => a + precioLinea(l), 0);
  const valorDevuelto = venta.precioBase; // precio base sin recargo
  const diferencia = totalNuevas - valorDevuelto; // + cliente paga / - voucher

  const cardDevuelta = `
    <div class="swap-card">
      <img src="img/${venta.codigo.toLowerCase()}.png" onerror="this.style.opacity=0.3">
      <div class="sc-info">
        <strong>${venta.marca}</strong>
        <span class="sc-cod">${venta.codigo} · ${venta.talle}/${venta.color}</span>
        <span class="sc-price">${formatPrecio(valorDevuelto)}</span>
      </div>
    </div>`;

  const cardsNuevas = State.carrito.map((l) => `
    <div class="swap-card">
      <img src="img/${l.codigo.toLowerCase()}.png" onerror="this.style.opacity=0.3">
      <div class="sc-info">
        <strong>${l.marca}</strong>
        <span class="sc-cod">${l.codigo} · ${l.talle}/${l.color} · x${l.cantidad}</span>
        <span class="sc-price">${formatPrecio(precioLinea(l))}</span>
      </div>
    </div>`).join("");

  let diffHTML;
  if (diferencia > 0) {
    diffHTML = `<div class="modal-total"><span>El cliente paga</span><span class="pay">${formatPrecio(diferencia)}</span></div>
      <p class="swap-note">Se pedirá método de pago al confirmar.</p>`;
  } else if (diferencia < 0) {
    diffHTML = `<div class="modal-total"><span>Saldo a favor (voucher)</span><span class="credit">${formatPrecio(-diferencia)}</span></div>
      <p class="swap-note">Se generará un voucher por la diferencia.</p>`;
  } else {
    diffHTML = `<div class="modal-total"><span>Diferencia</span><span>$0</span></div>
      <p class="swap-note">El cambio es exacto.</p>`;
  }

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal swap-modal">
      <h2>Intercambio</h2>
      <div class="swap-cols">
        <div class="swap-side">
          <h3>Devuelve</h3>
          ${cardDevuelta}
        </div>
        <div class="swap-arrow"><i class="ti ti-arrows-exchange"></i></div>
        <div class="swap-side">
          <h3>Se lleva (${State.carrito.length})</h3>
          <div class="swap-list">${cardsNuevas || '<p class="swap-empty">Carrito vacío</p>'}</div>
        </div>
      </div>
      <div class="swap-diff">${diffHTML}</div>
      <div class="modal-actions">
        <button class="btn-ghost" id="swapCancel">Cancelar</button>
        <button class="btn-primary" id="swapNext">${diferencia > 0 ? "Continuar al pago" : "Confirmar cambio"}</button>
      </div>
    </div>`;

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("swapCancel").onclick = cerrarModal;
  document.getElementById("swapNext").onclick = () => {
    if (diferencia > 0) {
      abrirPagoDiferencia(venta, diferencia);
    } else {
      confirmarIntercambio(venta, { diferencia, voucher: diferencia < 0 ? -diferencia : 0, metodoPago: null });
    }
  };
}

// si el cliente debe pagar, pedir método de pago
function abrirPagoDiferencia(venta, diferencia) {
  let metodo = null;
  const pagos = MEDIOS_PAGO.map((m) => `<button class="pay-opt" data-pago="${m}">${m}</button>`).join("");
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Pago de diferencia</h2>
      <div class="modal-total"><span>A pagar</span><span id="difTotal">${formatPrecio(diferencia)}</span></div>
      <div class="modal-line" id="recLine" style="display:none"><span>Recargo tarjeta (20%)</span><strong id="recVal">$0</strong></div>
      <p class="login-sub" style="text-align:center">Método de pago</p>
      <div class="pay-grid">${pagos}</div>
      <div class="modal-actions">
        <button class="btn-ghost" id="payCancel">Volver</button>
        <button class="btn-primary" id="payConfirm" disabled>Confirmar cambio</button>
      </div>
    </div>`;
  const btn = document.getElementById("payConfirm");
  const recLine = document.getElementById("recLine");
  const recVal = document.getElementById("recVal");
  const difTotal = document.getElementById("difTotal");
  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("payCancel").onclick = () => abrirIntercambio(venta);
  document.querySelectorAll("[data-pago]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".pay-opt").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      metodo = b.dataset.pago;
      const rec = MEDIOS_CON_RECARGO.includes(metodo) ? diferencia * CONFIG.RECARGO_TARJETA : 0;
      if (rec > 0) { recLine.style.display = "flex"; recVal.textContent = formatPrecio(rec); }
      else recLine.style.display = "none";
      difTotal.textContent = formatPrecio(diferencia + rec);
      btn.disabled = false;
    };
  });
  btn.onclick = () => confirmarIntercambio(venta, { diferencia, voucher: 0, metodoPago: metodo });
}

async function confirmarIntercambio(venta, info) {
  // construir voucher si corresponde
  let voucher = null;
  if (info.voucher > 0) {
    voucher = {
      id: "VCH-" + Date.now(),
      fecha: new Date().toISOString(),
      monto: info.voucher,
      origen: `Cambio de ${venta.codigo}`,
      usado: false,
    };
  }

  const res = await API.registrarIntercambio({
    ventaDevuelta: venta,
    lineasNuevas: State.carrito.slice(),
    diferencia: info.diferencia,
    metodoPago: info.metodoPago,
    voucher,
  });

  if (res.ok) {
    // descontar stock de las prendas nuevas
    State.carrito.forEach((l) => {
      const v = State.stock.find((s) => s.codigo === l.codigo && s.talle === l.talle && s.color === l.color);
      if (v) v.cantidad -= l.cantidad;
    });
    // reponer stock de la prenda devuelta
    const dev = State.stock.find((s) => s.codigo === venta.codigo && s.talle === venta.talle && s.color === venta.color);
    if (dev) dev.cantidad += venta.cantidad;
    // vaciar carrito
    State.carrito = [];
    cerrarModal();
    if (voucher) toast(`Cambio hecho · Voucher de ${formatPrecio(voucher.monto)}`);
    else toast("Cambio realizado");
    cargarCambios();
  } else {
    toast("Error al registrar el cambio");
  }
}
