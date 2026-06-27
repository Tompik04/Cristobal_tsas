/* ============================================================
   VISTA HOME
   ============================================================ */

function renderHome(root) {
  root.innerHTML = `
    <div class="home home-simple">
      <p class="home-brand" id="homeBrand">CRISTOBAL</p>
    </div>
  `;

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
  const onResize = () => { if (State.vistaActual === "home") fit(); };
  window.addEventListener("resize", onResize);
  fit();
}
