/* ============================================================
   VISTA VOUCHERS — alta, alarmas, compartir, filtros
   ============================================================ */

let _vouchers = [];

function renderVouchers(root) {
  root.innerHTML = `
    <p class="view-title">VOUCHERS</p>
    <div id="vAlarmas"></div>
    <div class="vouchers-top">
      <button class="btn-primary v-new-btn" id="vNewBtn"><i class="ti ti-plus"></i> Nuevo voucher</button>
    </div>
    <div id="vFiltros"></div>
    <div class="cambios-list" id="vouchersList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>`;
  document.getElementById("vNewBtn").onclick = abrirNuevoVoucher;
  cargarVouchers();
}

async function cargarVouchers() {
  const res = await API.getVouchers();
  if (!res.ok) {
    document.getElementById("vouchersList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar.</p></div>`;
    return;
  }
  _vouchers = res.vouchers;

  // barra de filtros
  const fcont = document.getElementById("vFiltros");
  fcont.innerHTML = "";
  const barra = crearBarraFiltros({
    placeholder: "Buscar por nombre o teléfono...",
    campos: [
      { id: "tipo", label: "Tipo", tipo: "select", opciones: ["Monto", "Descuento"] },
      { id: "estado", label: "Estado", tipo: "select", opciones: ["Disponible", "Usado", "Vencido"] },
    ],
    onChange: (f) => pintarVouchers(f),
  });
  fcont.appendChild(barra);

  pintarAlarmas();
  pintarVouchers({});
}

// barra de alarmas arriba de la sección
function pintarAlarmas() {
  const cont = document.getElementById("vAlarmas");
  const porVencer = _vouchers.filter((v) => {
    const e = estadoAlarmaVoucher(v);
    return e === "roja" || e === "amarilla";
  });
  if (!porVencer.length) { cont.innerHTML = ""; return; }

  // prioridad: si hay alguna roja, la barra es roja
  const hayRoja = porVencer.some((v) => estadoAlarmaVoucher(v) === "roja");
  const clase = hayRoja ? "alarm-red" : "alarm-yellow";
  const rojas = porVencer.filter((v) => estadoAlarmaVoucher(v) === "roja").length;
  const amarillas = porVencer.filter((v) => estadoAlarmaVoucher(v) === "amarilla").length;
  let texto = "";
  if (rojas) texto += `${rojas} voucher${rojas > 1 ? "s" : ""} por vencer sin avisar`;
  if (rojas && amarillas) texto += " · ";
  if (amarillas) texto += `${amarillas} avisado${amarillas > 1 ? "s" : ""} por vencer`;

  cont.innerHTML = `<div class="alarm-bar ${clase}"><i class="ti ti-bell-ringing"></i> ${texto}</div>`;
}

function pintarVouchers(f) {
  const list = document.getElementById("vouchersList");
  let lista = _vouchers.slice();

  if (f.q) lista = lista.filter((v) => coincideTexto(v, f.q, ["nombre", "telefono"]));
  if (f.tipo === "Monto") lista = lista.filter((v) => v.tipo === "monto");
  if (f.tipo === "Descuento") lista = lista.filter((v) => v.tipo === "descuento");
  if (f.estado === "Disponible") lista = lista.filter((v) => !v.usado && diasParaVencer(v.vencimiento) >= 0);
  if (f.estado === "Usado") lista = lista.filter((v) => v.usado);
  if (f.estado === "Vencido") lista = lista.filter((v) => !v.usado && diasParaVencer(v.vencimiento) < 0);

  // ordenar: alarmas rojas primero, luego amarillas, luego resto, usados al final
  const peso = (v) => {
    const e = estadoAlarmaVoucher(v);
    return e === "roja" ? 0 : e === "amarilla" ? 1 : e === "ninguna" ? 2 : e === "vencido" ? 3 : 4;
  };
  lista.sort((a, b) => peso(a) - peso(b));

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-ticket-off"></i><p>No hay vouchers que coincidan.</p></div>`;
    return;
  }
  list.innerHTML = lista.map(voucherHTML).join("");
  lista.forEach((v) => bindVoucher(list, v));
}

