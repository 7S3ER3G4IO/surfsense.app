let favoritesSet = new Set();
// --- 3. GATEKEEPER & AUTHENTIFICATION ---
const initGatekeeper = () => {
    const modal = document.getElementById("gatekeeper-modal");
    if (!modal) return;
    const user = localStorage.getItem("surfUser");
    const session = sessionStorage.getItem("accessGranted");
    if (user || session) { modal.style.display = "none"; return; }
    
    modal.style.display = "flex";
    modal.classList.add("is-open");
    
    const updateGatekeeperMetrics = async () => {
        try {
            const statusRes = await fetch("/api/all-status");
            const status = await statusRes.json();
            const total = Object.keys(status).length;
            const live = Object.values(status).filter(v => v === "LIVE").length;
            const reliability = total > 0 ? Math.round((live / total) * 100) : 0;
            const quotaRes = await fetch("/api/quota");
            const quota = await quotaRes.json();
            const quotaText = `${quota.remaining}/${quota.limit}`;
            const relEl = document.getElementById("gate-reliability");
            const liveEl = document.getElementById("gate-live-count");
            const quotaEl = document.getElementById("gate-quota-remaining");
            if (relEl) relEl.textContent = `${reliability}%`;
            if (liveEl) liveEl.textContent = `${live}`;
            if (quotaEl) quotaEl.textContent = quotaText;
        } catch {}
    };
    updateGatekeeperMetrics();
    const gateInterval = setInterval(updateGatekeeperMetrics, 10000);
    
    const toggleButtons = Array.from(document.querySelectorAll(".gate-toggle"));
    toggleButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            const panel = document.getElementById(target);
            if (!panel) return;
            const isOpen = panel.classList.contains("is-open");
            panel.classList.toggle("is-open", !isOpen);
            btn.classList.toggle("active", !isOpen);
        });
    });
    
    document.getElementById("btn-accept-access")?.addEventListener("click", () => {
        sessionStorage.setItem("accessGranted", "true");
        modal.classList.remove("is-open");
        clearInterval(gateInterval);
        setTimeout(() => modal.style.display = "none", 300);
    });
    document.getElementById("btn-refuse-access")?.addEventListener("click", () => {
        window.location.href = "https://google.com";
    });
};

const handleAuthSwitch = () => {
    const loginView = document.getElementById("auth-login-view");
    const registerView = document.getElementById("auth-register-view");

    // L'écouteur d'événement pour basculer entre Inscription et Connexion
    document.body.addEventListener('click', (e) => {
        if(e.target.id === 'link-to-register') {
            e.preventDefault();
            if(loginView) loginView.style.display = "none";
            if(registerView) registerView.style.display = "block";
        }
        if(e.target.id === 'link-to-login') {
            e.preventDefault();
            if(registerView) registerView.style.display = "none";
            if(loginView) loginView.style.display = "block";
        }
    });
};

// --- 4. GESTIONNAIRE D'AUTHENTIFICATION & 2FA ---
const initAuthLogic = () => {
    const regForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");
    
    const authLoginView = document.getElementById("auth-login-view");
    const authRegisterView = document.getElementById("auth-register-view");
    const auth2faView = document.getElementById("auth-2fa-view");
    const twofaEmailInput = document.getElementById("twofa-email");

    // 🛡️ 1. INSCRIPTION
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById("reg-name").value;
            const email = document.getElementById("reg-email").value;
            const password = document.getElementById("reg-pass").value;

            try {
                const res = await fetch("/api/auth/register", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();
                
                if (data.success) {
                    // 🛑 ON NE RECHARGE PLUS LA PAGE ICI ! On passe au 2FA.
                    console.log(`[ SYSTÈME ] Compte créé pour ${email}. Attente 2FA...`);
                    
                    if (authRegisterView) authRegisterView.style.display = "none";
                    if (auth2faView) auth2faView.style.display = "block";
                    if (twofaEmailInput) twofaEmailInput.value = email; // On mémorise l'email
                    try {
                        await fetch("/api/auth/send-2fa", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email })
                        });
                    } catch {}
                } else {
                    alert("Erreur : " + data.error);
                }
            } catch (err) { alert("Erreur connexion serveur."); }
        };
    }

    // 🛡️ 2. CONNEXION
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-pass").value;
            const btn = loginForm.querySelector("button");
            const originalText = btn.innerText;
            btn.innerText = "SÉCURISATION...";
            try {
                const res = await fetch("/api/auth/login", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data && data.success) {
                    localStorage.setItem("surfUser", JSON.stringify(data.user));
                    sessionStorage.setItem("accessGranted", "true");
                    document.getElementById("auth-modal")?.classList.remove("is-open");
                    window.location.reload();
                } else {
                    alert("Erreur : " + (data.error || "Connexion échouée"));
                    btn.innerText = originalText;
                }
            } catch (err) { alert("Erreur serveur."); btn.innerText = originalText; }
        };
    }

    // 🛡️ 3. VALIDATION DU CODE 2FA
    if (twofaForm) {
        twofaForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = twofaEmailInput.value;
            const code = document.getElementById("twofa-code").value;

            try {
                const response = await fetch("/api/auth/verify-2fa", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code })
                });
                const data = await response.json();

                if (data.success) {
                    console.log("[ SECURITY-BOT ] Accès 2FA autorisé.");
                    const email = twofaEmailInput.value;
                    try {
                        const uRes = await fetch(`/api/auth/user?email=${encodeURIComponent(email)}`);
                        const u = await uRes.json();
                        localStorage.setItem("surfUser", JSON.stringify(u));
                    } catch {}
                    sessionStorage.setItem("accessGranted", "true");
                    alert("Authentification validée. Bienvenue Agent.");
                    window.location.reload(); 
                } else {
                    alert("❌ " + data.error);
                    document.getElementById("twofa-code").value = "";
                }
            } catch (error) { console.error("Erreur 2FA", error); }
        };
    }
};

const loadFavorites = async () => {
    const u = JSON.parse(localStorage.getItem("surfUser") || "null");
    if (!u) { favoritesSet = new Set(); return; }
    try {
        const r = await fetch(`/api/favorites?userId=${u.id}`);
        const arr = await r.json();
        favoritesSet = new Set(arr);
    } catch {}
};

const updateProfileModal = async () => {
    const user = JSON.parse(localStorage.getItem("surfUser"));
    if (!user) return;

    document.getElementById("profile-user-name").textContent = user.name || "Agent Identifié";
    document.getElementById("profile-email").textContent = user.email || "N/A";

    try {
        const res = await fetch("/api/quota");
        const data = await res.json();
        const percent = (data.used / data.limit) * 100;
        document.getElementById("quota-text").textContent = `${data.used}/${data.limit}`;
        const fill = document.getElementById("quota-fill");
        if(fill) {
            fill.style.width = `${percent}%`;
            if (percent > 80) fill.style.background = "var(--live-red)";
        }
    } catch (e) {}
};

const logout = () => {
    if(confirm("DÉCONNEXION : Couper la liaison avec le terminal ?")) {
        localStorage.removeItem("surfUser");
        sessionStorage.removeItem("accessGranted");
        window.location.reload();
    }
};

