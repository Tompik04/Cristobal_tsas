# CRISTOBAL — Contexto del proyecto

SPA de gestión para Cristóbal, tienda de ropa masculina.
Respondeme siempre en español rioplatense, informal y directo.

---

## Stack

- **Frontend:** JavaScript vanilla (sin framework, sin build step). HTML + CSS + JS plano.
- **Backend / DB:** Supabase (Postgres + Auth + Storage).
- **Hosting:** GitHub Pages. Lo que se mergea a `main` se publica.
- **Sin bundler ni transpilador:** el código que escribís es el que corre en el navegador.
- **Sin ES modules.** No hay un solo `import`/`export` en el repo: son `<script>` clásicos listados en `index.html`, todos compartiendo el scope global. Si escribís un `import`, rompe.
  - El orden de carga importa: `config.js` → `api.js` → `auth.js` → `filters.js` → `views/*.js` → `app.js`. Cada archivo puede usar lo que definieron los anteriores.
  - `app.js` va último, así que todo lo suyo (`toast`, `Router`, `State`, `cerrarModal`) existe recién en runtime, no al cargar. Por eso la capa de datos (`api.js`) **no puede llamar a `toast()` en tiempo de carga**: el feedback al usuario lo dispara `app.js` o la vista, después de chequear el `{ ok, error }` que devuelve `API`.
  - Archivo nuevo = agregarlo a mano al `index.html`, en la posición que corresponda.

## Estructura del repo

```
/index.html
/css/
  styles.css
/img/                # imágenes de categorías y prendas (fallback si no está Supabase Storage)
/js/
  config.js          # CONFIG (URL/key de Supabase, constantes de negocio: categorías, talles, colores, medios de pago)
  api.js             # capa de datos: SB (fetch crudo a la REST API de Supabase) + API (todos los métodos de negocio)
  auth.js            # login con PIN + sesión (sessionStorage)
  app.js             # router (Router.ir), estado global (State), carritos múltiples (Carritos), header
  filters.js         # barra de filtros reutilizable (usada por varias vistas)
  views/
    home.js
    ventas.js        # categorías → lista de productos → venta única / carrito
    stock.js         # categorías → cargar nuevo stock + gestionar existente
    cambios.js       # ventas de los últimos 30 días con su estado de cambio
    vouchers.js       # alta, alarmas de vencimiento, filtros
    historial.js      # ventas del último mes, con restaurar compra
    facturas.js       # ventas con débito/crédito/transferencia pendientes de facturar
    gastos.js         # gastos del local + resumen mensual
    caja.js            # conteo manual de billetes en efectivo
    cuentas.js         # cuenta corriente + señas de clientes
    informes.js        # analítica de ventas (sección privada, requiere código)
```

No hay `js/supabase.js`: el cliente centralizado es el objeto `SB` dentro de `js/api.js` (fetch directo a la REST API de PostgREST, con `apikey`/`Authorization` desde `CONFIG.SUPABASE_KEY`). No se usa la librería `@supabase/supabase-js`.

## Módulos principales

- **Productos / stock** — alta de stock por variante (código + talle + color + marca), con precio de venta y costo; agrupa lotes iguales y suma cantidades (`js/views/stock.js`, tabla `stock`).
- **Ventas** — venta por categoría → lista de productos → carrito (o venta única), con pago simple o dividido entre métodos y recargo por tarjeta configurable (`js/views/ventas.js`, tabla `ventas`).
- **Facturas** — emisión y listado de facturas para ventas con débito, crédito o transferencia.
- **Señas** — pagos parciales / anticipos sobre una venta; reserva stock y arma cuenta corriente asociada.
- **Carritos múltiples** — varios carritos abiertos en simultáneo (para atender más de un cliente a la vez), persistidos en `localStorage`.
- **Cambios** — intercambio de una prenda vendida por otra dentro de la ventana de `DIAS_CAMBIO` días; la venta original se marca "cambiada" en vez de anularse (`js/views/cambios.js`).
- **Vouchers** — saldo a favor o descuento generado por un cambio, con vencimiento y alarma (roja/amarilla) antes de vencer (`js/views/vouchers.js`).
- **Cuenta corriente** — deuda de un cliente por prendas que se llevó sin pagar del todo, con pagos parciales (`js/views/cuentas.js`).
- **Caja** — conteo manual de billetes en efectivo por denominación (`js/views/caja.js`).
- **Gastos** — gastos fijos y variables del local, con checklist mensual de obligatorios/opcionales (`js/views/gastos.js`).
- **Informes** — analítica de ventas y ganancias, sección privada detrás de un código (`js/views/informes.js`).