function valorVoucher(v) {
  return v.tipo === "descuento" ? `${v.descuento}% off` : formatPrecio(v.monto);
}

function voucherHTML(v) {
  const est = estadoAlarmaVoucher(v);
  const dias = diasParaVencer(v.vencimiento);
  let badge = "";
  if (est === "roja") badge = `<span class="v-badge red">Vence en ${dias}d · sin avisar</span>`;
  else if (est === "amarilla") badge = `<span class="v-badge yellow">Vence en ${dias}d · avisado</span>`;
  else if (est === "vencido") badge = `<span class="v-badge gray">Vencido</span>`;
  else if (est === "usado") badge = `<span class="v-badge gray">Usado</span>`;
  else badge = `<span class="v-badge ok">Vence ${fmtFecha(v.vencimiento)}</span>`;

  const claseFila = (v.usado || dias < 0) ? "expirado" : (est === "roja" ? "alarm-row-red" : est === "amarilla" ? "alarm-row-yellow" : "");

  // checkbox de "aviso realizado" solo tiene sentido si está en ventana de alarma y no usado
  const mostrarCheck = !v.usado && dias >= 0 && dias <= CONFIG.DIAS_ALARMA_VOUCHER;
  const checkHTML = mostrarCheck
    ? `<label class="v-check"><input type="checkbox" data-act="avisado" ${v.avisado ? "checked" : ""}> Avisado</label>`
    : "";

  return `
    <div class="crow voucher-row ${claseFila}" data-id="${v.id}">
      <div class="c-meta">
        <span class="c-vars"><strong>${v.nombre || "—"}</strong> · ${v.telefono || "—"}</span>
        <span class="c-fecha">${v.id} · ${v.origen || ""}${v.comprado ? ` · pagado con ${metodoColoreado(v.metodoPago)}` : ""}</span>
        <span class="v-tipo-origen ${v.comprado ? "comprado" : "saldo"}">${v.comprado ? "Comprado (ingresó plata)" : "Saldo a favor"}</span>
        ${badge}
      </div>
      <div class="v-value">${valorVoucher(v)}</div>
      <div class="v-actions">
        ${checkHTML}
        <button class="v-icon" data-act="editvenc" title="Editar vencimiento"><i class="ti ti-calendar"></i></button>
        <button class="v-icon" data-act="share" title="Compartir imagen"><i class="ti ti-share"></i></button>
        ${v.usado
          ? `<button class="v-icon ok" data-act="enable" title="Rehabilitar"><i class="ti ti-rotate"></i></button>`
          : `<button class="v-icon danger" data-act="disable" title="Deshabilitar"><i class="ti ti-ban"></i></button>`}
      </div>
    </div>`;
}

