/* ============================================================
   VISTA CUENTA CORRIENTE — cuentas de clientes con deuda
   ============================================================ */

let _cuentas = [];
let _ccItems = [];
let _ccPagos = [];
let _cuentaAbierta = null; // id de la cuenta cuyo detalle se ve

function renderCuentas(root) {
  root.innerHTML = `
    <p class="view-title">CUENTA CORRIENTE / SEÑAS</p>
    <div class="cc-tabs">
      <button class="cc-tab selected" id="tabCuentas"><i class="ti ti-users"></i> Cuenta corriente</button>
      <button class="cc-tab" id="tabSenas"><i class="ti ti-bookmark"></i> Señas</button>
    </div>
    <div id="paneCuentas">
      <div class="vouchers-top">
        <button class="btn-primary v-new-btn" id="ccNewBtn"><i class="ti ti-user-plus"></i> Nueva cuenta</button>
      </div>
      <div id="ccFiltros"></div>
      <div class="cambios-list" id="ccList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>
    </div>
    <div id="paneSenas" style="display:none">
      <div id="senaFiltros"></div>
      <div class="cambios-list" id="senaList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>
    </div>`;
  document.getElementById("ccNewBtn").onclick = abrirNuevaCuenta;

  const tabC = document.getElementById("tabCuentas");
  const tabS = document.getElementById("tabSenas");
  const paneC = document.getElementById("paneCuentas");
  const paneS = document.getElementById("paneSenas");
  tabC.onclick = () => {
    tabC.classList.add("selected"); tabS.classList.remove("selected");
    paneC.style.display = ""; paneS.style.display = "none";
  };
  tabS.onclick = () => {
    tabS.classList.add("selected"); tabC.classList.remove("selected");
    paneS.style.display = ""; paneC.style.display = "none";
    cargarSenas();
  };

  cargarCuentas();
}

async function cargarCuentas() {
  const res = await API.getCuentas();
  if (!res.ok) {
    document.getElementById("ccList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las cuentas.</p></div>`;
    return;
  }
  _cuentas = res.cuentas;
  _ccItems = res.items;
  _ccPagos = res.pagos;

  // barra de búsqueda
  const fcont = document.getElementById("ccFiltros");
  fcont.innerHTML = "";
  const barra = crearBarraFiltros({
    placeholder: "Buscar por nombre, apellido o teléfono...",
    campos: [{ id: "estado", label: "Estado", tipo: "select", opciones: ["Con deuda", "Saldadas"] }],
    onChange: (f) => pintarCuentas(f),
  });
  fcont.appendChild(barra);

  pintarCuentas({});
}

// ¿una prenda de cuenta corriente está vencida? (35 días desde que se agregó)
function itemVencido(item) {
  if (!item.fecha) return false;
  const limite = new Date(item.fecha);
  limite.setDate(limite.getDate() + CONFIG.DIAS_VENCIMIENTO_VOUCHER);
  return new Date() > limite;
}
// precio efectivo de una prenda: si venció, sube +20% (precio de lista)
function precioItemEfectivo(item) {
  const base = item.precio * item.cantidad;
  return itemVencido(item) ? base * (1 + CONFIG.RECARGO_TARJETA) : base;
}
// fecha de vencimiento de una prenda
function vencimientoItem(item) {
  if (!item.fecha) return null;
  const limite = new Date(item.fecha);
  limite.setDate(limite.getDate() + CONFIG.DIAS_VENCIMIENTO_VOUCHER);
  return limite;
}

// deuda total de una cuenta: suma de prendas (vencidas +20%) − suma saldada por pagos
function deudaCuenta(cuentaId) {
  const items = _ccItems.filter((i) => i.cuentaId === cuentaId);
  const pagos = _ccPagos.filter((p) => p.cuentaId === cuentaId);
  const totalItems = items.reduce((a, i) => a + precioItemEfectivo(i), 0);
  const totalSaldado = pagos.reduce((a, p) => a + (p.salda != null ? p.salda : p.monto), 0);
  return totalItems - totalSaldado;
}

// total saldado (suma de lo que bajó la deuda con todos los pagos)
function totalSaldado(cuentaId) {
  return _ccPagos.filter((p) => p.cuentaId === cuentaId)
    .reduce((a, p) => a + (p.salda != null ? p.salda : p.monto), 0);
}

// reparte el total saldado sobre las prendas ordenadas de más vieja a más nueva.
// devuelve cada prenda con: pagada (bool), abonado (cuánto se le aplicó), falta (cuánto resta)
function itemsConEstadoPago(cuentaId) {
  const items = _ccItems.filter((i) => i.cuentaId === cuentaId)
    .slice()
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)); // más vieja primero
  let restante = totalSaldado(cuentaId);
  return items.map((i) => {
    const precio = precioItemEfectivo(i);
    let abonado = 0;
    if (restante >= precio) { abonado = precio; restante -= precio; }
    else { abonado = restante; restante = 0; }
    const pagada = abonado >= precio - 0.5;
    return Object.assign({}, i, { precioActual: precio, abonado, falta: precio - abonado, pagada });
  });
}

