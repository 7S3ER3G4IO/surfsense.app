/* ==========================================================================
   APP.JS - VERSION PROD RENDER (OPTIMISÉE & CORRIGÉE)
   ========================================================================== */

// --- 1. LISTE DES SPOTS (DATABASE) ---
const rawSpots = [
  { name: "Hossegor - La Gravière", region: "Landes", country: "France", coords: [43.6656, -1.4436], facing: 275, type: "beachbreak" },
  { name: "Hossegor - La Nord", region: "Landes", country: "France", coords: [43.6742, -1.4457], facing: 275, type: "beachbreak" },
  { name: "Capbreton - Le Santocha", region: "Landes", country: "France", coords: [43.6429, -1.4498], facing: 270, type: "beachbreak" },
  { name: "Seignosse - Les Estagnots", region: "Landes", country: "France", coords: [43.6921, -1.441], facing: 280, type: "beachbreak" },
  { name: "Seignosse - Le Penon", region: "Landes", country: "France", coords: [43.6992, -1.4441], facing: 280, type: "beachbreak" },
  { name: "Vieux-Boucau", region: "Landes", country: "France", coords: [43.7921, -1.4094], facing: 275, type: "beachbreak" },
  { name: "Ondres", region: "Landes", country: "France", coords: [43.56, -1.4662], facing: 270, type: "beachbreak" },
  { name: "Anglet - Les Cavaliers", region: "Pays basque", country: "France", coords: [43.523, -1.5368], facing: 290, type: "beachbreak" },
  { name: "Biarritz - Côte des Basques", region: "Pays basque", country: "France", coords: [43.4835, -1.5656], facing: 250, type: "beachbreak" },
  { name: "Guéthary - Parlementia", region: "Pays basque", country: "France", coords: [43.4221, -1.6097], facing: 300, type: "reef" },
  { name: "Saint-Jean-de-Luz - Lafitenia", region: "Pays basque", country: "France", coords: [43.4061, -1.6386], facing: 320, type: "pointbreak" },
  { name: "Hendaye", region: "Pays basque", country: "France", coords: [43.37, -1.789], facing: 0, type: "beachbreak" },
  { name: "Lacanau Central", region: "Gironde", country: "France", coords: [44.9774, -1.203], facing: 275, type: "beachbreak" },
  { name: "Carcans Plage", region: "Gironde", country: "France", coords: [45.0862, -1.1325], facing: 275, type: "beachbreak" },
  { name: "Hourtin", region: "Gironde", country: "France", coords: [45.2238, -1.1785], facing: 275, type: "beachbreak" },
  { name: "Biscarrosse", region: "Landes", country: "France", coords: [44.4472, -1.2527], facing: 275, type: "beachbreak" },
  { name: "Mimizan", region: "Landes", country: "France", coords: [44.2132, -1.3028], facing: 275, type: "beachbreak" },
  { name: "Cap Ferret - Truc Vert", region: "Gironde", country: "France", coords: [44.7322, -1.2523], facing: 275, type: "beachbreak" },
  { name: "La Torche", region: "Bretagne", country: "France", coords: [47.8198, -4.3588], facing: 230, type: "pointbreak" },
  { name: "Crozon - La Palue", region: "Bretagne", country: "France", coords: [48.2606, -4.6148], facing: 260, type: "beachbreak" }
];

const spots = rawSpots.map(s => ({...s, lastUpdated: null}));
let map;
let activeMarker;
let markersCluster;
const markersByName = new Map();
let tideInterval = null; 
let camClockInterval = null; 
let deferredPrompt;

// --- 2. CONTENU JURIDIQUE (PROTECTION) ---
const legalTexts = {
    "legal-mentions": {
        title: "Mentions Légales",
        body: `<div class="legal-section"><h3>1. Édition</h3><p>SurfSense Premium. Contact: support@surfsense.io</p></div>`
    },
    "legal-cgu": {
        title: "Conditions Générales d'Utilisation",
        body: `<div class="legal-section"><h3>Avertissement</h3><p>Le surf est un sport à risque. SurfSense décline toute responsabilité.</p></div>`
    },
    "legal-rgpd": {
        title: "Politique de Confidentialité",
        body: `<div class="legal-section"><h3>Données</h3><p>Vos données (email, favoris) sont stockées de manière sécurisée.</p></div>`
    }
};


