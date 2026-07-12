/* ============================================================
   VISTA FACTURAS
   Lista todas las facturas generadas en las ventas con débito,
   crédito o transferencia, para poder facturarlas después.
   ============================================================ */

let _facturas = [];

async function renderFacturas(root) {
  State.dentroCategoria = false;
  refrescarHeader();
  root.innerHTML = `
    ${bandaSeccion("facturas", "FACTURAS", "Datos para facturar")}
    <div id="facFiltros"></div>
    <div class="fact-list" id="factList"><div class="soon"><i class="ti ti-loader"></i><p>Cargando...</p></div></div>
  `;

  const res = await API.getFacturas();
  if (!res.ok) {
    document.getElementById("factList").innerHTML = `<div class="soon"><i class="ti ti-alert-triangle"></i><p>No se pudieron cargar las facturas.</p></div>`;
    return;
  }
  _facturas = res.facturas;

  const fcont = document.getElementById("facFiltros");
  const barra = crearBarraFiltros({
    placeholder: "Buscar por nombre, DNI o número...",
    campos: [
      { id: "estado", label: "Estado", tipo: "select", opciones: ["Pendientes", "Facturadas"] },
      { id: "pago", label: "Pago", tipo: "select", opciones: ["Débito", "Crédito", "Transferencia"] },
      { id: "fecha", label: "Fecha", tipo: "date" },
    ],
    onChange: (f) => pintarFacturas(f),
  });
  fcont.appendChild(barra);

  pintarFacturas({});
}

function pintarFacturas(f) {
  const list = document.getElementById("factList");
  let lista = _facturas.slice();

  if (f.q) {
    const q = f.q.toLowerCase();
    lista = lista.filter((x) =>
      (x.nombre || "").toLowerCase().includes(q) ||
      (x.dni || "").toLowerCase().includes(q) ||
      (x.numero || "").toLowerCase().includes(q));
  }
  if (f.estado === "Pendientes") lista = lista.filter((x) => !x.facturada);
  if (f.estado === "Facturadas") lista = lista.filter((x) => x.facturada);
  if (f.pago) lista = lista.filter((x) => (x.metodoPago || "").includes(f.pago));
  if (f.fecha) lista = lista.filter((x) => fechaLocalISO(x.fecha) === f.fecha);

  if (!lista.length) {
    list.innerHTML = `<div class="soon"><i class="ti ti-file-off"></i><p>No hay facturas que coincidan.</p></div>`;
    return;
  }

  const pendientes = lista.filter((x) => !x.facturada).length;
  const totalPend = lista.filter((x) => !x.facturada).reduce((a, x) => a + x.monto, 0);
  const resumen = `<div class="fact-resumen">
    <span><strong>${lista.length}</strong> factura${lista.length === 1 ? "" : "s"}</span>
    <span><strong>${pendientes}</strong> pendiente${pendientes === 1 ? "" : "s"} · ${formatPrecio(totalPend)}</span>
  </div>`;

  list.innerHTML = resumen + lista.map(factRowHTML).join("");
  lista.forEach((x) => bindFactRow(list, x));
}

function factRowHTML(x) {
  const fechaTxt = new Date(x.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `
    <div class="fact-row ${x.facturada ? "fact-hecha" : ""}" data-id="${x.id}">
      <div class="fact-num">
        <span class="fact-num-val">N° ${escAttr(x.numero)}</span>
        <span class="fact-fecha">${fechaTxt}</span>
      </div>
      <div class="fact-cliente">
        <span class="fact-nombre">${escAttr(x.nombre || "—")}</span>
        <span class="fact-datos">DNI ${escAttr(x.dni || "—")}${x.telefono ? " · Tel " + escAttr(x.telefono) : ""}</span>
      </div>
      <div class="fact-tarjeta">
        ${x.tipoTarjeta ? `<span class="fact-chip">${escAttr(x.tipoTarjeta)}</span>` : ""}
        ${x.banco ? `<span class="fact-chip fact-chip-banco">${escAttr(x.banco)}</span>` : ""}
        ${x.cuotas > 1 ? `<span class="fact-chip">${x.cuotas} cuotas</span>` : ""}
      </div>
      <div class="fact-pago"><span class="pago-tag ${clasePago(x.metodoPago)}">${escAttr(x.metodoPago || "—")}</span></div>
      <div class="fact-monto">${formatPrecio(x.monto)}</div>
      <div class="fact-acts">
        <button class="fact-check" data-act="toggle" title="${x.facturada ? "Marcar como pendiente" : "Marcar como facturada"}">
          <i class="ti ${x.facturada ? "ti-circle-check-filled" : "ti-circle"}"></i>
        </button>
        <button class="fact-del" data-act="del" title="Eliminar factura"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function bindFactRow(list, x) {
  const row = list.querySelector(`.fact-row[data-id="${x.id}"]`);
  if (!row) return;

  row.querySelector('[data-act="toggle"]').onclick = async () => {
    const nuevo = !x.facturada;
    await API.marcarFacturada(x.id, nuevo);
    x.facturada = nuevo;
    toast(nuevo ? `Factura ${x.numero} marcada como facturada` : `Factura ${x.numero} vuelve a pendiente`);
    renderFacturas(document.getElementById("view"));
  };

  row.querySelector('[data-act="del"]').onclick = () => {
    dobleConfirmacion({
      titulo: "Eliminar factura",
      mensaje1: `Vas a eliminar la factura N° ${x.numero} de ${x.nombre || "—"} por ${formatPrecio(x.monto)}.`,
      mensaje2: "Se borra de forma permanente. ¿Confirmás?",
      textoBoton: "Eliminar",
      onOk: async () => {
        await API.eliminarFactura(x.id);
        toast("Factura eliminada");
        renderFacturas(document.getElementById("view"));
      },
    });
  };
}
