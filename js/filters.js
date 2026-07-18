/* ============================================================
   FILTROS — barra de búsqueda reutilizable
   ============================================================
   Crea una barra con un buscador de texto + selects opcionales.
   onChange(valores) se llama cada vez que cambia algún filtro.
   ============================================================ */

function crearBarraFiltros(config) {
  // config: { campos: [{id,label,tipo,opciones}], onChange }
  const wrap = document.createElement("div");
  wrap.className = "filter-bar";

  // buscador de texto general
  const search = document.createElement("div");
  search.className = "filter-search";
  search.innerHTML = `<i class="ti ti-search"></i><input type="text" placeholder="${config.placeholder || "Buscar..."}" data-filter="q">`;
  wrap.appendChild(search);

  // selects / inputs adicionales
  (config.campos || []).forEach((c) => {
    if (c.tipo === "select") {
      const sel = document.createElement("select");
      sel.className = "filter-field";
      sel.dataset.filter = c.id;
      if (c.porDefecto) {
        // el campo arranca con un valor elegido y NO tiene opción vacía "Todo"
        sel.innerHTML = c.opciones
          .map((o) => `<option value="${o}"${o === c.porDefecto ? " selected" : ""}>${c.label}: ${o}</option>`)
          .join("");
      } else {
        // la opción vacía significa "sin filtrar" → se muestra como "Todo"
        sel.innerHTML = `<option value="">${c.label}: Todo</option>` +
          c.opciones.map((o) => `<option value="${o}">${o}</option>`).join("");
      }
      wrap.appendChild(sel);
    } else if (c.tipo === "date") {
      const inp = document.createElement("input");
      inp.type = "date";
      inp.className = "filter-field date-f";
      inp.dataset.filter = c.id;
      inp.title = c.label;
      if (c.min) inp.min = c.min;
      if (c.max) inp.max = c.max;
      wrap.appendChild(inp);
    } else if (c.tipo === "number") {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.className = "filter-field";
      inp.style.width = "100px";
      inp.placeholder = c.label;
      inp.dataset.filter = c.id;
      wrap.appendChild(inp);
    }
  });

  // botón limpiar
  const clear = document.createElement("button");
  clear.className = "filter-clear";
  clear.innerHTML = `<i class="ti ti-x"></i> Limpiar`;
  wrap.appendChild(clear);

  function valores() {
    const v = {};
    wrap.querySelectorAll("[data-filter]").forEach((el) => {
      v[el.dataset.filter] = el.value.trim();
    });
    return v;
  }
  function emit() { config.onChange(valores()); }

  wrap.querySelectorAll("[data-filter]").forEach((el) => {
    const ev = el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
    el.addEventListener(ev, emit);
  });
  clear.onclick = () => {
    wrap.querySelectorAll("[data-filter]").forEach((el) => {
      // si el campo tiene un valor por defecto, volver a ese en vez de vaciar
      const campo = (config.campos || []).find((c) => c.id === el.dataset.filter);
      el.value = (campo && campo.porDefecto) ? campo.porDefecto : "";
    });
    emit();
  };

  return wrap;
}

// helper de coincidencia de texto (sin acentos, case-insensitive)
function normaliza(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function coincideTexto(item, q, campos) {
  if (!q) return true;
  const nq = normaliza(q);
  return campos.some((c) => normaliza(item[c]).includes(nq));
}