// --- 3. GATEKEEPER & AUTHENTIFICATION (STABLE) ---
const initGatekeeper = () => {
    const modal = document.getElementById("gatekeeper-modal");
    if (!modal) return;

    const user = localStorage.getItem("surfUser");
    const session = sessionStorage.getItem("accessGranted");
    if (user || session) { modal.style.display = "none"; return; }

    modal.style.display = "flex";
    modal.classList.add("is-open");

    document.getElementById("btn-accept-access")?.addEventListener("click", () => {
        sessionStorage.setItem("accessGranted", "true");
        modal.classList.remove("is-open");
        setTimeout(() => modal.style.display = "none", 300);
    });

    document.getElementById("btn-refuse-access")?.addEventListener("click", () => {
        window.location.href = "https://google.com";
    });
};

// --- 4. AUTH MODAL (NORMALISATION DOM + SWITCH + 2FA) ---
const normalizeAuthDom = () => {
    const authModal = document.getElementById("auth-modal");
    if (!authModal) return;

    const content = authModal.querySelector(".modal-content") || authModal;

    // 1) Register view manquant (certains HTML ont le <h3> + <form> sans wrapper)
    const regForm = document.getElementById("register-form");
    let regView = document.getElementById("auth-register-view");
    if (!regView && regForm) {
        regView = document.createElement("div");
        regView.id = "auth-register-view";
        regView.style.display = "none";

        // Essaye de récupérer le <h3> juste au-dessus
        const maybeH3 = regForm.previousElementSibling && regForm.previousElementSibling.tagName === "H3"
            ? regForm.previousElementSibling
            : null;

        if (maybeH3) regView.appendChild(maybeH3);
        regView.appendChild(regForm);

        // Injecte après la vue login si possible, sinon à la fin
        const loginView = document.getElementById("auth-login-view");
        if (loginView && loginView.parentElement) {
            loginView.parentElement.insertBefore(regView, loginView.nextSibling);
        } else {
            content.appendChild(regView);
        }
    }

    // 2) 2FA view parfois hors modal / dupliquée : on garde la première trouvée et on la remet dans la modal
    const all2fa = Array.from(document.querySelectorAll("#auth-2fa-view"));
    if (all2fa.length > 0) {
        const preferred2fa = all2fa.find(el => content.contains(el)) || all2fa[0];
        if (!content.contains(preferred2fa)) content.appendChild(preferred2fa);
        preferred2fa.style.display = preferred2fa.style.display || "none";

        // Cache les doublons (sinon getElementById devient non-déterministe)
        all2fa.forEach((el) => {
            if (el !== preferred2fa) el.style.display = "none";
        });
    }

    // 3) twofa-form dupliqué : idem, on cache les doublons
    const allTwofaForms = Array.from(document.querySelectorAll("#twofa-form"));
    if (allTwofaForms.length > 1) {
        const preferredForm = allTwofaForms.find(el => content.contains(el)) || allTwofaForms[0];
        allTwofaForms.forEach((el) => {
            if (el !== preferredForm) el.style.display = "none";
        });
    }
};

const openAuthModal = () => {
    const authModal = document.getElementById("auth-modal");
    if (!authModal) return;
    authModal.classList.add("is-open");
};

const closeAuthModal = () => {
    const authModal = document.getElementById("auth-modal");
    if (!authModal) return;
    authModal.classList.remove("is-open");
};

const setLoggedState = (email) => {
    localStorage.setItem("surfUser", email);
    document.body.classList.add("user-is-logged");
};

const clearLoggedState = () => {
    localStorage.removeItem("surfUser");
    document.body.classList.remove("user-is-logged");
};

