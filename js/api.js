/* ============================================================
   API — CRISTOBAL (Supabase)
   ============================================================
   Capa de datos. Habla con Supabase vía su API REST.
   Mantiene los mismos métodos que usaba la app con Apps Script,
   así el resto del código no cambia.

   Si MODO_PRUEBA = true, usa datos de ejemplo en memoria (mock).
   ============================================================ */

const SB = {
  url: () => CONFIG.SUPABASE_URL + "/rest/v1",
  headers: () => ({
    "apikey": CONFIG.SUPABASE_KEY,
    "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
    "Content-Type": "application/json",
  }),

  // GET con filtros (querystring tipo PostgREST)
  async select(tabla, query) {
    const q = query ? "?" + query : "";
    const res = await fetch(this.url() + "/" + tabla + q, { headers: this.headers() });
    if (!res.ok) throw new Error("select " + tabla + ": " + res.status);
    return res.json();
  },
  // INSERT
  async insert(tabla, filas) {
    const res = await fetch(this.url() + "/" + tabla, {
      method: "POST",
      headers: Object.assign(this.headers(), { "Prefer": "return=representation" }),
      body: JSON.stringify(filas),
    });
    if (!res.ok) throw new Error("insert " + tabla + ": " + res.status + " " + (await res.text()));
    return res.json();
  },
  // UPDATE con filtro
  async update(tabla, query, cambios) {
    const res = await fetch(this.url() + "/" + tabla + "?" + query, {
      method: "PATCH",
      headers: Object.assign(this.headers(), { "Prefer": "return=representation" }),
      body: JSON.stringify(cambios),
    });
    if (!res.ok) throw new Error("update " + tabla + ": " + res.status + " " + (await res.text()));
    return res.json();
  },
  // DELETE con filtro
  async remove(tabla, query) {
    const res = await fetch(this.url() + "/" + tabla + "?" + query, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error("delete " + tabla + ": " + res.status);
    return true;
  },
  // UPSERT (insertar o actualizar si existe la clave única)
  async upsert(tabla, filas, onConflict) {
    const oc = onConflict ? "?on_conflict=" + onConflict : "";
    const res = await fetch(this.url() + "/" + tabla + oc, {
      method: "POST",
      headers: Object.assign(this.headers(), { "Prefer": "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(filas),
    });
    if (!res.ok) throw new Error("upsert " + tabla + ": " + res.status + " " + (await res.text()));
    return res.json();
  },

  // ---- Storage (imágenes) ----
  // sube (o reemplaza) un archivo en el bucket 'prendas'
  async subirImagen(nombre, file) {
    const url = CONFIG.SUPABASE_URL + "/storage/v1/object/prendas/" + nombre;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": CONFIG.SUPABASE_KEY,
        "Authorization": "Bearer " + CONFIG.SUPABASE_KEY,
        "Content-Type": file.type || "image/png",
        "x-upsert": "true", // reemplaza si ya existe
      },
      body: file,
    });
    if (!res.ok) throw new Error("subirImagen: " + res.status + " " + (await res.text()));
    return true;
  },
  // URL pública de una imagen del bucket
  urlImagen(nombre) {
    return CONFIG.SUPABASE_URL + "/storage/v1/object/public/prendas/" + nombre;
  },
};

/* ---------- Mapeo entre columnas de la DB y campos de la app ----------
   La DB usa snake_case (precio_venta). La app usa camelCase (precio).
   Estas funciones traducen en ambos sentidos.                          */

function stockDeDB(r) {
  return {
    id: r.id, codigo: r.codigo, categoria: r.categoria, marca: r.marca,
    talle: String(r.talle), color: r.color,
    precio: Number(r.precio_venta) || 0, costo: Number(r.precio_costo) || 0,
    cantidad: Number(r.cantidad) || 0,
  };
}
function ventaDeDB(r) {
  return {
    id: r.id, fechaHora: normalizarFechaISO(r.fecha_hora), codigo: r.codigo, marca: r.marca,
    talle: String(r.talle), color: r.color, cantidad: Number(r.cantidad) || 0,
    oferta: Number(r.oferta) || 0,
    precioBase: Number(r.precio_base) || 0, precioFinal: Number(r.precio_final) || 0,
    metodoPago: r.metodo_pago, voucherId: r.voucher_id,
    pagos: r.pagos || null,
    inicioCambio: r.inicio_cambio, limiteCambio: r.limite_cambio,
    restaurada: !!r.restaurada,
    voucherGenerado: r.voucher_generado || null,
    cambiada: !!r.cambiada,
    esCambio: !!r.es_cambio,
  };
}
// Supabase devuelve timestamps como "2026-06-22 00:55:00+00" (con espacio).
// Algunos navegadores no lo parsean como UTC. Lo pasamos a ISO válido.
function normalizarFechaISO(s) {
  if (!s) return s;
  let v = String(s).replace(" ", "T");
  // "+00" -> "+00:00" ; si no tiene zona y no termina en Z, asumir UTC
  if (/[+-]\d{2}$/.test(v)) v += ":00";
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(v)) v += "Z";
  return v;
}
function facturaDeDB(r) {
  return {
    id: r.id, numero: r.numero, fecha: normalizarFechaISO(r.fecha),
    ventaId: r.venta_id, nombre: r.nombre || "", dni: r.dni || "", telefono: r.telefono || "",
    tipoTarjeta: r.tipo_tarjeta || "", banco: r.banco || "",
    cuotas: Number(r.cuotas) || 1, monto: Number(r.monto) || 0,
    metodoPago: r.metodo_pago || "", facturada: !!r.facturada,
  };
}

