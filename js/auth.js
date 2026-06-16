/* ============================================================
   AUTH — login con PIN y sesión
   ============================================================
   Sesión guardada en sessionStorage (se borra al cerrar la
   pestaña) con vencimiento adicional de 1 día.
   La validación real del PIN la hace el Apps Script.
   ============================================================ */

const Auth = {
  KEY: "cristobal_sesion",

  sesionActiva() {
    try {
      const raw = sessionStorage.getItem(this.KEY);
      if (!raw) return false;
      const { exp } = JSON.parse(raw);
      if (Date.now() > exp) {
        sessionStorage.removeItem(this.KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  abrirSesion() {
    sessionStorage.setItem(
      this.KEY,
      JSON.stringify({ exp: Date.now() + CONFIG.SESION_MS })
    );
  },

  cerrarSesion() {
    sessionStorage.removeItem(this.KEY);
  },
};

// Pantalla de login con teclado de PIN
function initLogin(onSuccess) {
  const loginEl = document.getElementById("login");
  const dotsEl = document.getElementById("pinDots").children;
  const padEl = document.getElementById("pinPad");
  const errEl = document.getElementById("loginError");
  document.getElementById("loginLogo").innerHTML = LOGO_SVG;

  let pin = "";
  let bloqueado = false;

  const render = () => {
    for (let i = 0; i < 4; i++) {
      dotsEl[i].classList.toggle("filled", i < pin.length);
    }
  };

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  teclas.forEach((t) => {
    const b = document.createElement("button");
    if (t === "") {
      b.className = "pin-key ghost";
      b.disabled = true;
    } else if (t === "del") {
      b.className = "pin-key";
      b.innerHTML = '<i class="ti ti-backspace"></i>';
      b.onclick = () => { pin = pin.slice(0, -1); errEl.textContent = ""; render(); };
    } else {
      b.className = "pin-key";
      b.textContent = t;
      b.onclick = () => agregar(t);
    }
    padEl.appendChild(b);
  });

  async function agregar(d) {
    if (bloqueado || pin.length >= 4) return;
    pin += d;
    render();
    if (pin.length === 4) {
      bloqueado = true;
      const res = await API.login(pin);
      if (res.ok) {
        Auth.abrirSesion();
        loginEl.classList.add("hidden");
        onSuccess();
      } else {
        errEl.textContent = "PIN incorrecto";
        setTimeout(() => { pin = ""; bloqueado = false; render(); }, 700);
      }
    }
  }

  // soporte teclado físico
  document.addEventListener("keydown", (e) => {
    if (loginEl.classList.contains("hidden")) return;
    if (e.key >= "0" && e.key <= "9") agregar(e.key);
    if (e.key === "Backspace") { pin = pin.slice(0, -1); errEl.textContent = ""; render(); }
  });

  render();
}