const showAuthView = (view) => {
    const loginView = document.getElementById("auth-login-view");
    const regView = document.getElementById("auth-register-view");
    const twofaView = document.getElementById("auth-2fa-view");

    // Fallbacks si wrappers absents
    const regForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");

    if (loginView) loginView.style.display = "none";
    if (regView) regView.style.display = "none";
    if (twofaView) twofaView.style.display = "none";

    if (!regView && regForm) regForm.style.display = "none";
    if (loginForm) loginForm.style.display = "";

    if (view === "login") {
        if (loginView) loginView.style.display = "block";
        else if (loginForm) loginForm.style.display = "";
    } else if (view === "register") {
        if (regView) regView.style.display = "block";
        else if (regForm) regForm.style.display = "";
        if (loginView) loginView.style.display = "none";
        if (loginForm) loginForm.style.display = "none";
    } else if (view === "2fa") {
        if (twofaView) twofaView.style.display = "block";
        if (loginView) loginView.style.display = "none";
        if (regView) regView.style.display = "none";
        if (loginForm) loginForm.style.display = "none";
        if (regForm) regForm.style.display = "none";
    }
};

const initAuthModalSystem = () => {
    const authModal = document.getElementById("auth-modal");
    if (!authModal) return;

    // Ouvrir
    document.body.addEventListener("click", (e) => {
        const opener = e.target.closest('[data-modal="auth"]');
        if (opener) {
            e.preventDefault();
            normalizeAuthDom();
            openAuthModal();
            showAuthView("login");
        }
    });

    // Fermer
    document.body.addEventListener("click", (e) => {
        if (e.target.matches("[data-modal-close]")) {
            e.preventDefault();
            closeAuthModal();
        }
    });
};

const initAuthSwitch = () => {
    document.body.addEventListener("click", (e) => {
        if (e.target.id === "link-to-register") {
            e.preventDefault();
            normalizeAuthDom();
            showAuthView("register");
        }
        if (e.target.id === "link-to-login") {
            e.preventDefault();
            normalizeAuthDom();
            showAuthView("login");
        }
    });
};

// --- 4B. LOGIQUE AUTH (REGISTER / LOGIN / 2FA) ---
const initAuthLogic = () => {
    normalizeAuthDom();

    const regForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");

    const twofaEmailInput = document.getElementById("twofa-email");

    // INSCRIPTION
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("reg-name")?.value?.trim();
            const email = document.getElementById("reg-email")?.value?.trim();
            const password = document.getElementById("reg-pass")?.value;

            try {
                const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json().catch(() => ({}));
                if (!data?.success) {
                    alert("Erreur : " + (data?.error || data?.message || "Inscription impossible"));
                    return;
                }

                console.log(`[ SYSTÈME ] Compte créé pour ${email}. Attente 2FA...`);
                if (twofaEmailInput) twofaEmailInput.value = email;
                showAuthView("2fa");
            } catch (err) {
                console.error(err);
                alert("Erreur connexion serveur.");
            }
        }, { passive: false });
    }

    // CONNEXION
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("login-email")?.value?.trim();
            const password = document.getElementById("login-pass")?.value;
            const btn = loginForm.querySelector("button");
            const originalText = btn?.innerText;

            if (btn) btn.innerText = "SÉCURISATION...";

            try {
                const res = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json().catch(() => ({}));
                if (!data?.success) {
                    alert("Erreur : " + (data?.error || data?.message || "Connexion impossible"));
                    if (btn && originalText) btn.innerText = originalText;
                    return;
                }

                console.log(`[ SYSTÈME ] Login OK pour ${email}. Attente 2FA...`);
                if (twofaEmailInput) twofaEmailInput.value = email;
                showAuthView("2fa");
            } catch (err) {
                console.error(err);
                alert("Erreur serveur.");
            } finally {
                if (btn && originalText) btn.innerText = originalText;
            }
        }, { passive: false });
    }

    // VALIDATION 2FA
    if (twofaForm) {
        twofaForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = (twofaEmailInput?.value || "").trim();
            const code = document.getElementById("twofa-code")?.value?.trim();

            try {
                const response = await fetch("/api/auth/verify-2fa", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code })
                });

                const data = await response.json().catch(() => ({}));
                if (!data?.success) {
                    alert("Code invalide.");
                    return;
                }

                // ✅ On marque l'utilisateur comme connecté
                setLoggedState(email);

                closeAuthModal();
                showAuthView("login");
                // Nettoyage code 2FA
                const codeInput = document.getElementById("twofa-code");
                if (codeInput) codeInput.value = "";
            } catch (err) {
                console.error(err);
                alert("Erreur validation 2FA.");
            }
        }, { passive: false });
    }
};

