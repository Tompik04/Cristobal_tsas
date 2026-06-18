/* ============================================================
   API — comunicación con Google Apps Script
   ============================================================
   En MODO_PRUEBA devuelve datos de ejemplo en memoria.
   Con APPS_SCRIPT_URL configurada, hace fetch real al Web App.
   ============================================================ */

// ---- Datos de ejemplo (reflejan la pestaña Stock del Excel) ----
const STOCK_DEMO = [
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "S", color: "Verde", precio: 18500, costo: 9250, cantidad: 3 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Verde", precio: 18500, costo: 9250, cantidad: 5 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "L", color: "Verde", precio: 18500, costo: 9250, cantidad: 0 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Negro", precio: 18500, costo: 9250, cantidad: 2 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "L", color: "Negro", precio: 18500, costo: 9250, cantidad: 4 },
  { codigo: "FOW0102", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Blanco", precio: 17000, costo: 8500, cantidad: 8 },
  { codigo: "FOW0102", categoria: "Remeras", marca: "Fort Worth", talle: "L", color: "Blanco", precio: 17000, costo: 8500, cantidad: 3 },
  { codigo: "FOW0201", categoria: "Buzos", marca: "Fort Worth", talle: "M", color: "Gris", precio: 42000, costo: 21000, cantidad: 6 },
  { codigo: "FOW0201", categoria: "Buzos", marca: "Fort Worth", talle: "L", color: "Gris", precio: 42000, costo: 21000, cantidad: 4 },
  { codigo: "KEV0601", categoria: "Jeans", marca: "Kevingston", talle: "38", color: "Azul", precio: 55000, costo: 27500, cantidad: 2 },
  { codigo: "KEV0601", categoria: "Jeans", marca: "Kevingston", talle: "40", color: "Azul", precio: 55000, costo: 27500, cantidad: 3 },
];

