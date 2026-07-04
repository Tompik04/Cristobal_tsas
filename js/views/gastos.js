/* ============================================================
   VISTA GASTOS — gastos del local + resumen mensual
   ============================================================ */

let _gastos = [];
let _ventasParaResumen = [];
let _mesGastos = null; // "yyyy-mm" del mes mostrado en el resumen

function renderGastos(root) {
  root.innerHTML = `
    <p class="view-title">GASTOS</p>
    <div id="gastosResumen"></div>
    <div class="gastos-top">
      <button class="btn-primary v-new-btn" id="gNewBtn"><i class="ti ti-plus"></i> Nuevo gasto</button>
    </div>
    <div id="gFiltros"></div>
    <div class="cambios-list" id="gastosList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>`;
  document.getElementById("gNewBtn").onclick = abrirNuevoGasto;
  cargarGastos();
}

async function cargarGastos() {
  const [rg, rv] = await Promise.all([API.getGastos(), API.getVentas()]);
  if (!rg.ok) {
    document.getElementById("gastosList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar los gastos.</p></div>`;
    return;
  }
  _gastos = rg.gastos;
  _ventasParaResumen = rv.ok ? rv.ventas : [];

  // mes actual por defecto
  if (!_mesGastos) _mesGastos = mesActualISO();
  // en modo normal, siempre forzar el mes actual (no permitir quedar en meses viejos)
  if (!modoPrivadoActivo()) _mesGastos = mesActualISO();

  // filtros
  const fcont = document.getElementById("gFiltros");
  fcont.innerHTML = "";
  const barra = crearBarraFiltros({
    placeholder: "Buscar por concepto...",
    campos: [
      { id: "categoria", label: "Categoría", tipo: "select", opciones: CATEGORIAS_GASTO },
    ],
    onChange: (f) => pintarGastos(f),
  });
  fcont.appendChild(barra);

  pintarResumen();
  pintarGastos({});
}

function mesActualISO() {
  const d = new Date();
  return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);
}
function mesLegible(iso) {
  const [a, m] = iso.split("-");
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return meses[Number(m) - 1] + " " + a;
}
// suma 'delta' meses a un "yyyy-mm"
function correrMes(iso, delta) {
  let [a, m] = iso.split("-").map(Number);
  m += delta;
  while (m > 12) { m -= 12; a++; }
  while (m < 1) { m += 12; a--; }
  return a + "-" + String(m).padStart(2, "0");
}

function pintarResumen() {
  const cont = document.getElementById("gastosResumen");
  const mes = _mesGastos;

  // ventas del mes (no restauradas), por precio base (lo que se embolsa)
  const ventasMes = _ventasParaResumen.filter((v) => !v.restaurada && (v.fechaHora || "").slice(0, 7) === mes);
  const totalVentas = ventasMes.reduce((a, v) => a + (v.precioBase || 0), 0);

  // gastos del mes
  const gastosDelMes = _gastos.filter((g) => (g.fecha || "").slice(0, 7) === mes);
  const totalGastos = gastosDelMes.reduce((a, g) => a + g.monto, 0);

  const neta = totalVentas - totalGastos;
  const signo = neta >= 0 ? "pos" : "neg";

  const privado = modoPrivadoActivo();
  // en modo normal: solo mes actual (sin flechas) y solo la tarjeta de Gastos
  const navMeses = privado
    ? `<button class="mes-nav" id="mesPrev"><i class="ti ti-chevron-left"></i></button>
       <span class="mes-label">${mesLegible(mes)}</span>
       <button class="mes-nav" id="mesNext"><i class="ti ti-chevron-right"></i></button>`
    : `<span class="mes-label">${mesLegible(mes)}</span>`;

  let cardsHTML;
  if (privado) {
    cardsHTML = `
      <div class="rcard"><span class="rc-label">Ventas</span><span class="rc-val pos">${formatPrecio(totalVentas)}</span></div>
      <div class="rcard"><span class="rc-label">Gastos</span><span class="rc-val neg">${formatPrecio(totalGastos)}</span></div>
      <div class="rcard rc-net"><span class="rc-label">Ganancia neta</span><span class="rc-val ${signo}">${formatPrecio(neta)}</span></div>`;
  } else {
    cardsHTML = `<div class="rcard"><span class="rc-label">Gastos del mes</span><span class="rc-val neg">${formatPrecio(totalGastos)}</span></div>`;
  }

  cont.innerHTML = `
    <div class="resumen-mes">${navMeses}</div>
    <div class="resumen-cards ${privado ? "" : "resumen-1"}">
      ${cardsHTML}
    </div>
    <div id="checklistGastos"></div>`;

  if (privado) {
    document.getElementById("mesPrev").onclick = () => { _mesGastos = correrMes(mes, -1); pintarResumen(); pintarGastos(filtrosGasto()); };
    document.getElementById("mesNext").onclick = () => { _mesGastos = correrMes(mes, 1); pintarResumen(); pintarGastos(filtrosGasto()); };
  }

  pintarChecklist(gastosDelMes);
}