// --- 4C. PROTECTION "MON COMPTE" / PROFIL ---
const initProfileGate = () => {
    // Élément possible : .user-profile (conditions.html) + bouton "Mon Profil" (nav)
    document.body.addEventListener("click", (e) => {
        const profileClick = e.target.closest(".user-profile");
        if (!profileClick) return;

        // Si pas connecté → ouvre auth modal
        if (!localStorage.getItem("surfUser")) {
            e.preventDefault();
            normalizeAuthDom();
            openAuthModal();
            showAuthView("login");
        }
    });

    // Logout si présent
    document.body.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-logout");
        if (!btn) return;
        e.preventDefault();
        clearLoggedState();
        closeAuthModal();
        alert("Déconnecté.");
    });
};


// --- 5. LOGIQUE MÉTÉO / QUALITÉ / ROBOTS ---
const degToCompass = (deg) => {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const computeQuality = (spot, swellHeight, swellPeriod, swellDir, windSpeed, windDir) => {
  const spotFacing = spot.facing;
  const swellAngleDiff = Math.abs(((swellDir - spotFacing + 540) % 360) - 180);
  const windAngleDiff = Math.abs(((windDir - spotFacing + 540) % 360) - 180);

  const swellOk = swellHeight >= 0.6 && swellHeight <= 2.5 && swellPeriod >= 8;
  const swellDirOk = swellAngleDiff <= 55;
  const windOk = windSpeed <= 25;
  const offshore = windAngleDiff >= 135;

  let score = 0;
  if (swellOk) score += 35;
  if (swellDirOk) score += 25;
  if (windOk) score += 20;
  if (offshore) score += 20;

  if (swellHeight > 2.8) score -= 10;
  if (windSpeed > 35) score -= 25;

  score = clamp(score, 0, 100);

  if (score >= 80) return { label: "ÉPIQUE", className: "is-epic", badge: "LIVE" };
  if (score >= 60) return { label: "BON", className: "is-good", badge: "LIVE" };
  if (score >= 40) return { label: "MOYEN", className: "is-medium", badge: "SIMU" };
  return { label: "MAUVAIS", className: "is-bad", badge: "SIMU" };
};

const pickBest3 = (allData) => {
  const sorted = [...allData].sort((a,b) => b.score - a.score);
  return sorted.slice(0, 3);
};

const formatSwellSummary = (swellHeight, period, swellDir) => {
  if (swellHeight == null) return "--";
  return `${swellHeight.toFixed(1)}m / ${Math.round(period)}s / ${degToCompass(swellDir)}`;
};

const formatWindSummary = (windSpeed, windDir) => {
  if (windSpeed == null) return "--";
  return `${Math.round(windSpeed)} km/h ${degToCompass(windDir)}`;
};

const showGlobalAlert = (message, type="info") => {
  const zone = document.getElementById("global-alert-zone");
  if (!zone) return;

  const el = document.createElement("div");
  el.className = `global-alert global-alert--${type}`;
  el.innerHTML = `<strong>${type.toUpperCase()}</strong> ${message}`;
  zone.appendChild(el);
  setTimeout(() => el.classList.add("is-visible"), 30);
  setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 400);
  }, 3500);
};

// --- STORAGE / QUOTA ---
const STORAGE_KEY = "surfsense_spot_cache_v1";
const CALL_COUNT_KEY = "surfsense_call_count_v1";
const CALL_MAX = 500;

const getCallCount = () => {
  try {
    const raw = localStorage.getItem(CALL_COUNT_KEY);
    if (!raw) return { count: 0, date: new Date().toDateString() };
    const obj = JSON.parse(raw);
    if (obj.date !== new Date().toDateString()) return { count: 0, date: new Date().toDateString() };
    return obj;
  } catch {
    return { count: 0, date: new Date().toDateString() };
  }
};

const incCallCount = () => {
  const obj = getCallCount();
  obj.count++;
  localStorage.setItem(CALL_COUNT_KEY, JSON.stringify(obj));
  return obj.count;
};

const updateQuotaUI = () => {
  const ui = document.getElementById("call-count-ui");
  if (!ui) return;
  const { count } = getCallCount();
  ui.innerText = `Quota: ${count}/${CALL_MAX}`;
};

