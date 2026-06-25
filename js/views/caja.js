/* ============================================================
   VISTA CAJA — conteo manual de billetes en efectivo
   ============================================================ */

let _caja = [];

function renderCaja(root) {
  root.innerHTML = `
    <p class="view-title">CAJA</p>
    <div id="cajaTotal"></div>
    <div class="caja-list" id="cajaList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>`;
  cargarCaja();
}

async function cargarCaja() {
  const res = await API.getCaja();
  if (!res.ok) {
    document.getElementById("cajaList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudo cargar la caja.</p></div>`;
    return;
  }
  // ordenar por denominación, asegurando que estén todas las del config
  const mapa = {};
  res.caja.forEach((c) => { mapa[c.denominacion] = c.cantidad; });
  _caja = DENOMINACIONES.map((d) => ({ denominacion: d, cantidad: mapa[d] || 0 }));

  pintarCaja();
}

function totalCaja() {
  return _caja.reduce((a, b) => a + b.denominacion * b.cantidad, 0);
}

function pintarCaja() {
  document.getElementById("cajaTotal").innerHTML = `
    <div class="caja-total">
      <span>Total en caja</span>
      <strong>${formatPrecio(totalCaja())}</strong>
    </div>`;

  const list = document.getElementById("cajaList");
  list.innerHTML = _caja.map(billeteHTML).join("");
  _caja.forEach((b) => bindBillete(list, b));
}

function billeteHTML(b) {
  const subtotal = b.denominacion * b.cantidad;
  return `
    <div class="billete-row" data-den="${b.denominacion}">
      <div class="billete-info">
        <span class="billete-den">$${b.denominacion.toLocaleString("es-AR")}</span>
        <span class="billete-sub">${formatPrecio(subtotal)}</span>
      </div>
      <div class="billete-ctrl">
        <button class="step-btn" data-act="minus">&minus;</button>
        <input class="billete-cant" type="number" min="0" value="${b.cantidad}" data-act="cant">
        <button class="step-btn" data-act="plus">+</button>
      </div>
    </div>`;
}

function bindBillete(list, b) {
  const row = list.querySelector(`.billete-row[data-den="${b.denominacion}"]`);
  const input = row.querySelector('[data-act="cant"]');

  async function guardar(nueva) {
    nueva = Math.max(0, nueva);
    b.cantidad = nueva;
    input.value = nueva;
    // actualizar subtotal y total en vivo
    row.querySelector(".billete-sub").textContent = formatPrecio(b.denominacion * nueva);
    document.querySelector(".caja-total strong").textContent = formatPrecio(totalCaja());
    await API.setCajaCantidad(b.denominacion, nueva);
  }

  row.querySelector('[data-act="minus"]').onclick = () => guardar((Number(input.value) || 0) - 1);
  row.querySelector('[data-act="plus"]').onclick = () => guardar((Number(input.value) || 0) + 1);
  input.onchange = () => guardar(Number(input.value) || 0);
}
