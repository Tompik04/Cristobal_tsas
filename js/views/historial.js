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
  const res = await API.getVentas();
  if (!res.ok) {
    document.getElementById("histList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las ventas.</p></div>`;
    return;
  }
  // último mes (30 días), incluye restauradas
  const desde = new Date(); desde.setDate(desde.getDate() - 30);
  _ventasHist = res.ventas
    .filter((v) => new Date(v.fechaHora) >= desde)
    .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));

  const fcont = document.getElementById("histFiltros");
  fcont.innerHTML = "";
  const tallesDisp = [...new Set(_ventasHist.map((v) => v.talle))];
  const barra = crearBarraFiltros({
    placeholder: "Buscar por marca o código...",
    campos: [
      { id: "talle", label: "Talle", tipo: "select", opciones: tallesDisp },
      { id: "estado", label: "Estado", tipo: "select", opciones: ["Activas", "Restauradas"] },
      { id: "fecha", label: "Fecha", tipo: "date" },
    ],
    onChange: (f) => pintarHistorial(f),
  });
  fcont.appendChild(barra);

  pintarHistorial({});
}

function pintarHistorial(f) {
  const list = document.getElementById("histList");
  let lista = _ventasHist.slice();
  if (f.q) lista = lista.filter((v) => coincideTexto(v, f.q, ["marca", "codigo"]));
  if (f.talle) lista = lista.filter((v) => v.talle === f.talle);
  if (f.estado === "Activas") lista = lista.filter((v) => !v.restaurada);
  if (f.estado === "Restauradas") lista = lista.filter((v) => v.restaurada);
  if (f.fecha) lista = lista.filter((v) => fechaLocalISO(v.fechaHora) === f.fecha);

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-receipt-off"></i><p>Sin ventas que coincidan.</p></div>`;
    return;
  }
  list.innerHTML = lista.map(histRowHTML).join("");
  lista.forEach((v) => bindHistRow(list, v));
}

function histRowHTML(v) {
  const ofertaTxt = v.oferta ? ` · ${v.oferta}% off` : "";
  const pago = v.metodoPago ? ` · ${v.metodoPago}` : "";
  return `
    <div class="crow ${v.restaurada ? "expirado" : ""}" data-id="${v.id}">
      <div class="pcell">
        <img class="pimg" src="img/${v.codigo.toLowerCase()}.png" alt="" onerror="this.style.opacity=0.3">
        <div class="pinfo"><span class="pmarca">${v.marca}</span><span class="pcod">${v.codigo}</span></div>
      </div>
      <div class="c-meta">
        <span class="c-vars">Talle <strong>${v.talle}</strong> · Color <strong>${v.color}</strong> · x${v.cantidad}${ofertaTxt}</span>
        <span class="c-fecha">${fmtFechaHora(v.fechaHora)}${pago}</span>
        ${v.restaurada ? `<span class="c-estado vencido">Restaurada</span>` : ""}
      </div>
      <div class="c-precio">${formatPrecio(v.precioBase)}</div>
      <button class="c-swap" data-act="restore" ${v.restaurada ? "disabled" : ""} title="${v.restaurada ? "Ya restaurada" : "Restaurar compra"}">
        <i class="ti ti-arrow-back-up"></i>
      </button>
    </div>`;
}

function bindHistRow(list, v) {
  const row = list.querySelector(`.crow[data-id="${v.id}"]`);
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