const loadCache = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveCache = (cache) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
};

// --- API FETCH (via backend proxy) ---
const fetchSpotConditions = async (spot) => {
  // Storage-first
  const cache = loadCache();
  const key = spot.name;
  const cached = cache[key];

  const now = Date.now();
  const maxAge = 1000 * 60 * 45; // 45 min

  if (cached && (now - cached.ts) < maxAge) {
    return { ...cached.data, fromCache: true };
  }

  // Quota check
  const { count } = getCallCount();
  if (count >= CALL_MAX) {
    showGlobalAlert("Quota Stormglass atteint (500/j). Mode Storage-First.", "warning");
    if (cached) return { ...cached.data, fromCache: true };
    return null;
  }

  incCallCount();
  updateQuotaUI();

  const url = `/api/conditions?lat=${spot.coords[0]}&lng=${spot.coords[1]}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();

    cache[key] = { ts: now, data };
    saveCache(cache);

    return { ...data, fromCache: false };
  } catch (e) {
    console.error(e);
    if (cached) return { ...cached.data, fromCache: true };
    return null;
  }
};

// --- MAP & UI ---
const initMap = () => {
  const mapEl = document.getElementById("surf-map");
  if (!mapEl) return;

  map = L.map("surf-map", { zoomControl: true }).setView([46.6, 2.2], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  markersCluster = L.markerClusterGroup();
  markersCluster.addTo(map);

  spots.forEach((spot) => {
    const markerIcon = L.divIcon({
      className: "",
      html: `<div class="spot-marker"></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });

    const marker = L.marker(spot.coords, { icon: markerIcon });

    marker.on("click", () => {
      openSpotPopup(spot, marker);
      highlightSpotCard(spot.name);
    });

    markersByName.set(spot.name, marker);
    markersCluster.addLayer(marker);
  });
};

const openSpotPopup = (spot, marker) => {
  if (activeMarker) activeMarker.getElement()?.classList.remove("spot-marker--active");
  activeMarker = marker;
  marker.getElement()?.classList.add("spot-marker--active");

  const popupContent = `
    <div class="spot-popup compact-popup">
      <button class="popup-close" onclick="this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button').click()">✕</button>
      <h4>${spot.name}</h4>
      <p style="margin:0; color:#888; font-size:0.8rem;">${spot.region}</p>
      <a href="conditions.html?spot=${encodeURIComponent(spot.name)}" class="popup-btn popup-btn--primary">Voir conditions</a>
      <button class="popup-btn popup-btn--fav" onclick="toggleFavorite('${encodeURIComponent(spot.name)}')">♡ Ajouter Favori</button>
    </div>
  `;

  marker.bindPopup(popupContent, { closeButton: false, offset: [0, -20] }).openPopup();
};

const renderSpotList = () => {
  const listEl = document.getElementById("spot-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  spots.forEach((spot) => {
    const card = document.createElement("button");
    card.className = "spot-card";
    card.dataset.spot = spot.name;

    card.innerHTML = `
      <div class="spot-card-header">
        <div>
          <p class="spot-name">${spot.name}</p>
          <span class="spot-region">${spot.region}</span>
        </div>
        <span class="spot-live-badge">--</span>
      </div>
      <div class="spot-card-meta">
        <span class="tide-tag">Marée: --</span>
        <span class="swell-alert-badge" style="display:none;">ALERTE</span>
      </div>
    `;

    card.addEventListener("click", () => {
      const marker = markersByName.get(spot.name);
      if (marker) {
        map.setView(marker.getLatLng(), 10, { animate: true });
        openSpotPopup(spot, marker);
      }
      highlightSpotCard(spot.name);
    });

    listEl.appendChild(card);
  });
};

const highlightSpotCard = (spotName) => {
  document.querySelectorAll(".spot-card").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.spot === spotName);
  });
};

// --- SEARCH ---
const initSpotSearch = () => {
  const input = document.getElementById("spot-search");
  if (!input) return;

  input.addEventListener("input", () => {
    const val = input.value.toLowerCase();
    document.querySelectorAll(".spot-card").forEach((card) => {
      const name = card.dataset.spot.toLowerCase();
      card.style.display = name.includes(val) ? "" : "none";
    });
  });
};