// checklist de control: qué gastos típicos ya se cargaron este mes
function pintarChecklist(gastosDelMes) {
  const cont = document.getElementById("checklistGastos");
  const categoriasCargadas = new Set(gastosDelMes.map((g) => g.categoria));

  const item = (cat) => {
    const ok = categoriasCargadas.has(cat);
    return `<div class="chk-item chk-click ${ok ? "chk-ok" : "chk-pend"}" data-cat="${cat}" title="Agregar gasto de ${cat}">
      <i class="ti ${ok ? "ti-circle-check-filled" : "ti-circle-dashed"}"></i>
      <span>${cat}</span>
    </div>`;
  };

  cont.innerHTML = `
    <div class="chk-block">
      <p class="chk-title">Obligatorios del mes</p>
      <div class="chk-grid">${GASTOS_OBLIGATORIOS.map(item).join("")}</div>
    </div>
    <div class="chk-block">
      <p class="chk-title">Opcionales</p>
      <div class="chk-grid">${GASTOS_OPCIONALES.map(item).join("")}</div>
    </div>`;

  // click en cada categoría abre el popup de nuevo gasto con concepto y categoría precargados
  cont.querySelectorAll(".chk-click").forEach((el) => {
    el.onclick = () => {
      const cat = el.dataset.cat;
      abrirNuevoGasto({ concepto: cat, categoria: cat });
    };
  });
}

function filtrosGasto() {
  const f = {};
  document.querySelectorAll("#gFiltros [data-filter]").forEach((el) => { f[el.dataset.filter] = el.value.trim(); });
  return f;
}

function pintarGastos(f) {
  const list = document.getElementById("gastosList");
  const mes = _mesGastos;

  // solo gastos del mes seleccionado
  let lista = _gastos.filter((g) => (g.fecha || "").slice(0, 7) === mes);

  if (f.q) lista = lista.filter((g) => coincideTexto(g, f.q, ["concepto"]));
  if (f.categoria) lista = lista.filter((g) => g.categoria === f.categoria);

  lista.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-receipt-off"></i><p>Sin gastos en ${mesLegible(mes)}.</p></div>`;
    return;
  }
  list.innerHTML = lista.map(gastoHTML).join("");
  lista.forEach((g) => bindGasto(list, g));
}

function gastoHTML(g) {
  return `
    <div class="crow gasto-row" data-id="${g.id}">
      <div class="c-meta">
        <span class="c-vars"><strong>${g.concepto}</strong></span>
        <span class="c-fecha">${g.categoria || "—"} · ${fmtFecha(g.fecha)}</span>
      </div>
      <div class="v-value neg">${formatPrecio(g.monto)}</div>
      <div class="v-actions">
        <button class="v-icon" data-act="edit" title="Editar"><i class="ti ti-pencil"></i></button>
        <button class="v-icon danger" data-act="del" title="Eliminar"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function bindGasto(list, g) {
  const row = list.querySelector(`.gasto-row[data-id="${g.id}"]`);
  row.querySelector('[data-act="edit"]').onclick = () => abrirNuevoGasto(g);
  row.querySelector('[data-act="del"]').onclick = () => {
    dobleConfirmacion({
      titulo: "Eliminar gasto",
      mensaje1: `Vas a eliminar "${g.concepto}" por ${formatPrecio(g.monto)}.`,
      mensaje2: "El gasto se borra del registro. ¿Confirmás?",
      textoBoton: "Eliminar",
      onOk: async () => {
        await API.eliminarGasto(g.id);
        toast("Gasto eliminado");
        cargarGastos();
      },
    });
  };
}

// ---- Alta / edición de gasto ----
function abrirNuevoGasto(gasto) {
  const esEdicion = gasto && gasto.id;
  const preCat = gasto && gasto.categoria ? gasto.categoria : "";
  const preConcepto = gasto && gasto.concepto ? gasto.concepto : "";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const cats = CATEGORIAS_GASTO.map((c) => `<option value="${c}"${preCat === c ? " selected" : ""}>${c}</option>`).join("");

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>${esEdicion ? "Editar gasto" : "Nuevo gasto"}</h2>
      <div class="field"><label>Concepto</label><input class="sinput" id="gConcepto" placeholder="Ej. Alquiler local" value="${preConcepto}"></div>
      <div class="field"><label>Monto ($)</label><input class="sinput" type="number" min="0" id="gMonto" placeholder="$" value="${esEdicion ? gasto.monto : ""}"></div>
      <div class="field"><label>Categoría</label><select class="sinput" id="gCat">${cats}</select></div>
      <div class="field"><label>Fecha</label><input class="sinput" type="date" id="gFecha" value="${esEdicion ? gasto.fecha : hoy}"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="gCancel">Cancelar</button>
        <button class="btn-primary" id="gSave">${esEdicion ? "Guardar" : "Crear gasto"}</button>
      </div>
    </div>`;

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("gCancel").onclick = cerrarModal;
  // si vino con concepto precargado, enfocar el monto directamente
  if (!esEdicion && preConcepto) {
    const m = document.getElementById("gMonto");
    if (m) m.focus();
  }
  document.getElementById("gSave").onclick = async () => {
    const concepto = document.getElementById("gConcepto").value.trim();
    const monto = Number(document.getElementById("gMonto").value) || 0;
    const categoria = document.getElementById("gCat").value;
    const fecha = document.getElementById("gFecha").value;
    if (!concepto) return toast("Falta el concepto");
    if (monto <= 0) return toast("Monto inválido");
    if (!fecha) return toast("Falta la fecha");

    if (esEdicion) {
      await API.actualizarGasto(gasto.id, { concepto, monto, categoria, fecha });
      toast("Gasto actualizado");
    } else {
      await API.crearGasto({ id: "G-" + Date.now(), concepto, monto, categoria, fecha });
      toast("Gasto registrado");
    }
    cerrarModal();
    cargarGastos();
  };
}