function bindVoucher(list, v) {
  const row = list.querySelector(`.voucher-row[data-id="${v.id}"]`);
  const chk = row.querySelector('[data-act="avisado"]');
  if (chk) {
    chk.onchange = async () => {
      v.avisado = chk.checked;
      await API.actualizarVoucher(v.id, { avisado: chk.checked });
      pintarAlarmas();
      actualizarCampanitaVouchers();
      pintarVouchers(filtrosActuales());
    };
  }
  row.querySelector('[data-act="share"]').onclick = () => compartirVoucher(v);

  row.querySelector('[data-act="editvenc"]').onclick = () => {
    document.getElementById("modalRoot").innerHTML = `
      <div class="modal-overlay" id="ov"></div>
      <div class="modal">
        <h2>Editar vencimiento</h2>
        <p class="modal-line"><span>Voucher</span><strong>${v.nombre || v.id}</strong></p>
        <p class="modal-line"><span>Valor</span><strong>${valorVoucher(v)}</strong></p>
        <div class="field"><label>Nueva fecha de vencimiento</label>
          <input class="sinput" type="date" id="newVenc" value="${v.vencimiento || ""}"></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="vencCancel">Cancelar</button>
          <button class="btn-primary" id="vencSave">Guardar</button>
        </div>
      </div>`;
    document.getElementById("ov").onclick = cerrarModal;
    document.getElementById("vencCancel").onclick = cerrarModal;
    document.getElementById("vencSave").onclick = async () => {
      const nueva = document.getElementById("newVenc").value;
      if (!nueva) return toast("Falta la fecha");
      v.vencimiento = nueva;
      await API.actualizarVoucher(v.id, { vencimiento: nueva });
      cerrarModal();
      toast("Vencimiento actualizado");
      cargarVouchers();
      actualizarCampanitaVouchers();
    };
  };

  const dis = row.querySelector('[data-act="disable"]');
  if (dis) dis.onclick = () => {
    dobleConfirmacion({
      titulo: "Deshabilitar voucher",
      mensaje1: `Vas a deshabilitar el voucher de ${v.nombre || v.id} por ${valorVoucher(v)}.`,
      mensaje2: "El voucher quedará como usado y no se podrá aplicar. ¿Confirmás?",
      textoBoton: "Deshabilitar",
      onOk: async () => {
        v.usado = true;
        await API.actualizarVoucher(v.id, { usado: true });
        toast("Voucher deshabilitado");
        cargarVouchers();
        actualizarCampanitaVouchers();
      },
    });
  };

  const en = row.querySelector('[data-act="enable"]');
  if (en) en.onclick = () => {
    dobleConfirmacion({
      titulo: "Rehabilitar voucher",
      mensaje1: `Vas a rehabilitar el voucher de ${v.nombre || v.id} por ${valorVoucher(v)}.`,
      mensaje2: "Es una acción excepcional: el voucher volverá a estar disponible para usar. ¿Confirmás?",
      textoBoton: "Rehabilitar",
      onOk: async () => {
        v.usado = false;
        await API.actualizarVoucher(v.id, { usado: false });
        toast("Voucher rehabilitado");
        cargarVouchers();
        actualizarCampanitaVouchers();
      },
    });
  };
}

// lee los filtros actuales de la barra (para re-pintar sin perderlos)
function filtrosActuales() {
  const f = {};
  document.querySelectorAll("#vFiltros [data-filter]").forEach((el) => { f[el.dataset.filter] = el.value.trim(); });
  return f;
}