const API = {
  async _post(action, payload) {
    if (CONFIG.MODO_PRUEBA || !CONFIG.APPS_SCRIPT_URL) {
      return this._mock(action, payload);
    }
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload }),
    });
    return res.json();
  },

  // Validación de PIN
  async login(pin) {
    if (CONFIG.MODO_PRUEBA || !CONFIG.APPS_SCRIPT_URL) {
      return { ok: pin === CONFIG.PIN_PRUEBA };
    }
    return this._post("login", { pin });
  },

  // Trae todo el stock
  async getStock() {
    return this._post("getStock", {});
  },

  // Registra una venta (o varias líneas del carrito)
  async registrarVenta(lineas, metodoPago, detalles) {
    return this._post("registrarVenta", { lineas, metodoPago, detalles });
  },

  // Trae el historial de ventas de los últimos N días
  async getVentas() {
    return this._post("getVentas", {});
  },

  // Restaura (anula) una venta: repone stock, marca restaurada, anula vouchers usados
  async restaurarVenta(id) {
    return this._post("restaurarVenta", { id });
  },

  // Agrega prendas nuevas / suma stock (lista de pendientes)
  async agregarStock(items) {
    return this._post("agregarStock", { items });
  },

  // Ajusta el stock de una combinación en +1 / -1
  async ajustarStock(codigo, talle, color, delta) {
    return this._post("ajustarStock", { codigo, talle, color, delta });
  },

  // Elimina por completo una combinación de stock
  async eliminarStock(codigo, talle, color) {
    return this._post("eliminarStock", { codigo, talle, color });
  },

  // Actualiza el precio de todas las variantes de un código
  async actualizarPrecio(codigo, precio, costo) {
    return this._post("actualizarPrecio", { codigo, precio, costo });
  },

  // Anula (elimina) una venta del historial
  async anularVenta(id) {
    return this._post("anularVenta", { id });
  },

  // Registra un intercambio completo
  async registrarIntercambio(payload) {
    return this._post("registrarIntercambio", payload);
  },

  // Vouchers
  async getVouchers() {
    return this._post("getVouchers", {});
  },
  async crearVoucher(voucher) {
    return this._post("crearVoucher", { voucher });
  },
  // marca avisado / usado / deshabilitado
  async actualizarVoucher(id, cambios) {
    return this._post("actualizarVoucher", { id, cambios });
  },
  async toggleAvisoVoucher(id, avisado) {
    return this._post("toggleAvisoVoucher", { id, avisado });
  },
  async deshabilitarVoucher(id) {
    return this._post("deshabilitarVoucher", { id });
  },
  async usarVoucher(id) {
    return this._post("usarVoucher", { id });
  },

  // ---- MOCK en memoria ----
  _mock(action, payload) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (action === "getStock") {
          resolve({ ok: true, stock: JSON.parse(JSON.stringify(STOCK_DEMO)) });
        } else if (action === "getVentas") {
          resolve({ ok: true, ventas: JSON.parse(JSON.stringify(VENTAS_DEMO)) });
        } else if (action === "restaurarVenta") {
          const v = VENTAS_DEMO.find((x) => x.id === payload.id);
          if (v) v.restaurada = true;
          resolve({ ok: true });
        } else if (action === "registrarVenta") {
          const id = "V-DEMO-" + Date.now();
          const det = payload.detalles || {};
          const pago = payload.metodoPago;
          const metodoTxt = pago && pago.tipo === "dividido"
            ? pago.partes.map((p) => p.metodo).join(" + ")
            : (pago && pago.metodo) || (typeof pago === "string" ? pago : "");
          payload.lineas.forEach((l, i) => {
            const limite = sumarDias(det.inicioCambio, CONFIG.DIAS_CAMBIO);
            VENTAS_DEMO.unshift({
              id: id + "-" + i,
              fechaHora: det.fechaVenta || new Date().toISOString(),
              codigo: l.codigo, marca: l.marca, talle: l.talle, color: l.color,
              oferta: l.oferta, cantidad: l.cantidad,
              precioBase: l.precio * l.cantidad * (1 - (l.oferta || 0) / 100),
              metodoPago: metodoTxt,
              inicioCambio: det.inicioCambio,
              limiteCambio: limite,
            });
          });
          resolve({ ok: true, idVenta: id });
        } else if (action === "anularVenta") {
          VENTAS_DEMO = VENTAS_DEMO.filter((v) => v.id !== payload.id);
          resolve({ ok: true });
        } else if (action === "getVouchers") {
          resolve({ ok: true, vouchers: JSON.parse(JSON.stringify(VOUCHERS_DEMO)) });
        } else if (action === "crearVoucher") {
          VOUCHERS_DEMO.unshift(payload.voucher);
          resolve({ ok: true });
        } else if (action === "actualizarVoucher") {
          const v = VOUCHERS_DEMO.find((x) => x.id === payload.id);
          if (v) Object.assign(v, payload.cambios);
          resolve({ ok: true });
        } else if (action === "toggleAvisoVoucher") {
          const v = VOUCHERS_DEMO.find((x) => x.id === payload.id);
          if (v) v.avisado = payload.avisado;
          resolve({ ok: true });
        } else if (action === "deshabilitarVoucher") {
          const v = VOUCHERS_DEMO.find((x) => x.id === payload.id);
          if (v) v.usado = true;
          resolve({ ok: true });
        } else if (action === "usarVoucher") {
          const v = VOUCHERS_DEMO.find((x) => x.id === payload.id);
          if (v) v.usado = true;
          resolve({ ok: true });
        } else if (action === "registrarIntercambio") {
          // quitar la venta devuelta del historial de cambios
          if (payload.ventaDevuelta) {
            VENTAS_DEMO = VENTAS_DEMO.filter((v) => v.id !== payload.ventaDevuelta.id);
          }
          // si generó voucher, guardarlo
          if (payload.voucher) VOUCHERS_DEMO.unshift(payload.voucher);
          resolve({ ok: true, idIntercambio: "I-" + Date.now() });
        } else {
          resolve({ ok: true });
        }
      }, 200);
    });
  },
};