function pintarCuentas(f) {
  const list = document.getElementById("ccList");
  let lista = _cuentas.slice();
  if (f.q) lista = lista.filter((c) => coincideTexto(c, f.q, ["nombre", "apellido", "telefono"]));
  if (f.estado === "Con deuda") lista = lista.filter((c) => deudaCuenta(c.id) > 0.5);
  if (f.estado === "Saldadas") lista = lista.filter((c) => deudaCuenta(c.id) <= 0.5);

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-user-off"></i><p>Sin cuentas que coincidan.</p></div>`;
    return;
  }
  list.innerHTML = lista.map(cuentaHTML).join("");
  lista.forEach((c) => bindCuenta(list, c));
}

function cuentaHTML(c) {
  const deuda = deudaCuenta(c.id);
  const saldada = deuda <= 0.5;
  return `
    <div class="crow cuenta-row" data-id="${c.id}">
      <div class="c-meta">
        <span class="c-vars"><strong>${c.nombre} ${c.apellido || ""}</strong></span>
        <span class="c-fecha">${c.telefono || "—"}</span>
      </div>
      <div class="v-value ${saldada ? "" : "neg"}">${saldada ? "Saldada" : "Debe " + formatPrecio(deuda)}</div>
      <button class="c-swap" data-act="ver" title="Ver detalle"><i class="ti ti-chevron-right"></i></button>
    </div>`;
}

function bindCuenta(list, c) {
  const row = list.querySelector(`.cuenta-row[data-id="${c.id}"]`);
  row.querySelector('[data-act="ver"]').onclick = () => abrirDetalleCuenta(c.id);
  row.onclick = (e) => { if (!e.target.closest("button")) abrirDetalleCuenta(c.id); };
}

