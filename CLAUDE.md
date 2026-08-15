# CRISTOBAL — Contexto del proyecto

SPA de gestión para Cristóbal, tienda de ropa masculina.
Respondeme siempre en español rioplatense, informal y directo.

---

## Stack

- **Frontend:** JavaScript vanilla (sin framework, sin build step). HTML + CSS + JS plano.
- **Backend / DB:** Supabase (Postgres + Auth + Storage).
- **Hosting:** GitHub Pages. Lo que se mergea a `main` se publica.
- **Sin bundler ni transpilador:** el código que escribís es el que corre en el navegador. Usá ES modules nativos e `import` con rutas relativas y extensión `.js` explícita.

## Estructura del repo

<!-- TODO: completar con la estructura real. Ejemplo: -->
```
/index.html
/js/
  supabase.js      # cliente e inicialización
  auth.js
  productos.js
  ventas.js
  facturas.js
  senas.js
  carritos.js
/css/
/assets/
```

## Módulos principales

- **Productos / stock** — <!-- TODO: describir en 1 línea -->
- **Ventas** — <!-- TODO -->
- **Facturas** — emisión y listado de facturas.
- **Señas** — pagos parciales / anticipos sobre una venta.
- **Carritos múltiples** — varios carritos abiertos en simultáneo (para atender más de un cliente a la vez).

---

## Esquema de Supabase

<!-- TODO: pegar acá las tablas, columnas clave y relaciones.
     Es lo que más impacto tiene: sin esto Claude adivina nombres de columnas. -->

| Tabla | Columnas clave | Notas |
|---|---|---|
| `productos` | | |
| `ventas` | | |
| `venta_items` | | |
| `facturas` | | |
| `senas` | | |

**RLS:** <!-- TODO: qué políticas hay activas y con qué rol se consulta desde el front -->

---

## Convenciones de código

- Nombres de variables y funciones en **español** (`calcularTotal`, `productoSeleccionado`), igual que el resto del código.
- Nada de dependencias nuevas por CDN sin consultarme antes.
- Toda llamada a Supabase pasa por el cliente centralizado en `js/supabase.js`. No instanciar clientes sueltos.
- Manejo de errores: siempre chequear `{ data, error }` de Supabase y mostrar feedback al usuario, nunca fallar en silencio.
- Los montos se guardan en <!-- TODO: enteros en centavos / decimal --> y se formatean con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- Fechas en UTC en la base, se muestran en hora local de Argentina.

## Identidad visual

Respetá siempre estos tokens. No inventes colores ni tipografías.

```css
--evergreen:   #041F1E;
--coffee-bean: #0F060B;
--pale-oak:    #DCCAAC;
--platinum:    #E9E9ED;
--ash-brown:   #6A574E;
```

- **Display / títulos:** Cinzel SemiBold
- **Cuerpo:** Jost
- **Isotipo:** monograma ancla + C, **siempre rotado 45°**

---

## Cómo trabajar en este repo

1. Antes de tocar código, leé los archivos involucrados. No asumas la implementación.
2. Cambios chicos y enfocados. Un problema por vez.
3. Después de cada cambio funcional, verificá el flujo completo afectado (ej.: si tocás señas, revisá venta → seña → factura).
4. No refactorices archivos que no te pedí tocar.
5. Antes de pushear a `main`, avisame qué cambia — se publica en producción automáticamente.

## Cosas que se rompen seguido

<!-- TODO: ir agregando acá cada bug recurrente que aparezca.
     Esta sección es la que más valor gana con el tiempo. -->

- Al filtrar por colo o talle en prendas para poder ver la cantidad, aparecen algunos litados con otro talle o color y no el que se quiere filtrar
- 

## Comandos

```bash
# Servidor local (elegí uno)
python3 -m http.server 8000
# o
npx serve .
```

<!-- TODO: agregar comandos de deploy, migraciones o scripts si los hay -->
