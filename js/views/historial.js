/* ============================================================
   VISTA HISTORIAL — ventas del último mes, con restaurar compra
   ============================================================ */

let _ventasHist = [];

function renderHistorial(root) {
  root.innerHTML = `
    <p class="view-title">HISTORIAL</p>
    <div id="histFiltros"></div>
    <div class="cambios-list" id="histList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando ventas...</p></div></div>`;
  cargarHistorial();
}

async function cargarHistorial() {
  const [res, resCC, resSE] = await Promise.all([API.getVentas(), API.getCuentas(), API.getSenas()]);
  if (!res.ok) {
    document.getElementById("histList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las ventas.</p></div>`;
    return;
  }
  const privado = modoPrivadoActivo();
  // en modo normal: solo últimos 2 días (hoy y ayer). En privado: último mes completo.
  const diasAtras = privado ? 60 : 1;
  const desde = new Date(); desde.setDate(desde.getDate() - diasAtras);
  desde.setHours(0, 0, 0, 0);

  // pagos de cuenta corriente como "ingresos" (para que sumen al total por método)
  let pagosCC = [];
  if (resCC.ok) {
    const nombrePorCuenta = {};
    resCC.cuentas.forEach((c) => { nombrePorCuenta[c.id] = `${c.nombre} ${c.apellido || ""}`.trim(); });
    pagosCC = resCC.pagos.map((p) => ({
      id: p.id, fechaHora: p.fecha, codigo: "CTA CTE", marca: "Pago cuenta",
      talle: "—", color: nombrePorCuenta[p.cuentaId] || "", cantidad: 1, oferta: 0,
      precioBase: p.monto, precioFinal: p.monto, metodoPago: p.metodoPago,
      pagos: [{ metodo: p.metodoPago, monto: p.monto }],
      restaurada: false, esPagoCuenta: true,
    }));
  }

  // pagos de seña como "ingresos" (la plata cuenta el día que se cobra)
  let pagosSE = [];
  if (resSE && resSE.ok) {
    const nombrePorSena = {};
    resSE.senas.forEach((s) => { nombrePorSena[s.id] = s.nombre || ""; });
    pagosSE = resSE.pagos.map((p) => ({
      id: "SP-" + p.id, fechaHora: p.fecha, codigo: "SEÑA", marca: "Pago seña",
      talle: "—", color: nombrePorSena[p.senaId] || "", cantidad: 1, oferta: 0,
      precioBase: p.monto, precioFinal: p.monto, metodoPago: p.metodoPago,
      pagos: [{ metodo: p.metodoPago, monto: p.monto }],
      restaurada: false, esPagoCuenta: true, esPagoSena: true,
    }));
  }

  _ventasHist = res.ventas.concat(pagosCC).concat(pagosSE)
    .filter((v) => new Date(v.fechaHora) >= desde)
    .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));

  const fcont = document.getElementById("histFiltros");
  fcont.innerHTML = "";
  const tallesDisp = [...new Set(_ventasHist.map((v) => v.talle))];
  // límites del filtro de fecha: en modo normal solo hoy y ayer
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const ayerD = new Date(); ayerD.setDate(ayerD.getDate() - 1);
  const ayer = ayerD.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const campoFecha = privado
    ? { id: "fecha", label: "Fecha", tipo: "date" }
    : { id: "fecha", label: "Fecha", tipo: "date", min: ayer, max: hoy };
  const barra = crearBarraFiltros({
    placeholder: "Buscar por marca o código...",
    campos: [
      { id: "talle", label: "Talle", tipo: "select", opciones: tallesDisp },
      { id: "pago", label: "Pago", tipo: "select", opciones: ["Efectivo", "Tarjeta", "Transferencia"] },
      { id: "estado", label: "Ventas", tipo: "select", opciones: ["Realizadas", "Todas", "Restauradas"], porDefecto: "Realizadas" },
      campoFecha,
    ],
    onChange: (f) => pintarHistorial(f),
  });
  fcont.appendChild(barra);

  pintarHistorial({ estado: "Realizadas" });
}

// detecta si una venta incluye cierto tipo de pago (sirve para pagos divididos)
function ventaUsaPago(v, tipo) {
  const m = (v.metodoPago || "").toLowerCase();
  if (tipo === "Efectivo") return m.includes("efectivo");
  if (tipo === "Transferencia") return m.includes("transferencia");
  if (tipo === "Tarjeta") return m.includes("débito") || m.includes("debito") || m.includes("crédito") || m.includes("credito");
  return true;
}