// --- LIVE STATS BAR (HOME) ---
const updateQuickStats = async () => {
  const waterEl = document.querySelector("#stat-water .bubble-value");
  const swellEl = document.querySelector("#stat-swell .bubble-value");
  const activeEl = document.querySelector("#stat-active .bubble-value");
  const tideEl = document.querySelector("#stat-tide .bubble-value");

  if (!waterEl || !swellEl || !activeEl || !tideEl) return;

  // On prend un spot "référence" (Lacanau)
  const refSpot = spots.find(s => s.name.toLowerCase().includes("lacanau")) || spots[0];
  const data = await fetchSpotConditions(refSpot);
  if (!data) return;

  const swellHeight = data?.swell?.height ?? null;
  const swellPeriod = data?.swell?.period ?? null;
  const swellDir = data?.swell?.direction ?? null;
  const waterTemp = data?.water?.temperature ?? null;

  waterEl.innerText = waterTemp != null ? `${Math.round(waterTemp)}°C` : "--";
  swellEl.innerText = swellHeight != null ? `${swellHeight.toFixed(1)}m` : "--";

  // Spots live = nombre cache valide <45min
  const cache = loadCache();
  const now = Date.now();
  const maxAge = 1000*60*45;
  const liveCount = Object.values(cache).filter(v => v && (now - v.ts) < maxAge).length;
  activeEl.innerText = `${liveCount}`;

  tideEl.innerText = "SYNC";
};

// --- RADAR SESSIONS (TOP SPOTS) ---
const updateRadar = async () => {
  const container = document.getElementById("radar-container");
  if (!container) return;

  const results = [];

  // On limite pour performance (15 spots)
  const sample = spots.slice(0, 15);
  for (const spot of sample) {
    const data = await fetchSpotConditions(spot);
    if (!data) continue;

    const swellHeight = data?.swell?.height ?? 0;
    const swellPeriod = data?.swell?.period ?? 0;
    const swellDir = data?.swell?.direction ?? 0;
    const windSpeed = data?.wind?.speed ?? 0;
    const windDir = data?.wind?.direction ?? 0;

    const q = computeQuality(spot, swellHeight, swellPeriod, swellDir, windSpeed, windDir);
    const score =
      (q.label === "ÉPIQUE" ? 100 :
      q.label === "BON" ? 80 :
      q.label === "MOYEN" ? 55 : 25);

    results.push({
      spot,
      q,
      score,
      swellHeight,
      swellPeriod,
      swellDir,
      windSpeed,
      windDir
    });
  }

  const best = pickBest3(results);

  container.innerHTML = "";
  best.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card-panel";
    card.style.cursor = "pointer";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="margin:0;">${item.spot.name}</h3>
          <p style="margin:6px 0 0; color:#666; font-size:0.85rem;">
            ${formatSwellSummary(item.swellHeight, item.swellPeriod, item.swellDir)} · ${formatWindSummary(item.windSpeed, item.windDir)}
          </p>
        </div>
        <span class="quality-badge ${item.q.className}" style="min-width:90px;">${item.q.label}</span>
      </div>
      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        <span class="pill">🤖 ${item.q.badge}</span>
        <span class="pill">⚡ Score ${item.score}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `conditions.html?spot=${encodeURIComponent(item.spot.name)}`;
    });
    container.appendChild(card);
  });
};

// --- FAVORIS ---
const FAVORITES_KEY = "surfsense_favs_v1";

const getFavorites = () => {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
};

const setFavorites = (arr) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
};

window.toggleFavorite = (encodedSpotName) => {
  const spotName = decodeURIComponent(encodedSpotName);
  const favs = getFavorites();
  const exists = favs.includes(spotName);
  const newFavs = exists ? favs.filter(n => n !== spotName) : [...favs, spotName];
  setFavorites(newFavs);
  showGlobalAlert(exists ? "Retiré des favoris." : "Ajouté aux favoris.", exists ? "info" : "success");
};

