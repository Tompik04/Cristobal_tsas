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

  // ---- MOCK en memoria ----
  _mock(action, payload) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (action === "getStock") {
          resolve({ ok: true, stock: JSON.parse(JSON.stringify(STOCK_DEMO)) });
        } else if (action === "getVentas") {
          resolve({ ok: true, ventas: JSON.parse(JSON.stringify(VENTAS_DEMO)) });
        } else if (action === "registrarVenta") {
          const id = "V-DEMO-" + Date.now();
          // guardar en el historial demo para que aparezca en Cambios
          const det = payload.detalles || {};
          payload.lineas.forEach((l, i) => {
            const limite = sumarDias(det.inicioCambio, CONFIG.DIAS_CAMBIO);
            VENTAS_DEMO.unshift({
              id: id + "-" + i,
              fechaHora: det.fechaVenta || new Date().toISOString(),
              codigo: l.codigo, marca: l.marca, talle: l.talle, color: l.color,
              oferta: l.oferta, cantidad: l.cantidad,
              precioBase: l.precio * l.cantidad * (1 - l.oferta / 100),
              metodoPago: payload.metodoPago,
              inicioCambio: det.inicioCambio,
              limiteCambio: limite,
            });
          });
          resolve({ ok: true, idVenta: id });
        } else if (action === "anularVenta") {
          VENTAS_DEMO = VENTAS_DEMO.filter((v) => v.id !== payload.id);
          resolve({ ok: true });
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
  // vendida hace 3 días, inicio cambio ese día → ventana abierta (cambiable)
  { id: "V-D1", fechaHora: _fechaRel(-3), codigo: "FOW0101", marca: "Fort Worth", talle: "M", color: "Verde",
    oferta: 0, cantidad: 1, precioBase: 18500, metodoPago: "Efectivo",
    inicioCambio: _fechaRelDate(-3), limiteCambio: _fechaRelDate(12) },
  // vendida hace 20 días, ventana ya cerrada (no cambiable)
  { id: "V-D2", fechaHora: _fechaRel(-20), codigo: "KEV0601", marca: "Kevingston", talle: "40", color: "Azul",
    oferta: 10, cantidad: 1, precioBase: 49500, metodoPago: "Crédito",
    inicioCambio: _fechaRelDate(-20), limiteCambio: _fechaRelDate(-5) },
  // vendida hoy con inicio de cambio futuro (ventana todavía no abierta → no cambiable aún)
  { id: "V-D3", fechaHora: _fechaRel(-1), codigo: "FOW0201", marca: "Fort Worth", talle: "L", color: "Gris",
    oferta: 0, cantidad: 1, precioBase: 42000, metodoPago: "Débito",
    inicioCambio: _fechaRelDate(10), limiteCambio: _fechaRelDate(25) },
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
