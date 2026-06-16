# CRISTOBAL — Sistema de gestión

App de gestión interna para el local (ventas, stock, cambios, vouchers).
SPA en JavaScript puro, pensada para GitHub Pages + Google Apps Script.

## Estructura

```
index.html          → arranca la app
css/styles.css       → paleta (Evergreen/Pale Oak), Cinzel, estilos
js/
  config.js          → CONFIG: pegá acá la URL del Apps Script
  api.js             → comunicación con Sheets (+ datos de ejemplo)
  auth.js            → login con PIN + sesión
  app.js             → router, estado global, header
  views/
    home.js          → home (4 botones)
    ventas.js        → categorías → lista → venta única / carrito
    stock.js         → (en construcción)
    cambios.js       → (en construcción)
    vouchers.js      → (en construcción)
img/                 → imágenes de prendas y categorías
```

## Estado actual

Funciona en **MODO_PRUEBA**: usa datos de ejemplo y el PIN `1234`.
Probá: login → home → Ventas → Remeras → venta única o carrito.

## Para conectar a Google Sheets

1. En `js/config.js`, pegá la URL del Web App en `APPS_SCRIPT_URL`.
2. Poné `MODO_PRUEBA: false`.
3. El Apps Script debe responder a las acciones: `login`, `getStock`, `registrarVenta`.
   (El código del Apps Script se arma en el siguiente paso.)

## Imágenes

- Categorías: `img/cat_01.png` … `img/cat_10.png` (01=Remeras … 10=Mayas)
- Prendas: `img/<codigo>.png` en minúsculas, ej. `img/fow0101.png`

## Login

PIN de 4 dígitos. La sesión dura hasta cerrar la pestaña o 1 día.
La validación real del PIN la hace el Apps Script (server-side), no el navegador.
