/* ============================================================
   CONFIGURACIÓN — CRISTOBAL
   ============================================================
   Pegá acá la URL del Web App de Google Apps Script
   (la que termina en /exec). Mientras esté vacía, la app
   funciona con datos de ejemplo (MODO_PRUEBA).
   ============================================================ */

const CONFIG = {
  // ===== SUPABASE =====
  SUPABASE_URL: "https://gsqvjfxybiyozgvfhdbn.supabase.co",
  SUPABASE_KEY: "sb_publishable_7XQzlfzQq4MLmnKekugNyg_veY8RXxV",

  // 1) (legado Apps Script — ya no se usa con Supabase)
  APPS_SCRIPT_URL: "",

  // 2) Con Supabase configurado, poné MODO_PRUEBA en false.
  MODO_PRUEBA: false,

  // PIN solo para MODO_PRUEBA (en producción lo valida el Apps Script)
  PIN_PRUEBA: "1234",

  // Duración de sesión: 1 día (en milisegundos)
  SESION_MS: 24 * 60 * 60 * 1000,

  // Ventana de cambios en días (inicio + N días)
  DIAS_CAMBIO: 15,

  // Recargo por pago con tarjeta (débito/crédito)
  RECARGO_TARJETA: 0.20,

  // Días hacia atrás que se muestran en la sección Cambios (2 meses)
  DIAS_HISTORIAL_CAMBIOS: 60,

  // Vencimiento por defecto de un voucher (días)
  DIAS_VENCIMIENTO_VOUCHER: 35,

  // Días antes del vencimiento en que se dispara la alarma del voucher
  DIAS_ALARMA_VOUCHER: 7,
};

// Medios de pago que aplican recargo
const MEDIOS_CON_RECARGO = ["Débito", "Crédito"];

// % de ganancia a partir de venta y costo
function gananciaPct(venta, costo) {
  if (!costo) return 0;
  return Math.round(((venta - costo) / costo) * 100);
}

// días que faltan para que venza un voucher (puede ser negativo si ya venció)
function diasParaVencer(vencimientoISO) {
  if (!vencimientoISO) return Infinity;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(vencimientoISO + "T00:00:00");
  return Math.round((v - hoy) / (1000 * 60 * 60 * 24));
}

// estado de alarma de un voucher: "roja" | "amarilla" | "ninguna" | "vencido" | "usado"
function estadoAlarmaVoucher(v) {
  if (v.usado) return "usado";
  const dias = diasParaVencer(v.vencimiento);
  if (dias < 0) return "vencido";
  if (dias <= CONFIG.DIAS_ALARMA_VOUCHER) return v.avisado ? "amarilla" : "roja";
  return "ninguna";
}

// días que faltan para que venza un voucher (yyyy-mm-dd)
function diasParaVencer(vencimiento) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(vencimiento + "T00:00:00");
  return Math.ceil((v - hoy) / (1000 * 60 * 60 * 24));
}

// estado de alarma de un voucher: "roja" | "amarilla" | null
function estadoAlarmaVoucher(v) {
  if (v.usado) return null;
  const dias = diasParaVencer(v.vencimiento);
  if (dias < 0) return null; // ya vencido
  if (dias <= CONFIG.DIAS_ALARMA_VOUCHER) {
    return v.avisado ? "amarilla" : "roja";
  }
  return null;
}

