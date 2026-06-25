/* ============================================================
   VISTA CUENTA CORRIENTE — cuentas de clientes con deuda
   ============================================================ */

let _cuentas = [];
let _ccItems = [];
let _ccPagos = [];
let _cuentaAbierta = null; // id de la cuenta cuyo detalle se ve

function renderCuentas(root) {
  root.innerHTML = `
    <p class="view-title">CUENTA CORRIENTE</p>
    <div class="vouchers-top">
      <button class="btn-primary v-new-btn" id="ccNewBtn"><i class="ti ti-user-plus"></i> Nueva cuenta</button>
    </div>
    <div id="ccFiltros"></div>
    <div class="cambios-list" id="ccList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>`;
  document.getElementById("ccNewBtn").onclick = abrirNuevaCuenta;
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

// deuda total de una cuenta: suma de prendas − suma de pagos
function deudaCuenta(cuentaId) {
  const items = _ccItems.filter((i) => i.cuentaId === cuentaId);
  const pagos = _ccPagos.filter((p) => p.cuentaId === cuentaId);
  const totalItems = items.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const totalPagos = pagos.reduce((a, p) => a + p.monto, 0);
  return totalItems - totalPagos;
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

  const itemsHTML = items.length
    ? items.map((i) => `
        <div class="cc-item">
          <img class="cc-item-img" src="${imgPrenda(i.codigo)}" onerror="this.style.opacity=0.3">
          <div class="cc-item-info">
            <span>${i.marca} · ${i.codigo}</span>
            <span class="cc-item-var">Talle ${i.talle} · ${i.color} · x${i.cantidad}</span>
          </div>
          <span class="cc-item-precio">${formatPrecio(i.precio * i.cantidad)}</span>
          <button class="v-icon danger" data-quitar="${i.id}" title="Quitar (repone stock)"><i class="ti ti-x"></i></button>
        </div>`).join("")
    : `<p class="cc-vacio">Sin prendas cargadas.</p>`;

  const pagosHTML = pagos.length
    ? pagos.map((p) => `
        <div class="cc-pago">
          <span>${fmtFecha(p.fecha)} · ${p.metodoPago || "—"}</span>
          <span class="cc-pago-monto">− ${formatPrecio(p.monto)}</span>
        </div>`).join("")
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
      </div>

      <div class="cc-section">
        <div class="cc-section-head">
          <p class="chk-title">Prendas</p>
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

  document.getElementById("ccEliminar").onclick = () => {
    dobleConfirmacion({
      titulo: "Eliminar cuenta",
      mensaje1: `Vas a eliminar la cuenta de ${c.nombre} ${c.apellido || ""}.`,
      mensaje2: "Se borran sus prendas y pagos. El stock de las prendas pendientes se repone. ¿Confirmás?",
      textoBoton: "Eliminar",
      onOk: async () => {
        // reponer stock de las prendas pendientes antes de borrar
        for (const i of items) await API.ajustarStock(i.codigo, i.talle, i.color, i.cantidad);
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
  abrirDetalleCuenta(cuentaId);
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
      <div class="field"><label>Monto que paga</label><input class="sinput" type="number" id="ccMonto" min="0" max="${deuda}" placeholder="$" value="${Math.round(deuda)}"></div>
      <p class="login-sub" style="text-align:center">Método de pago</p>
      <div class="pay-grid">${pagos1}</div>
      <div class="modal-actions">
        <button class="btn-ghost" id="ccPagoCancel">Volver</button>
        <button class="btn-primary" id="ccPagoConfirm" disabled>Confirmar pago</button>
      </div>
    </div>`;
  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("ccPagoCancel").onclick = () => abrirDetalleCuenta(cuentaId);
  const btn = document.getElementById("ccPagoConfirm");
  document.querySelectorAll("[data-m]").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".pay-opt").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      metodo = b.dataset.m;
      btn.disabled = false;
    };
  });
  btn.onclick = async () => {
    const monto = Number(document.getElementById("ccMonto").value) || 0;
    if (monto <= 0) return toast("Monto inválido");
    if (monto > deuda + 0.5) return toast("El monto supera la deuda");
    if (!metodo) return toast("Elegí un método de pago");
    await API.registrarPagoCuenta(cuentaId, monto, metodo);
    toast(`Pago de ${formatPrecio(monto)} registrado`);
    await recargarYReabrir(cuentaId);
  };
}
