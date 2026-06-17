/* ============================================================
   VISTA VOUCHERS — saldos a favor generados por cambios
   ============================================================ */

function renderVouchers(root) {
  root.innerHTML = `<p class="view-title">VOUCHERS</p><div class="cambios-list" id="vouchersList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>`;
  cargarVouchers();
}

async function cargarVouchers() {
  const list = document.getElementById("vouchersList");
  const res = await API.getVouchers();
  if (!res.ok) { list.innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar.</p></div>`; return; }
  if (!res.vouchers.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-ticket-off"></i><p>No hay vouchers generados.</p></div>`;
    return;
  }
  list.innerHTML = res.vouchers.map(voucherHTML).join("");
}

function voucherHTML(v) {
  const fecha = new Date(v.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `
    <div class="crow ${v.usado ? "expirado" : ""}">
      <div class="c-meta">
        <span class="c-vars"><strong>${v.id}</strong></span>
        <span class="c-fecha">${v.origen} · ${fecha}</span>
        <span class="c-estado ${v.usado ? "no" : "ok"}">${v.usado ? "Usado" : "Disponible"}</span>
      </div>
      <div></div>
      <div class="c-precio">${formatPrecio(v.monto)}</div>
      <div></div>
    </div>`;
}