---

## Esquema de Supabase

Proyecto: `Cristobal_tsas` (ref `gsqvjfxybiyozgvfhdbn`, región `sa-east-1`, Postgres 17). Verificado contra la base real.

La app mapea columnas `snake_case` de la DB a campos `camelCase` en JS en `js/api.js` (funciones `*DeDB`). **No hay `venta_items` ni `productos`**: cada línea de una venta es una fila propia de `ventas` (no hay tabla de cabecera), y el catálogo es `stock`.

Todos los montos son `numeric` (pesos completos, no centavos). `fecha_hora`/`fecha`/`creada` son `timestamptz`; `inicio_cambio`, `limite_cambio`, `vencimiento` y `gastos.fecha` son `date` (sin hora).

| Tabla | PK | Columnas | Notas |
|---|---|---|---|
| `stock` | `id` (bigint identity) | `codigo, categoria, marca, talle, color, precio_venta, precio_costo, cantidad` | Una fila por variante+lote. `talle` es **text** (por eso el código hace `String(r.talle)`). Sin unique sobre la variante → ver "Cosas que se rompen seguido". |
| `stock_ingresos` | `id` (uuid) | `fecha, cantidad, codigo, categoria` | Log de entradas, solo para contar prendas ingresadas por mes en Informes. |
| `ventas` | `id` (text, ej. `V-1718…-0`) | `fecha_hora, codigo, marca, talle, color, cantidad, oferta, precio_base, precio_producto, precio_final, precio_costo, metodo_pago, pagos (jsonb), voucher_id, voucher_generado, inicio_cambio, limite_cambio, restaurada, cambiada, es_cambio, cambio_de, es_sena, sena_id` | `precio_costo` = costo al momento de vender (el margen histórico no cambia si después cambia el costo en stock). `cambio_de` puede tener **varios ids separados por coma**. Prefijos de id: `V-` venta, `VS-` venta generada por seña. |
| `vouchers` | `id` (text) | `tipo, monto, descuento, nombre, telefono, fecha, vencimiento, origen, avisado, usado, comprado, metodo_pago, pagado` | `tipo`: `"monto"` o `"descuento"`. `pagado` = lo que el cliente pagó realmente si `comprado=true`. |
| `facturas` | `id` (uuid) | `numero, venta_id, nombre, dni, telefono, tipo_tarjeta, banco, cuotas, monto, metodo_pago, facturada, fecha` | |
| `bancos` | `id` (uuid) | `nombre` **UNIQUE** | Se autocompleta desde las facturas; el insert duplicado se traga el error a propósito. |
| `senas` | `id` (text) | `fecha, nombre, telefono, total, estado` | `estado`: `activa` (default) / `cancelada`. |
| `sena_items` | `id` (bigint seq) | `sena_id → senas.id`, `codigo, marca, talle, color, cantidad, precio, oferta` | FK real. Índice en `sena_id`. No guarda costo. |
| `sena_pagos` | `id` (bigint seq) | `sena_id → senas.id`, `fecha, monto, metodo_pago` | FK real. Índice en `sena_id`. |
| `cuentas` | `id` (text) | `nombre, apellido, telefono, creada` | |
| `cuenta_items` | `id` (text) | `cuenta_id → cuentas.id`, `codigo, marca, talle, color, cantidad, precio, fecha` | FK real. |
| `cuenta_pagos` | `id` (text) | `cuenta_id → cuentas.id`, `monto, salda, metodo_pago, fecha` | FK real. `monto` = lo cobrado (con recargo si es tarjeta), `salda` = cuánto baja la deuda base. |
| `gastos` | `id` (text) | `concepto, monto, fecha, categoria, recurrente` | |
| `caja` | `denominacion` (int) | `cantidad` | Una fila por denominación (`DENOMINACIONES` en `config.js`). Se actualiza, nunca se insertan filas nuevas. |
| `config` | `clave` (text) | `valor` (text) | Ver abajo. |

