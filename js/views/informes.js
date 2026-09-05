/* ============================================================
   VISTA INFORMES — analítica de ventas (privada)
   Muestra ventas y ganancias mensuales, top prendas y talles,
   y recomendaciones de compra según stock vs ventas.
   ============================================================ */

let _ventasInf = [];   // ventas cargadas (sin restauradas)
let _cobrosInf = [];   // cobros de cuenta corriente y señas
let _gastosInf = [];   // gastos del local (entran en la ganancia neta)
let _ingresosInf = []; // log de ingresos de stock (prendas que entraron por mes)
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
  const [res, rc, rs, rvo, ri, rg] = await Promise.all([API.getVentas(), API.getCuentas(), API.getSenas(), API.getVouchers(), API.getIngresosStock(), API.getGastos()]);
  if (!res.ok) {
    document.getElementById("infBody").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las ventas.</p></div>`;
    return;
  }
  // excluir ventas restauradas (no cuentan como venta real)
  _ventasInf = res.ventas.filter((v) => !v.restaurada);
  _ingresosInf = ri && ri.ok ? ri.ingresos : [];
  // los gastos entran en la ganancia neta: sin ellos el número no cerraba con Gastos
  _gastosInf = rg && rg.ok ? rg.gastos : [];
  if (rg && !rg.ok) toast("No se pudieron cargar los gastos: la ganancia neta va a quedar incompleta");

  // cobros de cuenta corriente y señas: son plata que entró, pero no son
  // "ventas de prenda", así que se muestran aparte y no ensucian el margen.
  _cobrosInf = [];
  if (rc && rc.ok && rc.pagos) rc.pagos.forEach((p) => _cobrosInf.push({ fecha: p.fecha, monto: p.monto || 0, tipo: "Cta cte" }));
  if (rs && rs.ok && rs.pagos) rs.pagos.forEach((p) => _cobrosInf.push({ fecha: p.fecha, monto: p.monto || 0, tipo: "Seña" }));
  if (rvo && rvo.ok && rvo.vouchers) rvo.vouchers.filter((v) => v.comprado && (v.pagado || 0) > 0).forEach((v) => _cobrosInf.push({ fecha: v.fecha, monto: v.pagado || 0, tipo: "Voucher" }));

  // armar el selector de meses disponibles
  const meses = [...new Set(_ventasInf.map((v) => mesLocalDe(v.fechaHora || "")))].filter(Boolean).sort().reverse();
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

// costoDeVenta() y esVentaDePrenda() viven en js/api.js: los comparten esta vista
// y resumenEconomico(), que es la cuenta que usan Informes y Gastos por igual.

function pintarInformes() {
  const body = document.getElementById("infBody");
  // filtrar por mes si corresponde
  let ventas = _ventasInf.slice();
  if (_mesInf) ventas = ventas.filter((v) => mesLocalDe(v.fechaHora || "") === _mesInf);

  if (!ventas.length) {
    body.innerHTML = `<div class="soon"><i class="ti ti-chart-bar-off"></i><p>No hay ventas en el período seleccionado.</p></div>`;
    return;
  }

  body.innerHTML =
    bloqueResumen(ventas) +
    bloqueValorStock() +
    bloqueMensual() +
    bloquePrendasMensual() +
    bloqueTopPrendas(ventas) +
    bloqueTopTalles(ventas) +
    bloqueRecomendaciones(ventas) +
    bloqueMejoresMeses() +
    `<p class="inf-nota"><i class="ti ti-info-circle"></i> La ganancia neta usa el costo guardado en cada venta. Ventas anteriores a esta mejora usan el costo actual del stock, así que son una estimación.</p>`;
}

// Caja del período: la otra mitad de la foto. Acá la compra de mercadería SÍ
// resta, porque es plata que salió del local aunque haya quedado como stock.
function bloqueCaja(r) {
  const signo = r.caja >= 0 ? "" : "neg";
  return `
    <div class="inf-caja">
      <div class="inf-caja-head">
        <span><i class="ti ti-wallet"></i> Caja del período</span>
        <strong class="${signo}">${formatPrecio(r.caja)}</strong>
      </div>
      <p class="inf-caja-detalle">
        ${formatPrecio(r.ingresos)} que entraron − ${formatPrecio(r.gastosTotales)} de gastos
        ${r.gastosMercaderia > 0 ? `(incluye ${formatPrecio(r.gastosMercaderia)} de compra de mercadería)` : ""}
      </p>
      <p class="inf-caja-nota">
        <i class="ti ti-info-circle"></i>
        La <strong>rentabilidad</strong> mide cuánto ganaste con lo que vendiste; la <strong>caja</strong>, cuánta plata quedó.
        ${r.gastosMercaderia > 0
          ? `La diferencia de ${formatPrecio(Math.abs(r.rentabilidad - r.caja))} es, sobre todo, mercadería que compraste y todavía no vendiste: no es pérdida, es stock en el local.`
          : `Este período no tuvo compras de mercadería.`}
      </p>
    </div>`;
}

// aviso para los meses con ventas anteriores a la columna precio_costo
function avisoVentasSinCosto(r) {
  if (!r.ventasSinCosto) return "";
  const pct = r.ventasDePrenda ? Math.round((r.ventasSinCosto / r.ventasDePrenda) * 100) : 0;
  return `
    <p class="inf-aviso-costo">
      <i class="ti ti-alert-triangle"></i>
      <span><strong>${r.ventasSinCosto} de ${r.ventasDePrenda} ventas (${pct}%)</strong> no tienen el costo guardado: son anteriores a que se registrara.
      Para esas se usa el costo actual del stock y, si la prenda ya no está, se asume cero.
      La rentabilidad y el margen de este período están <strong>sobreestimados</strong>.</span>
    </p>`;
}

// gastos y cobros del período mostrado (o de todo el tiempo si no hay mes elegido).
// OJO: gastos.fecha es una fecha SIN hora (ya local), así que se corta el string;
// pasarla por mesLocalDe() la correría un día.
function gastosDelPeriodo() {
  return _mesInf ? _gastosInf.filter((g) => (g.fecha || "").slice(0, 7) === _mesInf) : _gastosInf.slice();
}
function cobrosDelPeriodo() {
  return _mesInf ? _cobrosInf.filter((c) => mesLocalDe(c.fecha || "") === _mesInf) : _cobrosInf.slice();
}

/* ---------- Bloque 1: resumen (ingresos, ganancias) ---------- */
function bloqueResumen(ventas) {
  const r = resumenEconomico(ventas, cobrosDelPeriodo(), gastosDelPeriodo());
  const unidades = ventas.reduce((a, v) => a + (esVentaDePrenda(v) ? v.cantidad : 0), 0);

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-cash"></i> Resumen ${_mesInf ? "de " + nombreMes(_mesInf) : "de todo el tiempo"}</h3>
      <div class="inf-cards">
        <div class="inf-card"><span class="inf-card-label">Ingresos totales</span><span class="inf-card-val">${formatPrecio(r.ingresos)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Costo de lo vendido</span><span class="inf-card-val neg">${formatPrecio(r.costoVendido)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Gastos operativos</span><span class="inf-card-val neg">${formatPrecio(r.gastosOperativos)}</span></div>
        <div class="inf-card inf-card-destacada"><span class="inf-card-label">Rentabilidad</span><span class="inf-card-val" style="color:var(--gold-bright)">${formatPrecio(r.rentabilidad)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Margen</span><span class="inf-card-val">${r.margen}%</span></div>
      </div>
      ${bloqueCaja(r)}
      <div class="inf-cards" style="margin-top:12px">
        <div class="inf-card"><span class="inf-card-label">Prendas vendidas</span><span class="inf-card-val">${unidades}</span></div>
        ${r.ingresosCobros > 0 ? `<div class="inf-card"><span class="inf-card-label">De cta cte / señas</span><span class="inf-card-val" style="color:var(--teal-bright)">${formatPrecio(r.ingresosCobros)}</span></div>` : ""}
      </div>
      ${avisoVentasSinCosto(r)}
    </div>`;
}

