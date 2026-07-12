/* ============================================================
   VISTA INFORMES — analítica de ventas (privada)
   Muestra ventas y ganancias mensuales, top prendas y talles,
   y recomendaciones de compra según stock vs ventas.
   ============================================================ */

let _ventasInf = [];   // ventas cargadas (sin restauradas)
let _mesInf = "";      // filtro de mes actual ("" = todo el tiempo)

function renderInformes(root) {
  State.dentroCategoria = false;
  refrescarHeader();
  root.innerHTML = `
    ${bandaSeccion("informes", "INFORMES", "Analítica de ventas")}
    <div id="infFiltro" class="inf-filtro"></div>
    <div id="infBody"><div class="soon"><i class="ti ti-loader"></i><p>Cargando datos...</p></div></div>
  `;
  cargarInformes();
}

async function cargarInformes() {
  const res = await API.getVentas();
  if (!res.ok) {
    document.getElementById("infBody").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las ventas.</p></div>`;
    return;
  }
  // excluir ventas restauradas (no cuentan como venta real)
  _ventasInf = res.ventas.filter((v) => !v.restaurada);

  // armar el selector de meses disponibles
  const meses = [...new Set(_ventasInf.map((v) => (v.fechaHora || "").substring(0, 7)))].filter(Boolean).sort().reverse();
  const opciones = ['<option value="">Todo el tiempo</option>']
    .concat(meses.map((m) => `<option value="${m}"${m === _mesInf ? " selected" : ""}>${nombreMes(m)}</option>`))
    .join("");
  document.getElementById("infFiltro").innerHTML = `
    <label class="inf-filtro-label">Período:</label>
    <select id="infMes" class="sinput">${opciones}</select>`;
  document.getElementById("infMes").onchange = (e) => { _mesInf = e.target.value; pintarInformes(); };

  pintarInformes();
}

// nombre legible de un mes "2026-01" → "Enero 2026"
function nombreMes(ym) {
  const [a, m] = ym.split("-");
  const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${nombres[Number(m) - 1] || m} ${a}`;
}

// costo estimado de una venta: busca el costo actual de esa prenda en el stock
function costoDeVenta(v) {
  const s = State.stock.find((x) => x.codigo === v.codigo);
  const costoUnit = s ? s.costo : 0;
  return costoUnit * v.cantidad;
}

function pintarInformes() {
  const body = document.getElementById("infBody");
  // filtrar por mes si corresponde
  let ventas = _ventasInf.slice();
  if (_mesInf) ventas = ventas.filter((v) => (v.fechaHora || "").substring(0, 7) === _mesInf);

  if (!ventas.length) {
    body.innerHTML = `<div class="soon"><i class="ti ti-chart-bar-off"></i><p>No hay ventas en el período seleccionado.</p></div>`;
    return;
  }

  body.innerHTML =
    bloqueResumen(ventas) +
    bloqueMensual() +
    bloqueTopPrendas(ventas) +
    bloqueTopTalles(ventas) +
    bloqueRecomendaciones(ventas) +
    bloqueMejoresMeses() +
    `<p class="inf-nota"><i class="ti ti-info-circle"></i> La ganancia neta usa el costo actual de cada prenda en stock, por lo que es una estimación.</p>`;
}

/* ---------- Bloque 1: resumen (ingresos, ganancias) ---------- */
function bloqueResumen(ventas) {
  const bruto = ventas.reduce((a, v) => a + v.precioFinal, 0);
  const costo = ventas.reduce((a, v) => a + costoDeVenta(v), 0);
  const neta = bruto - costo;
  const unidades = ventas.reduce((a, v) => a + v.cantidad, 0);
  const margen = bruto > 0 ? Math.round((neta / bruto) * 100) : 0;

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-cash"></i> Resumen ${_mesInf ? "de " + nombreMes(_mesInf) : "de todo el tiempo"}</h3>
      <div class="inf-cards">
        <div class="inf-card"><span class="inf-card-label">Ingresos brutos</span><span class="inf-card-val">${formatPrecio(bruto)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Ganancia neta (est.)</span><span class="inf-card-val" style="color:var(--gold-bright)">${formatPrecio(neta)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Margen</span><span class="inf-card-val">${margen}%</span></div>
        <div class="inf-card"><span class="inf-card-label">Prendas vendidas</span><span class="inf-card-val">${unidades}</span></div>
      </div>
    </div>`;
}

/* ---------- Bloque 2: ventas y ganancias por mes ---------- */
function bloqueMensual() {
  // siempre usa todas las ventas (ignora el filtro de mes, muestra el año)
  const porMes = {};
  _ventasInf.forEach((v) => {
    const ym = (v.fechaHora || "").substring(0, 7);
    if (!ym) return;
    if (!porMes[ym]) porMes[ym] = { bruto: 0, neta: 0, unidades: 0 };
    porMes[ym].bruto += v.precioFinal;
    porMes[ym].neta += v.precioFinal - costoDeVenta(v);
    porMes[ym].unidades += v.cantidad;
  });
  const meses = Object.keys(porMes).sort();
  if (meses.length < 2) return ""; // con un solo mes no tiene sentido el gráfico

  const maxBruto = Math.max(...meses.map((m) => porMes[m].bruto));
  const barras = meses.map((m) => {
    const d = porMes[m];
    const hBruto = maxBruto > 0 ? (d.bruto / maxBruto) * 100 : 0;
    const hNeta = maxBruto > 0 ? (d.neta / maxBruto) * 100 : 0;
    return `
      <div class="inf-barmes">
        <div class="inf-barmes-bars" title="${nombreMes(m)}: ${formatPrecio(d.bruto)} brutos, ${formatPrecio(d.neta)} netos">
          <div class="inf-bar-bruto" style="height:${hBruto}%"></div>
          <div class="inf-bar-neta" style="height:${hNeta}%"></div>
        </div>
        <span class="inf-barmes-label">${m.substring(5)}/${m.substring(2, 4)}</span>
        <span class="inf-barmes-val">${formatPrecioCorto(d.bruto)}</span>
      </div>`;
  }).join("");

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-calendar-stats"></i> Ventas por mes</h3>
      <div class="inf-legend">
        <span><i class="inf-dot dot-bruto"></i> Ingresos brutos</span>
        <span><i class="inf-dot dot-neta"></i> Ganancia neta</span>
      </div>
      <div class="inf-barmes-grid">${barras}</div>
    </div>`;
}

/* ---------- Bloque 3: prendas más vendidas ---------- */
function bloqueTopPrendas(ventas) {
  const porCod = {};
  ventas.forEach((v) => {
    if (!porCod[v.codigo]) porCod[v.codigo] = { codigo: v.codigo, marca: v.marca, unidades: 0, total: 0 };
    porCod[v.codigo].unidades += v.cantidad;
    porCod[v.codigo].total += v.precioFinal;
  });
  const top = Object.values(porCod).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
  const max = Math.max(...top.map((p) => p.unidades));

  const filas = top.map((p) => `
    <div class="inf-hbar-row">
      <span class="inf-hbar-name" title="${escAttr(p.marca)} · ${escAttr(p.codigo)}">${escAttr(p.marca || p.codigo)}</span>
      <div class="inf-hbar-track"><div class="inf-hbar-fill" style="width:${(p.unidades / max) * 100}%"></div></div>
      <span class="inf-hbar-val">${p.unidades}</span>
    </div>`).join("");

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-shirt"></i> Prendas más vendidas</h3>
      <div class="inf-hbars">${filas}</div>
    </div>`;
}

/* ---------- Bloque 4: talles más vendidos ---------- */
function bloqueTopTalles(ventas) {
  const porTalle = {};
  ventas.forEach((v) => { porTalle[v.talle] = (porTalle[v.talle] || 0) + v.cantidad; });
  const orden = Object.entries(porTalle).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...orden.map(([, n]) => n));
  const totalU = orden.reduce((a, [, n]) => a + n, 0);

  const filas = orden.map(([t, n]) => {
    const pct = totalU > 0 ? Math.round((n / totalU) * 100) : 0;
    return `
      <div class="inf-hbar-row">
        <span class="inf-hbar-name">${t}</span>
        <div class="inf-hbar-track"><div class="inf-hbar-fill fill-teal" style="width:${(n / max) * 100}%"></div></div>
        <span class="inf-hbar-val">${n} · ${pct}%</span>
      </div>`;
  }).join("");

  const masVendido = orden.length ? orden[0][0] : "—";

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-ruler-2"></i> Talles más vendidos</h3>
      <p class="inf-destacado">El talle que más sale es <strong>${masVendido}</strong></p>
      <div class="inf-hbars">${filas}</div>
    </div>`;
}

/* ---------- Bloque 5: recomendaciones de compra ---------- */
function bloqueRecomendaciones(ventas) {
  // por código: vendidas vs stock actual. Alta rotación = vendido alto respecto a lo que queda.
  const stat = {};
  ventas.forEach((v) => {
    if (!stat[v.codigo]) stat[v.codigo] = { codigo: v.codigo, marca: v.marca, vendidas: 0 };
    stat[v.codigo].vendidas += v.cantidad;
  });
  // agregar stock actual
  Object.values(stat).forEach((s) => {
    s.stock = State.stock.filter((x) => x.codigo === s.codigo).reduce((a, x) => a + x.cantidad, 0);
    // tasa de rotación: vendidas / (vendidas + stock). Cerca de 1 = se vendió casi todo.
    const totalHist = s.vendidas + s.stock;
    s.rotacion = totalHist > 0 ? s.vendidas / totalHist : 0;
  });

  const arr = Object.values(stat);
  // reponer urgente: se vendió mucho y queda poco (rotación alta)
  const reponer = arr.filter((s) => s.rotacion >= 0.7 && s.vendidas >= 2)
    .sort((a, b) => b.rotacion - a.rotacion || b.vendidas - a.vendidas).slice(0, 8);
  // ventas seguras: se vendió TODO lo que entró (stock 0), aunque sea poca cantidad
  const seguras = arr.filter((s) => s.stock === 0 && s.vendidas >= 1)
    .sort((a, b) => b.vendidas - a.vendidas).slice(0, 8);
  // frenar compra: mucho stock, poca venta (rotación baja)
  const frenar = arr.filter((s) => s.rotacion <= 0.2 && s.stock >= 5)
    .sort((a, b) => a.rotacion - b.rotacion).slice(0, 6);

  const chip = (s, extra) => `
    <div class="inf-reco-item">
      <span class="inf-reco-name">${escAttr(s.marca || s.codigo)}</span>
      <span class="inf-reco-detail">${escAttr(s.codigo)} · vendidas ${s.vendidas} · en stock ${s.stock}${extra ? " · " + extra : ""}</span>
    </div>`;

  let html = `<div class="inf-section"><h3 class="inf-h3"><i class="ti ti-bulb"></i> Recomendaciones de compra</h3>`;

  if (reponer.length) {
    html += `<div class="inf-reco-block reco-urgente">
      <p class="inf-reco-title"><i class="ti ti-flame"></i> Reponer: alta rotación</p>
      <p class="inf-reco-sub">Se vendieron mucho respecto a lo que queda. Conviene comprar más.</p>
      ${reponer.map((s) => chip(s, `${Math.round(s.rotacion * 100)}% vendido`)).join("")}
    </div>`;
  }
  if (seguras.length) {
    html += `<div class="inf-reco-block reco-segura">
      <p class="inf-reco-title"><i class="ti ti-circle-check"></i> Venta segura: se agotaron</p>
      <p class="inf-reco-sub">Se vendió todo lo que entró (stock en 0), aunque haya sido poca cantidad.</p>
      ${seguras.map((s) => chip(s)).join("")}
    </div>`;
  }
  if (frenar.length) {
    html += `<div class="inf-reco-block reco-frenar">
      <p class="inf-reco-title"><i class="ti ti-hand-stop"></i> Comprar con cuidado: baja rotación</p>
      <p class="inf-reco-sub">Hay bastante stock y poca venta. Evitá sobrecomprar.</p>
      ${frenar.map((s) => chip(s, `${Math.round(s.rotacion * 100)}% vendido`)).join("")}
    </div>`;
  }
  if (!reponer.length && !seguras.length && !frenar.length) {
    html += `<p class="inf-reco-sub">Todavía no hay suficientes datos para recomendaciones claras.</p>`;
  }
  html += `</div>`;
  return html;
}

/* ---------- Bloque 6: qué se vendió mejor cada mes ---------- */
function bloqueMejoresMeses() {
  // por mes, qué categoría vendió más unidades
  const porMesCat = {};
  _ventasInf.forEach((v) => {
    const ym = (v.fechaHora || "").substring(0, 7);
    if (!ym) return;
    // deducir categoría del stock actual, o del número del código
    const s = State.stock.find((x) => x.codigo === v.codigo);
    const cat = s ? s.categoria : (categoriaDeCodigo ? categoriaDeCodigo(v.codigo) : "—");
    if (!porMesCat[ym]) porMesCat[ym] = {};
    porMesCat[ym][cat] = (porMesCat[ym][cat] || 0) + v.cantidad;
  });
  const meses = Object.keys(porMesCat).sort();
  if (!meses.length) return "";

  const filas = meses.map((m) => {
    const cats = Object.entries(porMesCat[m]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const chips = cats.map(([c, n]) => `<span class="inf-mes-chip">${escAttr(c)} <strong>${n}</strong></span>`).join("");
    return `<div class="inf-mes-row"><span class="inf-mes-name">${nombreMes(m)}</span><div class="inf-mes-cats">${chips}</div></div>`;
  }).join("");

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-calendar-heart"></i> Qué funcionó mejor cada mes</h3>
      <p class="inf-reco-sub">Las categorías más vendidas en cada mes (útil para anticipar temporada).</p>
      <div class="inf-mes-list">${filas}</div>
    </div>`;
}

/* ---------- helpers ---------- */
// precio corto para etiquetas de barras: $12.500 → $12k
function formatPrecioCorto(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + Math.round(n);
}