**Relaciones:** las únicas FKs declaradas son `sena_items`/`sena_pagos` → `senas` y `cuenta_items`/`cuenta_pagos` → `cuentas` (todas por `cuenta_id`/`sena_id`). El resto de los vínculos son **texto suelto sin FK ni índice**: `ventas.sena_id`, `ventas.voucher_id`, `ventas.cambio_de`, `ventas.voucher_generado` y `facturas.venta_id`. Nada garantiza que apunten a una fila existente — al borrar hay que limpiar a mano.

**Tabla `config`** (claves reales en la base): `PIN`, `CODIGO_PRIVADO`, `RecargoTarjeta`, `DiasCambio`, `DiasVencimientoVoucher`, `DiasAlarmaVoucher`, `DiasHistorialCambios`, `DiasHistorialVentas`.
Ojo: **el código solo lee `PIN`, `CODIGO_PRIVADO` y `RECARGO_TARJETA`** (en mayúsculas con guión bajo), y esa última clave **no existe** con ese nombre — ver "Cosas que se rompen seguido". Las claves `Dias*` no las lee nadie: la app usa las constantes hardcodeadas de `js/config.js`.

**Storage:** un solo bucket, `prendas`, **público**. Las imágenes se suben como `{codigo}_{categoria}.png` (minúsculas, sin acentos ni espacios) con `x-upsert: true`. Nombre viejo `{codigo}.png` sigue funcionando por compatibilidad.

**RLS:** está **habilitado en las 15 tablas**, pero todas las políticas son `FOR ALL` con `USING (true)` y `WITH CHECK (true)` para el rol `anon` o `public`. O sea: RLS prendido pero **completamente abierto**, no filtra nada. Como la app es 100% front-end y la key publishable está hardcodeada en `js/config.js` (que se publica en GitHub Pages), cualquiera que abra el sitio puede leer, modificar y borrar toda la base desde la consola del navegador — incluido el `PIN` y el `CODIGO_PRIVADO` de la tabla `config`. El login por PIN es una barrera de UI, no de seguridad.

No hay migraciones versionadas (`supabase_migrations` vacío): todo cambio de esquema se hizo a mano en el dashboard y no queda registro en el repo.

<!-- Pendiente de decisión tuya (no es algo que se arregle escribiendo doc):
     si esto va a seguir siendo una app pública sin auth, al menos las columnas
     sensibles (config.PIN, config.CODIGO_PRIVADO, costos y márgenes) deberían
     dejar de ser legibles con la key anónima. -->

