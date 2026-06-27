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
    codigo: r.codigo, categoria: r.categoria, marca: r.marca,
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
        const ex = actual.find((r) =>
          r.codigo === it.codigo && String(r.talle) === String(it.talle) && r.color === it.color);
        if (ex) {
          await SB.update("stock", "id=eq." + ex.id,
            { cantidad: (Number(ex.cantidad) || 0) + Number(it.cantidad),
              precio_venta: it.precio, precio_costo: it.costo });
        } else {
          await SB.insert("stock", [{
            codigo: it.codigo, categoria: categoriaDeCodigo(it.codigo), marca: it.marca,
            talle: it.talle, color: it.color,
            precio_venta: it.precio, precio_costo: it.costo, cantidad: it.cantidad,
          }]);
        }
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async ajustarStock(codigo, talle, color, delta) {
    if (CONFIG.MODO_PRUEBA) return this._mock("ajustarStock", {});
    try {
      const q = "codigo=eq." + enc(codigo) + "&talle=eq." + enc(talle) + "&color=eq." + enc(color);
      const rows = await SB.select("stock", "select=*&" + q);
      if (!rows.length) return { ok: false, error: "No encontrado" };
      let restante = delta;
      if (delta < 0) {
        let quitar = -delta;
        for (const r of rows) {
          if (quitar <= 0) break;
          const actual = Number(r.cantidad) || 0;
          const q2 = Math.min(actual, quitar);
          await SB.update("stock", "id=eq." + r.id, { cantidad: actual - q2 });
          quitar -= q2;
        }
      } else {
        const r = rows[0];
        await SB.update("stock", "id=eq." + r.id, { cantidad: (Number(r.cantidad) || 0) + delta });
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async eliminarStock(codigo, talle, color) {
    if (CONFIG.MODO_PRUEBA) return this._mock("eliminarStock", {});
    try {
      const q = "codigo=eq." + enc(codigo) + "&talle=eq." + enc(talle) + "&color=eq." + enc(color);
      await SB.remove("stock", q);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  async actualizarPrecio(codigo, precio, costo) {
    if (CONFIG.MODO_PRUEBA) return this._mock("actualizarPrecio", {});
    try {
      await SB.update("stock", "codigo=eq." + enc(codigo),
        { precio_venta: precio, precio_costo: costo });
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
      const filas = lineas.map((l, i) => ({
        id: id + "-" + i,
        fecha_hora: det.fechaVenta ? new Date(det.fechaVenta).toISOString() : new Date().toISOString(),
        codigo: l.codigo, marca: l.marca, talle: l.talle, color: l.color,
        cantidad: l.cantidad, oferta: l.oferta || 0,
        precio_base: l.precio * l.cantidad * (1 - (l.oferta || 0) / 100),
        precio_final: det.precioFinal || null,
        metodo_pago: metodoTxt, voucher_id: det.voucherId || null,
        // el desglose de pagos va completo en la primera línea (representa el total de la venta)
        pagos: (i === 0 && pago && pago.partes) ? pago.partes : null,
        inicio_cambio: det.inicioCambio || null, limite_cambio: limite, restaurada: false,
      }));
      await SB.insert("ventas", filas);
      // descontar stock
      for (const l of lineas) await this.ajustarStock(l.codigo, l.talle, l.color, -l.cantidad);
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
      await this.ajustarStock(v.codigo, v.talle, v.color, Number(v.cantidad) || 0);
      if (v.voucher_id) await SB.update("vouchers", "id=eq." + enc(v.voucher_id), { usado: false });
      await SB.update("ventas", "id=eq." + enc(id), { restaurada: true });
      return { ok: true };
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
      if (p.ventaDevuelta) {
        const v = p.ventaDevuelta;
        await this.ajustarStock(v.codigo, v.talle, v.color, v.cantidad || 1);
        await this.restaurarVenta(v.id);
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
        await this.registrarVenta(p.lineasNuevas, pago,
          { fechaVenta: new Date().toISOString(), inicioCambio: hoyISO() });
      }
      if (p.voucher) await this.crearVoucher(p.voucher);
      if (p.voucherUsado) await this.usarVoucher(p.voucherUsado);
      if (p.sobranteVoucher) await this.crearVoucher(p.sobranteVoucher);
      return { ok: true, idIntercambio: "I-" + Date.now() };
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  // ---------- VOUCHERS ----------
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
  async subirImagenCodigo(codigo, file) {
    if (CONFIG.MODO_PRUEBA) return { ok: true, url: "" };
    try {
      const nombre = codigo.toLowerCase() + ".png";
      await SB.subirImagen(nombre, file);
      return { ok: true, url: SB.urlImagen(nombre) };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  // URL pública de la imagen de un código (con cache-busting opcional)
  urlImagenCodigo(codigo) {
    return SB.urlImagen(codigo.toLowerCase() + ".png");
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
      for (const l of lineas) await this.ajustarStock(l.codigo, l.talle, l.color, -l.cantidad);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e) }; }
  },
  async quitarItemCuenta(itemId, item) {
    if (CONFIG.MODO_PRUEBA) return { ok: true };
    try {
      // reponer stock al quitar la prenda de la cuenta
      if (item) await this.ajustarStock(item.codigo, item.talle, item.color, item.cantidad);
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
function imgPrenda(codigo) {
  if (!codigo) return "";
  if (!CONFIG.MODO_PRUEBA && CONFIG.SUPABASE_URL) {
    return CONFIG.SUPABASE_URL + "/storage/v1/object/public/prendas/" + String(codigo).toLowerCase() + ".png";
  }
  return "img/" + String(codigo).toLowerCase() + ".png";
}