// ¿un método pertenece a la categoría de filtro?
function metodoEsTipo(metodo, tipo) {
  const m = (metodo || "").toLowerCase();
  if (tipo === "Efectivo") return m.includes("efectivo");
  if (tipo === "Transferencia") return m.includes("transferencia");
  if (tipo === "Tarjeta") return m.includes("débito") || m.includes("debito") || m.includes("crédito") || m.includes("credito");
  return false;
}

// monto que entró por un tipo de pago en una venta (usa el desglose si existe)
function montoPorTipo(v, tipo) {
  if (v.pagos && v.pagos.length) {
    return v.pagos.filter((p) => metodoEsTipo(p.metodo, tipo)).reduce((a, p) => a + (Number(p.monto) || 0), 0);
  }
  // ventas viejas sin desglose: si el método coincide, se asume lo realmente cobrado
  return ventaUsaPago(v, tipo) ? (v.precioFinal != null ? v.precioFinal : (v.precioBase || 0)) : 0;
}

function pintarHistorial(f) {
  const list = document.getElementById("histList");
  let lista = _ventasHist.slice();
  if (f.q) lista = lista.filter((v) => coincideTexto(v, f.q, ["marca", "codigo"]));
  if (f.talle) lista = lista.filter((v) => v.talle === f.talle);
  if (f.pago) lista = lista.filter((v) => ventaUsaPago(v, f.pago));
  // por defecto las restauradas se ocultan (no molestan).
  // "Restauradas" muestra solo esas; "Todas" muestra activas + restauradas.
  // Realizadas (por defecto) = solo las no restauradas; Restauradas = solo anuladas; Todas = ambas
  if (f.estado === "Restauradas") lista = lista.filter((v) => v.restaurada);
  else if (f.estado !== "Todas") lista = lista.filter((v) => !v.restaurada);
  if (f.fecha) lista = lista.filter((v) => fechaLocalISO(v.fechaHora) === f.fecha);

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-receipt-off"></i><p>Sin ventas que coincidan.</p></div>`;
    return;
  }

  // total: si se filtra por un método, mostrar solo la parte de ese método; si no, el total
  // en modo normal el total solo aparece si se eligió una fecha
  const mostrarTotal = modoPrivadoActivo() || !!f.fecha;
  let totalHTML = "";
  if (mostrarTotal) {
    const activas = lista.filter((v) => !v.restaurada);
    let total, etiqueta;
    if (f.pago) {
      total = activas.reduce((a, v) => a + montoPorTipo(v, f.pago), 0);
      etiqueta = `Total en ${f.pago.toLowerCase()} (${lista.length})`;
    } else {
      // usar precioFinal (lo realmente cobrado, ya con descuento/regalo/adicional),
      // NO precioBase (el precio original de lista)
      total = activas.reduce((a, v) => a + (v.precioFinal != null ? v.precioFinal : (v.precioBase || 0)), 0);
      etiqueta = `Total filtrado (${lista.length})`;
    }
    totalHTML = `<div class="hist-total"><span>${etiqueta}</span><strong>${formatPrecio(total)}</strong></div>`;
  }

  // Ventas de carrito: las líneas de una misma venta comparten el prefijo del id (V-123456-0, -1...).
  // Se les asigna un color de fondo distinto por venta, para distinguirlas visualmente.
  const grupos = {};
  lista.forEach((v) => {
    const pref = prefijoVenta(v.id);
    if (!grupos[pref]) grupos[pref] = 0;
    grupos[pref]++;
  });
  // solo las ventas con más de una línea (carrito) reciben color
  const colorPorVenta = {};
  let idxColor = 0;
  Object.keys(grupos).forEach((pref) => {
    if (grupos[pref] > 1) { colorPorVenta[pref] = (idxColor % 6) + 1; idxColor++; }
  });

  list.innerHTML = totalHTML + lista.map((v) => histRowHTML(v, f.pago, colorPorVenta[prefijoVenta(v.id)])).join("");
  lista.forEach((v) => bindHistRow(list, v));
}

// prefijo de una venta (sin el índice de línea): "V-123456-0" → "V-123456"
function prefijoVenta(id) {
  const s = String(id || "");
  const i = s.lastIndexOf("-");
  return i > 0 ? s.substring(0, i) : s;
}