**Advisor de seguridad de Supabase:** marca que la función `public.rls_auto_enable()` es `SECURITY DEFINER` y puede ejecutarla `anon` vía `/rest/v1/rpc/rls_auto_enable`. No la llama nadie desde el front. [Doc](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

---

## Convenciones de código

- Nombres de variables y funciones en **español** (`calcularTotal`, `productoSeleccionado`), igual que el resto del código.
- Nada de dependencias nuevas por CDN sin consultarme antes.
- Toda llamada a Supabase pasa por el objeto `SB` y los métodos de `API` en `js/api.js` (no hay librería `supabase-js`, es fetch directo a la REST API de PostgREST). No instanciar clientes sueltos ni pegarle a la REST API desde una vista.
- Manejo de errores: cada método de `API` devuelve `{ ok, error }` (nunca tira una excepción hacia la vista) — siempre chequear `res.ok` antes de usar el resultado y mostrar feedback al usuario (`toast(...)`), nunca fallar en silencio.
- Los montos se guardan como **decimal** (pesos ARS completos, ej. `18500`, no centavos) y se formatean con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` o el helper `formatPrecio()` de `js/api.js`.
- Fechas: los timestamps (`fecha_hora`) se guardan en UTC y se muestran en hora local de Argentina vía `fechaLocalISO()`/`mesLocalDe()` en `js/config.js`. Las fechas sin hora (ej. `inicio_cambio`, fecha de un gasto) ya están en formato local `yyyy-mm-dd` y NO deben pasar por esas funciones (se correrían un día).

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
5. **Preguntá antes de hacer el cambio, no después.** Una vez que las dudas están resueltas y el cambio está verificado, commiteá y pusheá a `main` sin pedir una segunda confirmación. El mensaje de commit tiene que decir qué cambia, porque se publica en producción automáticamente.
6. **El commit cubre el código, no la base.** Un `git revert` deshace cualquier cambio de este repo, pero Supabase queda afuera: datos y esquema no están versionados acá. Antes de borrar o modificar filas en producción, guardá un backup de lo que vas a tocar (ej. un `SELECT` con las filas exactas) y mostrámelo — eso sí necesita confirmación explícita, siempre.

## Cosas que se rompen seguido

Síntomas reportados (sin diagnosticar todavía):

- Al filtrar por color o talle en prendas para poder ver la cantidad, aparecen algunos litados con otro talle o color y no el que se quiere filtrar
- Variacion de disponibles en stock, entre subida de stock y ventas de las prendas a veces deberia aparecer 1 prenda y salen 2, o no deberia haber y sale 1 disponible. (Podria deberse a error al stockear, pero vale la pena revisar)
- Muestra en historial de cambios o ventas, cambios realizados sin mostrar bien los detalles de prendas salientes y prendas entrantes
- Muestra en historial de vouchers y demas realizados sin descripcion ni detalle
- Espaciado de items en las diferentes tarjetas, no tienen una buena disposicion y no se ve bien, no se aprovecha todo el espacio

### Confirmado en la base (2026-08-18)

**1. Filas duplicadas en `stock` — explica la variación de disponibles.**
`stock` no tiene ningún índice único sobre la variante: la única restricción es la PK `id`. Nada impide dos filas idénticas. Hoy hay **9 variantes con 2 filas cada una**, iguales en *todos* los campos (código, talle, color, categoría, marca, precio_venta, precio_costo) — no son lotes distintos. Ejemplos:

| codigo | talle | color | ids | cantidades |
|---|---|---|---|---|
| `MBE0605` | 44 | Celeste | 821, 901 | 1 + 1 = 2 |
| `BBR0211` | XL | Negro | 840, 863 | 0 + 1 = 1 |

Por qué el número baila: `consolidarStock()` ([js/app.js:473](js/app.js:473)) suma las filas duplicadas **al leer**, así que la UI muestra el total combinado; pero `ajustarStockPorVariante()` ([js/api.js:304](js/api.js:304)) descuenta recorriendo las filas de a una, y `agregarStock()` ([js/api.js:244](js/api.js:244)) busca una fila que matchee variante **y ambos precios** para sumarle. Según cuál fila quede en cero, el disponible que ves y el que hay realmente se separan. Los commits recientes (`fIX DUPLICADOS`, `Fix duplicado v2`, `v3`) atacaron el síntoma en el front; la causa de raíz es que la base los permite.

**2. `RECARGO_TARJETA` nunca se lee de la base — el recargo configurable no funciona.**
`cargarRecargoTarjeta()` ([js/api.js:191](js/api.js:191)) consulta `clave=eq.RECARGO_TARJETA`, pero en `config` la clave se llama **`RecargoTarjeta`**. Verificado: 0 filas con el nombre que busca el código, 1 con el que existe. PostgREST compara texto sensible a mayúsculas, así que nunca matchea, la función devuelve `{ok:false}` y `iniciarApp()` ([js/app.js:463](js/app.js:463)) ignora el resultado sin avisar. Consecuencia: **siempre se usa el 0.25 hardcodeado de [js/config.js:30](js/config.js:30)**, y cambiar el valor en el dashboard de Supabase no tiene ningún efecto. El recargo se aplica en ventas, cambios y cuenta corriente.

Las otras claves de `config` (`DiasCambio`, `DiasVencimientoVoucher`, `DiasAlarmaVoucher`, `DiasHistorialCambios`, `DiasHistorialVentas`) directamente no las lee nadie: son filas muertas y la app usa las constantes de `js/config.js`.

**3. Vínculos sin FK.** `facturas.venta_id`, `ventas.voucher_id`, `ventas.sena_id` y `ventas.cambio_de` son texto sin foreign key. Si se borra la fila apuntada quedan referencias colgadas y las vistas que las resuelven muestran el registro sin detalle — probablemente relacionado con los síntomas de historial de cambios y de vouchers "sin descripción ni detalle".

## Comandos

```bash
# Servidor local (elegí uno)
python3 -m http.server 8000
# o
npx serve .
```

No hay build, migraciones ni scripts de deploy: es HTML/CSS/JS estático servido tal cual por GitHub Pages. "Deploy" es mergear a `main` (`git push`) y GitHub Pages publica automáticamente. Los cambios de esquema en Supabase se hacen a mano desde el dashboard (no están versionados en el repo).