// --- PAGE FAVORITES RENDER ---
const renderFavoritesPage = async () => {
  const grid = document.getElementById("fav-grid");
  const empty = document.getElementById("empty-favs");
  if (!grid || !empty) return;

  const favs = getFavorites();
  if (!favs.length) {
    empty.style.display = "block";
    grid.innerHTML = "";
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = "";

  for (const name of favs) {
    const spot = spots.find(s => s.name === name);
    if (!spot) continue;

    const data = await fetchSpotConditions(spot);
    const swellHeight = data?.swell?.height ?? 0;
    const swellPeriod = data?.swell?.period ?? 0;
    const swellDir = data?.swell?.direction ?? 0;
    const windSpeed = data?.wind?.speed ?? 0;
    const windDir = data?.wind?.direction ?? 0;

    const q = computeQuality(spot, swellHeight, swellPeriod, swellDir, windSpeed, windDir);

    const card = document.createElement("div");
    card.className = `fav-card ${q.className}`;
    card.innerHTML = `
      <div class="fav-card-header">
        <h3>${spot.name}</h3>
        <button class="fav-remove-btn" title="Retirer" aria-label="Retirer">✕</button>
      </div>
      <p style="margin:0; color:#888; font-size:0.85rem;">${spot.region}</p>
      <div class="fav-stats">
        <div class="fav-stat-item">
          <span class="fav-stat-label">HOULE</span>
          <span class="fav-stat-value">${swellHeight ? swellHeight.toFixed(1) : "-"} m</span>
        </div>
        <div class="fav-stat-item">
          <span class="fav-stat-label">VENT</span>
          <span class="fav-stat-value">${windSpeed ? Math.round(windSpeed) : "-"} km/h</span>
        </div>
        <div class="fav-stat-item">
          <span class="fav-stat-label">QUALITÉ</span>
          <span class="fav-stat-value">${q.label}</span>
        </div>
      </div>
    `;

    card.querySelector(".fav-remove-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      setFavorites(getFavorites().filter(x => x !== spot.name));
      renderFavoritesPage();
    });

    card.addEventListener("click", () => {
      window.location.href = `conditions.html?spot=${encodeURIComponent(spot.name)}`;
    });

    grid.appendChild(card);
  }
};