function histRowHTML(v, filtroPago, colorCarrito) {
  const ofertaTxt = v.oferta ? ` · ${v.oferta}% off` : "";
  const pago = v.metodoPago ? ` · ${metodoColoreado(v.metodoPago)}` : "";
  // precio realmente cobrado (con descuento/regalo/adicional aplicado)
  const cobrado = v.precioFinal != null ? v.precioFinal : (v.precioBase || 0);
  // si se filtra por un método y la venta fue mixta, mostrar la parte de ese método
  let precioHTML;
  if (filtroPago) {
    const parcial = montoPorTipo(v, filtroPago);
    const esMixta = (v.pagos && v.pagos.length > 1);
    precioHTML = esMixta
      ? `<div class="c-precio"><span class="c-precio-parcial">${formatPrecio(parcial)}</span><span class="c-precio-total">de ${formatPrecio(cobrado)}</span></div>`
      : `<div class="c-precio">${formatPrecio(parcial)}</div>`;
  } else {
    // si hubo descuento/regalo, mostrar el cobrado y tachado el original
    const huboAjuste = v.precioBase && Math.abs(cobrado - v.precioBase) > 1;
    precioHTML = huboAjuste
      ? `<div class="c-precio"><span class="c-precio-parcial">${formatPrecio(cobrado)}</span><span class="c-precio-total c-tachado">${formatPrecio(v.precioBase)}</span></div>`
      : `<div class="c-precio">${formatPrecio(cobrado)}</div>`;
  }
  return `
    <div class="crow ${v.restaurada ? "expirado" : ""} ${colorCarrito ? "carrito-" + colorCarrito : ""}" data-id="${v.id}">
      <div class="pcell">
        <img class="pimg${v.esPagoCuenta ? "" : " zoomable"}" src="${imgPrenda(v.codigo, categoriaDeStock(v.codigo))}" alt="" onerror="this.style.opacity=0.3">
        <div class="pinfo"><span class="pmarca">${v.marca}</span><span class="pcod">${v.codigo}</span></div>
      </div>
      <div class="c-meta">
        <span class="c-vars">Talle <strong>${v.talle}</strong> · Color <strong>${v.color}</strong> · x${v.cantidad}${ofertaTxt}</span>
        <span class="c-fecha">${fmtFechaHora(v.fechaHora)}${pago}</span>
        ${v.restaurada ? `<span class="c-estado vencido">Restaurada</span>` : ""}
        ${v.voucherGenerado ? `<span class="c-estado c-estado-voucher"><i class="ti ti-ticket"></i> Voucher generado</span>` : ""}
      </div>
      ${precioHTML}
      <div class="c-acts">
        <button class="c-swap c-voucher" data-act="voucher" ${v.restaurada || v.esPagoCuenta || v.voucherGenerado ? "disabled" : ""} title="${v.voucherGenerado ? "Ya generó voucher (" + v.voucherGenerado + ")" : (v.restaurada ? "Venta restaurada" : "Generar voucher por esta venta")}">
          <i class="ti ti-ticket"></i>
        </button>
        <button class="c-swap" data-act="restore" ${v.restaurada || v.esPagoCuenta || v.voucherGenerado ? "disabled" : ""} title="${v.esPagoCuenta ? "Pago de cuenta corriente" : (v.voucherGenerado ? "Ya generó voucher" : (v.restaurada ? "Ya restaurada" : "Restaurar compra"))}">
          <i class="ti ti-arrow-back-up"></i>
        </button>
      </div>
    </div>`;
}

