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
    swap.onclick = () => toast("El flujo de cambio se define en el próximo paso");
  }
}
