/* ============================================================
   API — comunicación con Google Apps Script
   ============================================================
   En MODO_PRUEBA devuelve datos de ejemplo en memoria.
   Con APPS_SCRIPT_URL configurada, hace fetch real al Web App.
   ============================================================ */

// ---- Datos de ejemplo (reflejan la pestaña Stock del Excel) ----
const STOCK_DEMO = [
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "S", color: "Verde", precio: 18500, cantidad: 3 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Verde", precio: 18500, cantidad: 5 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "L", color: "Verde", precio: 18500, cantidad: 0 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Negro", precio: 18500, cantidad: 2 },
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "L", color: "Negro", precio: 18500, cantidad: 4 },
  { codigo: "FOW0102", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Blanco", precio: 17000, cantidad: 8 },
  { codigo: "FOW0102", categoria: "Remeras", marca: "Fort Worth", talle: "L", color: "Blanco", precio: 17000, cantidad: 3 },
  { codigo: "FOW0201", categoria: "Buzos", marca: "Fort Worth", talle: "M", color: "Gris", precio: 42000, cantidad: 6 },
  { codigo: "FOW0201", categoria: "Buzos", marca: "Fort Worth", talle: "L", color: "Gris", precio: 42000, cantidad: 4 },
  { codigo: "KEV0601", categoria: "Jeans", marca: "Kevingston", talle: "38", color: "Azul", precio: 55000, cantidad: 2 },
  { codigo: "KEV0601", categoria: "Jeans", marca: "Kevingston", talle: "40", color: "Azul", precio: 55000, cantidad: 3 },
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
  async registrarVenta(lineas, metodoPago) {
    return this._post("registrarVenta", { lineas, metodoPago });
  },

  // ---- MOCK en memoria ----
  _mock(action, payload) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (action === "getStock") {
          resolve({ ok: true, stock: JSON.parse(JSON.stringify(STOCK_DEMO)) });
        } else if (action === "registrarVenta") {
          resolve({ ok: true, idVenta: "V-DEMO-" + Date.now() });
        } else {
          resolve({ ok: true });
        }
      }, 200);
    });
  },
};

// Helpers de dominio
function categoriaDeCodigo(codigo) {
  const num = codigo.substring(3, 5);
  const cat = CATEGORIAS.find((c) => c.num === num);
  return cat ? cat.nombre : "—";
}

function formatPrecio(n) {
  return "$" + Number(n).toLocaleString("es-AR");
}