// ---- Nueva cuenta ----
function abrirNuevaCuenta() {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Nueva cuenta corriente</h2>
      <div class="field"><label>Nombre</label><input class="sinput" id="ccNom" placeholder="Nombre"></div>
      <div class="field"><label>Apellido</label><input class="sinput" id="ccApe" placeholder="Apellido"></div>
      <div class="field"><label>Teléfono</label><input class="sinput" id="ccTel" placeholder="Teléfono"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="ccCancel">Cancelar</button>
        <button class="btn-primary" id="ccSave">Crear cuenta</button>
      </div>
    </div>`;
  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("ccCancel").onclick = cerrarModal;
  document.getElementById("ccSave").onclick = async () => {
    const nombre = document.getElementById("ccNom").value.trim();
    const apellido = document.getElementById("ccApe").value.trim();
    const telefono = document.getElementById("ccTel").value.trim();
    if (!nombre) return toast("Falta el nombre");
    await API.crearCuenta({ id: "CC-" + Date.now(), nombre, apellido, telefono });
    toast("Cuenta creada");
    cerrarModal();
    cargarCuentas();
  };
}

// ---- Detalle de cuenta ----
function abrirDetalleCuenta(cuentaId) {
  _cuentaAbierta = cuentaId;
  const c = _cuentas.find((x) => x.id === cuentaId);
  if (!c) return;
  const items = _ccItems.filter((i) => i.cuentaId === cuentaId);
  const pagos = _ccPagos.filter((p) => p.cuentaId === cuentaId);
  const deuda = deudaCuenta(cuentaId);
  const deudaCredito = deuda * (1 + CONFIG.RECARGO_TARJETA); // referencia con recargo

  // prendas con su estado de pago (FIFO): las pagadas no se muestran
  const itemsEstado = itemsConEstadoPago(cuentaId);
  const itemsPendientes = itemsEstado.filter((i) => !i.pagada);
  const cantPagadas = itemsEstado.length - itemsPendientes.length;

  const itemsHTML = itemsPendientes.length
    ? itemsPendientes.map((i) => {
        const vencido = itemVencido(i);
        const venc = vencimientoItem(i);
        const dias = venc ? Math.ceil((venc - new Date()) / 86400000) : null;
        const parcial = i.abonado > 0.5;
        return `
        <div class="cc-item ${vencido ? "cc-item-vencido" : ""}">
          <img class="cc-item-img" src="${imgPrenda(i.codigo, categoriaDeStock(i.codigo))}" onerror="this.style.opacity=0.3">
          <div class="cc-item-info">
            <span>${i.marca} · ${i.codigo}</span>
            <span class="cc-item-var">Talle ${i.talle} · ${i.color} · x${i.cantidad}</span>
            ${vencido
              ? `<span class="cc-item-venc vencido">Vencida · precio de lista (+20%)</span>`
              : `<span class="cc-item-venc">Vence en ${dias}d · ${fmtFecha(venc.toISOString())}</span>`}
            ${parcial ? `<span class="cc-item-parcial">Abonado ${formatPrecio(i.abonado)} · falta ${formatPrecio(i.falta)}</span>` : ""}
          </div>
          <div class="cc-item-precios">
            ${vencido ? `<span class="cc-item-precio-old">${formatPrecio(i.precio * i.cantidad)}</span>` : ""}
            <span class="cc-item-precio">${formatPrecio(i.precioActual)}</span>
          </div>
          <button class="v-icon danger" data-quitar="${i.id}" title="Quitar (repone stock)"><i class="ti ti-x"></i></button>
        </div>`;
      }).join("")
    : `<p class="cc-vacio">${cantPagadas > 0 ? "Todas las prendas están saldadas." : "Sin prendas cargadas."}</p>`;

  const pagosHTML = pagos.length
    ? pagos.map((p) => {
        const salda = p.salda != null ? p.salda : p.monto;
        const conRecargo = p.monto > salda + 0.5; // pagó con recargo (crédito)
        return `
        <div class="cc-pago">
          <span>${fmtFecha(p.fecha)} · ${metodoColoreado(p.metodoPago)}</span>
          <div class="cc-pago-der">
            <span class="cc-pago-monto">− ${formatPrecio(salda)}${conRecargo ? ` <span class="cc-pago-cobrado">(cobró ${formatPrecio(p.monto)})</span>` : ""}</span>
            <button class="v-icon danger" data-quitarpago="${p.id}" title="Eliminar pago"><i class="ti ti-x"></i></button>
          </div>
        </div>`;
      }).join("")
    : `<p class="cc-vacio">Sin pagos registrados.</p>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal modal-wide">
      <div class="cc-head">
        <h2>${c.nombre} ${c.apellido || ""}</h2>
        <span class="cc-tel">${c.telefono || "—"}</span>
      </div>
      <div class="cc-saldo ${deuda <= 0.5 ? "saldada" : ""}">
        <span>${deuda <= 0.5 ? "Cuenta saldada" : "Saldo adeudado"}</span>
        <strong>${formatPrecio(Math.max(0, deuda))}</strong>
        ${deuda > 0.5 ? `<span class="cc-saldo-credito">Con recargo crédito: <strong>${formatPrecio(deudaCredito)}</strong></span>` : ""}
      </div>

      <div class="cc-section">
        <div class="cc-section-head">
          <p class="chk-title">Prendas${cantPagadas > 0 ? ` <span class="cc-pagadas-tag">${cantPagadas} saldada${cantPagadas > 1 ? "s" : ""}</span>` : ""}</p>
          <button class="btn-mini" id="ccAddItem"><i class="ti ti-plus"></i> Agregar del stock</button>
        </div>
        <div class="cc-items">${itemsHTML}</div>
      </div>

      <div class="cc-section">
        <div class="cc-section-head">
          <p class="chk-title">Pagos</p>
          <button class="btn-mini" id="ccAddPago" ${deuda <= 0.5 ? "disabled" : ""}><i class="ti ti-cash"></i> Registrar pago</button>
        </div>
        <div class="cc-pagos">${pagosHTML}</div>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" id="ccEliminar">Eliminar cuenta</button>
        <button class="btn-primary" id="ccCerrar">Cerrar</button>
      </div>
    </div>`;

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("ccCerrar").onclick = cerrarModal;
  document.getElementById("ccAddItem").onclick = () => agregarPrendasACuenta(cuentaId);
  const btnPago = document.getElementById("ccAddPago");
  if (btnPago) btnPago.onclick = () => abrirPagoCuenta(cuentaId, deuda);

  items.forEach((i) => {
    const b = document.querySelector(`[data-quitar="${i.id}"]`);
    if (b) b.onclick = () => {
      dobleConfirmacion({
        titulo: "Quitar prenda",
        mensaje1: `Vas a quitar ${i.marca} ${i.codigo} de la cuenta.`,
        mensaje2: "Se repone al stock y baja la deuda. ¿Confirmás?",
        textoBoton: "Quitar",
        onOk: async () => {
          await API.quitarItemCuenta(i.id, i);
          toast("Prenda quitada");
          await recargarYReabrir(cuentaId);
        },
      });
    };
  });

  pagos.forEach((p) => {
    const b = document.querySelector(`[data-quitarpago="${p.id}"]`);
    if (b) b.onclick = () => {
      dobleConfirmacion({
        titulo: "Eliminar pago",
        mensaje1: `Vas a eliminar el pago de ${formatPrecio(p.monto)} (${p.metodoPago || "—"}).`,
        mensaje2: "La deuda vuelve a subir por ese monto. ¿Confirmás?",
        textoBoton: "Eliminar",
        onOk: async () => {
          await API.eliminarPagoCuenta(p.id);
          toast("Pago eliminado");
          await recargarYReabrir(cuentaId);
        },
      });
    };
  });

  document.getElementById("ccEliminar").onclick = () => {
    dobleConfirmacion({
      titulo: "Eliminar cuenta",
      mensaje1: `Vas a eliminar la cuenta de ${c.nombre} ${c.apellido || ""}.`,
      mensaje2: "Se borran sus prendas y pagos. El stock de las prendas pendientes se repone. ¿Confirmás?",
      textoBoton: "Eliminar",
      onOk: async () => {
        // reponer stock de las prendas pendientes antes de borrar
        for (const i of items) {
          const fila = State.stock.find((s) => s.codigo === i.codigo && s.talle === i.talle && s.color === i.color);
          if (fila) { fila.cantidad += i.cantidad; await API.ajustarStock(fila.id, i.cantidad); }
        }
        await API.eliminarCuenta(cuentaId);
        toast("Cuenta eliminada");
        cerrarModal();
        cargarCuentas();
      },
    });
  };
}

async function recargarYReabrir(cuentaId) {
  const res = await API.getCuentas();
  if (res.ok) { _cuentas = res.cuentas; _ccItems = res.items; _ccPagos = res.pagos; }
  // re-pintar la lista de fondo para que muestre el saldo actualizado al cerrar el detalle
  const listEl = document.getElementById("ccList");
  if (listEl) pintarCuentas(filtrosCuenta());
  abrirDetalleCuenta(cuentaId);
}

// lee los filtros actuales de la barra (para re-pintar sin perderlos)
function filtrosCuenta() {
  const f = {};
  document.querySelectorAll("#ccFiltros [data-filter]").forEach((el) => { f[el.dataset.filter] = el.value.trim(); });
  return f;
}

// ---- Agregar prendas del stock a la cuenta (usa el carrito) ----
function agregarPrendasACuenta(cuentaId) {
  // reutiliza el flujo de stock: abrimos la vista de stock en modo "a cuenta"
  State.cuentaDestino = cuentaId;
  cerrarModal();
  toast("Elegí prendas y tocá 'Agregar a cuenta' en el carrito");
  Router.ir("ventas");
  renderCartFab();
}

// ---- Registrar pago ----
function abrirPagoCuenta(cuentaId, deuda) {
  const pagos1 = MEDIOS_PAGO.map((m) => `<button class="pay-opt" data-m="${m}">${m}</button>`).join("");
  let metodo = null;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Registrar pago</h2>
      <div class="modal-line"><span>Saldo adeudado</span><strong>${formatPrecio(deuda)}</strong></div>
      <div class="field">
        <label>Cuánto de la deuda salda</label>
        <input class="sinput" type="number" id="ccSalda" min="0" max="${Math.ceil(deuda)}" placeholder="$">
      </div>
      <div class="field" id="ccPagaWrap" style="display:none">
        <label>O cuánto paga con recargo</label>
        <input class="sinput" type="number" id="ccPaga" min="0" placeholder="$ con recargo incluido">
      </div>
      <p class="login-sub" style="text-align:center">Método de pago</p>
      <div class="pay-grid">${pagos1}</div>
      <div class="field">
        <label>Fecha del pago</label>
        <input class="sinput" type="datetime-local" id="ccFecha" value="${ahoraLocalInput()}">
      </div>
      <div class="modal-line" id="ccRecargoLine" style="display:none"><span>Recargo tarjeta (${Math.round(CONFIG.RECARGO_TARJETA * 100)}%)</span><strong id="ccRecargoVal">$0</strong></div>
      <div class="modal-line"><span>Salda de deuda</span><strong id="ccSaldaVal">$0</strong></div>
      <div class="modal-total"><span>Se cobra al cliente</span><span id="ccCobra">$0</span></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="ccPagoCancel">Volver</button>
        <button class="btn-primary" id="ccPagoConfirm" disabled>Confirmar pago</button>
      </div>
    </div>`;
  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("ccPagoCancel").onclick = () => abrirDetalleCuenta(cuentaId);
  const btn = document.getElementById("ccPagoConfirm");
  const inSalda = document.getElementById("ccSalda");
  const inPaga = document.getElementById("ccPaga");
  const pagaWrap = document.getElementById("ccPagaWrap");
  const recargoLine = document.getElementById("ccRecargoLine");
  const recargoVal = document.getElementById("ccRecargoVal");
  const saldaVal = document.getElementById("ccSaldaVal");
  const cobraEl = document.getElementById("ccCobra");

  // valores finales que se confirman
  let saldaFinal = 0, cobradoFinal = 0;

  function tieneRecargo() { return metodo && MEDIOS_CON_RECARGO.includes(metodo); }

  function recalcular() {
    const f = tieneRecargo() ? (1 + CONFIG.RECARGO_TARJETA) : 1;
    // determinar qué input se está usando
    const usaPaga = tieneRecargo() && inPaga.value !== "" && Number(inPaga.value) > 0;
    if (usaPaga) {
      // ingresó el monto con recargo → calcular cuánto salda
      cobradoFinal = Number(inPaga.value) || 0;
      saldaFinal = cobradoFinal / f;
      inSalda.disabled = true;
    } else {
      // ingresó cuánto salda → calcular cuánto se cobra
      saldaFinal = Number(inSalda.value) || 0;
      cobradoFinal = saldaFinal * f;
      inPaga.disabled = inSalda.value !== "" && Number(inSalda.value) > 0;
    }
    // si ambos vacíos, rehabilitar los dos
    if ((inSalda.value === "" || Number(inSalda.value) === 0) && (inPaga.value === "" || Number(inPaga.value) === 0)) {
      inSalda.disabled = false; inPaga.disabled = false;
    }

    const recargo = cobradoFinal - saldaFinal;
    if (tieneRecargo() && recargo > 0) { recargoLine.style.display = "flex"; recargoVal.textContent = formatPrecio(recargo); }
    else recargoLine.style.display = "none";
    saldaVal.textContent = formatPrecio(saldaFinal);
    cobraEl.textContent = formatPrecio(cobradoFinal);
    btn.disabled = !(saldaFinal > 0 && metodo && saldaFinal <= deuda + 0.5);
  }

  document.querySelectorAll("[data-m]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".pay-opt").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      metodo = b.dataset.m;
      // mostrar segundo input solo si el método tiene recargo
      pagaWrap.style.display = tieneRecargo() ? "" : "none";
      if (!tieneRecargo()) { inPaga.value = ""; inPaga.disabled = false; inSalda.disabled = false; }
      recalcular();
    };
  });
  inSalda.addEventListener("input", recalcular);
  inPaga.addEventListener("input", recalcular);

  btn.onclick = async () => {
    if (saldaFinal <= 0) return toast("Ingresá cuánto salda");
    if (saldaFinal > deuda + 0.5) return toast("El monto supera la deuda");
    if (!metodo) return toast("Elegí un método de pago");
    // usar la fecha elegida (puede ser de un día anterior)
    const fVal = document.getElementById("ccFecha").value;
    const fecha = fVal ? new Date(fVal).toISOString() : new Date().toISOString();
    await API.registrarPagoCuenta(cuentaId, Math.round(cobradoFinal), metodo, Math.round(saldaFinal), fecha);
    toast(`Pago registrado · saldó ${formatPrecio(Math.round(saldaFinal))}`);
    await recargarYReabrir(cuentaId);
  };
}