function voucherDeDB(r) {
  return {
    id: r.id, tipo: r.tipo, monto: Number(r.monto) || 0, descuento: Number(r.descuento) || 0,
    nombre: r.nombre, telefono: String(r.telefono || ""),
    fecha: normalizarFechaISO(r.fecha), vencimiento: r.vencimiento, origen: r.origen,
    avisado: !!r.avisado, usado: !!r.usado,
    comprado: !!r.comprado, metodoPago: r.metodo_pago || null,
  };
}
function gastoDeDB(r) {
  return {
    id: r.id, concepto: r.concepto, monto: Number(r.monto) || 0,
    fecha: r.fecha, categoria: r.categoria, recurrente: !!r.recurrente,
  };
}

const API = {
  // ---------- LOGIN ----------
  async login(pin) {
    if (CONFIG.MODO_PRUEBA) return { ok: pin === CONFIG.PIN_PRUEBA };
    try {
      const rows = await SB.select("config", "clave=eq.PIN&select=valor");
      const real = rows.length ? String(rows[0].valor) : "1234";
      return { ok: String(pin) === real };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  // validar el código del modo privado (ver datos históricos)
  async validarCodigoPrivado(codigo) {
    if (CONFIG.MODO_PRUEBA) return { ok: codigo === "0000" };
    try {
      const rows = await SB.select("config", "clave=eq.CODIGO_PRIVADO&select=valor");
      const real = rows.length ? String(rows[0].valor) : "0000";
      return { ok: String(codigo) === real };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // lee el recargo de tarjeta desde la tabla config de Supabase y actualiza CONFIG.
  // Acepta el valor como porcentaje (25) o como fracción (0.25).
  async cargarRecargoTarjeta() {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      const rows = await SB.select("config", "clave=eq.RECARGO_TARJETA&select=valor");
      if (!rows.length) return { ok: false };
      let v = Number(rows[0].valor);
      if (isNaN(v) || v < 0) return { ok: false };
      // si viene como 25 (porcentaje), pasarlo a 0.25; si ya viene 0.25, dejarlo
      if (v > 1) v = v / 100;
      CONFIG.RECARGO_TARJETA = v;
      return { ok: true, recargo: v };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- STOCK ----------
  async getStock() {
    if (CONFIG.MODO_PRUEBA) return this._mock("getStock", {});
    try {
      const rows = await SB.select("stock", "select=*&order=codigo");
      return { ok: true, stock: rows.map(stockDeDB) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async agregarStock(items) {
    if (CONFIG.MODO_PRUEBA) return this._mock("agregarStock", { items });
    try {
      // traer stock actual para sumar cantidades a lo existente
      const actual = await SB.select("stock", "select=*");
      for (const it of items) {
        const cat = it.categoria || categoriaDeCodigo(it.codigo);
        // una fila existente coincide si: mismo código, talle, color, categoría Y mismos precios.
        // Si el precio difiere, es un lote nuevo → fila separada.
        const ex = actual.find((r) =>
          r.codigo === it.codigo &&
          String(r.talle) === String(it.talle) &&
          r.color === it.color &&
          r.categoria === cat &&
          Number(r.precio_venta) === Number(it.precio) &&
          Number(r.precio_costo) === Number(it.costo));
        if (ex) {
          await SB.update("stock", "id=eq." + ex.id,
            { cantidad: (Number(ex.cantidad) || 0) + Number(it.cantidad) });
        } else {
          await SB.insert("stock", [{
            codigo: it.codigo, categoria: cat, marca: it.marca,
            talle: it.talle, color: it.color,
            precio_venta: it.precio, precio_costo: it.costo, cantidad: it.cantidad,
          }]);
        }
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ajusta la cantidad de una fila específica por su id
  async ajustarStock(id, delta) {
    if (CONFIG.MODO_PRUEBA) return this._mock("ajustarStock", {});
    try {
      const rows = await SB.select("stock", "select=*&id=eq." + enc(id));
      if (!rows.length) return { ok: false, error: "No encontrado" };
      const r = rows[0];
      const nueva = Math.max(0, (Number(r.cantidad) || 0) + delta);
      await SB.update("stock", "id=eq." + enc(id), { cantidad: nueva });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ajusta stock por variante (codigo+talle+color) cuando no se tiene el id.
  // Para descontar: resta de las filas con stock (puede haber varios lotes).
  // Para sumar: suma a la primera fila que coincida.
  async ajustarStockPorVariante(codigo, talle, color, delta) {
    if (CONFIG.MODO_PRUEBA) return this._mock("ajustarStockPorVariante", {});
    try {
      const q = "codigo=eq." + enc(codigo) + "&talle=eq." + enc(talle) + "&color=eq." + enc(color);
      const rows = await SB.select("stock", "select=*&" + q + "&order=id");
      if (!rows.length) return { ok: false, error: "No encontrado" };
      if (delta < 0) {
        let quitar = -delta;
        for (const r of rows) {
          if (quitar <= 0) break;
          const actual = Number(r.cantidad) || 0;
          const q2 = Math.min(actual, quitar);
          if (q2 > 0) { await SB.update("stock", "id=eq." + r.id, { cantidad: actual - q2 }); quitar -= q2; }
        }
      } else {
        const r = rows[0];
        await SB.update("stock", "id=eq." + r.id, { cantidad: (Number(r.cantidad) || 0) + delta });
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // elimina una fila específica por su id
  async eliminarStock(id) {
    if (CONFIG.MODO_PRUEBA) return this._mock("eliminarStock", {});
    try {
      await SB.remove("stock", "id=eq." + enc(id));
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // actualiza precios de TODAS las filas de un código+categoría (precio del modelo)
  async actualizarPrecio(codigo, precio, costo, categoria) {
    if (CONFIG.MODO_PRUEBA) return this._mock("actualizarPrecio", {});
    try {
      let q = "codigo=eq." + enc(codigo);
      if (categoria) q += "&categoria=eq." + enc(categoria);
      await SB.update("stock", q, { precio_venta: precio, precio_costo: costo });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // edita una fila específica de stock por su id (marca, código, precios)
  async editarStockFila(id, campos) {
    if (CONFIG.MODO_PRUEBA) return this._mock("editarStockFila", {});
    try {
      const c = {};
      if (campos.codigo != null) c.codigo = campos.codigo;
      if (campos.marca != null) c.marca = campos.marca;
      if (campos.precio != null) c.precio_venta = campos.precio;
      if (campos.costo != null) c.precio_costo = campos.costo;
      if (Object.keys(c).length) await SB.update("stock", "id=eq." + enc(id), c);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // edita marca y/o código de TODAS las filas de un código+categoría
  async editarDatosCodigo(codigoViejo, categoria, nuevo) {
    if (CONFIG.MODO_PRUEBA) return this._mock("editarDatosCodigo", {});
    try {
      let q = "codigo=eq." + enc(codigoViejo);
      if (categoria) q += "&categoria=eq." + enc(categoria);
      const campos = {};
      if (nuevo.codigo != null) campos.codigo = nuevo.codigo;
      if (nuevo.marca != null) campos.marca = nuevo.marca;
      if (nuevo.precio != null) campos.precio_venta = nuevo.precio;
      if (nuevo.costo != null) campos.precio_costo = nuevo.costo;
      if (Object.keys(campos).length) await SB.update("stock", q, campos);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- VENTAS ----------
  async registrarVenta(lineas, pago, det) {
    if (CONFIG.MODO_PRUEBA) return this._mock("registrarVenta", { lineas, metodoPago: pago, detalles: det });
    try {
      det = det || {};
      const id = "V-" + Date.now();
      const metodoTxt = textoMetodo(pago);
      const limite = sumarDias(det.inicioCambio, CONFIG.DIAS_CAMBIO);

      // base de cada línea y total, para repartir proporcionalmente el pago
      const basesLinea = lineas.map((l) => l.precio * l.cantidad * (1 - (l.oferta || 0) / 100));
      const baseTotal = basesLinea.reduce((a, b) => a + b, 0);
      const totalCobrado = det.precioFinal != null ? det.precioFinal : baseTotal;

      const filas = lineas.map((l, i) => {
        const baseL = basesLinea[i];
        // proporción de esta línea sobre el total de la venta
        const prop = baseTotal > 0 ? baseL / baseTotal : (1 / lineas.length);
        // el precio final de ESTA línea es su parte proporcional de lo cobrado
        const finalLinea = totalCobrado * prop;
        // el desglose de pagos se reparte también proporcionalmente,
        // así cada línea reporta solo lo que le corresponde por método
        const partesLinea = (pago && pago.partes)
          ? pago.partes.map((p) => ({ metodo: p.metodo, monto: (Number(p.monto) || 0) * prop }))
          : null;
        return {
          id: id + "-" + i,
          fecha_hora: det.fechaVenta ? new Date(det.fechaVenta).toISOString() : new Date().toISOString(),
          codigo: l.codigo, marca: l.marca, talle: l.talle, color: l.color,
          cantidad: l.cantidad, oferta: l.oferta || 0,
          precio_base: baseL,
          precio_final: finalLinea,
          metodo_pago: metodoTxt, voucher_id: det.voucherId || null,
          pagos: partesLinea,
          inicio_cambio: det.inicioCambio || null, limite_cambio: limite, restaurada: false,
          es_cambio: !!det.esCambio,
          cambio_de: det.cambioDe || null,
        };
      });
      await SB.insert("ventas", filas);
      // descontar stock
      for (const l of lineas) await this.ajustarStockPorVariante(l.codigo, l.talle, l.color, -l.cantidad);
      return { ok: true, idVenta: id };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async getVentas() {
    if (CONFIG.MODO_PRUEBA) return this._mock("getVentas", {});
    try {
      const rows = await SB.select("ventas", "select=*&order=fecha_hora.desc");
      return { ok: true, ventas: rows.map(ventaDeDB) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async restaurarVenta(id) {
    if (CONFIG.MODO_PRUEBA) return this._mock("restaurarVenta", { id });
    try {
      const rows = await SB.select("ventas", "select=*&id=eq." + enc(id));
      if (!rows.length) return { ok: false, error: "Venta no encontrada" };
      const v = rows[0];
      // la prenda vendida vuelve al stock
      await this.ajustarStockPorVariante(v.codigo, v.talle, v.color, Number(v.cantidad) || 0);
      if (v.voucher_id) await SB.update("vouchers", "id=eq." + enc(v.voucher_id), { usado: false });
      await SB.update("ventas", "id=eq." + enc(id), { restaurada: true });

      // Si esta venta salió de un CAMBIO, hay que deshacer el cambio entero:
      // la prenda original (que había vuelto al stock) sale de nuevo (el cliente se la queda),
      // y su venta se desmarca para que pueda volver a cambiarse.
      if (v.es_cambio && v.cambio_de) {
        const orig = await SB.select("ventas", "select=*&id=eq." + enc(v.cambio_de));
        if (orig.length) {
          const o = orig[0];
          await this.ajustarStockPorVariante(o.codigo, o.talle, o.color, -(Number(o.cantidad) || 0));
          await SB.update("ventas", "id=eq." + enc(o.id), { cambiada: false });
        }
      }
      return { ok: true, deshizoCambio: !!(v.es_cambio && v.cambio_de) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async anularVenta(id) {
    if (CONFIG.MODO_PRUEBA) return this._mock("anularVenta", { id });
    try { await SB.remove("ventas", "id=eq." + enc(id)); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- INTERCAMBIO ----------
  async registrarIntercambio(p) {
    if (CONFIG.MODO_PRUEBA) return this._mock("registrarIntercambio", p);
    try {
      // fecha en que se hace el cambio (puede ser un día anterior al actual)
      const fechaCambio = p.fecha || new Date().toISOString();

      if (p.ventaDevuelta) {
        const v = p.ventaDevuelta;
        // la prenda vuelve al stock...
        await this.ajustarStockPorVariante(v.codigo, v.talle, v.color, v.cantidad || 1);
        // ...pero la venta NO se anula: la plata sigue contando el día que se cobró.
        // Solo se marca como "cambiada" para que no se pueda volver a cambiar/restaurar.
        await SB.update("ventas", "id=eq." + enc(v.id), { cambiada: true });
      }
      if (p.lineasNuevas && p.lineasNuevas.length) {
        // construir el objeto de pago con desglose (para que entre bien en la caja)
        let pago;
        if (p.pagos && p.pagos.length) {
          pago = { tipo: p.pagos.length > 1 ? "dividido" : "simple", partes: p.pagos };
          if (p.pagos.length === 1) pago.metodo = p.pagos[0].metodo;
        } else {
          pago = { metodo: p.metodoPago || "Cambio" };
        }
        // El ingreso del día del cambio es SOLO la diferencia que pagó el cliente,
        // no el precio total de la prenda nueva (lo anterior ya se cobró el día de la venta original).
        const cobradoHoy = (p.diferencia && p.diferencia > 0) ? p.diferencia : 0;
        await this.registrarVenta(p.lineasNuevas, pago, {
          fechaVenta: fechaCambio,
          inicioCambio: fechaCambio.slice(0, 10),
          precioFinal: cobradoHoy,
          esCambio: true,
          // vínculo con la venta original, para poder deshacer el cambio si se restaura
          cambioDe: p.ventaDevuelta ? p.ventaDevuelta.id : null,
        });
      }
      if (p.voucher) await this.crearVoucher(p.voucher);
      if (p.voucherUsado) await this.usarVoucher(p.voucherUsado);
      if (p.sobranteVoucher) await this.crearVoucher(p.sobranteVoucher);
      return { ok: true, idIntercambio: "I-" + Date.now() };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- VOUCHERS ----------
  // ===== SEÑAS =====
  // Trae las señas con sus prendas y pagos
  async getSenas() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, senas: [], items: [], pagos: [] };
    try {
      const [senas, items, pagos] = await Promise.all([
        SB.select("senas", "select=*&order=fecha.desc"),
        SB.select("sena_items", "select=*"),
        SB.select("sena_pagos", "select=*&order=fecha"),
      ]);
      return {
        ok: true,
        senas: senas.map((r) => ({
          id: r.id, fecha: normalizarFechaISO(r.fecha), nombre: r.nombre || "",
          telefono: r.telefono || "", total: Number(r.total) || 0, estado: r.estado || "activa",
        })),
        items: items.map((r) => ({
          id: r.id, senaId: r.sena_id, codigo: r.codigo, marca: r.marca,
          talle: String(r.talle), color: r.color, cantidad: Number(r.cantidad) || 0,
          precio: Number(r.precio) || 0, oferta: Number(r.oferta) || 0,
        })),
        pagos: pagos.map((r) => ({
          id: r.id, senaId: r.sena_id, fecha: normalizarFechaISO(r.fecha),
          monto: Number(r.monto) || 0, metodoPago: r.metodo_pago || "",
        })),
      };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // Crea la seña: guarda cabecera, prendas y el primer pago, y descuenta el stock
  async crearSena(sena, lineas, pagoInicial) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      const total = lineas.reduce((a, l) => a + l.precio * l.cantidad * (1 - (l.oferta || 0) / 100), 0);
      await SB.insert("senas", [{
        id: sena.id, fecha: sena.fecha || new Date().toISOString(),
        nombre: sena.nombre || "", telefono: sena.telefono || "",
        total, estado: "activa",
      }]);
      await SB.insert("sena_items", lineas.map((l) => ({
        sena_id: sena.id, codigo: l.codigo, marca: l.marca, talle: l.talle, color: l.color,
        cantidad: l.cantidad, precio: l.precio, oferta: l.oferta || 0,
      })));
      if (pagoInicial && pagoInicial.monto > 0) {
        await SB.insert("sena_pagos", [{
          sena_id: sena.id, fecha: sena.fecha || new Date().toISOString(),
          monto: pagoInicial.monto, metodo_pago: pagoInicial.metodoPago || "",
        }]);
      }
      // las prendas salen del stock (quedan reservadas para el cliente)
      for (const l of lineas) await this.ajustarStockPorVariante(l.codigo, l.talle, l.color, -l.cantidad);
      return { ok: true, total };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async pagarSena(senaId, monto, metodoPago, fecha) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.insert("sena_pagos", [{
        sena_id: senaId, fecha: fecha || new Date().toISOString(),
        monto: Number(monto) || 0, metodo_pago: metodoPago || "",
      }]);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async actualizarEstadoSena(senaId, estado) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.update("senas", "id=eq." + enc(senaId), { estado });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // Cancela la seña: las prendas vuelven al stock.
  // borrarPagos=true → la plata cobrada NO queda registrada (se borran los pagos).
  async cancelarSena(senaId, items, borrarPagos) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      for (const i of items) await this.ajustarStockPorVariante(i.codigo, i.talle, i.color, i.cantidad);
      if (borrarPagos) await SB.remove("sena_pagos", "sena_id=eq." + enc(senaId));
      await SB.update("senas", "id=eq." + enc(senaId), { estado: "cancelada" });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // marca una venta como que ya generó un voucher (evita duplicar)
  async marcarVoucherGenerado(idVenta, idVoucher) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.update("ventas", "id=eq." + enc(idVenta), { voucher_generado: idVoucher });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ===== FACTURAS =====
  async getFacturas() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, facturas: [] };
    try {
      const rows = await SB.select("facturas", "select=*&order=fecha.desc");
      return { ok: true, facturas: rows.map(facturaDeDB) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async crearFactura(f) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.insert("facturas", [{
        numero: f.numero, venta_id: f.ventaId || null,
        nombre: f.nombre || "", dni: f.dni || "", telefono: f.telefono || "",
        tipo_tarjeta: f.tipoTarjeta || "", banco: f.banco || "",
        cuotas: Number(f.cuotas) || 1, monto: Number(f.monto) || 0,
        metodo_pago: f.metodoPago || "", facturada: false,
        fecha: f.fecha || new Date().toISOString(),
      }]);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async editarFactura(id, f) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.update("facturas", "id=eq." + enc(id), {
        numero: f.numero || "", nombre: f.nombre || "", dni: f.dni || "",
        telefono: f.telefono || "", tipo_tarjeta: f.tipoTarjeta || "",
        banco: f.banco || "", cuotas: Number(f.cuotas) || 1, monto: Number(f.monto) || 0,
      });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // marcar una factura como ya facturada (o desmarcarla)
  async marcarFacturada(id, valor) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.update("facturas", "id=eq." + enc(id), { facturada: !!valor });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async eliminarFactura(id) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.remove("facturas", "id=eq." + enc(id));
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // siguiente número de factura (el mayor guardado + 1, con ceros a la izquierda)
  async siguienteNumeroFactura() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, numero: "0001" };
    try {
      const rows = await SB.select("facturas", "select=numero");
      let max = 0;
      rows.forEach((r) => {
        const n = parseInt(String(r.numero).replace(/\D/g, ""), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      return { ok: true, numero: String(max + 1).padStart(4, "0") };
    } catch (e) { return { ok: false, numero: "0001" }; }
  },

  // ===== BANCOS (se retroalimentan) =====
  async getBancos() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, bancos: [] };
    try {
      const rows = await SB.select("bancos", "select=nombre&order=nombre");
      return { ok: true, bancos: rows.map((r) => r.nombre) };
    } catch (e) { return { ok: false, bancos: [] }; }
  },

  // guarda un banco nuevo si no existe (para que aparezca en próximas facturas)
  async agregarBanco(nombre) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    const n = String(nombre || "").trim();
    if (!n) return { ok: false };
    try {
      await SB.insert("bancos", [{ nombre: n }]);
      return { ok: true };
    } catch (e) {
      // si ya existe (unique), no es error real
      return { ok: true };
    }
  },

  async getVouchers() {
    if (CONFIG.MODO_PRUEBA) return this._mock("getVouchers", {});
    try {
      const rows = await SB.select("vouchers", "select=*&order=fecha.desc");
      return { ok: true, vouchers: rows.map(voucherDeDB) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async crearVoucher(v) {
    if (CONFIG.MODO_PRUEBA) return this._mock("crearVoucher", { voucher: v });
    try {
      await SB.insert("vouchers", [{
        id: v.id, tipo: v.tipo,
        monto: v.tipo === "monto" ? v.monto : 0,
        descuento: v.tipo === "descuento" ? v.descuento : 0,
        nombre: v.nombre || "", telefono: v.telefono || "",
        fecha: v.fecha || new Date().toISOString(), vencimiento: v.vencimiento || null,
        origen: v.origen || "", avisado: !!v.avisado, usado: !!v.usado,
        comprado: !!v.comprado, metodo_pago: v.metodoPago || null,
      }]);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async actualizarVoucher(id, cambios) {
    if (CONFIG.MODO_PRUEBA) return this._mock("actualizarVoucher", { id, cambios });
    try {
      const c = {};
      if (cambios.usado !== undefined) c.usado = cambios.usado;
      if (cambios.avisado !== undefined) c.avisado = cambios.avisado;
      if (cambios.vencimiento !== undefined) c.vencimiento = cambios.vencimiento;
      await SB.update("vouchers", "id=eq." + enc(id), c);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async usarVoucher(id) { return this.actualizarVoucher(id, { usado: true }); },
  async deshabilitarVoucher(id) { return this.actualizarVoucher(id, { usado: true }); },
  async toggleAvisoVoucher(id, avisado) { return this.actualizarVoucher(id, { avisado: avisado }); },

  // ---------- GASTOS ----------
  async getGastos() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, gastos: [] };
    try {
      const rows = await SB.select("gastos", "select=*&order=fecha.desc");
      return { ok: true, gastos: rows.map(gastoDeDB) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async crearGasto(g) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.insert("gastos", [{
        id: g.id, concepto: g.concepto, monto: g.monto,
        fecha: g.fecha, categoria: g.categoria || "", recurrente: !!g.recurrente,
      }]);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async actualizarGasto(id, cambios) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try { await SB.update("gastos", "id=eq." + enc(id), cambios); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e) }; }
  },
  async eliminarGasto(id) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try { await SB.remove("gastos", "id=eq." + enc(id)); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- IMÁGENES ----------
  // sube la imagen de un código (file = File del input). Devuelve la URL pública.
  async subirImagenCodigo(codigo, file, categoria) {
    if (CONFIG.MODO_PRUEBA) return { ok: true, url: "" };
    try {
      const nombre = nombreImagen(codigo, categoria) + ".png";
      await SB.subirImagen(nombre, file);
      return { ok: true, url: SB.urlImagen(nombre) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  // URL pública de la imagen de un código+categoría (con cache-busting opcional)
  urlImagenCodigo(codigo, categoria) {
    return SB.urlImagen(nombreImagen(codigo, categoria) + ".png");
  },

  // ---------- CAJA ----------
  async getCaja() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, caja: CONFIG.DENOMINACIONES.map((d) => ({ denominacion: d, cantidad: 0 })) };
    try {
      const rows = await SB.select("caja", "select=*&order=denominacion");
      return { ok: true, caja: rows.map((r) => ({ denominacion: Number(r.denominacion), cantidad: Number(r.cantidad) || 0 })) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async setCajaCantidad(denominacion, cantidad) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.update("caja", "denominacion=eq." + denominacion, { cantidad: Math.max(0, cantidad) });
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- CUENTAS CORRIENTES ----------
  async getCuentas() {
    if (CONFIG.MODO_PRUEBA) return { ok: true, cuentas: [], items: [], pagos: [] };
    try {
      const [cuentas, items, pagos] = await Promise.all([
        SB.select("cuentas", "select=*&order=creada.desc"),
        SB.select("cuenta_items", "select=*&order=fecha"),
        SB.select("cuenta_pagos", "select=*&order=fecha"),
      ]);
      return {
        ok: true,
        cuentas: cuentas.map((c) => ({ id: c.id, nombre: c.nombre, apellido: c.apellido || "", telefono: String(c.telefono || ""), creada: normalizarFechaISO(c.creada) })),
        items: items.map((i) => ({ id: i.id, cuentaId: i.cuenta_id, codigo: i.codigo, marca: i.marca, talle: String(i.talle), color: i.color, cantidad: Number(i.cantidad) || 0, precio: Number(i.precio) || 0, fecha: normalizarFechaISO(i.fecha) })),
        pagos: pagos.map((p) => ({ id: p.id, cuentaId: p.cuenta_id, monto: Number(p.monto) || 0, salda: p.salda != null ? Number(p.salda) : null, metodoPago: p.metodo_pago, fecha: normalizarFechaISO(p.fecha) })),
      };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async crearCuenta(c) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.insert("cuentas", [{ id: c.id, nombre: c.nombre, apellido: c.apellido || "", telefono: c.telefono || "" }]);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async eliminarCuenta(id) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try { await SB.remove("cuentas", "id=eq." + enc(id)); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e) }; }
  },
  // agregar prendas a una cuenta (descuenta stock, suma deuda, NO es ingreso aún)
  async agregarItemsCuenta(cuentaId, lineas) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      const filas = lineas.map((l, i) => ({
        id: "CI-" + Date.now() + "-" + i, cuenta_id: cuentaId,
        codigo: l.codigo, marca: l.marca, talle: l.talle, color: l.color,
        cantidad: l.cantidad, precio: l.precio,
      }));
      await SB.insert("cuenta_items", filas);
      for (const l of lineas) await this.ajustarStockPorVariante(l.codigo, l.talle, l.color, -l.cantidad);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async quitarItemCuenta(itemId, item) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      // reponer stock al quitar la prenda de la cuenta
      if (item) await this.ajustarStockPorVariante(item.codigo, item.talle, item.color, item.cantidad);
      await SB.remove("cuenta_items", "id=eq." + enc(itemId));
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  // registrar un pago (baja deuda, ES ingreso con método de pago)
  // monto = lo cobrado al cliente (con recargo si es tarjeta); salda = cuánto baja la deuda base
  async registrarPagoCuenta(cuentaId, monto, metodoPago, salda) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      await SB.insert("cuenta_pagos", [{
        id: "CP-" + Date.now(), cuenta_id: cuentaId, monto, metodo_pago: metodoPago,
        salda: salda != null ? salda : monto,
      }]);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  // eliminar un pago (revierte: la deuda vuelve a subir)
  async eliminarPagoCuenta(pagoId) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try { await SB.remove("cuenta_pagos", "id=eq." + enc(pagoId)); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- MOCK (datos de ejemplo si MODO_PRUEBA) ----------
  _mock(action, payload) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (action === "getStock") resolve({ ok: true, stock: JSON.parse(JSON.stringify(STOCK_DEMO)) });
        else if (action === "getVentas") resolve({ ok: true, ventas: JSON.parse(JSON.stringify(VENTAS_DEMO)) });
        else if (action === "getVouchers") resolve({ ok: true, vouchers: JSON.parse(JSON.stringify(VOUCHERS_DEMO)) });
        else if (action === "registrarVenta") resolve({ ok: true, idVenta: "V-DEMO-" + Date.now() });
        else resolve({ ok: true });
      }, 150);
    });
  },
};

// codifica un valor para usarlo en un filtro de URL de PostgREST
function enc(v) { return encodeURIComponent(String(v)); }

// texto del método de pago (soporta pago simple, dividido o string)
function textoMetodo(pago) {
  if (!pago) return "";
  if (typeof pago === "string") return pago;
  if (pago.tipo === "dividido") return pago.partes.map((x) => x.metodo).join(" + ");
  return pago.metodo || "";
}

function sumarDias(fechaStr, dias) {
  const d = fechaStr ? new Date(fechaStr + "T00:00:00") : new Date();
  d.setDate(d.getDate() + dias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// ---------- Datos de ejemplo (solo se usan si MODO_PRUEBA = true) ----------
const STOCK_DEMO = [
  { codigo: "FOW0101", categoria: "Remeras", marca: "Fort Worth", talle: "M", color: "Verde", precio: 18500, costo: 9250, cantidad: 5 },
  { codigo: "FOW0201", categoria: "Buzos", marca: "Fort Worth", talle: "M", color: "Gris", precio: 42000, costo: 21000, cantidad: 6 },
];
function _fechaRel(dias) { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString(); }
function _fechaRelDate(dias) { const d = new Date(); d.setDate(d.getDate() + dias); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
function _vencEnDias(dias) { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
let VENTAS_DEMO = [
  { id: "V-D1", fechaHora: _fechaRel(-3), codigo: "FOW0101", marca: "Fort Worth", talle: "M", color: "Verde", oferta: 0, cantidad: 1, precioBase: 18500, metodoPago: "Efectivo", inicioCambio: _fechaRelDate(-3), limiteCambio: _fechaRelDate(12) },
];
let VOUCHERS_DEMO = [
  { id: "VCH-1001", tipo: "monto", fecha: _fechaRel(-31), vencimiento: _vencEnDias(4), monto: 8000, nombre: "Lucía Gómez", telefono: "2915551234", origen: "Cambio de FOW0101", avisado: false, usado: false },
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

// URL de la imagen de una prenda según su código.
// Usa Supabase Storage si está configurado; si no, cae al repo local (img/).
// nombre del archivo de imagen: {codigo}_{categoria}.png (así cada categoría tiene su foto).
// Sin categoría, cae al nombre viejo {codigo}.png (compatibilidad con imágenes ya subidas).
function nombreImagen(codigo, categoria) {
  const cod = String(codigo || "").toLowerCase();
  if (!categoria) return cod;
  // normalizar la categoría: minúsculas, sin espacios ni acentos
  const cat = String(categoria).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return cod + "_" + cat;
}

// deduce la categoría de un código buscándolo en el stock actual (para historial/cambios/cuentas,
// que no guardan la categoría). Si no lo encuentra, devuelve null (cae a imagen vieja por código).
function categoriaDeStock(codigo) {
  const f = (typeof State !== "undefined" && State.stock) ? State.stock.find((s) => s.codigo === codigo) : null;
  return f ? f.categoria : null;
}

function imgPrenda(codigo, categoria) {
  if (!codigo) return "";
  const nombre = nombreImagen(codigo, categoria);
  if (!CONFIG.MODO_PRUEBA && CONFIG.SUPABASE_URL) {
    return CONFIG.SUPABASE_URL + "/storage/v1/object/public/prendas/" + nombre + ".png";
  }
  return "img/" + nombre + ".png";
}