// --- 5. LOGIQUE MÉTIER (MÉTÉO & IA) ---
const calculateQuality = (waveHeight, windSpeed, wavePeriod, windDir, tideStage, spotName) => {
  const spot = spots.find(s => s.name === spotName) || { facing: 275, type: "beachbreak" };
  const energyScore = (waveHeight * waveHeight) * wavePeriod;
  const dirAngles = { "N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SO": 225, "O": 270, "NO": 315 };
  const windAngle = dirAngles[windDir] || 270;
  const offshoreAngle = (spot.facing + 180) % 360;
  const angularDiff = Math.min(Math.abs(windAngle - offshoreAngle), 360 - Math.abs(windAngle - offshoreAngle));
  
  const isOffshorePure = angularDiff < 30;
  const isOnshore = angularDiff > 120;
  let tideWarning = false;
  const stage = (tideStage || "").toLowerCase();
  if (spot.type === "beachbreak" && (stage === "haute" || stage === "high") && waveHeight > 1.8) tideWarning = true;

  let label = "MOYEN", color = "#facc15", cls = "is-medium", msg = "Analyse : Plan d'eau moyen.";

  // 1. DANGER : Tempête de vent absolue
  if (windSpeed > 35) {
      return { label: "TEMPÊTE", color: "#ef4444", class: "is-bad", botMsg: "Robot Alert : Vent violent.", energy: Math.round(energyScore) };
  }
  
  // 2. DANGER : Houle XXL impraticable pour un beachbreak normal
  if (waveHeight > 2.5) {
      return { label: "MAUVAIS", color: "#ef4444", class: "is-bad", botMsg: `Robot Alert : Houle massive (${waveHeight.toFixed(1)}m).`, energy: Math.round(energyScore) };
  }

  // 3. MAUVAIS : Trop de vent, vent onshore, ou houle trop courte
  if (windSpeed > 25 || isOnshore || wavePeriod < 6 || tideWarning) {
      label = "MAUVAIS"; color = "#ef4444"; cls = "is-bad"; 
      msg = windSpeed > 25 ? "Trop de vent pour surfer." : (isOnshore ? "Vent de mer dégradé." : "Conditions défavorables.");
  } 
  // 4. ÉPIQUE : Les conditions parfaites (Offshore pur, houle longue)
  else if (isOffshorePure && wavePeriod >= 10 && waveHeight >= 0.7 && !tideWarning) {
      label = "ÉPIQUE"; color = "#d946ef"; cls = "is-epic"; 
      msg = `Verdict : Houle longue (${Math.round(wavePeriod)}s) + Offshore pur.`;
  } 
  // 5. BON : Conditions de base propres (Houle correcte, peu de vent)
  else if (waveHeight >= 0.8 && wavePeriod >= 8 && windSpeed <= 15) {
      label = "BON"; color = "#4ade80"; cls = "is-good"; 
      msg = "Verdict : Conditions propres et surfables.";
  }

  return { label, color, class: cls, botMsg: msg, energy: Math.round(energyScore) };
};

const getWeatherIcon = (cloudCover, precipitation) => {
  // 1. La pluie est prioritaire (si > 0.1mm/h)
  if (precipitation > 0.1) {
      if (precipitation > 2) return "⛈️"; // Grosse pluie / Orage
      return "🌧️"; // Pluie normale
  }
  // 2. Si pas de pluie, on regarde les nuages
  if (cloudCover == null || cloudCover < 20) return "☀️"; 
  if (cloudCover < 60) return "⛅"; 
  if (cloudCover < 90) return "☁️"; 
  return "🌫️"; 
};

const degToCardinal = (deg) => {
  const d = ((deg % 360) + 360) % 360;
  const dirs = ["N","NE","E","SE","S","SO","O","NO"];
  return dirs[Math.round(d / 45) % 8];
};

const cardinalLabelFr = (dir) => {
  if (!dir) return "-";
  if (dir === "N" || dir === "NE" || dir === "NO") return "Nord";
  if (dir === "S" || dir === "SE" || dir === "SO") return "Sud";
  if (dir === "E") return "Est";
  if (dir === "O") return "Ouest";
  return dir;
};

const dirToAngle = (dir) => {
  const map = { "N":0, "NE":45, "E":90, "SE":135, "S":180, "SO":225, "O":270, "NO":315 };
  return map[dir] ?? null;
};

const classifyWindRelative = (facing, dir) => {
  const wa = dirToAngle(dir);
  if (wa == null || facing == null) return "-";
  const off = (facing + 180) % 360;
  const d = Math.min(Math.abs(wa - off), 360 - Math.abs(wa - off));
  if (d <= 30) return "Offshore";
  if (d >= 150) return "Onshore";
  return "Side-shore";
};

const getSwellDir = (weather) => {
  if (weather && weather.swellDirection) return weather.swellDirection;
  if (weather && weather.swellDirectionDegrees != null) return degToCardinal(weather.swellDirectionDegrees);
  if (weather && Array.isArray(weather.forecast)) {
    for (const it of weather.forecast) {
      if (it.swellDirection) return it.swellDirection;
      if (it.swellDirectionDegrees != null) return degToCardinal(it.swellDirectionDegrees);
      if (it.waveDirection) return it.waveDirection;
      if (it.waveDirectionDegrees != null) return degToCardinal(it.waveDirectionDegrees);
    }
  }
  if (weather && weather.waveDirection) return weather.waveDirection;
  if (weather && weather.waveDirectionDegrees != null) return degToCardinal(weather.waveDirectionDegrees);
  return null;
};

const runAiRobots = (weather) => {
    const hub = document.getElementById("ai-robot-hub");
    if(!hub) return;

    let board = "Hybride"; if(weather.waveHeight < 0.8) board = "Longboard 9'"; else if(weather.waveHeight < 1.5) board = "Shortboard"; else board = "Gun / Step-up";
    const now = new Date();
    const isWeekend = (now.getDay() === 0 || now.getDay() === 6);
    let crowd = "Calme 🟢"; if(weather.waveHeight > 1.0 && isWeekend) crowd = "Saturé 🔴"; else if(weather.waveHeight > 1.0) crowd = "Moyen 🟠";
    const feel = Math.round((weather.airTemperature || 15) - ((weather.windSpeed || 10) * 0.1)); 
    let solar = "Standard";
    if(now.getHours() > 20 || now.getHours() < 7) solar = "Nuit 🌙"; else if(weather.cloudCover < 30) solar = "UV Fort ☀️"; else solar = "Nuageux ☁️";
    const pollution = (weather.cloudCover > 95) ? "Risque ⚠️" : "Eau Claire 💧";

    hub.innerHTML = `
        <div class="ai-robot-card" title="Planche conseillée selon hauteur de vague">
          <div class="robot-icon">🏄‍♂️</div>
          <div class="robot-info">
            <span class="robot-name">Quiver-AI</span>
            <span class="robot-value">${board}</span>
            <span class="robot-desc">Planche conseillée</span>
          </div>
        </div>
        <div class="ai-robot-card" title="Affluence estimée selon créneau et conditions">
          <div class="robot-icon">👥</div>
          <div class="robot-info">
            <span class="robot-name">Crowd-Predict</span>
            <span class="robot-value">${crowd}</span>
            <span class="robot-desc">Affluence estimée</span>
          </div>
        </div>
        <div class="ai-robot-card" title="Température ressentie (air - effet du vent)">
          <div class="robot-icon">🌡️</div>
          <div class="robot-info">
            <span class="robot-name">Feel-Real</span>
            <span class="robot-value">${feel}°C</span>
            <span class="robot-desc">Temp. ressentie</span>
          </div>
        </div>
        <div class="ai-robot-card" title="État du ciel • UV • Golden Hour">
          <div class="robot-icon">☀️</div>
          <div class="robot-info">
            <span class="robot-name">Solar-Sync</span>
            <span class="robot-value">${solar}</span>
            <span class="robot-desc">Ciel & UV</span>
          </div>
        </div>
        <div class="ai-robot-card" title="Qualité de l’eau : risque pollution après pluie">
          <div class="robot-icon">🧬</div>
          <div class="robot-info">
            <span class="robot-name">Eco-Scan</span>
            <span class="robot-value">${pollution}</span>
            <span class="robot-desc">Qualité de l’eau</span>
          </div>
        </div>
    `;
};

// --- 6. INTERFACE CARTE & LISTES ---
const updateQuotaUI = async () => {
  const quotaLabel = document.getElementById("call-count-ui");
  if (!quotaLabel) return;
  try {
    const res = await fetch("/api/quota");
    if(!res.ok) throw new Error("Erreur quota");
    const data = await res.json();
    quotaLabel.textContent = `Quota: ${data.used}/${data.limit} (${data.remaining} restants)`;
  } catch (e) { quotaLabel.textContent = "Quota: --/500"; }
};