/* ============================================================
   SEÑAS
   Prendas reservadas: salen del stock al señar y el cliente
   paga en cuotas hasta completar. Si no retira, se cancela y
   las prendas vuelven al stock.
   ============================================================ */

let _senas = [], _senaItems = [], _senaPagos = [];

async function cargarSenas() {
  const res = await API.getSenas();
  if (!res.ok) {
    document.getElementById("senaList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las señas.</p></div>`;
    return;
  }
  _senas = res.senas; _senaItems = res.items; _senaPagos = res.pagos;

  const fcont = document.getElementById("senaFiltros");
  fcont.innerHTML = "";
  const barra = crearBarraFiltros({
    placeholder: "Buscar por nombre o teléfono...",
    campos: [{ id: "estado", label: "Estado", tipo: "select", opciones: ["Activas", "Completadas", "Canceladas"], porDefecto: "Activas" }],
    onChange: (f) => pintarSenas(f),
  });
  fcont.appendChild(barra);

  pintarSenas({ estado: "Activas" });
}

// pagado y saldo de una seña
function pagadoSena(senaId) {
  return _senaPagos.filter((p) => p.senaId === senaId).reduce((a, p) => a + p.monto, 0);
}
function saldoSena(s) {
  return Math.max(0, s.total - pagadoSena(s.id));
}

function pintarSenas(f) {
  const list = document.getElementById("senaList");
  let lista = _senas.slice();

  if (f.q) {
    const q = f.q.toLowerCase();
    lista = lista.filter((s) => (s.nombre || "").toLowerCase().includes(q) || (s.telefono || "").includes(q));
  }
  const mapa = { Activas: "activa", Completadas: "completada", Canceladas: "cancelada" };
  const estadoBuscado = mapa[f.estado] || "activa";
  lista = lista.filter((s) => s.estado === estadoBuscado);

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-bookmark-off"></i><p>No hay señas ${(f.estado || "activas").toLowerCase()}.</p></div>`;
    return;
  }

  list.innerHTML = lista.map(senaHTML).join("");
  lista.forEach((s) => {
    const row = list.querySelector(`.sena-card[data-id="${s.id}"]`);
    if (row) row.onclick = () => abrirDetalleSena(s.id);
  });
}