// suma N días a una fecha yyyy-mm-dd → devuelve yyyy-mm-dd
function sumarDias(fechaStr, dias) {
  const d = fechaStr ? new Date(fechaStr + "T00:00:00") : new Date();
  d.setDate(d.getDate() + dias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Historial de ventas de ejemplo (algunas dentro de ventana de cambio, otras fuera)
function _fechaRel(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}
function _fechaRelDate(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
let VENTAS_DEMO = [
  // vendida hace 3 días, ventana abierta (cambiable normal)
  { id: "V-D1", fechaHora: _fechaRel(-3), codigo: "FOW0101", marca: "Fort Worth", talle: "M", color: "Verde",
    oferta: 0, cantidad: 1, precioBase: 18500, metodoPago: "Efectivo",
    inicioCambio: _fechaRelDate(-3), limiteCambio: _fechaRelDate(12) },
  // vendida hace 20 días, ventana ya cerrada (vencido, ahora igual cambiable)
  { id: "V-D2", fechaHora: _fechaRel(-20), codigo: "KEV0601", marca: "Kevingston", talle: "40", color: "Azul",
    oferta: 10, cantidad: 1, precioBase: 49500, metodoPago: "Crédito",
    inicioCambio: _fechaRelDate(-20), limiteCambio: _fechaRelDate(-5) },
  // vendida hace 1 día con inicio de cambio futuro (ventana todavía no abierta)
  { id: "V-D3", fechaHora: _fechaRel(-1), codigo: "FOW0201", marca: "Fort Worth", talle: "L", color: "Gris",
    oferta: 0, cantidad: 1, precioBase: 42000, metodoPago: "Débito",
    inicioCambio: _fechaRelDate(10), limiteCambio: _fechaRelDate(25) },
  // ventas más antiguas (dentro de 2 meses) para ver el historial extendido
  { id: "V-D4", fechaHora: _fechaRel(-38), codigo: "FOW0102", marca: "Fort Worth", talle: "M", color: "Blanco",
    oferta: 0, cantidad: 1, precioBase: 17000, metodoPago: "Efectivo",
    inicioCambio: _fechaRelDate(-38), limiteCambio: _fechaRelDate(-23) },
  { id: "V-D5", fechaHora: _fechaRel(-52), codigo: "FOW0101", marca: "Fort Worth", talle: "L", color: "Negro",
    oferta: 15, cantidad: 2, precioBase: 31450, metodoPago: "Transferencia",
    inicioCambio: _fechaRelDate(-52), limiteCambio: _fechaRelDate(-37) },
];

// Vouchers de ejemplo (varios estados para ver las alarmas)
function _vencEnDias(dias) {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
let VOUCHERS_DEMO = [
  // vence en 4 días, no avisado → alarma ROJA
  { id: "VCH-1001", tipo: "monto", fecha: _fechaRel(-31), vencimiento: _vencEnDias(4), monto: 8000,
    nombre: "Lucía Gómez", telefono: "2915551234", origen: "Cambio de FOW0101", avisado: false, usado: false },
  // vence en 5 días, ya avisado → alarma AMARILLA
  { id: "VCH-1002", tipo: "descuento", fecha: _fechaRel(-30), vencimiento: _vencEnDias(5), descuento: 15,
    nombre: "Martín Ruiz", telefono: "2914449876", origen: "Promo", avisado: true, usado: false },
  // vigente lejos del vencimiento, sin alarma
  { id: "VCH-1003", tipo: "monto", fecha: _fechaRel(-5), vencimiento: _vencEnDias(30), monto: 12000,
    nombre: "Sofía Paz", telefono: "2913338765", origen: "Cambio de KEV0601", avisado: false, usado: false },
  // ya usado
  { id: "VCH-1004", tipo: "monto", fecha: _fechaRel(-40), vencimiento: _vencEnDias(-2), monto: 5000,
    nombre: "Diego Sosa", telefono: "2912227654", origen: "Cambio de FOW0201", avisado: true, usado: true },
];

// Helpers de dominio
function categoriaDeCodigo(codigo) {
  const num = codigo.substring(3, 5);
  const cat = CATEGORIAS.find((c) => c.num === num);
  return cat ? cat.nombre : "—";
}

function formatPrecio(n) {
  return "$" + Number(n).toLocaleString("es-AR");
}