const scrollToMap = () => {
  const el = document.getElementById("surf-map");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => { if (map) map.invalidateSize(); }, 250);
};

const initMap = () => {
  if (map) { map.remove(); map = null; }
  if (!document.getElementById("surf-map")) return;
  
  map = L.map("surf-map", { zoomControl: false }).setView([46.8, 2.0], 5.5);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  markersCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    removeOutsideVisibleBounds: true,
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({ html: `<div class="surf-cluster-marker"><span>${count}</span></div>`, className: 'surf-cluster', iconSize: L.point(40, 40) });
    }
  });
  markersCluster.on("clusterclick", () => scrollToMap());
  const glowIcon = L.divIcon({ className: "leaflet-marker-wrapper", html: '<div class="spot-marker"></div>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -35] });
  spots.forEach((spot) => {
    const marker = L.marker(spot.coords, { icon: glowIcon });
    marker.bindPopup(renderSpotPopup(spot), { closeButton: false, offset: [0, -10], className: "surf-popup" });
    marker.on("click", () => selectSpot(spot, marker));
    markersCluster.addLayer(marker);
    markersByName.set(spot.name, marker);
  });
  map.addLayer(markersCluster);
  map.on("popupclose", () => {
    if (activeMarker && activeMarker.getElement()) activeMarker.getElement().querySelector('.spot-marker')?.classList.remove("spot-marker--active");
    const b = markersCluster && markersCluster.getBounds();
    if (b && b.isValid && b.isValid()) {
      map.fitBounds(b, { padding: [50, 50], animate: true, maxZoom: 6.5 });
    } else {
      map.setZoom(Math.max(map.getZoom() - 2, 6));
    }
  });
  setTimeout(() => map.invalidateSize(), 200);
};

const selectSpot = (spot, marker, { openPopup = true, scrollList = false } = {}) => {
  if (!spot) return;
  scrollToMap();

  // 📡 SIGNAL RADAR : Envoie l'info au serveur pour affichage dans Render
  fetch(`/api/log-click?spot=${encodeURIComponent(spot.name)}`).catch(() => {});

  const resolvedMarker = marker || markersByName.get(spot.name);
  if (activeMarker && activeMarker.getElement()) activeMarker.getElement().querySelector('.spot-marker')?.classList.remove("spot-marker--active");
  
  if (resolvedMarker) {
      markersCluster.zoomToShowLayer(resolvedMarker, () => {
          if (resolvedMarker.getElement()) { resolvedMarker.getElement().querySelector('.spot-marker')?.classList.add("spot-marker--active"); }
          if (openPopup) resolvedMarker.openPopup();
          updatePopupStatus(spot);
          activeMarker = resolvedMarker;
      });
  } else { 
      map.setView(spot.coords, 9, { animate: true }); 
  }
  
  updateSpotListSelection(spot.name, scrollList);
  localStorage.setItem("selectedSpot", spot.name);
};

const updatePopupStatus = async (spot) => {
  try {
    const res = await fetch("/api/all-status");
    if (!res.ok) return;
    const statusMap = await res.json();
    const status = statusMap[spot.name];
    const el = document.getElementById(`popup-status-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`);
    if (!el || !status) return;
    if (status === "LIVE") {
      el.innerHTML = `<span class="dot"></span> LIVE`;
      el.classList.add("is-live");
      el.classList.remove("is-waiting");
    } else {
      el.innerHTML = `<span class="dot"></span> WAITING`;
      el.classList.add("is-waiting");
      el.classList.remove("is-live");
    }
  } catch {}
};

const renderSpotPopup = (spot) => {
  const isFav = favoritesSet.has(spot.name);
  const badgeId = `badge-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`;
  const safeId = spot.name.replace(/[^a-zA-Z0-9]/g, '');
  const isLive = document.getElementById(badgeId)?.classList.contains('is-live');
  const statusHtml = isLive 
    ? `<span id="popup-status-${safeId}" class="popup-status is-live"><span class="dot"></span> LIVE</span>` 
    : `<span id="popup-status-${safeId}" class="popup-status is-waiting"><span class="dot"></span> WAITING</span>`;

  return `
    <div class="spot-popup compact-popup">
        <button class="popup-close" onclick="map.closePopup()">✕</button>
        <div class="popup-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <h4 class="popup-spot-name" style="margin:0;">${spot.name}</h4>
            ${statusHtml}
        </div>
        <div class="spot-popup-actions" style="display:flex; flex-direction:column; gap:8px;">
            <a class="popup-btn popup-btn--primary" href="conditions.html?spot=${encodeURIComponent(spot.name)}" style="text-align:center; text-decoration:none;">Voir Conditions</a>
            <a class="popup-btn popup-btn--webcam" href="cameras.html?spot=${encodeURIComponent(spot.name)}" style="text-align:center; text-decoration:none;">📷 Webcams</a>
            <button class="popup-btn popup-btn--fav ${isFav ? 'active' : ''}" onclick="window.toggleFav('${spot.name}', this)" style="width:100%;">
               ${isFav ? '♥ Retirer Favori' : '♡ Ajouter Favori'}
            </button>
        </div>
    </div>`;
};

window.toggleFav = (name, btn) => {
    toggleFavorite(name);
    const isFav = favoritesSet.has(name);
    if(btn && btn.classList) {
        btn.classList.toggle('active');
        btn.innerHTML = isFav ? '♥ Favori' : '♡ Ajouter Favori';
        btn.style.color = '#000';
    }
    if (document.body.classList.contains("favorites-page")) initFavoritesPage();
};

const renderSpotList = () => {
  const list = document.getElementById("spot-list");
  if (!list) return;
  const query = (document.getElementById("spot-search")?.value || "").toLowerCase();
  const selected = localStorage.getItem("selectedSpot");
  list.innerHTML = "";
  spots.forEach((spot) => {
    if (query && !spot.name.toLowerCase().includes(query)) return;
    const badgeId = `badge-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`; 
    const card = document.createElement("button");
    card.type = "button";
    card.className = `spot-card${spot.name === selected ? " is-active" : ""}`;
    card.dataset.spot = spot.name;
    card.innerHTML = `<div class="spot-card-header"><h4 class="spot-name">${spot.name}</h4><span class="spot-live-badge" id="${badgeId}">...</span></div><div class="spot-card-meta"><span class="spot-region">${spot.region}</span></div>`;
    card.addEventListener("click", () => {
      const marker = markersByName.get(spot.name);
      if (marker) selectSpot(spot, marker);
    });
    list.appendChild(card);
  });
  updateListStatus();
  updateQuotaUI();
};

const updateSpotListSelection = (name, doScroll = true) => {
  document.querySelectorAll(".spot-card").forEach(c => {
    c.classList.toggle("is-active", c.dataset.spot === name);
    if (doScroll && c.dataset.spot === name) c.scrollIntoView({ behavior: "smooth", block: "center" });
  });
};

const updateListStatus = async () => {
  try {
    const res = await fetch("/api/all-status");
    if (!res.ok) return;
    const statusMap = await res.json();
    spots.forEach(spot => {
      const badgeId = `badge-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`;
      const badge = document.getElementById(badgeId);
      if (badge && statusMap[spot.name]) {
        badge.textContent = statusMap[spot.name];
        badge.className = `spot-live-badge is-${statusMap[spot.name].toLowerCase()}`;
        if(statusMap[spot.name] === "LIVE") badge.classList.add("is-live");
      }
    });
  } catch (e) {}
};

const toggleFavorite = async (name) => {
  const u = JSON.parse(localStorage.getItem("surfUser") || "null");
  if (!u) { 
    const modal = document.getElementById("auth-modal");
    const loginView = document.getElementById("auth-login-view");
    const registerView = document.getElementById("auth-register-view");
    if (modal) modal.classList.add("is-open");
    if (loginView) loginView.style.display = "none";
    if (registerView) registerView.style.display = "block";
    return; 
  }
  const add = !favoritesSet.has(name);
  try {
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, spotName: name, action: add ? "add" : "remove" })
    });
    if (add) favoritesSet.add(name); else favoritesSet.delete(name);
  } catch {}
};