function bindHistRow(list, v) {
  const row = list.querySelector(`.crow[data-id="${v.id}"]`);
  const imgEl = row.querySelector(".pimg.zoomable");
  if (imgEl) imgEl.onclick = () => verImagenAmpliada(v.codigo, v.marca, categoriaDeStock(v.codigo));
  const btn = row.querySelector('[data-act="restore"]');
  if (btn && !btn.disabled) {
    btn.onclick = () => {
      dobleConfirmacion({
        titulo: "Restaurar compra",
        mensaje1: `Vas a restaurar la venta de ${v.codigo} (${v.talle}/${v.color}) por ${formatPrecio(v.precioBase)}.`,
        mensaje2: "La venta se anula, se repone el stock y se anula cualquier voucher usado en ella. ¿Confirmás?",
        textoBoton: "Restaurar",
        onOk: async () => {
          // reponer stock
          const s = State.stock.find((x) => x.codigo === v.codigo && x.talle === v.talle && x.color === v.color);
          if (s) s.cantidad += v.cantidad;
          // anular voucher usado en la venta (si lo hubo)
          if (v.voucherId) await API.actualizarVoucher(v.voucherId, { usado: false });
          await API.restaurarVenta(v.id);
          v.restaurada = true;
          toast("Compra restaurada · Stock repuesto");
          cargarHistorial();
          actualizarCampanitaVouchers();
        },
      });
    };
  }

  const btnVou = row.querySelector('[data-act="voucher"]');
  if (btnVou && !btnVou.disabled) {
    btnVou.onclick = () => abrirVoucherDesdeVenta(v);
  }
}

// Genera un voucher a partir de una venta: la prenda vuelve al stock,
// la venta NO se anula (el valor del día se mantiene) y el cliente recibe
// un voucher por el monto que pagó.
function abrirVoucherDesdeVenta(v) {
  const monto = v.precioFinal != null ? v.precioFinal : (v.precioBase || 0);
  const venceDefault = (() => {
    const d = new Date(); d.setDate(d.getDate() + CONFIG.DIAS_VENCIMIENTO_VOUCHER);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  })();

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="gvOv"></div>
    <div class="modal">
      <h2>Generar voucher</h2>
      <p class="dc-msg">Por la venta de <strong>${escAttr(v.marca || v.codigo)}</strong> (${v.talle}/${v.color}).</p>
      <div class="gv-monto">
        <span>Valor del voucher</span>
        <strong>${formatPrecio(monto)}</strong>
      </div>
      <div class="field"><label>Nombre</label><input class="sinput" id="gvNom" placeholder="Nombre y apellido"></div>
      <div class="field"><label>Teléfono</label><input class="sinput" id="gvTel" placeholder="Ej. 2915551234" inputmode="numeric"></div>
      <div class="field"><label>Vencimiento</label><input class="sinput" type="date" id="gvVence" value="${venceDefault}"></div>
      <p class="gv-aviso"><i class="ti ti-info-circle"></i> La prenda vuelve al stock y la venta sigue contando en el día.</p>
      <div class="modal-actions">
        <button class="btn-ghost" id="gvCancel">Cancelar</button>
        <button class="btn-primary" id="gvSave">Generar voucher</button>
      </div>
    </div>`;

  document.getElementById("gvOv").onclick = cerrarModal;
  document.getElementById("gvCancel").onclick = cerrarModal;

  document.getElementById("gvSave").onclick = async () => {
    const nombre = document.getElementById("gvNom").value.trim();
    const telefono = document.getElementById("gvTel").value.trim();
    const vencimiento = document.getElementById("gvVence").value;
    if (!nombre) return toast("Falta el nombre");
    if (!telefono) return toast("Falta el teléfono");
    if (monto <= 0) return toast("La venta no tiene monto para generar voucher");

    const btn = document.getElementById("gvSave");
    btn.disabled = true; btn.textContent = "Generando...";

    const idVoucher = "VCH-" + Date.now();
    const res = await API.crearVoucher({
      id: idVoucher, tipo: "monto", monto,
      fecha: new Date().toISOString(), vencimiento,
      nombre, telefono,
      origen: `Devolución de ${v.codigo}`,
      avisado: false, usado: false, comprado: false,
    });
    if (!res.ok) {
      btn.disabled = false; btn.textContent = "Generar voucher";
      return toast("No se pudo crear el voucher");
    }

    // la prenda vuelve al stock (es una devolución)
    await API.ajustarStockPorVariante(v.codigo, v.talle, v.color, v.cantidad);
    const s = State.stock.find((x) => x.codigo === v.codigo && x.talle === v.talle && x.color === v.color);
    if (s) s.cantidad += v.cantidad;

    // marcar la venta: ya generó voucher (no se puede volver a generar ni restaurar)
    await API.marcarVoucherGenerado(v.id, idVoucher);
    v.voucherGenerado = idVoucher;

    cerrarModal();
    toast(`Voucher de ${formatPrecio(monto)} generado · Prenda repuesta`);
    cargarHistorial();
    actualizarCampanitaVouchers();
  };
}