// --- PAGE CONDITIONS (DASHBOARD) ---
const initConditionsPage = async () => {
  const url = new URL(window.location.href);
  const spotName = url.searchParams.get("spot");
  if (!spotName) return;

  const spot = spots.find(s => s.name === spotName);
  if (!spot) return;

  // Header
  const title = document.getElementById("spot-title");
  const sub = document.getElementById("spot-subtitle");
  if (title) title.innerText = spot.name;
  if (sub) sub.innerText = `${spot.region} • ${spot.country}`;

  // Mini map
  const mini = document.getElementById("mini-map");
  if (mini) {
    const miniMap = L.map("mini-map", { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView(spot.coords, 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(miniMap);
    L.marker(spot.coords).addTo(miniMap);
  }

  const data = await fetchSpotConditions(spot);
  if (!data) return;

  const swellHeight = data?.swell?.height ?? 0;
  const swellPeriod = data?.swell?.period ?? 0;
  const swellDir = data?.swell?.direction ?? 0;
  const windSpeed = data?.wind?.speed ?? 0;
  const windDir = data?.wind?.direction ?? 0;

  const q = computeQuality(spot, swellHeight, swellPeriod, swellDir, windSpeed, windDir);

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.innerText = v;
  };

  setVal("val-wave", swellHeight ? swellHeight.toFixed(1) : "-");
  setVal("val-period", swellPeriod ? Math.round(swellPeriod) : "-");
  setVal("val-wind-speed", windSpeed ? Math.round(windSpeed) : "-");
  setVal("val-wind-dir", degToCompass(windDir));
  setVal("val-swell-dir", degToCompass(swellDir));
  setVal("val-quality", q.label);

  // Status banner
  const banner = document.getElementById("status-banner");
  const bannerTitle = document.getElementById("status-title");
  const bannerMsg = document.getElementById("status-msg");
  if (banner) {
    banner.classList.remove("is-epic","is-good","is-warning","is-bad");
    banner.classList.add(q.className === "is-epic" ? "is-epic" : q.className === "is-good" ? "is-good" : q.className === "is-medium" ? "is-warning" : "is-bad");
  }
  if (bannerTitle) bannerTitle.innerText = q.label;
  if (bannerMsg) bannerMsg.innerText = q.label === "ÉPIQUE" ? "Créneau rare. Activez le mode session." : "Conditions analysées par les robots.";

  // Forecast (placeholder)
  const list = document.getElementById("forecast-list");
  if (list) {
    list.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const row = document.createElement("div");
      row.className = "day-row";
      row.innerHTML = `
        <div class="day-card is-medium">
          <div class="day-header">
            <div class="day-date">J+${i}</div>
            <div class="quality-badge">SIMU</div>
            <div class="surf-stats-group">
              <div class="surf-primary">${swellHeight ? swellHeight.toFixed(1) : "-"}m | ${windSpeed ? Math.round(windSpeed) : "-"} km/h</div>
              <div class="surf-secondary">Période ${swellPeriod ? Math.round(swellPeriod) : "-"}s · Dir ${degToCompass(swellDir)}</div>
            </div>
            <div></div>
            <div class="weather-stats-group">
              <div class="weather-pill"><span class="w-icon">🌡️</span><span class="w-val">--</span></div>
            </div>
            <div class="day-arrow">›</div>
          </div>
          <div class="day-details">
            <div class="detail-box"><div class="detail-label">Énergie</div><div class="detail-value">--</div></div>
            <div class="detail-box"><div class="detail-label">Marée</div><div class="detail-value">--</div></div>
            <div class="detail-box"><div class="detail-label">Crowd</div><div class="detail-value">--</div></div>
          </div>
        </div>
      `;
      row.querySelector(".day-card").addEventListener("click", () => {
        row.querySelector(".day-card").classList.toggle("is-open");
      });
      list.appendChild(row);
    }
  }

  // Tide (placeholder)
  const tideDisplay = document.getElementById("tide-display");
  if (tideDisplay) tideDisplay.innerText = "SYNC...";

  if (tideInterval) clearInterval(tideInterval);
  tideInterval = setInterval(() => {
    if (tideDisplay) tideDisplay.innerText = "SYNC...";
  }, 10000);
};

// --- CAMERAS PAGE (placeholder) ---
const initCamerasPage = () => {
  const grid = document.getElementById("cam-grid");
  if (!grid) return;
  // Ton code cam est dans cameras.html (iframe) → ici on laisse minimal
};

// --- NEWS PAGE (placeholder) ---
const initNewsPage = async () => {
  const preview = document.getElementById("news-preview");
  if (!preview) return;

  try {
    const res = await fetch("/api/news");
    const data = await res.json();
    preview.innerHTML = "";
    (data?.items || []).slice(0, 10).forEach((item) => {
      const card = document.createElement("div");
      card.className = "news-card";
      card.innerHTML = `
        <div class="news-img-wrapper"></div>
        <div class="news-body" style="padding:16px;">
          <h3 style="margin:0 0 8px;">${item.title || "News"}</h3>
          <p style="margin:0; color:#94a3b8; font-size:0.9rem;">${item.snippet || ""}</p>
        </div>
      `;
      card.addEventListener("click", () => {
        if (item.link) window.open(item.link, "_blank");
      });
      preview.appendChild(card);
    });
  } catch (e) {
    console.error(e);
  }
};

// --- LEGAL MODAL (simple) ---
const initLegalModal = () => {
  document.body.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-modal]");
    if (!trigger) return;

    const key = trigger.dataset.modal;
    if (!legalTexts[key]) return;

    e.preventDefault();
    alert(`${legalTexts[key].title}\n\n${legalTexts[key].body.replace(/<[^>]*>/g, "")}`);
  });
};

// --- PWA INSTALL PROMPT (OPTIONNEL) ---
const initPWAInstall = () => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
};

// --- INITIALISATION AU CHARGEMENT ---
window.addEventListener("load", () => {
  initGatekeeper();
  initAuthModalSystem();
  initAuthSwitch();
  initAuthLogic();
  initProfileGate();

  const loader = document.getElementById("app-loader");
  if(loader) { setTimeout(() => loader.classList.add("loader-hidden"), 900); }

  initLegalModal();
  initPWAInstall();
  updateQuotaUI();

  // Init selon page
  initMap();
  renderSpotList();
  initSpotSearch();
  updateQuickStats();
  updateRadar();

  renderFavoritesPage();
  initConditionsPage();
  initCamerasPage();
  initNewsPage();
});
