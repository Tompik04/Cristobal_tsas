/* ============================================================a
   VISTA HISTORIAL — ventas del último mes, con restaurar compra
   ============================================================ */

let _ventasHist = [];
let _ventaPorId = {};       // id de venta → venta (para vincular los cambios)
let _cambioPorOrigen = {};  // id de la venta original → venta nueva del cambio

function renderHistorial(root) {
  root.innerHTML = `
    <p class="view-title">HISTORIAL</p>
    <div id="histFiltros"></div>
    <div class="cambios-list" id="histList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando ventas...</p></div></div>`;
  cargarHistorial();
}

async function cargarHistorial() {
  const [res, resCC, resSE, resVO] = await Promise.all([API.getVentas(), API.getCuentas(), API.getSenas(), API.getVouchers()]);
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

  // vouchers COMPRADOS como ingreso: la plata entra el día que se vende la gift card.
  // El ingreso es lo que PAGÓ el cliente (no el saldo del voucher, que puede tener bonificación).
  // Al usar el voucher en prendas, esas ventas registran precioFinal=0 (o solo el excedente),
  // así que no hay doble conteo.
  let ingresosVO = [];
  if (resVO && resVO.ok) {
    ingresosVO = resVO.vouchers.filter((v) => v.comprado && (v.pagado || 0) > 0).map((v) => {
      const bonif = (v.monto || 0) - (v.pagado || 0); // regalo (mercadería), informativo
      return {
        id: "VO-" + v.id, fechaHora: v.fecha, codigo: "VOUCHER", marca: "Venta de voucher",
        talle: "—", color: v.nombre || "", cantidad: 1, oferta: 0,
        precioBase: v.pagado, precioFinal: v.pagado, metodoPago: v.metodoPago,
        pagos: [{ metodo: v.metodoPago, monto: v.pagado }],
        restaurada: false, esPagoCuenta: true, esVoucher: true,
        voucherMonto: v.monto || 0, voucherBonif: bonif > 0 ? bonif : 0,
      };
    });
  }

  // Índices para mostrar el cambio completo en el historial.
  // Se arman con TODAS las ventas (no solo las del período visible), porque
  // la venta original puede ser de antes de la ventana de fechas.
  _ventaPorId = {};
  _cambioPorOrigen = {};
  res.ventas.forEach((v) => {
    _ventaPorId[v.id] = v;
    if (v.esCambio && v.cambioDe) _cambioPorOrigen[v.cambioDe] = v; // original → prenda que se llevó
  });

  _ventasHist = res.ventas.filter((v) => !v.esSena).concat(pagosCC).concat(pagosSE).concat(ingresosVO)
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
  // Estado: "Realizadas" (por defecto) = solo las NO restauradas;
  //         "Restauradas" = solo las anuladas; "Todas" = ambas.
  // Si por lo que sea llega vacío, se asume "Realizadas" (nunca mostrar todo por error).
  const estado = f.estado || "Realizadas";
  if (estado === "Restauradas") lista = lista.filter((v) => v.restaurada);
  else if (estado !== "Todas") lista = lista.filter((v) => !v.restaurada);
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
    <div class="crow ${v.restaurada ? "expirado fila-restaurada" : ""} ${v.cambiada ? "fila-cambiada" : ""} ${colorCarrito ? "carrito-" + colorCarrito : ""}" data-id="${v.id}">
      <div class="pcell">
        <img class="pimg${v.esPagoCuenta ? "" : " zoomable"}" src="${imgPrenda(v.codigo, categoriaDeStock(v.codigo))}" alt="" onerror="this.style.opacity=0.3">
        <div class="pinfo"><span class="pmarca">${v.marca}</span><span class="pcod">${v.codigo}</span></div>
      </div>
      <div class="c-meta">
        ${v.esVoucher
          ? `<span class="c-vars"><strong>${v.color || "—"}</strong> · saldo ${formatPrecio(v.voucherMonto)}${v.voucherBonif > 0 ? ` · bonificás ${formatPrecio(v.voucherBonif)}` : ""}</span>`
          : `<span class="c-vars">Talle <strong>${v.talle}</strong> · Color <strong>${v.color}</strong> · x${v.cantidad}${ofertaTxt}</span>`}
        <span class="c-fecha">${fmtFechaHora(v.fechaHora)}${pago}</span>
        ${v.restaurada ? `<span class="c-estado vencido">Restaurada</span>` : ""}
        ${detalleCambioHTML(v)}
        ${v.voucherGenerado ? `<span class="c-estado c-estado-voucher"><i class="ti ti-ticket"></i> Voucher generado</span>` : ""}
      </div>
      ${precioHTML}
      <div class="c-acts">
        <button class="c-swap c-voucher" data-act="voucher" ${v.restaurada || v.esPagoCuenta || v.voucherGenerado || v.cambiada ? "disabled" : ""} title="${v.cambiada ? "Ya fue cambiada" : (v.voucherGenerado ? "Ya generó voucher (" + v.voucherGenerado + ")" : (v.restaurada ? "Venta restaurada" : "Generar voucher por esta venta"))}">
          <i class="ti ti-ticket"></i>
        </button>
        <button class="c-swap" data-act="restore" ${v.restaurada || v.esPagoCuenta || v.voucherGenerado || v.cambiada ? "disabled" : ""} title="${v.esPagoCuenta ? "Pago de cuenta corriente" : (v.cambiada ? "Ya fue cambiada" : (v.voucherGenerado ? "Ya generó voucher" : (v.restaurada ? "Ya restaurada" : "Restaurar compra")))}">
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
        mensaje2: v.esCambio
          ? "Se deshace el CAMBIO completo: la prenda vuelve al stock, la prenda original sale de nuevo (se la queda el cliente) y su venta vuelve a estar disponible para cambiar. ¿Confirmás?"
          : "La venta se anula, se repone el stock y se anula cualquier voucher usado en ella. ¿Confirmás?",
        textoBoton: "Restaurar",
        onOk: async () => {
          // anular voucher usado en la venta (si lo hubo)
          if (v.voucherId) await API.actualizarVoucher(v.voucherId, { usado: false });
          const res = await API.restaurarVenta(v.id);
          v.restaurada = true;
          // el stock puede haber cambiado en 2 prendas (si se deshizo un cambio),
          // así que se recarga desde la base para que quede exacto
          const rec = await API.getStock();
          if (rec.ok) State.stock = rec.stock;
          if (res && res.ok && !res.stockRepuesto) {
            toast("Atención: la prenda no se pudo reponer al stock. Revisala a mano.");
          } else {
            toast(res && res.deshizoCambio
              ? "Cambio deshecho · La venta original vuelve a estar disponible"
              : "Compra restaurada · Stock repuesto");
          }
          cargarHistorial();
          actualizarCampanitaVouchers();
        },
      });
    };
  }

  const btnVou = row.querySelector('[data-act="voucher"]');
  if (btnVou && !btnVou.disabled) {
    // la implementación vive en vouchers.js (la comparten Historial y Cambios).
    // El monto propuesto sale del default compartido: el VALOR DE LA PRENDA
    // (precio_producto), no el precio final cobrado. Con precio_final, una venta
    // pagada con tarjeta proponía un 25% de más (el recargo no es mercadería) y
    // una pagada con voucher o seña proponía $0, que la validación rechaza.
    btnVou.onclick = () => abrirVoucherDesdeVenta(v, { onListo: cargarHistorial });
  }
}

