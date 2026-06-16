/* ============================================================
   VISTA HOME
   ============================================================ */

function renderHome(root) {
  root.innerHTML = `
    <div class="home">
      <p class="home-brand" id="homeBrand">CRISTOBAL</p>
      <div class="home-grid-wrap">
        <div class="home-logo">${LOGO_SVG}</div>
        <div class="home-grid">
          <a class="home-btn" data-go="ventas"><span>VENTAS</span></a>
          <a class="home-btn" data-go="stock"><span>STOCK</span></a>
          <a class="home-btn" data-go="cambios"><span>CAMBIOS</span></a>
          <a class="home-btn" data-go="vouchers"><span>VOUCHERS</span></a>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll("[data-go]").forEach((b) => {
    b.onclick = () => Router.ir(b.dataset.go);
  });

  // Ajuste responsive del título: ocupa ~95% del ancho
  const brand = document.getElementById("homeBrand");
  const SPACING_EM = 0.35;
  function fit() {
    const available = brand.parentElement.clientWidth * 0.95;
    let size = 10;
    brand.style.letterSpacing = SPACING_EM + "em";
    brand.style.fontSize = size + "px";
    while (size < 400) {
      size++;
      brand.style.fontSize = size + "px";
      if (brand.scrollWidth + SPACING_EM * size >= available) break;
    }
    brand.style.fontSize = size - 2 + "px";
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  else fit();
  // re-ajustar al cambiar tamaño mientras estemos en la home
  const onResize = () => { if (State.vistaActual === "home") fit(); };
  window.addEventListener("resize", onResize);
  fit();
}