// ---- Alta de voucher ----
function abrirNuevoVoucher() {
  const venceDefault = (() => {
    const d = new Date(); d.setDate(d.getDate() + CONFIG.DIAS_VENCIMIENTO_VOUCHER);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  })();

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="ov"></div>
    <div class="modal">
      <h2>Nuevo voucher</h2>
      <div class="pay-mode">
        <button class="pay-mode-btn selected" id="tipoMonto">Monto fijo</button>
        <button class="pay-mode-btn" id="tipoDesc">% Descuento</button>
      </div>
      <div class="field" id="campoMonto">
        <label>Monto ($) <span style="color:var(--oak-55)">— lo que se lleva</span></label>
        <input class="sinput" type="number" min="0" id="vMonto" placeholder="$">
      </div>
      <label class="g-check" id="campoBonif" style="display:none"><input type="checkbox" id="vBonif"> Con bonificación (paga menos de lo que se lleva)</label>
      <div class="field" id="campoPagado" style="display:none">
        <label>Paga ($) <span style="color:var(--oak-55)">— lo que entra a caja</span></label>
        <input class="sinput" type="number" min="0" id="vPagado" placeholder="$">
      </div>
      <div class="field" id="campoDesc" style="display:none">
        <label>Descuento (%)</label>
        <input class="sinput" type="number" min="1" max="100" id="vDesc" placeholder="%">
      </div>
      <div class="field"><label>Nombre</label><input class="sinput" id="vNom" placeholder="Nombre y apellido"></div>
      <div class="field"><label>Teléfono</label><input class="sinput" id="vTel" placeholder="Ej. 2915551234" inputmode="numeric"></div>
      <div class="field"><label>Vencimiento</label><input class="sinput" type="date" id="vVence" value="${venceDefault}"></div>
      <label class="g-check"><input type="checkbox" id="vComprado"> Voucher comprado (el cliente lo paga ahora)</label>
      <div class="field" id="campoMetodo" style="display:none">
        <label>Método de pago</label>
        <select class="sinput" id="vMetodo">${MEDIOS_PAGO.map((m) => `<option value="${m}">${m}</option>`).join("")}</select>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" id="vCancel">Cancelar</button>
        <button class="btn-primary" id="vSave">Crear voucher</button>
      </div>
    </div>`;

  let tipo = "monto";
  const campoMonto = document.getElementById("campoMonto");
  const campoDesc = document.getElementById("campoDesc");
  const chkComprado = document.getElementById("vComprado");
  const campoMetodo = document.getElementById("campoMetodo");
  const campoBonif = document.getElementById("campoBonif");
  const campoPagado = document.getElementById("campoPagado");
  const chkBonif = document.getElementById("vBonif");

  // la bonificación solo aplica a "Monto fijo" + "Comprado"
  function refrescarBonif() {
    const puede = (tipo === "monto") && chkComprado.checked;
    campoBonif.style.display = puede ? "" : "none";
    campoPagado.style.display = (puede && chkBonif.checked) ? "" : "none";
    if (!puede) chkBonif.checked = false;
  }

  document.getElementById("tipoMonto").onclick = () => {
    tipo = "monto";
    document.getElementById("tipoMonto").classList.add("selected");
    document.getElementById("tipoDesc").classList.remove("selected");
    campoMonto.style.display = ""; campoDesc.style.display = "none";
    refrescarBonif();
  };
  document.getElementById("tipoDesc").onclick = () => {
    tipo = "descuento";
    document.getElementById("tipoDesc").classList.add("selected");
    document.getElementById("tipoMonto").classList.remove("selected");
    campoDesc.style.display = ""; campoMonto.style.display = "none";
    refrescarBonif();
  };

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("vCancel").onclick = cerrarModal;

  // mostrar método de pago y bonificación solo si es comprado
  chkComprado.onchange = () => {
    campoMetodo.style.display = chkComprado.checked ? "" : "none";
    refrescarBonif();
  };
  chkBonif.onchange = refrescarBonif;

  document.getElementById("vSave").onclick = async () => {
    const nombre = document.getElementById("vNom").value.trim();
    const telefono = document.getElementById("vTel").value.trim();
    const vencimiento = document.getElementById("vVence").value;
    if (!nombre) return toast("Falta el nombre");
    if (!telefono) return toast("Falta el teléfono");
    if (!vencimiento) return toast("Falta el vencimiento");

    const comprado = chkComprado.checked;
    const voucher = {
      id: "VCH-" + Date.now(), tipo, fecha: new Date().toISOString(), vencimiento,
      nombre, telefono, origen: comprado ? "Compra" : "Alta manual",
      avisado: false, usado: false,
      comprado, metodoPago: comprado ? document.getElementById("vMetodo").value : null,
    };
    if (tipo === "monto") {
      const m = Number(document.getElementById("vMonto").value) || 0;
      if (m <= 0) return toast("Monto inválido");
      voucher.monto = m;
      // bonificación: paga menos de lo que se lleva. Solo si es comprado.
      if (comprado && chkBonif.checked) {
        const pagado = Number(document.getElementById("vPagado").value) || 0;
        if (pagado <= 0) return toast("Ingresá lo que paga el cliente");
        if (pagado > m) return toast("Lo que paga no puede ser mayor a lo que se lleva");
        voucher.pagado = pagado;
      } else {
        voucher.pagado = comprado ? m : 0;
      }
    } else {
      const d = Number(document.getElementById("vDesc").value) || 0;
      if (d <= 0 || d > 100) return toast("Descuento inválido");
      voucher.descuento = d;
    }
    // un voucher comprado de descuento no tiene sentido (no entra plata fija); avisar
    if (comprado && tipo === "descuento") return toast("Un voucher comprado debe ser de monto fijo");
    const resVch = await API.crearVoucher(voucher);
    if (!resVch || !resVch.ok) return toast("No se pudo crear el voucher. Revisá la conexión e intentá de nuevo.");
    cerrarModal();
    toast("Voucher creado");
    cargarVouchers();
  };
}

/* ============================================================
   GENERAR VOUCHER A PARTIR DE UNA VENTA (devolución sin cambio)
   ============================================================
   La prenda vuelve al stock, la venta NO se anula (la plata del día se mantiene)
   y el cliente recibe un voucher. La venta queda marcada con voucher_generado,
   así no se puede volver a cambiar ni restaurar.

   Vive acá (y no en una vista) porque la usan Cambios e Historial.
   opts: { montoSugerido, onListo }
     montoSugerido → número precargado en el campo (queda editable)
     onListo       → callback tras generar, para que cada vista repinte lo suyo
   ============================================================ */
async function abrirVoucherDesdeVenta(v, opts) {
  opts = opts || {};
  // por defecto, el valor de la prenda para el cliente (lo mismo que acreditaría
  // un cambio normal), no el precio final cobrado: ese incluye recargo de tarjeta.
  const montoSugerido = opts.montoSugerido != null
    ? opts.montoSugerido
    : (v.precioProducto != null ? v.precioProducto : (v.precioBase || 0));

  const venceDefault = (() => {
    const d = new Date(); d.setDate(d.getDate() + CONFIG.DIAS_VENCIMIENTO_VOUCHER);
    return fechaLocalISO(d);
  })();

  // vouchers ya existentes: sirven para autocompletar al cliente y para acumular
  const rv = await API.getVouchers();
  const existentes = rv.ok ? rv.vouchers : [];
  // solo se acumula sobre un voucher de monto fijo, vigente, sin usar y NO comprado.
  // Un voucher comprado entró como ingreso (pagado); mezclarlo con una devolución
  // ensuciaría los informes.
  const esAcumulable = (x) => x.tipo === "monto" && !x.usado && !x.comprado && diasParaVencer(x.vencimiento) >= 0;

  const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
  // busca el voucher del cliente: primero por teléfono (clave más confiable que el
  // nombre, que puede repetirse entre clientes distintos), después por nombre.
  function voucherDelCliente(nombre, telefono, lista) {
    const tel = soloDigitos(telefono);
    if (tel) {
      const porTel = lista.find((x) => soloDigitos(x.telefono) === tel);
      if (porTel) return porTel;
    }
    const nom = normaliza(nombre);
    if (!nom) return null;
    return lista.find((x) => normaliza(x.nombre) === nom) || null;
  }

  // clientes conocidos, para el autocompletado del nombre
  const clientes = [];
  existentes.forEach((x) => {
    if (x.nombre && !clientes.some((c) => normaliza(c.nombre) === normaliza(x.nombre))) {
      clientes.push({ nombre: x.nombre, telefono: x.telefono || "" });
    }
  });

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="gvOv"></div>
    <div class="modal">
      <h2>Generar voucher</h2>
      <p class="dc-msg">Por la venta de <strong>${escAttr(v.marca || v.codigo)}</strong> (${escAttr(v.talle)}/${escAttr(v.color)}).</p>
      <div class="field">
        <label>Monto del voucher <span style="color:var(--oak-55)">— lo que pagó por la prenda</span></label>
        <input class="sinput" type="number" min="0" id="gvMonto" value="${montoSugerido}">
      </div>
      <div class="field">
        <label>Nombre</label>
        <input class="sinput" id="gvNom" list="gvClientes" placeholder="Nombre y apellido" autocomplete="off">
        <datalist id="gvClientes">${clientes.map((c) => `<option value="${escAttr(c.nombre)}">`).join("")}</datalist>
      </div>
      <div class="field"><label>Teléfono</label><input class="sinput" id="gvTel" placeholder="Ej. 2915551234" inputmode="numeric"></div>
      <div class="field"><label>Vencimiento</label><input class="sinput" type="date" id="gvVence" value="${venceDefault}"></div>
      <div id="gvAcum"></div>
      <p class="gv-aviso"><i class="ti ti-info-circle"></i> La prenda vuelve al stock y la venta sigue contando en el día.</p>
      <div class="modal-actions">
        <button class="btn-ghost" id="gvCancel">Cancelar</button>
        <button class="btn-primary" id="gvSave">Generar voucher</button>
      </div>
    </div>`;

  const inpNom = document.getElementById("gvNom");
  const inpTel = document.getElementById("gvTel");
  const inpMonto = document.getElementById("gvMonto");
  const inpVence = document.getElementById("gvVence");
  const contAcum = document.getElementById("gvAcum");

  let acumulaEn = null; // voucher existente al que se le va a sumar (o null)

  // muestra el cartel de acumulación según el cliente que se esté tipeando
  function refrescarAcumulacion() {
    const nombre = inpNom.value.trim();
    const telefono = inpTel.value.trim();
    const previo = voucherDelCliente(nombre, telefono, existentes);

    if (!previo) { acumulaEn = null; contAcum.innerHTML = ""; return; }

    if (!esAcumulable(previo)) {
      // hay un voucher del cliente pero no se puede sumar: explicar por qué
      const motivo = previo.usado ? "ya fue usado"
        : previo.comprado ? "fue comprado (cuenta como ingreso)"
        : previo.tipo !== "monto" ? "es de descuento por porcentaje"
        : "está vencido";
      acumulaEn = null;
      contAcum.innerHTML = `<p class="gv-acum-no"><i class="ti ti-info-circle"></i> ${escAttr(previo.nombre)} ya tiene un voucher, pero ${motivo}. Se va a crear uno nuevo.</p>`;
      return;
    }

    acumulaEn = previo;
    const nuevoMonto = (Number(inpMonto.value) || 0) + previo.monto;
    // al sumar, el vencimiento se renueva al más lejano de los dos: si no,
    // la plata nueva heredaría el vencimiento viejo y podría morir enseguida
    const vencFinal = (inpVence.value && inpVence.value > previo.vencimiento) ? inpVence.value : previo.vencimiento;
    contAcum.innerHTML = `
      <div class="gv-acum">
        <label class="g-check">
          <input type="checkbox" id="gvSumar" checked>
          Sumar al voucher que ya tiene ${escAttr(previo.nombre)}
        </label>
        <div class="gv-acum-detalle">
          <span>Tenía ${formatPrecio(previo.monto)} · vence ${fmtFecha(previo.vencimiento)}</span>
          <strong>Queda en ${formatPrecio(nuevoMonto)} · vence ${fmtFecha(vencFinal)}</strong>
        </div>
      </div>`;
    document.getElementById("gvSumar").onchange = (e) => { acumulaEn = e.target.checked ? previo : null; };
  }

  // al elegir un cliente conocido, completar el teléfono solo
  inpNom.addEventListener("input", () => {
    const c = clientes.find((x) => normaliza(x.nombre) === normaliza(inpNom.value.trim()));
    if (c && !inpTel.value.trim()) inpTel.value = c.telefono;
    refrescarAcumulacion();
  });
  inpTel.addEventListener("input", () => {
    // si el teléfono identifica a un cliente y el nombre está vacío, completarlo
    const previo = voucherDelCliente("", inpTel.value, existentes);
    if (previo && !inpNom.value.trim()) inpNom.value = previo.nombre || "";
    refrescarAcumulacion();
  });
  inpMonto.addEventListener("input", refrescarAcumulacion);
  inpVence.addEventListener("change", refrescarAcumulacion);

  document.getElementById("gvOv").onclick = cerrarModal;
  document.getElementById("gvCancel").onclick = cerrarModal;

  document.getElementById("gvSave").onclick = async () => {
    const nombre = inpNom.value.trim();
    const telefono = inpTel.value.trim();
    const vencimiento = inpVence.value;
    const monto = Number(inpMonto.value) || 0;
    if (!nombre) return toast("Falta el nombre");
    if (!telefono) return toast("Falta el teléfono");
    if (!vencimiento) return toast("Falta el vencimiento");
    if (monto <= 0) return toast("El monto tiene que ser mayor a 0");

    const btn = document.getElementById("gvSave");
    btn.disabled = true; btn.textContent = "Generando...";

    const origenPrenda = `Devolución de ${v.codigo}`;
    let idVoucher, res, sumado = false, montoFinal = monto;

    if (acumulaEn) {
      // sumar sobre el voucher existente
      montoFinal = acumulaEn.monto + monto;
      const vencFinal = vencimiento > acumulaEn.vencimiento ? vencimiento : acumulaEn.vencimiento;
      res = await API.actualizarVoucher(acumulaEn.id, {
        monto: montoFinal,
        vencimiento: vencFinal,
        // el origen se acumula para no perder de qué prendas salió la plata
        origen: (acumulaEn.origen ? acumulaEn.origen + " + " : "") + origenPrenda,
        avisado: false, // volvió a tener saldo nuevo: el aviso anterior ya no vale
      });
      idVoucher = acumulaEn.id;
      sumado = true;
    } else {
      idVoucher = "VCH-" + Date.now();
      res = await API.crearVoucher({
        id: idVoucher, tipo: "monto", monto,
        fecha: new Date().toISOString(), vencimiento,
        nombre, telefono, origen: origenPrenda,
        avisado: false, usado: false, comprado: false,
      });
    }

    if (!res || !res.ok) {
      btn.disabled = false; btn.textContent = "Generar voucher";
      return toast("No se pudo generar el voucher. Revisá la conexión e intentá de nuevo.");
    }

    // la prenda vuelve al stock (es una devolución)
    await API.ajustarStockPorVariante(v.codigo, v.talle, v.color, v.cantidad);
    const s = State.stock.find((x) => x.codigo === v.codigo && x.talle === v.talle && x.color === v.color);
    if (s) s.cantidad += v.cantidad;

    // marcar la venta: ya generó voucher (no se puede volver a generar ni restaurar)
    await API.marcarVoucherGenerado(v.id, idVoucher);
    v.voucherGenerado = idVoucher;

    cerrarModal();
    toast(sumado
      ? `Sumado al voucher de ${nombre}: ${formatPrecio(montoFinal)} · Prenda repuesta`
      : `Voucher de ${formatPrecio(monto)} generado · Prenda repuesta`);
    if (typeof opts.onListo === "function") opts.onListo();
    actualizarCampanitaVouchers();
  };
}