function senaHTML(s) {
  const items = _senaItems.filter((i) => i.senaId === s.id);
  const pagado = pagadoSena(s.id);
  const saldo = saldoSena(s);
  const pct = s.total > 0 ? Math.min(100, Math.round((pagado / s.total) * 100)) : 0;
  const prendas = items.map((i) => `${escAttr(i.marca || i.codigo)} (${i.talle}/${i.color})`).join(", ");

  return `
    <div class="sena-card estado-${s.estado}" data-id="${s.id}">
      <div class="sena-head">
        <div>
          <span class="sena-nombre">${escAttr(s.nombre || "—")}</span>
          <span class="sena-tel">${escAttr(s.telefono || "")}</span>
        </div>
        <span class="sena-estado sena-${s.estado}">${s.estado}</span>
      </div>
      <p class="sena-prendas">${prendas || "—"}</p>
      <div class="sena-barra"><div class="sena-barra-fill" style="width:${pct}%"></div></div>
      <div class="sena-montos">
        <span>Pagó <strong>${formatPrecio(pagado)}</strong> de ${formatPrecio(s.total)}</span>
        ${s.estado === "activa" ? `<span class="sena-saldo">Debe ${formatPrecio(saldo)}</span>` : ""}
      </div>
    </div>`;
}

function abrirDetalleSena(senaId) {
  const s = _senas.find((x) => x.id === senaId);
  if (!s) return;
  const items = _senaItems.filter((i) => i.senaId === senaId);
  const pagos = _senaPagos.filter((p) => p.senaId === senaId);
  const pagado = pagadoSena(senaId);
  const saldo = saldoSena(s);

  const itemsHTML = items.map((i) => `
    <div class="sd-item">
      <span>${escAttr(i.marca || i.codigo)} · ${i.talle}/${i.color} · x${i.cantidad}</span>
      <strong>${formatPrecio(i.precio * i.cantidad * (1 - (i.oferta || 0) / 100))}</strong>
    </div>`).join("");

  const pagosHTML = pagos.length
    ? pagos.map((p) => `
      <div class="sd-pago">
        <span>${new Date(p.fecha).toLocaleDateString("es-AR")} · ${escAttr(p.metodoPago)}</span>
        <strong>${formatPrecio(p.monto)}</strong>
      </div>`).join("")
    : `<p class="sd-vacio">Sin pagos registrados.</p>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="sdOv"></div>
    <div class="modal modal-wide">
      <h2>Seña de ${escAttr(s.nombre || "—")}</h2>
      <p class="dc-msg">${escAttr(s.telefono || "")} · ${new Date(s.fecha).toLocaleDateString("es-AR")}</p>

      <p class="sd-titulo">Prendas reservadas</p>
      <div class="sd-lista">${itemsHTML}</div>

      <p class="sd-titulo">Pagos</p>
      <div class="sd-lista">${pagosHTML}</div>

      <div class="sd-resumen">
        <div><span>Total</span><strong>${formatPrecio(s.total)}</strong></div>
        <div><span>Pagado</span><strong class="sd-ok">${formatPrecio(pagado)}</strong></div>
        <div><span>Saldo</span><strong class="sd-deuda">${formatPrecio(saldo)}</strong></div>
      </div>

      <div class="modal-actions sd-acts">
        <button class="btn-ghost" id="sdCerrar">Cerrar</button>
        ${s.estado === "activa" ? `
          <button class="btn-ghost sd-cancelar" id="sdCancelar">Cancelar seña</button>
          <button class="btn-primary" id="sdPagar">Registrar pago</button>` : ""}
      </div>
    </div>`;

  document.getElementById("sdOv").onclick = cerrarModal;
  document.getElementById("sdCerrar").onclick = cerrarModal;

  if (s.estado !== "activa") return;

  // registrar un pago (si completa el total, la seña se completa y el cliente se lleva la prenda)
  document.getElementById("sdPagar").onclick = () => abrirPagoSena(s, saldo);

  // cancelar: las prendas vuelven al stock. Dos opciones con la plata cobrada.
  document.getElementById("sdCancelar").onclick = () => {
    document.getElementById("modalRoot").innerHTML = `
      <div class="modal-overlay" id="scOv"></div>
      <div class="modal">
        <h2>Cancelar seña</h2>
        <p class="dc-msg">Las ${items.length} prenda${items.length === 1 ? "" : "s"} vuelven al stock.</p>
        <p class="sd-titulo">¿Qué hacés con lo que ya pagó (${formatPrecio(pagado)})?</p>
        <div class="sc-ops">
          <button class="sc-op" id="scMantener">
            <i class="ti ti-cash"></i>
            <span class="sc-op-t">La plata queda registrada</span>
            <span class="sc-op-s">El local se queda con ${formatPrecio(pagado)}. Sigue contando como ingreso en los días que se cobró.</span>
          </button>
          <button class="sc-op sc-op-danger" id="scBorrar">
            <i class="ti ti-cash-off"></i>
            <span class="sc-op-t">La plata NO queda registrada</span>
            <span class="sc-op-s">Se borran los pagos (se le devolvió al cliente). Deja de contar como ingreso.</span>
          </button>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" id="scVolver">Volver</button>
        </div>
      </div>`;

    document.getElementById("scOv").onclick = cerrarModal;
    document.getElementById("scVolver").onclick = () => abrirDetalleSena(s.id);

    const cancelar = async (borrarPagos) => {
      await API.cancelarSena(s.id, items, borrarPagos);
      items.forEach((i) => {
        const st = State.stock.find((x) => x.codigo === i.codigo && x.talle === i.talle && x.color === i.color);
        if (st) st.cantidad += i.cantidad;
      });
      cerrarModal();
      toast(borrarPagos
        ? "Seña cancelada · Prendas repuestas · Pagos borrados"
        : "Seña cancelada · Prendas repuestas · La plata queda registrada");
      cargarSenas();
    };

    document.getElementById("scMantener").onclick = () => cancelar(false);
    document.getElementById("scBorrar").onclick = () => {
      dobleConfirmacion({
        titulo: "Borrar los pagos",
        mensaje1: `Se van a borrar ${formatPrecio(pagado)} en pagos. Dejan de contar como ingreso en el historial.`,
        mensaje2: "Esto no se puede deshacer. ¿Confirmás?",
        textoBoton: "Borrar pagos",
        onOk: () => cancelar(true),
      });
    };
  };
}