// abrirVoucherDesdeVenta() vive en js/views/vouchers.js: la comparten Historial y Cambios.

// Detalle del cambio en la fila del historial: muestra las DOS puntas del cambio
// (la prenda que volvió al stock y la que se llevó el cliente).
function detalleCambioHTML(v) {
  const desc = (x) => x ? `${escAttr(x.marca || x.codigo)} <span class="cd-var">${x.talle}/${x.color}</span>` : "—";

  // Esta venta ES la del cambio (la prenda que se llevó el cliente)
  if (v.esCambio) {
    const orig = v.cambioDe ? _ventaPorId[v.cambioDe] : null;
    const dif = v.precioFinal || 0;
    return `
      <div class="cd-box">
        <span class="cd-tag"><i class="ti ti-arrows-exchange"></i> Cambio</span>
        <span class="cd-linea">
          <span class="cd-in"><i class="ti ti-arrow-back-up"></i> Volvió al stock: ${desc(orig)}</span>
          <span class="cd-out"><i class="ti ti-arrow-right"></i> Se llevó: ${desc(v)}</span>
        </span>
        <span class="cd-dif">${dif > 0 ? "Pagó de diferencia " + formatPrecio(dif) : "Sin diferencia a pagar"}</span>
      </div>`;
  }

  // Esta venta FUE cambiada (la prenda volvió al stock y el cliente se llevó otra)
  if (v.cambiada) {
    const nueva = _cambioPorOrigen[v.id];
    return `
      <div class="cd-box cd-box-orig">
        <span class="cd-tag"><i class="ti ti-arrows-exchange"></i> Cambiada</span>
        <span class="cd-linea">
          <span class="cd-in"><i class="ti ti-arrow-back-up"></i> Esta prenda volvió al stock</span>
          <span class="cd-out"><i class="ti ti-arrow-right"></i> Se llevó: ${desc(nueva)}</span>
        </span>
        <span class="cd-dif">Lo pagado sigue contando en este día</span>
      </div>`;
  }

  return "";
}
