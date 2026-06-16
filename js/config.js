/* ============================================================
   CONFIGURACIÓN — CRISTOBAL
   ============================================================
   Pegá acá la URL del Web App de Google Apps Script
   (la que termina en /exec). Mientras esté vacía, la app
   funciona con datos de ejemplo (MODO_PRUEBA).
   ============================================================ */

const CONFIG = {
  // 1) Pegá tu URL del Apps Script acá ↓
  APPS_SCRIPT_URL: "",

  // 2) Mientras no haya URL, usa datos de ejemplo y un PIN local.
  //    Cuando pegues la URL arriba, poné MODO_PRUEBA en false.
  MODO_PRUEBA: true,

  // PIN solo para MODO_PRUEBA (en producción lo valida el Apps Script)
  PIN_PRUEBA: "1234",

  // Duración de sesión: 1 día (en milisegundos)
  SESION_MS: 24 * 60 * 60 * 1000,

  // Ventana de cambios en días (inicio + N días)
  DIAS_CAMBIO: 15,
};

// Logo SVG reutilizable en toda la app
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 604" preserveAspectRatio="xMidYMid meet">
<g transform="translate(0,604) scale(0.1,-0.1)" fill="#DCCAAC" stroke="none">
<path d="M5195 5923 c-16 -2 -57 -11 -90 -19 -200 -51 -388 -237 -449 -442 -36 -125 -29 -286 18 -403 l23 -57 -216 -216 -215 -217 -253 253 -253 253 0 62 c0 128 -75 245 -193 302 -82 39 -148 47 -228 26 -113 -28 -193 -96 -241 -202 -34 -73 -32 -198 4 -275 32 -68 96 -136 159 -166 52 -25 152 -46 183 -38 18 4 67 -39 276 -249 l254 -254 -74 -78 c-41 -43 -672 -674 -1403 -1403 l-1327 -1325 -93 0 c-80 0 -99 4 -147 27 -50 24 -61 37 -116 125 -292 468 -376 967 -237 1407 70 223 196 420 387 611 250 248 507 393 809 456 133 28 335 30 459 6 160 -32 317 -93 462 -181 76 -47 79 -48 97 -30 18 19 10 26 -296 309 -173 160 -322 292 -331 293 -42 10 -310 -68 -482 -140 -325 -135 -594 -316 -875 -588 -312 -302 -507 -598 -621 -940 -216 -649 -84 -1297 382 -1880 105 -131 326 -350 449 -443 314 -238 627 -366 995 -406 516 -57 1073 128 1558 515 107 85 319 296 393 390 286 364 422 789 387 1212 -5 67 -14 139 -18 160 -7 29 -71 112 -287 368 -342 405 -321 382 -339 364 -13 -13 -5 -31 65 -140 213 -333 323 -642 336 -940 17 -389 -127 -732 -451 -1068 -431 -447 -995 -589 -1576 -396 -195 65 -447 200 -527 281 -54 56 -83 133 -83 221 0 136 -120 5 1408 1534 l1387 1388 257 -257 c244 -244 256 -258 251 -288 -7 -45 23 -151 58 -207 127 -198 425 -207 564 -18 50 68 67 122 67 213 1 67 -4 86 -31 141 -60 122 -175 196 -304 196 l-62 0 -255 255 -255 255 215 215 216 216 47 -21 c55 -24 180 -50 243 -50 80 0 197 30 283 71 155 76 272 213 328 384 21 67 26 98 26 190 -1 186 -55 316 -188 451 -65 66 -96 89 -165 122 -47 22 -107 45 -133 51 -56 13 -188 22 -232 14z m188 -293 c119 -37 206 -129 242 -254 47 -161 -37 -341 -193 -418 -60 -30 -75 -33 -157 -33 -76 0 -99 4 -147 27 -79 37 -142 98 -181 177 -29 59 -32 74 -32 156 0 76 4 98 26 146 82 175 261 255 442 199z"/>
</g></svg>`;

// Categorías (orden = número de categoría en el código)
const CATEGORIAS = [
  { num: "01", nombre: "Remeras" },
  { num: "02", nombre: "Buzos" },
  { num: "03", nombre: "Camperas" },
  { num: "04", nombre: "Camisas" },
  { num: "05", nombre: "Abrigos" },
  { num: "06", nombre: "Jeans" },
  { num: "07", nombre: "Cargos" },
  { num: "08", nombre: "Babucha" },
  { num: "09", nombre: "Shorts" },
  { num: "10", nombre: "Mayas" },
];

const OFERTAS = [0, 5, 10, 15, 20];
const MEDIOS_PAGO = ["Efectivo", "Débito", "Crédito", "Transferencia"];

// Listas fijas para cargar stock
const TALLES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];
const COLORES = ["Negro", "Blanco", "Gris", "Verde", "Azul", "Rojo", "Beige", "Marrón"];

// Talles según categoría (provisorio, se ajusta más adelante)
const TALLES_LETRA = ["XS", "S", "M", "L", "XL", "XXL"];
const TALLES_NUMERO = ["36", "38", "40", "42", "44", "46"];
const TALLES_POR_CATEGORIA = {
  Remeras: TALLES_LETRA,
  Buzos: TALLES_LETRA,
  Camperas: TALLES_LETRA,
  Camisas: TALLES_LETRA,
  Abrigos: TALLES_LETRA,
  Mayas: TALLES_LETRA,
  Jeans: TALLES_NUMERO,
  Cargos: TALLES_NUMERO,
  Babucha: TALLES_NUMERO,
  Shorts: TALLES_NUMERO,
};
function tallesDeCategoria(cat) {
  return TALLES_POR_CATEGORIA[cat] || TALLES_LETRA;
}

// Marcas conocidas (prefijo del código → nombre)
const MARCAS = [
  { prefijo: "FOW", nombre: "Fort Worth" },
  { prefijo: "KEV", nombre: "Kevingston" },
];