// Logo SVG reutilizable en toda la app
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 337 333" preserveAspectRatio="xMidYMid meet">
<path fill="#DCCAAC" d="M323.95,14.51c-14.66-16.6-40.05-17.2-55.48-1.76-11.03,11.03-13.88,27.15-8.52,40.81.61,1.56.24,3.33-.94,4.51l-14.47,14.47c-1.65,1.65-4.33,1.65-5.98,0l-15.76-15.76c-.97-.97-1.41-2.35-1.17-3.71,1.53-8.48-1.29-17.62-8.48-23.78-9.53-8.19-23.96-8.04-33.34.33-10.98,9.79-11.35,26.64-1.09,36.91,6.1,6.1,14.56,8.45,22.45,7.01,1.35-.24,2.72.2,3.69,1.17l15.76,15.77c1.65,1.65,1.65,4.33,0,5.98l-42.46,42.45c-29.48,29.49-60.3,57.63-92.34,84.31l-13.44,11.19c-9.91,8.25-25.14,4.22-29.34-7.95-11.17-32.16-5.3-67.44,18.38-91.12,9.06-9.05,19.83-15.51,31.46-19.41,18.41-6.15,38.99-5.88,58.49.63q8.92,2.98,2.15-3.51l-25.14-25.12q-7.16-6.71-16.38-5.1c-1.24.22-2.45.58-3.65.97-.46.15-.92.27-1.38.41-.16.06-.31.09-.45.13-22.79,6.82-44.25,19.23-62.24,37.22-.43.42-.88.85-1.28,1.28-.36.34-.7.69-1.04,1.04-7.18,7.18-13.26,15.04-18.24,23.36-5.1,8.04-9.34,16.47-12.71,25.17-1.1,2.76-2.12,5.56-3.01,8.4-.09.25-.15.51-.24.76-8.88,29.81-3.39,64.35,15.86,93.44,4.65,7.03,10.13,13.75,16.38,20,6.24,6.24,12.93,11.7,19.93,16.33,30.55,20.23,67.13,25.3,97.92,14.48,20.03-5.25,38.98-15.71,54.67-31.4,17.75-17.75,28.79-39.64,33.16-62.55.04-.1.04-.19.06-.31.15-.73.28-1.49.42-2.25.1-.67.21-1.37.33-2.07.64-4.37.89-8.8.82-13.2v-.07q-.16-7.28-5.27-12.41l-20.11-20.09q-6.49-6.79-3.48,2.13c6.61,19.5,6.77,40.13.64,58.55-3.89,11.64-10.35,22.39-19.41,31.45-12.01,12.01-27,19.44-43.07,22.36-15.65,2.89-32.33,1.51-48.23-4.04-12.13-4.22-16.11-19.44-7.89-29.3l10.64-12.75c26.69-32.06,54.84-62.89,84.34-92.38l43.09-43.1c1.65-1.65,4.33-1.65,5.98,0l15.72,15.72c.97.97,1.41,2.36,1.17,3.71-1.54,8.5,1.3,17.63,8.48,23.79,3.97,3.39,8.76,5.36,13.69,5.88,6.95.78,14.19-1.31,19.66-6.21,10.98-9.8,11.34-26.66,1.07-36.91-6.11-6.11-14.56-8.45-22.46-7.02-1.34.24-2.72-.21-3.68-1.17l-15.73-15.73c-1.65-1.65-1.65-4.33,0-5.98l14.47-14.47c1.18-1.18,2.95-1.56,4.5-.95,14.21,5.6,31.11,2.29,42.17-9.91,12.86-14.2,13.01-36.26.33-50.64ZM298.13,55.63c-11.09,1.82-20.54-7.65-18.72-18.74,1.1-6.71,6.52-12.13,13.23-13.23,11.09-1.82,20.56,7.63,18.74,18.72-1.1,6.72-6.52,12.14-13.25,13.25Z"/>
</svg>`;

// Categorías (orden = número de categoría en el código)
const CATEGORIAS = [
  { num: "01", nombre: "Remeras M/Corta" },
  { num: "02", nombre: "Buzos y Camperas" },
  { num: "03", nombre: "Chaquetas" },
  { num: "04", nombre: "Camisa M/Corta" },
  { num: "05", nombre: "Abrigos" },
  { num: "06", nombre: "Jeans" },
  { num: "07", nombre: "Cargos" },
  { num: "08", nombre: "Babucha" },
  { num: "09", nombre: "Shorts" },
  { num: "10", nombre: "Mayas" },
  { num: "11", nombre: "Musculosas" },
  { num: "12", nombre: "Sweater" },
  { num: "13", nombre: "Chombas" },
  { num: "14", nombre: "Chalecos" },
  { num: "15", nombre: "Camisacos" },
  { num: "16", nombre: "Poleras-Remeras M/Larga" },
  { num: "17", nombre: "Camisa M/Larga" },
  { num: "18", nombre: "Pantalón Gabardina" },
  { num: "19", nombre: "Pantalón de Lino" },
  { num: "20", nombre: "Accesorios" },
];

// Agrupación de categorías en cuadrantes 2x2 para la grilla de ventas/stock
const GRUPOS_CATEGORIA = [
  {
    titulo: "Remeras y similares",
    categorias: ["Remeras M/Corta", "Poleras-Remeras M/Larga", "Camisa M/Corta", "Camisa M/Larga", "Chombas", "Musculosas"],
  },
  {
    titulo: "Abrigo",
    categorias: ["Buzos y Camperas", "Chaquetas", "Abrigos", "Sweater", "Chalecos", "Camisacos"],
  },
  {
    titulo: "Pantalones",
    categorias: ["Jeans", "Cargos", "Pantalón de Lino", "Pantalón Gabardina", "Babucha", "Shorts"],
  },
  {
    titulo: "Otros",
    categorias: ["Accesorios", "Mayas"],
  },
];

const OFERTAS = [0, 5, 10, 15, 20];
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito"];

// Categorías de gastos del local
const CATEGORIAS_GASTO = ["Alquiler", "Luz", "Internet", "Monotributo", "Alarma", "Seguro", "Sueldos", "Mercadería", "Mantenimiento", "Envíos", "Materiales", "Otros"];

// Checklist de control mensual: obligatorios (no deberían faltar) y opcionales
const GASTOS_OBLIGATORIOS = ["Alquiler", "Luz", "Internet", "Monotributo", "Alarma", "Seguro"];
const GASTOS_OPCIONALES = ["Sueldos", "Mercadería", "Mantenimiento", "Envíos", "Materiales", "Otros"];

// Denominaciones de billetes que maneja la Caja
const DENOMINACIONES = [100, 200, 500, 1000, 2000, 10000];

// ¿es válido dividir el pago entre estos dos métodos?
// Permite repetir tarjetas (Crédito/Débito), pero no Efectivo+Efectivo ni Transferencia+Transferencia.
function combinacionPagoValida(m1, m2) {
  if (m1 !== m2) return true;
  return MEDIOS_CON_RECARGO.includes(m1); // solo tarjetas pueden repetirse
}

// clase CSS para colorear un método de pago (para resaltarlo visualmente)
function clasePago(metodo) {
  const m = (metodo || "").toLowerCase();
  if (m.includes("efectivo")) return "pago-efectivo";
  if (m.includes("crédito") || m.includes("credito")) return "pago-credito";
  if (m.includes("débito") || m.includes("debito")) return "pago-debito";
  if (m.includes("transferencia")) return "pago-transfer";
  return "";
}
// envuelve un texto de método (puede ser "Efectivo + Crédito") en spans coloreados
function metodoColoreado(metodo) {
  if (!metodo) return "";
  return String(metodo).split("+").map((parte) => {
    const t = parte.trim();
    return `<span class="pago-tag ${clasePago(t)}">${t}</span>`;
  }).join(" + ");
}

// Listas fijas para cargar stock
const TALLES = ["S", "M", "L", "XL", "XXL", "3XL", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54"];
const COLORES = ["Negro", "Blanco", "Gris", "Beige", "Azul", "Marrón", "Celeste", "Kaki", "Verde", "Rojo", "Amarillo", "Rosa", "Naranja", "Violeta", "Mostaza"];

// Talles según categoría (provisorio, se ajusta más adelante)
const TALLES_LETRA = ["S", "M", "L", "XL", "XXL", "3XL", "50", "52", "54"];
const TALLES_NUMERO = ["36", "38", "40", "42", "44", "46", "48", "50"];
const TALLES_POR_CATEGORIA = {
  "Remeras M/Corta": TALLES_LETRA,
  "Buzos y Camperas": TALLES_LETRA,
  Chaquetas: TALLES_LETRA,
  "Camisa M/Corta": TALLES_LETRA,
  Abrigos: TALLES_LETRA,
  Mayas: TALLES_LETRA,
  Musculosas: TALLES_LETRA,
  Sweater: TALLES_LETRA,
  Chombas: TALLES_LETRA,
  Chalecos: TALLES_LETRA,
  Camisacos: TALLES_LETRA,
  "Poleras-Remeras M/Larga": TALLES_LETRA,
  "Camisa M/Larga": TALLES_LETRA,
  Accesorios: TALLES_LETRA,
  Jeans: TALLES_NUMERO,
  Cargos: TALLES_NUMERO,
  Babucha: TALLES_NUMERO,
  Shorts: TALLES_NUMERO,
  "Pantalón Gabardina": TALLES_NUMERO,
  "Pantalón de Lino": TALLES_NUMERO,
};
function tallesDeCategoria(cat) {
  return TALLES_POR_CATEGORIA[cat] || TALLES_LETRA;
}

// número (2 dígitos) asignado a una categoría por su nombre
function numDeCategoria(nombre) {
  const c = CATEGORIAS.find((x) => x.nombre === nombre);
  return c ? c.num : "—";
}

// arma el HTML de la grilla de categorías en 4 cuadrantes 2x2.
// Si incluirTodos=true, agrega la tarjeta "Todos" en el último cuadrante.
function gridCategoriasHTML(incluirTodos) {
  const tarjeta = (nombre) => {
    const num = numDeCategoria(nombre);
    return `
      <div class="cat cat-mini" data-cat="${nombre}">
        <span class="cat-num">${num}</span>
        <div class="cat-img"><img src="img/cat_${num}.png" alt="${nombre}" onerror="this.style.opacity=0.25"></div>
        <span class="cat-name">${nombre.toUpperCase()}</span>
      </div>`;
  };
  const cuadrantes = GRUPOS_CATEGORIA.map((g, i) => {
    let cards = g.categorias.map(tarjeta).join("");
    // en el último cuadrante ("Otros"), agregar la tarjeta "Todos"
    if (incluirTodos && i === GRUPOS_CATEGORIA.length - 1) {
      cards += `
        <div class="cat cat-mini cat-todos" data-cat="__TODOS__">
          <div class="cat-img"><i class="ti ti-layout-grid"></i></div>
          <span class="cat-name">TODOS</span>
        </div>`;
    }
    return `
      <div class="cat-cuadrante">
        <p class="cuadrante-titulo">${g.titulo}</p>
        <div class="cat-mini-grid">${cards}</div>
      </div>`;
  }).join("");
  return `<div class="cuadrantes-2x2">${cuadrantes}</div>`;
}

// Marcas conocidas (prefijo del código → nombre)
const MARCAS = [
  { prefijo: "FOW", nombre: "Fort Worth" },
  { prefijo: "KEV", nombre: "Kevingston" },
];

// Escapa un valor para insertarlo de forma segura en un atributo HTML (comillas, <, >, &)
function escAttr(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