// --- 7. NEWS ET AUTRES PAGES ---
const renderHomeNews = async () => {
  const container = document.getElementById("news-preview");
  if (!container) return;
  try {
    const res = await fetch("/api/news");
    const newsData = await res.json();
    if (newsData.length === 0) { container.innerHTML = '<p style="color:#666; text-align:center;">Aucune actu.</p>'; return; }
    container.innerHTML = newsData.slice(0, 3).map(n => `
      <article class="news-card">
        <div class="news-img-wrapper">
            <img src="/api/proxy-img?url=${encodeURIComponent(n.img)}" class="news-img" alt="${n.title}" loading="lazy" referrerpolicy="no-referrer">
            <span class="news-badge">${n.tag}</span>
        </div>
        <div class="news-content">
          <h3>${n.title}</h3>
          <a href="${n.link}" target="_blank" class="news-btn">Lire l'article →</a>
        </div>
      </article>
    `).join('');
  } catch (e) { container.innerHTML = "<p style='color:#666;'>Impossible de charger.</p>"; }
};

const renderFullNews = async () => {
    const grid = document.getElementById("full-news-grid");
    const hero = document.getElementById("news-hero-container");
    if (!grid || !hero) return;
    try {
        const res = await fetch("/api/news"); 
        const allNews = await res.json();
        
        if (allNews.length === 0) { hero.innerHTML = "<p style='color:#fff;'>Chargement...</p>"; return; }
        
        const topStory = allNews[0];
        const otherStories = allNews.slice(1);
        
        hero.innerHTML = `
            <div class="hero-news-card">
                <div class="hero-bg" style="background-image: url('/api/proxy-img?url=${encodeURIComponent(topStory.img)}');"></div>
                <div class="hero-overlay">
                    <span class="hero-tag">🔥 À LA UNE</span>
                    <h1 class="hero-title">${topStory.title}</h1>
                    <p class="hero-desc">${topStory.desc}</p>
                    <a href="${topStory.link}" target="_blank" class="hero-btn">Lire l'article</a>
                </div>
            </div>`;
            
        grid.innerHTML = otherStories.map(n => `
            <article class="news-card">
                <div class="news-img-wrapper"><img src="/api/proxy-img?url=${encodeURIComponent(n.img)}" class="news-img" loading="lazy" referrerpolicy="no-referrer"><span class="news-badge">${n.tag}</span></div>
                <div class="news-content"><h3>${n.title}</h3><a href="${n.link}" target="_blank" class="news-btn">Lire la suite</a></div>
            </article>`).join('');
    } catch (e) { console.error("Erreur news:", e); }
};

const fetchJsonWithRetry = async (url, opts = {}, retries = 3, baseDelay = 300) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries - 1) throw e;
      await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
    }
  }
};