function abrirPagoSena(s, saldo) {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="spOv"></div>
    <div class="modal">
      <h2>Registrar pago</h2>
      <p class="dc-msg">Saldo pendiente: <strong>${formatPrecio(saldo)}</strong></p>
      <div class="field">
        <label>Monto que paga ($)</label>
        <input class="sinput" type="number" id="spMonto" min="0" value="${Math.round(saldo)}">
      </div>
      <div class="field">
        <label>Método de pago</label>
        <select class="sinput" id="spMetodo">${MEDIOS_PAGO.map((m) => `<option value="${m}">${m}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label>Fecha del pago</label>
        <input class="sinput" type="datetime-local" id="spFecha" value="${ahoraLocalInput()}">
      </div>
      <p class="sena-info" id="spInfo"></p>
      <div class="modal-actions">
        <button class="btn-ghost" id="spCancel">Cancelar</button>
        <button class="btn-primary" id="spSave">Registrar pago</button>
      </div>
    </div>`;

  const inp = document.getElementById("spMonto");
  const info = document.getElementById("spInfo");
  const refrescar = () => {
    const m = Number(inp.value) || 0;
    if (m >= saldo && saldo > 0) info.innerHTML = `<i class="ti ti-circle-check"></i> Completa la seña: el cliente se lleva la prenda.`;
    else if (m > 0) info.innerHTML = `Quedaría debiendo ${formatPrecio(saldo - m)}`;
    else info.textContent = "";
  };
  inp.oninput = refrescar;
  refrescar();

  document.getElementById("spOv").onclick = cerrarModal;
  document.getElementById("spCancel").onclick = () => abrirDetalleSena(s.id);

  document.getElementById("spSave").onclick = async () => {
    const monto = Number(inp.value) || 0;
    const metodo = document.getElementById("spMetodo").value;
    if (monto <= 0) return toast("Monto inválido");
    if (monto > saldo) return toast(`El saldo es ${formatPrecio(saldo)}`);

    const btn = document.getElementById("spSave");
    btn.disabled = true; btn.textContent = "Guardando...";

    // usar la fecha elegida (puede ser de un día anterior)
    const fVal = document.getElementById("spFecha").value;
    const fecha = fVal ? new Date(fVal).toISOString() : new Date().toISOString();

    await API.pagarSena(s.id, monto, metodo, fecha);
    // si completó el total, la seña queda completada (la prenda ya salió del stock al señar)
    const completa = (monto >= saldo);
    if (completa) await API.actualizarEstadoSena(s.id, "completada");

    cerrarModal();
    toast(completa ? "Seña completada · El cliente se lleva la prenda" : `Pago registrado · ${formatPrecio(monto)}`);
    cargarSenas();
  };
}
