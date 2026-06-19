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
        <span class="c-fecha">${v.id} · ${v.origen || ""}</span>
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
        <label>Monto ($)</label>
        <input class="sinput" type="number" min="0" id="vMonto" placeholder="$">
      </div>
      <div class="field" id="campoDesc" style="display:none">
        <label>Descuento (%)</label>
        <input class="sinput" type="number" min="1" max="100" id="vDesc" placeholder="%">
      </div>
      <div class="field"><label>Nombre</label><input class="sinput" id="vNom" placeholder="Nombre y apellido"></div>
      <div class="field"><label>Teléfono</label><input class="sinput" id="vTel" placeholder="Ej. 2915551234" inputmode="numeric"></div>
      <div class="field"><label>Vencimiento</label><input class="sinput" type="date" id="vVence" value="${venceDefault}"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="vCancel">Cancelar</button>
        <button class="btn-primary" id="vSave">Crear voucher</button>
      </div>
    </div>`;

  let tipo = "monto";
  const campoMonto = document.getElementById("campoMonto");
  const campoDesc = document.getElementById("campoDesc");
  document.getElementById("tipoMonto").onclick = () => {
    tipo = "monto";
    document.getElementById("tipoMonto").classList.add("selected");
    document.getElementById("tipoDesc").classList.remove("selected");
    campoMonto.style.display = ""; campoDesc.style.display = "none";
  };
  document.getElementById("tipoDesc").onclick = () => {
    tipo = "descuento";
    document.getElementById("tipoDesc").classList.add("selected");
    document.getElementById("tipoMonto").classList.remove("selected");
    campoDesc.style.display = ""; campoMonto.style.display = "none";
  };

  document.getElementById("ov").onclick = cerrarModal;
  document.getElementById("vCancel").onclick = cerrarModal;
  document.getElementById("vSave").onclick = async () => {
    const nombre = document.getElementById("vNom").value.trim();
    const telefono = document.getElementById("vTel").value.trim();
    const vencimiento = document.getElementById("vVence").value;
    if (!nombre) return toast("Falta el nombre");
    if (!telefono) return toast("Falta el teléfono");
    if (!vencimiento) return toast("Falta el vencimiento");

    const voucher = {
      id: "VCH-" + Date.now(), tipo, fecha: new Date().toISOString(), vencimiento,
      nombre, telefono, origen: "Alta manual", avisado: false, usado: false,
    };
    if (tipo === "monto") {
      const m = Number(document.getElementById("vMonto").value) || 0;
      if (m <= 0) return toast("Monto inválido");
      voucher.monto = m;
    } else {
      const d = Number(document.getElementById("vDesc").value) || 0;
      if (d <= 0 || d > 100) return toast("Descuento inválido");
      voucher.descuento = d;
    }
    await API.crearVoucher(voucher);
    cerrarModal();
    toast("Voucher creado");
    cargarVouchers();
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
