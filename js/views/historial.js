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
  const [res, resCC] = await Promise.all([API.getVentas(), API.getCuentas()]);
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

  _ventasHist = res.ventas.concat(pagosCC)
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
      { id: "estado", label: "Estado", tipo: "select", opciones: ["Activas", "Restauradas"] },
      campoFecha,
    ],
    onChange: (f) => pintarHistorial(f),
  });
  fcont.appendChild(barra);

  pintarHistorial({});
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
  // ventas viejas sin desglose: si el método coincide, se asume el total
  return ventaUsaPago(v, tipo) ? (v.precioBase || 0) : 0;
}

function pintarHistorial(f) {
  const list = document.getElementById("histList");
  let lista = _ventasHist.slice();
  if (f.q) lista = lista.filter((v) => coincideTexto(v, f.q, ["marca", "codigo"]));
  if (f.talle) lista = lista.filter((v) => v.talle === f.talle);
  if (f.pago) lista = lista.filter((v) => ventaUsaPago(v, f.pago));
  if (f.estado === "Activas") lista = lista.filter((v) => !v.restaurada);
  if (f.estado === "Restauradas") lista = lista.filter((v) => v.restaurada);
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
      total = activas.reduce((a, v) => a + (v.precioBase || 0), 0);
      etiqueta = `Total filtrado (${lista.length})`;
    }
    totalHTML = `<div class="hist-total"><span>${etiqueta}</span><strong>${formatPrecio(total)}</strong></div>`;
  }

  list.innerHTML = totalHTML + lista.map((v) => histRowHTML(v, f.pago)).join("");
  lista.forEach((v) => bindHistRow(list, v));
}

function histRowHTML(v, filtroPago) {
  const ofertaTxt = v.oferta ? ` · ${v.oferta}% off` : "";
  const pago = v.metodoPago ? ` · ${metodoColoreado(v.metodoPago)}` : "";
  // si se filtra por un método y la venta fue mixta, mostrar la parte de ese método
  let precioHTML;
  if (filtroPago) {
    const parcial = montoPorTipo(v, filtroPago);
    const esMixta = (v.pagos && v.pagos.length > 1);
    precioHTML = esMixta
      ? `<div class="c-precio"><span class="c-precio-parcial">${formatPrecio(parcial)}</span><span class="c-precio-total">de ${formatPrecio(v.precioBase)}</span></div>`
      : `<div class="c-precio">${formatPrecio(parcial)}</div>`;
  } else {
    precioHTML = `<div class="c-precio">${formatPrecio(v.precioBase)}</div>`;
  }
  return `
    <div class="crow ${v.restaurada ? "expirado" : ""}" data-id="${v.id}">
      <div class="pcell">
        <img class="pimg${v.esPagoCuenta ? "" : " zoomable"}" src="${imgPrenda(v.codigo)}" alt="" onerror="this.style.opacity=0.3">
        <div class="pinfo"><span class="pmarca">${v.marca}</span><span class="pcod">${v.codigo}</span></div>
      </div>
      <div class="c-meta">
        <span class="c-vars">Talle <strong>${v.talle}</strong> · Color <strong>${v.color}</strong> · x${v.cantidad}${ofertaTxt}</span>
        <span class="c-fecha">${fmtFechaHora(v.fechaHora)}${pago}</span>
        ${v.restaurada ? `<span class="c-estado vencido">Restaurada</span>` : ""}
      </div>
      ${precioHTML}
      <button class="c-swap" data-act="restore" ${v.restaurada || v.esPagoCuenta ? "disabled" : ""} title="${v.esPagoCuenta ? "Pago de cuenta corriente" : (v.restaurada ? "Ya restaurada" : "Restaurar compra")}">
        <i class="ti ti-arrow-back-up"></i>
      </button>
    </div>`;
}

function bindHistRow(list, v) {
  const row = list.querySelector(`.crow[data-id="${v.id}"]`);
  const imgEl = row.querySelector(".pimg.zoomable");
  if (imgEl) imgEl.onclick = () => verImagenAmpliada(v.codigo, v.marca);
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
}