/* ---------- Bloque: valor del stock actual ---------- */
function bloqueValorStock() {
  const filas = State.stock.filter((s) => (s.cantidad || 0) > 0);
  if (!filas.length) return "";

  const unidades = filas.reduce((a, s) => a + s.cantidad, 0);
  const valorCosto = filas.reduce((a, s) => a + s.costo * s.cantidad, 0);
  const valorVenta = filas.reduce((a, s) => a + s.precio * s.cantidad, 0);
  const ganancia = valorVenta - valorCosto;
  const margen = valorVenta > 0 ? Math.round((ganancia / valorVenta) * 100) : 0;

  // desglose por categoría (de mayor a menor valor de venta)
  const porCat = {};
  filas.forEach((s) => {
    const c = s.categoria || "—";
    if (!porCat[c]) porCat[c] = { unidades: 0, costo: 0, venta: 0 };
    porCat[c].unidades += s.cantidad;
    porCat[c].costo += s.costo * s.cantidad;
    porCat[c].venta += s.precio * s.cantidad;
  });
  const cats = Object.entries(porCat).sort((a, b) => b[1].venta - a[1].venta);
  const maxVenta = Math.max(...cats.map(([, d]) => d.venta));

  const filasCat = cats.map(([c, d]) => `
    <div class="inf-hbar-row vs-row">
      <span class="inf-hbar-name" title="${escAttr(c)}">${escAttr(c)}</span>
      <div class="inf-hbar-track"><div class="inf-hbar-fill" style="width:${maxVenta > 0 ? (d.venta / maxVenta) * 100 : 0}%"></div></div>
      <span class="vs-cifras">
        <span class="vs-venta">${formatPrecio(d.venta)}</span>
        <span class="vs-costo">costo ${formatPrecio(d.costo)} · ${d.unidades}u</span>
      </span>
    </div>`).join("");

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-building-warehouse"></i> Valor del stock actual</h3>
      <div class="inf-cards">
        <div class="inf-card"><span class="inf-card-label">Valor a costo</span><span class="inf-card-val" style="color:var(--teal-bright)">${formatPrecio(valorCosto)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Valor a venta</span><span class="inf-card-val" style="color:var(--gold-bright)">${formatPrecio(valorVenta)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Ganancia potencial</span><span class="inf-card-val">${formatPrecio(ganancia)}</span></div>
        <div class="inf-card"><span class="inf-card-label">Margen</span><span class="inf-card-val">${margen}%</span></div>
        <div class="inf-card"><span class="inf-card-label">Prendas en stock</span><span class="inf-card-val">${unidades}</span></div>
      </div>
      <p class="inf-reco-sub" style="margin-top:14px">Por categoría (barra = valor a venta):</p>
      <div class="inf-hbars">${filasCat}</div>
    </div>`;
}

/* ---------- Bloque 2: ventas y ganancias por mes ---------- */
function bloqueMensual() {
  // siempre usa todos los meses (ignora el filtro, muestra la evolución)
  // Cada mes se calcula con resumenEconomico, igual que el resumen de arriba,
  // así la barra de rentabilidad ya tiene descontados los gastos operativos.
  const meses = [...new Set(_ventasInf.map((v) => mesLocalDe(v.fechaHora || "")).filter(Boolean))].sort();
  if (meses.length < 2) return ""; // con un solo mes no tiene sentido el gráfico

  const porMes = {};
  meses.forEach((m) => {
    porMes[m] = resumenEconomico(
      _ventasInf.filter((v) => mesLocalDe(v.fechaHora || "") === m),
      _cobrosInf.filter((c) => mesLocalDe(c.fecha || "") === m),
      _gastosInf.filter((g) => (g.fecha || "").slice(0, 7) === m)
    );
  });

  // la escala se toma del ingreso más alto; la rentabilidad puede ser negativa
  // (un mes con mucha compra de mercadería), así que se dibuja desde cero.
  const maxIngreso = Math.max(...meses.map((m) => porMes[m].ingresos));
  const barras = meses.map((m) => {
    const d = porMes[m];
    const hBruto = maxIngreso > 0 ? (d.ingresos / maxIngreso) * 100 : 0;
    const hNeta = maxIngreso > 0 ? (Math.max(0, d.rentabilidad) / maxIngreso) * 100 : 0;
    return `
      <div class="inf-barmes">
        <div class="inf-barmes-bars" title="${nombreMes(m)}: ${formatPrecio(d.ingresos)} de ingresos · ${formatPrecio(d.rentabilidad)} de rentabilidad · caja ${formatPrecio(d.caja)}">
          <div class="inf-bar-bruto" style="height:${hBruto}%"></div>
          <div class="inf-bar-neta" style="height:${hNeta}%"></div>
        </div>
        <span class="inf-barmes-label">${m.substring(5)}/${m.substring(2, 4)}</span>
        <span class="inf-barmes-val">${formatPrecioCorto(d.ingresos)}</span>
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

// Prendas que entraron vs se vendieron, mes a mes (conteo de unidades, no plata)
function bloquePrendasMensual() {
  const porMes = {};
  const tocar = (ym) => { if (!porMes[ym]) porMes[ym] = { entraron: 0, vendidas: 0 }; };
  _ingresosInf.forEach((i) => {
    const ym = mesLocalDe(i.fecha || "");
    if (!ym) return;
    tocar(ym); porMes[ym].entraron += i.cantidad || 0;
  });
  _ventasInf.forEach((v) => {
    if (!esVentaDePrenda(v)) return; // no cuenta cambiadas ni ventas de seña
    const ym = mesLocalDe(v.fechaHora || "");
    if (!ym) return;
    tocar(ym); porMes[ym].vendidas += v.cantidad || 0;
  });
  const meses = Object.keys(porMes).sort();
  if (!meses.length) return "";

  const maxVal = Math.max(1, ...meses.map((m) => Math.max(porMes[m].entraron, porMes[m].vendidas)));
  const barras = meses.map((m) => {
    const d = porMes[m];
    const hEnt = (d.entraron / maxVal) * 100;
    const hVen = (d.vendidas / maxVal) * 100;
    return `
      <div class="inf-barmes">
        <div class="inf-barmes-bars" title="${nombreMes(m)}: entraron ${d.entraron}, vendidas ${d.vendidas}">
          <div class="inf-bar-entraron" style="height:${hEnt}%"></div>
          <div class="inf-bar-vendidas" style="height:${hVen}%"></div>
        </div>
        <span class="inf-barmes-label">${m.substring(5)}/${m.substring(2, 4)}</span>
        <span class="inf-barmes-val">${d.entraron}/${d.vendidas}</span>
      </div>`;
  }).join("");

  return `
    <div class="inf-section">
      <h3 class="inf-h3"><i class="ti ti-hanger"></i> Prendas por mes</h3>
      <div class="inf-legend">
        <span><i class="inf-dot dot-entraron"></i> Entraron</span>
        <span><i class="inf-dot dot-vendidas"></i> Vendidas</span>
      </div>
      <div class="inf-barmes-grid">${barras}</div>
    </div>`;
}

/* ---------- Bloque 3: prendas más vendidas ---------- */
function bloqueTopPrendas(ventas) {
  const porCod = {};
  ventas.forEach((v) => {
    if (!esVentaDePrenda(v)) return; // las cambiadas no cuentan como prenda vendida
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
  ventas.forEach((v) => { if (!esVentaDePrenda(v)) return; porTalle[v.talle] = (porTalle[v.talle] || 0) + v.cantidad; });
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
    if (!esVentaDePrenda(v)) return;
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
    const ym = mesLocalDe(v.fechaHora || "");
    if (!ym) return;
    // deducir categoría del stock actual, o del número del código
    const s = State.stock.find((x) => x.codigo === v.codigo);
    if (!esVentaDePrenda(v)) return;
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