// ---- Compartir como imagen ----
function compartirVoucher(v) {
  const canvas = document.createElement("canvas");
  const W = 600, H = 340;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // fondo
  ctx.fillStyle = "#041F1E"; ctx.fillRect(0, 0, W, H);
  // borde
  ctx.strokeStyle = "#DCCAAC"; ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  ctx.fillStyle = "#DCCAAC";
  ctx.textAlign = "center";
  ctx.font = "bold 34px Georgia";
  ctx.fillText("CRISTOBAL", W / 2, 70);
  ctx.font = "16px Georgia";
  ctx.fillStyle = "#C9A24B";
  ctx.fillText("VOUCHER", W / 2, 100);

  // valor grande
  ctx.fillStyle = "#DCCAAC";
  ctx.font = "bold 60px Georgia";
  ctx.fillText(valorVoucher(v), W / 2, 185);

  ctx.font = "18px Georgia";
  ctx.fillStyle = "#DCCAAC";
  ctx.fillText(`A nombre de: ${v.nombre || "—"}`, W / 2, 235);
  ctx.font = "15px Georgia";
  ctx.fillStyle = "rgba(220,202,172,0.7)";
  ctx.fillText(`Válido hasta ${fmtFecha(v.vencimiento)}`, W / 2, 265);
  ctx.fillText(`Código: ${v.id}`, W / 2, 290);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], `voucher-${v.id}.png`, { type: "image/png" });
    // intentar compartir nativo (móvil)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Voucher CRISTOBAL" });
        return;
      } catch (e) { /* canceló, cae a descarga */ }
    }
    // fallback: descargar
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `voucher-${v.id}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Imagen del voucher descargada");
  }, "image/png");
}