const fetchJsonFromHosts = async (hosts, path, opts = {}, retriesPerHost = 2, baseDelay = 300) => {
  for (const host of hosts) {
    for (let a = 0; a < retriesPerHost; a++) {
      try {
        const res = await fetch(`${host}${path}`, opts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        await new Promise(r => setTimeout(r, baseDelay * (a + 1)));
      }
    }
  }
  throw new Error("UNAVAILABLE");
};

let lastRobotsData = null;

const renderHomeRobotsHub = async () => {
  const container = document.getElementById("home-robots-hub");
  if (!container) return;
  try {
    let data = null;
    try {
      data = await fetchJsonWithRetry(`/api/robots-status`, {}, 3, 300);
    } catch {
      data = await fetchJsonFromHosts(
        [window.location.origin, "http://127.0.0.1:3001", "http://localhost:3001"],
        "/api/robots-status",
        {},
        2,
        300
      );
    }
    lastRobotsData = data;
    const list = [
      { key: "Tide-Master", icon: "🌊" },
      { key: "Swell-Pulse", icon: "⏱️" },
      { key: "Vector-Angle", icon: "📐" },
      { key: "Energy-Core", icon: "⚡" },
      { key: "Anti-Chop", icon: "🛡️" },
      { key: "News-Bot", icon: "🤖" },
      { key: "Crowd-Predict", icon: "👥" },
      { key: "Feel-Real", icon: "🌡️" },
      { key: "Solar-Sync", icon: "☀️" },
      { key: "Eco-Scan", icon: "🧬" },
      { key: "Swell-Hunter", icon: "🏹" }
    ];
    const colorFor = s => {
      const v = (s || "").toUpperCase();
      if (["ERROR", "CRITICAL", "WARN", "OFF"].includes(v)) return "#ff304a";
      if (["READY", "ACTIF", "RUNNING", "RESP", "DATA", "SUCCESS"].includes(v)) return "#4ade80";
      return "#2a7bff";
    };
    container.innerHTML = list.map(r => {
      const st = data[r.key] || {};
      const c = colorFor(st.status);
      const desc = st.details || "";
      return `
        <div class="ai-robot-card" data-name="${r.key}">
          <span class="robot-icon">${r.icon}</span>
          <div class="robot-info">
            <span class="robot-name"><span class="status-dot" style="background:${c}"></span>${r.key}</span>
            <span class="robot-value" style="color:${c}">${st.status || "--"}</span>
            <span class="robot-desc">${desc}</span>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    if (lastRobotsData) {
      const list = [
        { key: "Tide-Master", icon: "🌊" },
        { key: "Swell-Pulse", icon: "⏱️" },
        { key: "Vector-Angle", icon: "📐" },
        { key: "Energy-Core", icon: "⚡" },
        { key: "Anti-Chop", icon: "🛡️" },
        { key: "News-Bot", icon: "🤖" },
        { key: "Crowd-Predict", icon: "👥" },
        { key: "Feel-Real", icon: "🌡️" },
        { key: "Solar-Sync", icon: "☀️" },
        { key: "Eco-Scan", icon: "🧬" },
        { key: "Swell-Hunter", icon: "🏹" }
      ];
      const colorFor = s => {
        const v = (s || "").toUpperCase();
        if (["ERROR", "CRITICAL", "WARN", "OFF"].includes(v)) return "#ff304a";
        if (["READY", "ACTIF", "RUNNING", "RESP", "DATA", "SUCCESS"].includes(v)) return "#4ade80";
        return "#2a7bff";
      };
      container.innerHTML = list.map(r => {
        const st = lastRobotsData[r.key] || {};
        const c = colorFor(st.status);
        const desc = st.details || "";
        return `
          <div class="ai-robot-card" data-name="${r.key}">
            <span class="robot-icon">${r.icon}</span>
            <div class="robot-info">
              <span class="robot-name"><span class="status-dot" style="background:${c}"></span>${r.key}</span>
              <span class="robot-value" style="color:${c}">${st.status || "--"}</span>
              <span class="robot-desc">${desc}</span>
            </div>
          </div>
        `;
      }).join("");
    }
    setTimeout(renderHomeRobotsHub, 3000);
  }
};

const initConditionsPage = () => {
  const params = new URLSearchParams(window.location.search);
  const spotName = params.get("spot");
  const spot = spots.find(s => s.name === spotName);
  if (!spot) { window.location.href = "index.html"; return; }
  document.getElementById("cond-name").textContent = spot.name;
  const btnCam = document.getElementById("btn-cam");
  if(btnCam) btnCam.href = `cameras.html?spot=${encodeURIComponent(spot.name)}`;
  
  const updateFavBtn = () => {
    const isFav = favoritesSet.has(spot.name);
    const btnFav = document.getElementById("btn-fav");
    if(btnFav) {
      btnFav.textContent = isFav ? "♥ Favori" : "♡ Ajouter";
      btnFav.style.color = isFav ? "#ff304a" : "#fff";
    }
  };
  updateFavBtn();
  document.getElementById("btn-fav")?.addEventListener("click", () => { toggleFavorite(spot.name); updateFavBtn(); });

  setTimeout(() => {
    const container = document.getElementById("mini-map");
    if (!container) return;
    const miniMap = L.map("mini-map", { zoomControl: false, dragging: false, scrollWheelZoom: false, attributionControl: false }).setView(spot.coords, 10);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(miniMap);
    L.circleMarker(spot.coords, { radius: 8, fillColor: "#ff304a", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(miniMap);
  }, 200);

  const fetchConditions = async () => {
    try {
      const wRes = await fetch(`/api/marine?lat=${spot.coords[0]}&lng=${spot.coords[1]}`);
      const weather = await wRes.json();
      const tRes = await fetch(`/api/tide?spot=${encodeURIComponent(spot.name)}`);
      const tide = await tRes.json();
      
      updateDashboard(weather, tide);
      runAiRobots(weather);
      
      setTimeout(() => { updateListStatus(); updateQuotaUI(); }, 500);
    } catch (e) { document.getElementById("status-title").textContent = "ERREUR CONNEXION"; }
  };

  const updateDashboard = (weather, tide) => {
    const now = new Date();
    const dataTime = new Date(weather.sourceTime || now);
    const diffMins = Math.floor((now - dataTime) / 60000);
    let timeText = diffMins < 60 ? `${diffMins} min` : `${Math.floor(diffMins/60)}h${diffMins%60}`;
    if(document.getElementById("cond-updated")) document.getElementById("cond-updated").textContent = `Mise à jour : il y a ${timeText}`;
    
    const statusBox = document.getElementById("status-box");
    const statusTitle = document.getElementById("status-title");
    const statusDesc = document.getElementById("status-desc");
    const statusIcon = document.getElementById("status-icon");
    statusBox.className = "status-banner"; 
    
    const spotNameActual = document.getElementById("cond-name").textContent;
    const safeTideStage = tide.stage || (tide.allTides && tide.allTides[0] ? tide.allTides[0].stage : "Stable");
    const qual = calculateQuality(weather.waveHeight, weather.windSpeed, weather.wavePeriod, weather.windDirection, safeTideStage, spotNameActual);
    
    statusBox.classList.add(qual.class);
    statusTitle.textContent = qual.label;
    statusDesc.textContent = qual.botMsg;
    statusIcon.textContent = qual.label === "ÉPIQUE" ? "⚡️" : "🌊";

    if(document.getElementById("val-quality")) { 
        document.getElementById("val-quality").textContent = qual.label; 
        document.getElementById("val-quality").style.color = qual.color; 
    }
    document.getElementById("val-wave").textContent = weather.waveHeight?.toFixed(1) || "-";
    document.getElementById("val-period").textContent = weather.wavePeriod?.toFixed(0) || "-";
    document.getElementById("val-wind-speed").textContent = weather.windSpeed || "-";
    (function() {
      const spotNameActual = document.getElementById("cond-name").textContent;
      const spotObj = spots.find(s => s.name === spotNameActual);
      const label = classifyWindRelative(spotObj?.facing, weather.windDirection);
      const orient = cardinalLabelFr(weather.windDirection);
      document.getElementById("val-wind-dir").textContent = weather.windDirection ? `${label} • ${orient}` : "-";
    })();
    document.getElementById("val-swell-dir").textContent = getSwellDir(weather) || "-";

    const tideDisplay = document.getElementById("tide-display");
    if (tideInterval) clearInterval(tideInterval); 
    
    const updateTideTimer = () => {
      let nextTideObj = null;
      if (tide.allTides && Array.isArray(tide.allTides)) {
          nextTideObj = tide.allTides.find(t => new Date(t.time) > new Date());
      } else if (tide.nextTime && new Date(tide.nextTime) > new Date()) {
          nextTideObj = { time: tide.nextTime, stage: tide.stage, level: tide.level };
      }

      if (nextTideObj) {
        const nextTideTime = new Date(nextTideObj.time);
        const diffMs = nextTideTime - new Date();
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        const state = (nextTideObj.stage === 'high' || nextTideObj.stage === 'Haute') ? 'Haute' : 'Basse';
        const timeColor = h === 0 ? "#4ade80" : "#fff";
        tideDisplay.innerHTML = `<strong style="color:var(--accent)">MARÉE ${state.toUpperCase()}</strong> dans <span style="color:${timeColor}; font-weight:800;">${h}h ${m}m</span> <small style="opacity:0.6">(${nextTideObj.level})</small>`;
      } else { 
        tideDisplay.innerHTML = `<span style="color:#facc15; font-weight:bold;">🌊 MARÉE : CALCUL EN COURS...</span>`;
      }
    };
    updateTideTimer(); 
    tideInterval = setInterval(updateTideTimer, 30000);

    const list = document.getElementById("forecast-list");
    const dash = document.querySelector(".dashboard-layout");
    if (list && dash && list.parentElement !== dash) {
        const h3 = list.previousElementSibling;
        dash.insertBefore(list, dash.lastElementChild?.nextSibling || null);
        if (h3 && h3.tagName === "H3") {
            dash.insertBefore(h3, list);
        }
    }
    if (list && weather.forecast) {
        const groups = {};
        weather.forecast.forEach(item => {
            const dt = new Date(item.time);
            const key = dt.toISOString().slice(0,10);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        const keys = Object.keys(groups).sort();
        list.classList.add("calendar-grid");
        list.innerHTML = keys.map(key => {
            const arr = groups[key];
            const mid = arr.find(h => new Date(h.time).getHours() === 12) || arr[Math.floor(arr.length/2)];
            const d = new Date(arr[0].time);
            const dateLabel = d.toLocaleDateString("fr-FR", { weekday: 'short', day: 'numeric' });
            const q = calculateQuality(mid.waveHeight, mid.windSpeed, mid.wavePeriod, mid.windDirection, safeTideStage, spotNameActual);
            return `
              <div class="calendar-day ${q.class}" data-key="${key}">
                <div class="cal-date">${dateLabel}</div>
                <div class="cal-badge" style="color:${q.color}">${q.label}</div>
                <div class="cal-primary">${mid.waveHeight?.toFixed(1)}m • ${Math.round(mid.wavePeriod)}s</div>
                <div class="cal-source">${
                  (() => {
                    const src = weather.source || 'API';
                    const t = weather.sourceTime ? new Date(weather.sourceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null;
                    return t ? `${src} • MAJ ${t}` : src;
                  })()
                }</div>
                <div class="cal-details"></div>
              </div>`;
        }).join('');
        const modal = document.getElementById("forecast-modal");
        const modalBody = document.getElementById("forecast-modal-body");
        const closeElems = () => modal.querySelectorAll("[data-modal-close]").forEach(b => b.onclick = () => modal.classList.remove("is-open"));
        const hourlyStrip = document.getElementById("hourly-strip");
        const renderHourlyFor = (key) => {
            if (!hourlyStrip) return;
            const arr = groups[key] || [];
            const prepared = arr
              .map(x => ({ h: new Date(x.time).getHours(), x }))
              .filter(o => o.h >= 5 || o.h === 0)
              .sort((a,b) => ((a.h >= 5 ? a.h : 24) - (b.h >= 5 ? b.h : 24)));
            hourlyStrip.innerHTML = prepared.map((o,i) => {
                const x = o.x;
                const q = calculateQuality(x.waveHeight, x.windSpeed, x.wavePeriod, x.windDirection, safeTideStage, spotNameActual);
                const labelH = String(o.h).padStart(2,'0') + 'h';
                return `
                  <div class="hourly-chip ${q.class}" data-time="${x.time}" data-day="${key}" style="animation-delay:${i*60}ms">
                    <div class="h-time">${labelH}</div>
                    <div class="h-primary">${x.waveHeight?.toFixed(1)}m • ${Math.round(x.wavePeriod)}s</div>
                  </div>
                `;
            }).join('');
            Array.from(hourlyStrip.querySelectorAll(".hourly-chip")).forEach(chip => {
                chip.onclick = () => {
                    const time = chip.getAttribute("data-time");
                    const day = chip.getAttribute("data-day");
                    const item = (groups[day] || []).find(z => new Date(z.time).toISOString() === new Date(time).toISOString());
                    if (!item) return;
                    openHourModal(item);
                };
            });
        };
        const openHourModal = (item) => {
            const d = new Date(item.time);
            const dateFull = d.toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'short' }) + " • " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const q = calculateQuality(item.waveHeight, item.windSpeed, item.wavePeriod, item.windDirection, safeTideStage, spotNameActual);
            const spotObjX = spots.find(s => s.name === spotNameActual);
            const rel = classifyWindRelative(spotObjX?.facing, item.windDirection);
            const orient = cardinalLabelFr(item.windDirection);
            const swell = item.swellDirection || getSwellDir({ forecast: [item] });
            const src = weather.source || "API";
            const t = weather.sourceTime ? new Date(weather.sourceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null;
            modalBody.innerHTML = `
              <div class="fm-header ${q.class}">
                <div class="fm-date">${dateFull}</div>
                <div class="fm-badge" style="color:${q.color}">${q.label}</div>
                <div class="fm-primary">${item.waveHeight?.toFixed(1)}m • ${Math.round(item.wavePeriod)}s • ${item.windSpeed} km/h</div>
                <div class="fm-source">${t ? `${src} • MAJ ${t}` : src}</div>
              </div>
              <div class="fm-details">
                <div class="detail-line">
                  <div class="dl-item"><span class="dl-label">VAGUES</span><span class="dl-val">${item.waveHeight?.toFixed(1)} m</span></div>
                  <div class="dl-item"><span class="dl-label">PÉRIODE</span><span class="dl-val">${Math.round(item.wavePeriod)} s</span></div>
                  <div class="dl-item"><span class="dl-label">VENT</span><span class="dl-val">${item.windSpeed} km/h</span></div>
                  <div class="dl-item"><span class="dl-label">DIR. VENT</span><span class="dl-val">${rel} • ${orient}</span></div>
                  <div class="dl-item"><span class="dl-label">DIR. HOULE</span><span class="dl-val">${swell || 'N/A'}</span></div>
                  <div class="dl-item"><span class="dl-label">QUALITÉ</span><span class="dl-val">${q.label}</span></div>
                </div>
              </div>
            `;
            modal.classList.add("is-open");
            closeElems();
        };
        const openForecastModal = (key) => {
            const arr = groups[key];
            if (!arr || arr.length === 0) return;
            const mid = arr.find(h => new Date(h.time).getHours() === 12) || arr[Math.floor(arr.length/2)];
            const d = new Date(arr[0].time);
            const dateFull = d.toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'short' });
            const q = calculateQuality(mid.waveHeight, mid.windSpeed, mid.wavePeriod, mid.windDirection, safeTideStage, spotNameActual);
            const spotObjX = spots.find(s => s.name === spotNameActual);
            const rel = classifyWindRelative(spotObjX?.facing, mid.windDirection);
            const orient = cardinalLabelFr(mid.windDirection);
            const swell = mid.swellDirection || getSwellDir({ forecast: arr });
            const src = weather.source || "API";
            const t = weather.sourceTime ? new Date(weather.sourceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null;
            modalBody.innerHTML = `
              <div class="fm-header ${q.class}">
                <div class="fm-date">${dateFull}</div>
                <div class="fm-badge" style="color:${q.color}">${q.label}</div>
                <div class="fm-primary">${mid.waveHeight?.toFixed(1)}m • ${Math.round(mid.wavePeriod)}s • ${mid.windSpeed} km/h</div>
                <div class="fm-source">${t ? `${src} • MAJ ${t}` : src}</div>
              </div>
              <div class="fm-details">
                <div class="detail-line">
                  <div class="dl-item"><span class="dl-label">VAGUES</span><span class="dl-val">${mid.waveHeight?.toFixed(1)} m</span></div>
                  <div class="dl-item"><span class="dl-label">PÉRIODE</span><span class="dl-val">${Math.round(mid.wavePeriod)} s</span></div>
                  <div class="dl-item"><span class="dl-label">VENT</span><span class="dl-val">${mid.windSpeed} km/h</span></div>
                  <div class="dl-item"><span class="dl-label">DIR. VENT</span><span class="dl-val">${rel} • ${orient}</span></div>
                  <div class="dl-item"><span class="dl-label">DIR. HOULE</span><span class="dl-val">${swell || 'N/A'}</span></div>
                  <div class="dl-item"><span class="dl-label">QUALITÉ</span><span class="dl-val">${q.label}</span></div>
                </div>
              </div>
            `;
            modal.classList.add("is-open");
            closeElems();
        };
        document.querySelectorAll(".calendar-day").forEach(el => {
            el.onclick = () => {
                document.querySelectorAll(".calendar-day").forEach(x => x.classList.remove("is-selected"));
                el.classList.add("is-selected");
                renderHourlyFor(el.dataset.key);
                openForecastModal(el.dataset.key);
            };
        });
        const firstKey = keys[0];
        const firstEl = list.querySelector(`[data-key="${firstKey}"]`);
        if (firstEl) {
            firstEl.classList.add("is-selected");
            renderHourlyFor(firstKey);
        }
    }
  };
  fetchConditions();
};

const initFavoritesPage = async () => {
    const container = document.getElementById("fav-grid");
    const emptyState = document.getElementById("empty-favs");
    if (!container || !emptyState) return;

    const u = JSON.parse(localStorage.getItem("surfUser") || "null");
    if (!u) {
        container.style.display = "none";
        emptyState.style.display = "block";
        return;
    }
    await loadFavorites();
    const favs = Array.from(favoritesSet);
    if (favs.length === 0) {
        container.style.display = "none";
        emptyState.style.display = "block";
        return;
    }

    container.style.display = "grid";
    emptyState.style.display = "none";
    container.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Synchronisation des favoris...</p>";

    const promises = favs.map(async (name) => {
        const spot = spots.find(s => s.name === name);
        if (!spot) return null;
        try {
            const res = await fetch(`/api/marine?lat=${spot.coords[0]}&lng=${spot.coords[1]}`);
            const weather = await res.json();
            const quality = calculateQuality(weather.waveHeight, weather.windSpeed, weather.wavePeriod, weather.windDirection, "mid", spot.name);
            return { spot, weather, quality };
        } catch (e) {
            return { spot, weather: null, quality: { label: "--", color: "#666", class: "is-medium" } };
        }
    });

    const results = await Promise.all(promises);
    
    container.innerHTML = results.filter(r => r !== null).map(item => {
        const { spot, weather, quality } = item;
        return `
        <div class="fav-card ${quality.class}" onclick="window.location.href='conditions.html?spot=${encodeURIComponent(spot.name)}'">
            <div class="fav-card-header">
                <h3>${spot.name}</h3>
                <button class="fav-remove-btn" onclick="event.stopPropagation(); window.toggleFav('${spot.name}');">✕</button>
            </div>
            <div class="fav-stats">
                <div class="fav-stat-main">
                    <span class="fs-val">${weather ? weather.waveHeight.toFixed(1) : "-"}m</span>
                    <span class="fs-label">${weather ? Math.round(weather.wavePeriod) : "-"}s</span>
                </div>
                <div class="fav-stat-secondary">
                    <span class="fs-wind">${weather ? weather.windSpeed : "-"} km/h ${weather ? weather.windDirection : ""}</span>
                    <span class="quality-pill" style="background:${quality.color}">${quality.label}</span>
                </div>
            </div>
            <div class="fav-footer">
                ${spot.region} • <span style="color:${quality.color}">${quality.botMsg.split(':')[0]}</span>
            </div>
        </div>
        `;
    }).join('');
};

const checkGlobalAlerts = async () => { /* Code Alerte Inchangé */ };

// --- 9. STATS, RADAR & OUTILS ---
const updateHomeStats = async () => {
  try {
      const refSpot = spots[0]; // Hossegor

      const weatherRes = await fetch(`/api/marine?lat=${refSpot.coords[0]}&lng=${refSpot.coords[1]}`);
      const weather = await weatherRes.json();

      const tideRes = await fetch(`/api/tide?spot=${encodeURIComponent(refSpot.name)}`);
      const tide = await tideRes.json();

      const statusRes = await fetch("/api/all-status");
      const statuses = await statusRes.json();
      const liveCount = Object.values(statuses).filter(s => s === "LIVE").length;

      const waterEl = document.getElementById("stat-water");
      const swellEl = document.getElementById("stat-swell");
      const activeEl = document.getElementById("stat-active");
      const tideEl = document.getElementById("stat-tide");

      if (waterEl) {
          const temp = (weather && weather.waterTemperature != null)
              ? weather.waterTemperature
              : (weather && Array.isArray(weather.forecast) && weather.forecast[0] && weather.forecast[0].waterTemperature != null)
                  ? weather.forecast[0].waterTemperature
                  : null;
          waterEl.querySelector(".bubble-value").textContent = (temp != null) ? `${temp}°C` : "--";
          if (temp != null) waterEl.querySelector(".bubble-value").style.color = "#4ade80";
      }

      if(swellEl && weather.waveHeight) {
          swellEl.querySelector(".bubble-value").textContent = `${weather.waveHeight.toFixed(1)}m • ${Math.round(weather.wavePeriod)}s`;
          swellEl.querySelector(".bubble-value").style.color = weather.waveHeight > 1.5 ? "#d946ef" : "#fff";
      }

      if(activeEl) {
          activeEl.querySelector(".bubble-value").textContent = `${liveCount}`;
      }

      if(tideEl) {
          let tideText = "--";
          if (tide.allTides && tide.allTides.length) {
              const now = new Date();
              const next = tide.allTides.find(t => new Date(t.time) > now);
              if (next) {
                  const isRising = next.stage === "Haute" || next.stage === "high";
                  const direction = isRising ? "MONTANTE ↗" : "DESCENDANTE ↘";
                  tideText = direction;
                  tideEl.querySelector(".bubble-value").style.fontSize = "1rem"; 
              }
          }
          tideEl.querySelector(".bubble-value").textContent = tideText;
      }

  } catch (e) { console.error("Erreur stats accueil", e); }
};

const initRadar = async () => {
    const container = document.getElementById("radar-container");
    if (!container) return; 
    let trendingSpots = [];
    try {
        const res = await fetch("/api/alerts");
        const alerts = await res.json();
        trendingSpots = alerts.slice(0, 4).map(a => spots.find(s => s.name === a.name)).filter(Boolean);
    } catch {}
    if (trendingSpots.length === 0) trendingSpots = [spots[0], spots[7], spots[18], spots[9]];
    container.innerHTML = trendingSpots.map((spot, idx) => `
        <div class="radar-card ${idx === 0 ? 'is-featured' : ''}" onclick="window.location.href='conditions.html?spot=${encodeURIComponent(spot.name)}'">
            <div class="radar-header">
                <span class="radar-live-dot"></span>
                <span class="radar-status">SCAN LIVE</span>
            </div>
            <h3 class="radar-title">${spot.name}</h3>
            <p class="radar-region">${spot.region}</p>
            <div class="radar-wave">
                <div class="wave-line"></div>
                <div class="wave-line" style="animation-delay: 0.2s"></div>
                <div class="wave-line" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    `).join('');
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

const initMobileInstall = () => {
    const installModal = document.getElementById("install-modal");
    const iosGuide = document.getElementById("ios-install-guide");
    const androidGuide = document.getElementById("android-install-guide");
    const androidBtn = document.getElementById("pwa-install-btn");
    const iosCta = document.getElementById("btn-install-ios");
    const androidCta = document.getElementById("btn-install-android");

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (iosCta) {
        iosCta.addEventListener("click", () => {
            installModal.classList.add("is-open");
            iosGuide.style.display = "block";
            androidGuide.style.display = "none";
        });
    }
    if (androidCta) {
        androidCta.addEventListener("click", async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
            } else {
                installModal.classList.add("is-open");
                iosGuide.style.display = "none";
                androidGuide.style.display = "block";
            }
        });
    }

    if(androidBtn) {
        androidBtn.addEventListener("click", async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                installModal.classList.remove("is-open");
            } else {
                alert("L'installation n'est pas supportée par ce navigateur ou l'app est déjà installée.");
            }
        });
    }
};

const initCamerasPage = async () => {
    const listContainer = document.getElementById("cam-list-container");
    const mainScreen = document.getElementById("main-cam-screen");
    const liveName = document.getElementById("cam-live-name");
    const metaTitle = document.getElementById("meta-title");
    const metaDesc = document.getElementById("meta-desc");
    const btnRedirect = document.getElementById("cam-redirect-btn");
    const timeDisplay = document.getElementById("cam-live-time");
    let camStatusMap = {};
    let camStatsInterval = null;
    let currentSpot = null;

    if (!listContainer || !mainScreen) return;

    if (camClockInterval) clearInterval(camClockInterval);
    camClockInterval = setInterval(() => {
        const now = new Date();
        if(timeDisplay) timeDisplay.textContent = now.toLocaleTimeString();
    }, 1000);

    const buildUnsplashSurf = (s) => {
        const keys = ["surfing", "barrel", "wave", "ocean"].join(",");
        const u = `https://source.unsplash.com/800x600/?${keys}`;
        return `/api/proxy-img?url=${encodeURIComponent(u)}`;
    };
    const imageForSpot = (s) => spotImages[s.name] || buildUnsplashSurf(s);
    const camImages = spots.map(s => imageForSpot(s));

    const loadCam = (spot, imgUrl) => {
        mainScreen.style.backgroundImage = `url('${imgUrl}')`;
        if(liveName) liveName.textContent = spot.name.toUpperCase();
        if(metaTitle) metaTitle.textContent = spot.name;
        const status = camStatusMap[spot.name] || "INCONNU";
        if(metaDesc) metaDesc.textContent = `Vue directe sur ${spot.name} • ${spot.region}. Statut: ${status}`;
        
        const searchUrl = `https://www.google.com/search?q=webcam+${encodeURIComponent(spot.name)}+live`;
        const gosurfUrl = `https://www.google.com/search?q=site%3Agosurf+webcam+${encodeURIComponent(spot.name)}`;
        const directWebcam = (typeof spotLinks !== "undefined" && spotLinks[spot.name]?.webcam) || null;
        const directGoSurf = (typeof spotLinks !== "undefined" && spotLinks[spot.name]?.gosurf) || null;
        if(btnRedirect) btnRedirect.href = directWebcam || searchUrl;
        const btnGoSurf = document.getElementById("cam-gosurf-btn");
        if (btnGoSurf) btnGoSurf.href = directGoSurf || gosurfUrl;

        document.querySelectorAll(".cam-item").forEach(c => c.classList.remove("active"));
        const activeItem = document.getElementById(`cam-item-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`);
        if(activeItem) activeItem.classList.add("active");
        currentSpot = spot;
        updateCamStats(spot);
        if (camStatsInterval) clearInterval(camStatsInterval);
        camStatsInterval = setInterval(() => {
            if (currentSpot) updateCamStats(currentSpot);
        }, 5000);
    };

    listContainer.innerHTML = spots.map((spot, index) => {
        const img = camImages[index % camImages.length];
        const safeId = spot.name.replace(/[^a-zA-Z0-9]/g, '');
        return `
            <div class="cam-item" id="cam-item-${safeId}" data-index="${index}" onclick='window.selectCam(${JSON.stringify(spot)}, "${img}")'>
                <div class="cam-thumb" style="background-image: url('${img}');"></div>
                <div class="cam-info">
                    <h4>${spot.name}</h4>
                    <div class="cam-region">${spot.region} • ${spot.country}</div>
                    <span class="cam-status">● LIVE</span>
                </div>
            </div>
        `;
    }).join('');

    window.selectCam = (spot, img) => loadCam(spot, img);
    listContainer.addEventListener("click", (e) => {
        const item = e.target.closest(".cam-item");
        if (!item) return;
        const idx = parseInt(item.getAttribute("data-index"), 10);
        if (isNaN(idx)) return;
        const s = spots[idx];
        const img = camImages[idx];
        loadCam(s, img);
    });

    if (spots.length > 0) loadCam(spots[0], camImages[0]);
    try {
        const res = await fetch("/api/all-status");
        camStatusMap = await res.json();
        spots.forEach(s => {
            const safeId = s.name.replace(/[^a-zA-Z0-9]/g, '');
            const el = document.querySelector(`#cam-item-${safeId} .cam-status`);
            if (el && camStatusMap[s.name]) el.textContent = camStatusMap[s.name] === "LIVE" ? "● LIVE" : "○ WAITING";
        });
        const first = spots[0];
        if (first) {
          const img0 = camImages[0];
          loadCam(first, img0);
        }
    } catch {}
    
    async function updateCamStats(spot) {
        try {
            const r = await fetch(`/api/marine?lat=${spot.coords[0]}&lng=${spot.coords[1]}`);
            const data = await r.json();
            const t = await fetch(`/api/tide?spot=${encodeURIComponent(spot.name)}`);
            const tide = await t.json();
            const w = document.getElementById("cs-wind");
            const s = document.getElementById("cs-swell");
            const m = document.getElementById("cs-tide");
            if (w) w.textContent = `${data.windSpeed} km/h`;
            if (s) s.textContent = `${data.waveHeight.toFixed(1)}m`;
            if (m) m.textContent = tide.stage || "Inconnu";
            const status = camStatusMap[spot.name] || "INCONNU";
            if (metaDesc) {
                metaDesc.textContent = `Vent ${data.windSpeed} km/h • Houle ${data.waveHeight.toFixed(1)}m • Marée ${tide.stage || "Inconnue"} — ${spot.name} (${spot.region}) • ${status}`;
            }
        } catch(e) {}
    }
};

const initVersusPage = () => {
    const selA = document.getElementById("select-spot-a");
    const selB = document.getElementById("select-spot-b");
    if (!selA || !selB) return;

    const options = spots.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    selA.innerHTML = options;
    selB.innerHTML = options;
    if (spots.length > 1) selB.selectedIndex = 1;

    const updateComparison = async () => {
        const nameA = selA.value;
        const nameB = selB.value;
        
        document.getElementById("verdict-text").textContent = "Calcul IA en cours...";
        document.getElementById("versus-verdict").style.display = "none";

        const fetchData = async (name) => {
            const spot = spots.find(s => s.name === name);
            if (!spot) return null;
            try {
                const res = await fetch(`/api/marine?lat=${spot.coords[0]}&lng=${spot.coords[1]}`);
                const weather = await res.json();
                return { ...weather, quality: calculateQuality(weather.waveHeight, weather.windSpeed, weather.wavePeriod, weather.windDirection, "mid", spot.name) };
            } catch (e) { return null; }
        };

        const [dataA, dataB] = await Promise.all([fetchData(nameA), fetchData(nameB)]);

        const renderSide = (side, data) => {
            if (!data) return;
            const container = document.getElementById(`stats-${side}`);
            
            container.querySelector(".main-score").textContent = data.quality.label;
            container.querySelector(".main-score").style.color = data.quality.color;
            
            container.querySelector(".val-wave").textContent = `${data.waveHeight.toFixed(1)}m`;
            container.querySelector(".val-period").textContent = `${Math.round(data.wavePeriod)}s`;
            container.querySelector(".val-wind").textContent = `${data.windSpeed} km/h ${data.windDirection}`;
        };

        renderSide('a', dataA);
        renderSide('b', dataB);

        if (dataA && dataB) {
            let scoreA = 0; let scoreB = 0;
            if (dataA.waveHeight > dataB.waveHeight) scoreA++; else scoreB++;
            if (dataA.wavePeriod > dataB.wavePeriod) scoreA++; else scoreB++;
            if (dataA.windSpeed < dataB.windSpeed) scoreA++; else scoreB++;
            if (dataA.quality.label === "ÉPIQUE") scoreA += 2;
            if (dataB.quality.label === "ÉPIQUE") scoreB += 2;

            const verdictBox = document.getElementById("versus-verdict");
            const verdictText = document.getElementById("verdict-text");
            
            verdictBox.style.display = "block";
            
            if (scoreA > scoreB) {
                verdictText.innerHTML = `Vainqueur : <strong style="color:#4ade80">${nameA}</strong>`;
            } else if (scoreB > scoreA) {
                verdictText.innerHTML = `Vainqueur : <strong style="color:#4ade80">${nameB}</strong>`;
            } else {
                verdictText.innerHTML = "Égalité parfaite. Faites votre choix !";
            }
        }
    };

    selA.addEventListener("change", updateComparison);
    selB.addEventListener("change", updateComparison);
    updateComparison();
};

// --- 10. INITIALISATION AU CHARGEMENT ---
window.addEventListener("load", () => {
  initGatekeeper();
  handleAuthSwitch(); 
  initAuthLogic(); 
  loadFavorites();

  const loader = document.getElementById("app-loader");
  if(loader) { setTimeout(() => loader.classList.add("loader-hidden"), 800); }

  try {
      if (document.getElementById("surf-map")) { 
        initMap(); renderSpotList(); renderHomeNews(); renderHomeRobotsHub(); checkGlobalAlerts(); updateHomeStats(); initRadar(); initMobileInstall(); 
        document.getElementById("spot-search")?.addEventListener("input", () => setTimeout(renderSpotList, 200)); 
      }
      if (document.body.classList.contains("conditions-page")) initConditionsPage();
      if (document.body.classList.contains("cameras-page")) initCamerasPage(); 
      if (document.body.classList.contains("favorites-page")) initFavoritesPage(); 
      if (document.body.classList.contains("versus-page")) initVersusPage(); 
      if (document.body.classList.contains("actus-page")) renderFullNews(); 
  } catch (e) { console.error("Erreur critique init:", e); }

  document.body.addEventListener("click", e => {
    if (e.target.matches("[data-modal-close]") || e.target.closest(".modal-close")) {
      const openModal = document.querySelector(".modal.is-open");
      if (openModal) openModal.classList.remove("is-open");
    }
    
    if (e.target.matches("[data-modal='auth']")) {
        if (localStorage.getItem("surfUser")) {
            updateProfileModal();
            document.getElementById("profile-modal").classList.add("is-open");
        } else {
            document.getElementById("auth-modal").classList.add("is-open");
        }
    }

    if (e.target.matches("[data-modal='tech']")) {
      document.getElementById("tech-modal").classList.add("is-open");
    }

    const legalTarget = e.target.closest("[data-modal^='legal-']");
    if (legalTarget) {
        e.preventDefault();
        const type = legalTarget.getAttribute("data-modal");
        const doc = legalTexts[type];
        if (doc) {
            document.getElementById("legal-title").textContent = doc.title;
            document.getElementById("legal-body").innerHTML = doc.body;
            document.getElementById("legal-modal").classList.add("is-open");
        }
    }
  });
});

// AFFICHER BANNIÈRE COOKIES
window.addEventListener("load", () => {
    if (!localStorage.getItem("surfSenseCookies")) {
        setTimeout(() => {
            const banner = document.getElementById("cookie-banner");
            if (banner) banner.style.display = "block";
        }, 2000); // Apparaît après 2 secondes
    }
});

window.acceptCookies = () => {
    localStorage.setItem("surfSenseCookies", "accepted");
    document.getElementById("cookie-banner").style.display = "none";
};

// --- ACTIVATION PWA (APPLICATION MOBILE) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Terminal PWA : Connecté', reg))
      .catch(err => console.error('Terminal PWA : Erreur', err));
  });
}

setInterval(() => { renderHomeRobotsHub(); }, 5000);
