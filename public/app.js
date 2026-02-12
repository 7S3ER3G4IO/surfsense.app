let favoritesSet = new Set();
// --- 3. GATEKEEPER & AUTHENTIFICATION ---
const initGatekeeper = () => {
    const modal = document.getElementById("gatekeeper-modal");
    if (!modal) return;
    const user = localStorage.getItem("surfUser");
    const session = sessionStorage.getItem("accessGranted");
    const accepted = localStorage.getItem("surfAccessAccepted");
    if (user || session || accepted === "true") { modal.style.display = "none"; return; }
    
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
        localStorage.setItem("surfAccessAccepted", "true");
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
                    if (data.adminToken) localStorage.setItem("surfAdminToken", data.adminToken);
                    sessionStorage.setItem("accessGranted", "true");
                    localStorage.setItem("surfAccessAccepted", "true");
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
                    localStorage.setItem("surfAccessAccepted", "true");
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
        localStorage.removeItem("surfAdminToken");
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

const getWeatherIcon = (cloudCover, precipitation, windSpeed) => {
  if (precipitation != null && precipitation > 0.1) {
      if (precipitation > 2) return "⛈️"; 
      return "🌧️"; 
  }
  if (windSpeed != null) {
      if (windSpeed >= 55) return "⛈️";
      if (windSpeed >= 30) return "🌧️";
  }
  if (cloudCover == null) return "⛅";
  if (cloudCover < 20) return "☀️"; 
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
  (function() {
    const href = `https://swellsync.fr/conditions.html?spot=${encodeURIComponent(spot.name)}`;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = href;
  })();
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
            const dayIcon = getWeatherIcon(mid.cloudCover ?? null, mid.precipitation ?? null, mid.windSpeed ?? null);
            return `
              <div class="calendar-day ${q.class}" data-key="${key}">
                <div class="cal-date"><span class="cal-icon">${dayIcon}</span>${dateLabel}</div>
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
                const icon = getWeatherIcon(x.cloudCover ?? null, x.precipitation ?? null, x.windSpeed ?? null);
                const rainLike = (icon === "🌧️" || icon === "⛈️");
                return `
                  <div class="hourly-chip ${q.class}" data-time="${x.time}" data-day="${key}" style="animation-delay:${i*60}ms">
                    <div class="h-time"><span class="h-icon">${icon}</span>${labelH}</div>
                    <div class="h-primary">${x.waveHeight?.toFixed(1)}m • ${Math.round(x.wavePeriod)}s</div>
                    ${rainLike ? `<div class="h-meta">Pluie</div>` : ``}
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

const attachLocateFeature = () => {
  const btn = document.getElementById("locate-me");
  const status = document.getElementById("locate-status");
  if (!btn) return;
  const toRad = (v) => v * Math.PI / 180;
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  const nearestSpot = (lat, lon) => {
    let best = null;
    spots.forEach(s => {
      const d = haversine(lat, lon, s.coords[0], s.coords[1]);
      if (!best || d < best.d) best = { spot: s, d };
    });
    return best;
  };
  const openResultModal = (res, coords) => {
    const modal = document.getElementById("forecast-modal");
    const body = document.getElementById("forecast-modal-body");
    if (!modal || !body) return;
    const km = Math.round(res.d);
    body.innerHTML = `
      <div class="fm-header is-good">
        <div class="fm-date">Spot le plus proche</div>
        <div class="fm-badge" style="color:#4ade80">${km} km</div>
        <div class="fm-primary">${res.spot.name} • ${res.spot.region}</div>
        <div class="fm-source">LOCALISATION ACTIVÉE</div>
      </div>
      <div class="fm-details">
        <div class="detail-line">
          <div class="dl-item"><span class="dl-label">Latitude</span><span class="dl-val">${coords.lat.toFixed(4)}</span></div>
          <div class="dl-item"><span class="dl-label">Longitude</span><span class="dl-val">${coords.lon.toFixed(4)}</span></div>
          <div class="dl-item"><span class="dl-label">Distance</span><span class="dl-val">${km} km</span></div>
          <div class="dl-item"><span class="dl-label">Accès</span><span class="dl-val"><a href="conditions.html?spot=${encodeURIComponent(res.spot.name)}" style="color:#4ade80">Ouvrir les conditions</a></span></div>
        </div>
      </div>
    `;
    modal.classList.add("is-open");
    modal.querySelectorAll("[data-modal-close]").forEach(b => b.onclick = () => modal.classList.remove("is-open"));
  };
  btn.onclick = () => {
    if (status) status.textContent = "Demande de localisation…";
    if (!navigator.geolocation) {
      if (status) status.textContent = "Géolocalisation non supportée";
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const res = nearestSpot(lat, lon);
        if (status) status.textContent = `Plus proche: ${res.spot.name} • ${Math.round(res.d)} km`;
        openResultModal(res, { lat, lon });
      },
      () => {
        if (status) status.textContent = "Permission refusée";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
};

const attachStatsInfo = () => {
  const modal = document.getElementById("stats-info-modal");
  const body = document.getElementById("stats-info-body");
  if (!modal || !body) return;
  const refSpot = spots[0];
  const open = (title, content) => {
    body.innerHTML = `
      <div class="detail-line">
        <div class="dl-item"><span class="dl-label">Intitulé</span><span class="dl-val">${title}</span></div>
        <div class="dl-item"><span class="dl-label">Endpoint</span><span class="dl-val">${content.endpoint}</span></div>
        <div class="dl-item"><span class="dl-label">Spot Réf.</span><span class="dl-val">${refSpot.name}</span></div>
      </div>
      <div class="detail-line">
        <div class="dl-item"><span class="dl-label">Signification</span><span class="dl-val">${content.meaning}</span></div>
        <div class="dl-item"><span class="dl-label">Champs</span><span class="dl-val">${content.fields}</span></div>
        <div class="dl-item"><span class="dl-label">Méthode</span><span class="dl-val">${content.method}</span></div>
      </div>
    `;
    modal.classList.add("is-open");
    modal.querySelectorAll("[data-modal-close]").forEach(b => b.onclick = () => modal.classList.remove("is-open"));
  };
  const elWater = document.getElementById("stat-water");
  const elSwell = document.getElementById("stat-swell");
  const elActive = document.getElementById("stat-active");
  const elTide = document.getElementById("stat-tide");
  if (elWater) elWater.onclick = () => open("Température de l’eau", {
    endpoint: `/api/marine?lat=${refSpot.coords[0]}&lng=${refSpot.coords[1]}`,
    meaning: "Température de surface à proximité du spot de référence.",
    fields: "waterTemperature (°C)",
    method: "Lecture directe de la valeur horaire fournie par Stormglass."
  });
  if (elSwell) elSwell.onclick = () => open("Analyse Houle", {
    endpoint: `/api/marine?lat=${refSpot.coords[0]}&lng=${refSpot.coords[1]}`,
    meaning: "Énergie des vagues: hauteur (m) et période (s).",
    fields: "waveHeight (m), wavePeriod (s), swellDirection",
    method: "Sélection du créneau récent et affichage des champs normalisés."
  });
  if (elActive) elActive.onclick = () => open("Spots en LIVE", {
    endpoint: `/api/all-status`,
    meaning: "Nombre de spots dont le flux est actif.",
    fields: "status par spot (LIVE/WAITING/ERROR)",
    method: "Comptage des statuts 'LIVE' retournés par le service."
  });
  if (elTide) elTide.onclick = () => open("Marée (Global)", {
    endpoint: `/api/tide?spot=${encodeURIComponent(refSpot.name)}`,
    meaning: "Tendance de marée globale sur la zone.",
    fields: "stage (Montante/Descendante/Haute/Basse), nextTime",
    method: "Agrégation des cycles de marée et calcul de la tendance actuelle."
  });
};
const attachHomeGeoBubble = () => {
  const bubble = document.getElementById("geo-bubble");
  const modal = document.getElementById("geo-modal");
  const body = document.getElementById("geo-modal-body");
  if (!bubble || !modal || !body) return;
  const toRad = (v) => v * Math.PI / 180;
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  const nearestSpot = (lat, lon) => {
    let best = null;
    spots.forEach(s => {
      const d = haversine(lat, lon, s.coords[0], s.coords[1]);
      if (!best || d < best.d) best = { spot: s, d };
    });
    return best;
  };
  const renderResult = (res, coords) => {
    const km = Math.round(res.d);
    body.innerHTML = `
      <div class="detail-line">
        <div class="dl-item"><span class="dl-label">Spot</span><span class="dl-val">${res.spot.name}</span></div>
        <div class="dl-item"><span class="dl-label">Région</span><span class="dl-val">${res.spot.region}</span></div>
        <div class="dl-item"><span class="dl-label">Distance</span><span class="dl-val">${km} km</span></div>
        <div class="dl-item"><span class="dl-label">Accès</span><span class="dl-val"><a href="conditions.html?spot=${encodeURIComponent(res.spot.name)}" style="color:#4ade80">Ouvrir les conditions</a></span></div>
      </div>
      <div class="detail-line">
        <div class="dl-item"><span class="dl-label">Latitude</span><span class="dl-val">${coords.lat.toFixed(4)}</span></div>
        <div class="dl-item"><span class="dl-label">Longitude</span><span class="dl-val">${coords.lon.toFixed(4)}</span></div>
      </div>
    `;
  };
  bubble.onclick = () => {
    modal.classList.add("is-open");
    const startBtn = document.getElementById("geo-start");
    const statusEl = document.getElementById("geo-status");
    if (statusEl) statusEl.textContent = "Demande de localisation…";
    if (!navigator.geolocation) {
      if (statusEl) statusEl.textContent = "Géolocalisation non supportée";
      return;
    }
    if (startBtn) {
      startBtn.onclick = () => {
        statusEl.textContent = "Recherche du spot le plus proche…";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const res = nearestSpot(lat, lon);
            renderResult(res, { lat, lon });
            statusEl.textContent = "";
          },
          () => { statusEl.textContent = "Permission refusée"; },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      };
    }
    modal.querySelectorAll("[data-modal-close]").forEach(b => b.onclick = () => modal.classList.remove("is-open"));
  };
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
        
        document.getElementById("verdict-text").textContent = t("vs.verdict.calc");
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
                verdictText.innerHTML = `${t("vs.verdict.winner")} <strong style="color:#4ade80">${nameA}</strong>`;
            } else if (scoreB > scoreA) {
                verdictText.innerHTML = `${t("vs.verdict.winner")} <strong style="color:#4ade80">${nameB}</strong>`;
            } else {
                verdictText.innerHTML = t("vs.verdict.draw");
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
      attachLocateFeature();
      attachHomeGeoBubble();
      attachStatsInfo();
      if (document.body.classList.contains("cameras-page")) initCamerasPage(); 
      if (document.body.classList.contains("favorites-page")) initFavoritesPage(); 
      if (document.body.classList.contains("versus-page")) initVersusPage(); 
      if (document.body.classList.contains("actus-page")) renderFullNews(); 
      if (document.body.classList.contains("contact-page")) initContactPage(); 
      attachAdminSecret();
      attachShareFeature();
      attachStoryShare();
      initI18n();
      try {
        const params = new URLSearchParams(window.location.search);
        if (document.body.classList.contains("conditions-page") && params.get("share-story") === "1") {
          setTimeout(() => { if (window.shareStoryNow) window.shareStoryNow(); }, 1200);
        }
      } catch {}
  } catch (e) { console.error("Erreur critique init:", e); }

  document.body.addEventListener("click", e => {
    const mailAnchor = e.target.closest("a[href^='mailto:']");
    if (mailAnchor) {
      e.preventDefault();
      window.location.href = "contact.html";
      return;
    }
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
        const doc = (window.legalTexts || {})[type];
        if (doc) {
            document.getElementById("legal-title").textContent = doc.title;
            document.getElementById("legal-body").innerHTML = doc.body;
            document.getElementById("legal-modal").classList.add("is-open");
        }
    }
  });
});

if (!window.legalTexts) window.legalTexts = {
  "legal-mentions": {
    title: "Mentions Légales",
    body: `
      <h3>Éditeur du site</h3>
      <p>SwellSync — Service de prévisions et d’analyse surf. Contact: <a href="mailto:swellsync@gmail.com">swellsync@gmail.com</a>.</p>
      <h3>Responsable de la publication</h3>
      <p>Équipe SwellSync.</p>
      <h3>Hébergement</h3>
      <p>Application hébergée sur un fournisseur cloud européen/US compatible RGPD. L’infrastructure peut inclure des CDN et services tiers sécurisés.</p>
      <h3>Propriété intellectuelle</h3>
      <p>Les éléments du site (textes, visuels, interfaces, marques) sont protégés. Toute reproduction ou réutilisation non autorisée est interdite.</p>
      <h3>Sources de données</h3>
      <p>Données océanographiques issues notamment de Stormglass/NOAA/Bouées locales; certaines images proviennent de sources publiques (ex: Unsplash, flux RSS). Les droits restent la propriété de leurs auteurs.</p>
      <h3>Liens externes</h3>
      <p>Les liens vers des sites tiers sont fournis à titre informatif; nous n’en contrôlons pas le contenu.</p>
      <h3>Contact</h3>
      <p>Pour toute demande: <a href="mailto:swellsync@gmail.com">swellsync@gmail.com</a>.</p>
    `
  },
  "legal-cgu": {
    title: "Conditions Générales d’Utilisation (CGU)",
    body: `
      <h3>1. Objet</h3>
      <p>Les présentes CGU régissent l’accès et l’utilisation de SwellSync (site et services associés).</p>
      <h3>2. Acceptation</h3>
      <p>L’utilisation du service vaut acceptation pleine et entière des CGU et des politiques s’y rapportant.</p>
      <h3>3. Accès au service</h3>
      <p>Service fourni “en l’état”, sous réserve de disponibilité. Des évolutions, interruptions ou maintenances peuvent survenir.</p>
      <h3>4. Compte et sécurité</h3>
      <p>Vous êtes responsable des identifiants et de toute activité liée à votre compte. L’authentification peut inclure 2FA par email.</p>
      <h3>5. Usage autorisé</h3>
      <p>Usage personnel ou professionnel raisonnable. Interdits: extraction massive, scraping non autorisé, reverse engineering, contournement des quotas, atteinte à la sécurité.</p>
      <h3>6. Données et exactitude</h3>
      <p>Les prévisions et analyses sont fournies à titre indicatif. SwellSync ne peut garantir l’exactitude en toutes circonstances (aléas météo/océan, latences, sources externes).</p>
      <h3>7. Contenus tiers</h3>
      <p>Les flux, images et webcams peuvent provenir de tiers; leur disponibilité et conformité relèvent de leurs éditeurs.</p>
      <h3>8. Responsabilité</h3>
      <p>Dans la limite permise par la loi, SwellSync ne saurait être tenue responsable des dommages indirects, perte de chance, perte de données, ou activités réalisées sur la base des informations publiées.</p>
      <h3>9. Abonnements et paiements</h3>
      <p>Si des offres payantes sont proposées, des conditions spécifiques s’appliqueront (prix, durée, renouvellement, rétractation si applicable). À date, aucune transaction en ligne n’est obligatoire pour l’usage courant.</p>
      <h3>10. Quotas et équité d’usage</h3>
      <p>Des quotas techniques peuvent limiter les appels API ou fonctionnalités afin d’assurer la stabilité du service.</p>
      <h3>11. Modifications</h3>
      <p>Nous pouvons modifier les CGU. La version publiée sur le site fait foi; l’usage postérieur à la modification vaut acceptation.</p>
      <h3>12. Droit applicable</h3>
      <p>Droit applicable et juridictions compétentes selon le siège de l’éditeur et les règles de conflit de lois.</p>
      <h3>13. Contact</h3>
      <p>Support: <a href="mailto:swellsync@gmail.com">swellsync@gmail.com</a>.</p>
    `
  },
  "legal-rgpd": {
    title: "Politique de Confidentialité (RGPD)",
    body: `
      <h3>1. Responsable du traitement</h3>
      <p>SwellSync. Contact: <a href="mailto:swellsync@gmail.com">swellsync@gmail.com</a>.</p>
      <h3>2. Données collectées</h3>
      <p>Identité (email lors de la création de compte), messages de contact, préférences (ex: favoris), journaux techniques (statuts robots, erreurs), données d’usage agrégées.</p>
      <h3>3. Finalités</h3>
      <p>Fourniture du service, sécurité, amélioration produit, support utilisateur, envois d’alertes/communications (opt-in), conformité légale.</p>
      <h3>4. Bases légales</h3>
      <p>Exécution du contrat (compte et service), intérêt légitime (sécurité/mesure d’audience raisonnable), consentement pour communications marketing.</p>
      <h3>5. Cookies et stockage local</h3>
      <p>Aucun traçage publicitaire. Stockage local utilisé pour la session, préférences et expérience. Bandeau d’information affiché au premier accès.</p>
      <h3>6. Destinataires et transferts</h3>
      <p>Accès restreint à l’équipe SwellSync; prestataires techniques (hébergement, envoi email) sous engagements de confidentialité et sécurité.</p>
      <h3>7. Durées de conservation</h3>
      <p>Données de compte: durée d’usage et obligations légales; logs techniques: durée proportionnée; contacts: le temps du traitement et suivi.</p>
      <h3>8. Sécurité</h3>
      <p>Mesures techniques et organisationnelles; chiffrement en transit; contrôles d’accès; surveillance des quotas et anomalies.</p>
      <h3>9. Vos droits</h3>
      <p>Accès, rectification, effacement, limitation, opposition, portabilité; retrait du consentement à tout moment. Exercice: <a href="mailto:swellsync@gmail.com">swellsync@gmail.com</a>.</p>
      <h3>10. Réclamations</h3>
      <p>Autorité de contrôle compétente (ex: CNIL en France). Vous pouvez déposer une plainte si vous estimez que vos droits ne sont pas respectés.</p>
      <h3>11. Modifications</h3>
      <p>La présente politique peut évoluer; la version en ligne à jour s’applique.</p>
      <h3>12. Contact</h3>
      <p>Confidentialité: <a href="mailto:swellsync@gmail.com">swellsync@gmail.com</a>.</p>
    `
  }
};

function initI18n() {
  const select = document.getElementById("lang-select");
  window.lang = localStorage.getItem("lang") || "fr";
  document.documentElement.setAttribute("lang", window.lang);
  if (select) {
    select.value = window.lang;
    select.addEventListener("change", () => {
      window.lang = select.value;
      localStorage.setItem("lang", window.lang);
      document.documentElement.setAttribute("lang", window.lang);
      applyI18n();
    });
  }
  applyI18n();
}
const i18n = {
  fr: {
    "nav.map": "Carte",
    "nav.cameras": "Caméras",
    "nav.favorites": "Favoris",
    "nav.versus": "Versus",
    "nav.news": "News",
    "nav.contact": "Contact",
    "nav.login": "Se connecter",
    "cta.explore": "Explorer les spots",
    "geo.find": "Trouver mon spot",
    "quick.water": "TEMP. EAU",
    "quick.swell": "ANALYSE HOULE",
    "quick.live": "SPOTS EN LIVE",
    "quick.tide": "MARÉE (GLOBAL)",
    "legal.mentions": "Mentions Légales",
    "legal.cgu": "CGU",
    "legal.rgpd": "Confidentialité",
    "hero.title": "Prévisions surf essentielles.",
    "map.title": "Carte interactive",
    "map.desc": "Analyse précise via Stormglass Premium.",
    "spot.header": "Navigation Spots",
    "spot.search.placeholder": "Filtrer les spots...",
    "legend.title": "Légende Robots",
    "radar.title": "Radar des Sessions",
    "radar.desc": "Les spots les plus surveillés en ce moment.",
    "flow.title": "Le Flux SurfSense",
    "flow.desc": "De l'océan à votre écran en 3 étapes millimétrées.",
    "flow.step1.title": "1. Scan Satellite",
    "flow.step1.desc": "Récupération des données brutes Stormglass et bouées océaniques.",
    "flow.step2.title": "2. Traitement IA",
    "flow.step2.desc": "Nos robots filtrent le clapot et calculent l'énergie réelle du spot.",
    "flow.step3.title": "3. Alertes Smart",
    "flow.step3.desc": "Vous recevez l'info uniquement quand c'est \"Bon\" ou \"Épique\".",
    "cookie.ok": "COMPRIS",
    "cond.live": "LIVE REPORT •",
    "cond.status.title": "ANALYSE EN COURS...",
    "cond.status.desc": "Connexion aux bouées...",
    "stats.wave": "VAGUES",
    "stats.period": "PÉRIODE",
    "stats.wind": "VENT",
    "stats.winddir": "DIR. VENT",
    "stats.swelldir": "DIR. HOULE",
    "stats.quality": "QUALITÉ",
    "locate.btn": "Trouver mon spot le plus proche",
    "forecast.title": "Conditions 7 jours",
    "tide.next": "PROCHAINE MARÉE",
    "cams.network": "Réseau Live",
    "cams.signal": "SIGNAL 100%",
    "cams.meta.title": "Sélectionnez une caméra",
    "cams.meta.desc": "Accès direct aux webcams partenaires.",
    "cams.stat.wind": "Vent",
    "cams.stat.swell": "Houle",
    "cams.stat.tide": "Marée",
    "cams.source.title": "SOURCE OFFICIELLE",
    "cams.source.desc": "Ouvrir le flux sur le site d'origine",
    "cams.btn.gosurf": "Voir sur GoSurf",
    "fav.title": "Mon Line-up",
    "fav.desc": "Vos spots préférés en un coup d'œil. Analyse temps réel.",
    "fav.empty.title": "Aucun spot favori",
    "fav.empty.desc": "Connectez-vous pour retrouver vos favoris enregistrés sur votre compte.",
    "fav.empty.btn": "Se connecter",
    "vs.title": "FACE-OFF",
    "vs.sub": "Comparateur d'analyse temps réel",
    "vs.a": "CHALLENGER A",
    "vs.b": "CHALLENGER B",
    "vs.stat.waves": "VAGUES",
    "vs.stat.period": "PÉRIODE",
    "vs.stat.wind": "VENT",
    "vs.verdict.calc": "Calcul IA en cours...",
    "vs.verdict.analyse": "Analyse...",
    "vs.verdict.winner": "Vainqueur :",
    "vs.verdict.draw": "Égalité parfaite. Faites votre choix !",
    "contact.title": "Contact",
    "contact.sub": "Questions, problèmes ou infos supplémentaires — on vous répond rapidement.",
    "contact.card.title": "Équipe support • SwellSync",
    "contact.card.desc": "Remplissez le formulaire ci-dessous. Votre demande sera transmise au support.",
    "contact.label.name": "Nom complet",
    "contact.placeholder.name": "Ex: Jean Dupont",
    "contact.label.email": "Email",
    "contact.placeholder.email": "Ex: jean@exemple.com",
    "contact.label.category": "Catégorie",
    "contact.label.subject": "Sujet (optionnel)",
    "contact.placeholder.subject": "Ex: Erreur sur la page Conditions",
    "contact.label.message": "Message",
    "contact.placeholder.message": "Décrivez votre demande...",
    "contact.submit": "Envoyer",
    "contact.info.title": "Infos utiles",
    "contact.info.sub": "Avant d’envoyer —",
    "contact.info.li1": "Précisez le spot, l’heure et la page concernée si c’est un problème.",
    "contact.info.li2": "Pour les demandes de fonctionnalités, dites-nous l’usage concret souhaité.",
    "contact.info.li3": "Vous pouvez joindre des liens externes (cam, article, etc.).",
    "contact.copy": "Copier l’adresse",
    "news.feed.title": "Le fil de l'eau",
    "gate.title": "PROTOCOLE D'ACCÈS SURFSENSE",
    "gate.label": "SYSTÈME D'ANALYSE IA v2.0",
    "gate.tab.metrics": "Métriques",
    "gate.tab.robots": "Robots",
    "gate.tab.how": "Fonctionnement",
    "gate.tab.legal": "Juridique",
    "gate.accept": "ACCEPTER ET ENTRER",
    "gate.refuse": "REFUSER"
  },
  en: {
    "nav.map": "Map",
    "nav.cameras": "Cameras",
    "nav.favorites": "Favorites",
    "nav.versus": "Versus",
    "nav.news": "News",
    "nav.contact": "Contact",
    "nav.login": "Sign in",
    "cta.explore": "Explore spots",
    "geo.find": "Find my spot",
    "quick.water": "WATER TEMP",
    "quick.swell": "SWELL ANALYSIS",
    "quick.live": "LIVE SPOTS",
    "quick.tide": "TIDE (GLOBAL)",
    "legal.mentions": "Legal",
    "legal.cgu": "Terms",
    "legal.rgpd": "Privacy",
    "hero.title": "Essential surf forecasts.",
    "map.title": "Interactive Map",
    "map.desc": "Precise analysis via Stormglass Premium.",
    "spot.header": "Spots Navigation",
    "spot.search.placeholder": "Filter spots...",
    "legend.title": "Robots Legend",
    "radar.title": "Sessions Radar",
    "radar.desc": "Most watched spots right now.",
    "flow.title": "The SurfSense Flow",
    "flow.desc": "From ocean to your screen in 3 precise steps.",
    "flow.step1.title": "1. Satellite Scan",
    "flow.step1.desc": "Fetch raw Stormglass and buoy data.",
    "flow.step2.title": "2. AI Processing",
    "flow.step2.desc": "Robots filter chop and compute real spot energy.",
    "flow.step3.title": "3. Smart Alerts",
    "flow.step3.desc": "You get info only when it’s Good or Epic.",
    "cookie.ok": "OK",
    "cond.live": "LIVE REPORT •",
    "cond.status.title": "ANALYSIS IN PROGRESS...",
    "cond.status.desc": "Connecting to buoys...",
    "stats.wave": "WAVES",
    "stats.period": "PERIOD",
    "stats.wind": "WIND",
    "stats.winddir": "WIND DIR",
    "stats.swelldir": "SWELL DIR",
    "stats.quality": "QUALITY",
    "locate.btn": "Find my nearest spot",
    "forecast.title": "7‑day conditions",
    "tide.next": "NEXT TIDE",
    "cams.network": "Live Network",
    "cams.signal": "SIGNAL 100%",
    "cams.meta.title": "Select a camera",
    "cams.meta.desc": "Direct access to partner webcams.",
    "cams.stat.wind": "Wind",
    "cams.stat.swell": "Swell",
    "cams.stat.tide": "Tide",
    "cams.source.title": "OFFICIAL SOURCE",
    "cams.source.desc": "Open the stream on the original site",
    "cams.btn.gosurf": "View on GoSurf",
    "fav.title": "My Line-up",
    "fav.desc": "Your favorite spots at a glance. Live analysis.",
    "fav.empty.title": "No favorite spot",
    "fav.empty.desc": "Sign in to retrieve your saved favorites.",
    "fav.empty.btn": "Sign in",
    "vs.title": "FACE-OFF",
    "vs.sub": "Real-time analysis comparator",
    "vs.a": "CHALLENGER A",
    "vs.b": "CHALLENGER B",
    "vs.stat.waves": "WAVES",
    "vs.stat.period": "PERIOD",
    "vs.stat.wind": "WIND",
    "vs.verdict.calc": "AI computation in progress...",
    "vs.verdict.analyse": "Analysis...",
    "vs.verdict.winner": "Winner:",
    "vs.verdict.draw": "Perfect tie. Make your choice!",
    "contact.title": "Contact",
    "contact.sub": "Questions, issues or extra info — we reply quickly.",
    "contact.card.title": "Support team • SwellSync",
    "contact.card.desc": "Fill the form below. Your request will be sent to support.",
    "contact.label.name": "Full name",
    "contact.placeholder.name": "e.g. John Doe",
    "contact.label.email": "Email",
    "contact.placeholder.email": "e.g. john@example.com",
    "contact.label.category": "Category",
    "contact.label.subject": "Subject (optional)",
    "contact.placeholder.subject": "e.g. Error on Conditions page",
    "contact.label.message": "Message",
    "contact.placeholder.message": "Describe your request...",
    "contact.submit": "Send",
    "contact.info.title": "Useful info",
    "contact.info.sub": "Before sending —",
    "contact.info.li1": "Specify the spot, time and page if it’s a problem.",
    "contact.info.li2": "For feature requests, describe the concrete use case.",
    "contact.info.li3": "You can add external links (cam, article, etc.).",
    "contact.copy": "Copy address",
    "news.feed.title": "News feed",
    "gate.title": "SURFSENSE ACCESS PROTOCOL",
    "gate.label": "AI ANALYSIS SYSTEM v2.0",
    "gate.tab.metrics": "Metrics",
    "gate.tab.robots": "Robots",
    "gate.tab.how": "How it works",
    "gate.tab.legal": "Legal",
    "gate.accept": "ACCEPT AND ENTER",
    "gate.refuse": "REFUSE"
  },
  es: {
    "nav.map": "Mapa",
    "nav.cameras": "Cámaras",
    "nav.favorites": "Favoritos",
    "nav.versus": "Versus",
    "nav.news": "Noticias",
    "nav.contact": "Contacto",
    "nav.login": "Conectar",
    "cta.explore": "Explorar spots",
    "geo.find": "Encontrar mi spot",
    "quick.water": "TEMP. AGUA",
    "quick.swell": "ANÁLISIS OLEAJE",
    "quick.live": "SPOTS EN VIVO",
    "quick.tide": "MAREA (GLOBAL)",
    "legal.mentions": "Aviso legal",
    "legal.cgu": "Términos",
    "legal.rgpd": "Privacidad",
    "hero.title": "Previsiones de surf esenciales.",
    "map.title": "Mapa interactivo",
    "map.desc": "Análisis preciso con Stormglass Premium.",
    "spot.header": "Navegación de spots",
    "spot.search.placeholder": "Filtrar spots...",
    "legend.title": "Leyenda Robots",
    "radar.title": "Radar de Sesiones",
    "radar.desc": "Los spots más vigilados ahora.",
    "flow.title": "El flujo de SurfSense",
    "flow.desc": "Del océano a tu pantalla en 3 pasos precisos.",
    "flow.step1.title": "1. Escaneo satélite",
    "flow.step1.desc": "Obtención de datos de Stormglass y boyas.",
    "flow.step2.title": "2. Procesamiento IA",
    "flow.step2.desc": "Los robots filtran el choppy y calculan energía real.",
    "flow.step3.title": "3. Alertas inteligentes",
    "flow.step3.desc": "Recibes info solo cuando está Bueno o Épico.",
    "cookie.ok": "OK",
    "cond.live": "LIVE REPORT •",
    "cond.status.title": "ANÁLISIS EN CURSO...",
    "cond.status.desc": "Conectando a boyas...",
    "stats.wave": "OLAS",
    "stats.period": "PERIODO",
    "stats.wind": "VIENTO",
    "stats.winddir": "DIR. VIENTO",
    "stats.swelldir": "DIR. OLEAJE",
    "stats.quality": "CALIDAD",
    "locate.btn": "Encontrar mi spot más cercano",
    "forecast.title": "Condiciones 7 días",
    "tide.next": "PRÓXIMA MAREA",
    "cams.network": "Red en vivo",
    "cams.signal": "SEÑAL 100%",
    "cams.meta.title": "Selecciona una cámara",
    "cams.meta.desc": "Acceso directo a webcams asociadas.",
    "cams.stat.wind": "Viento",
    "cams.stat.swell": "Oleaje",
    "cams.stat.tide": "Marea",
    "cams.source.title": "FUENTE OFICIAL",
    "cams.source.desc": "Abrir el flujo en el sitio original",
    "cams.btn.gosurf": "Ver en GoSurf",
    "fav.title": "Mi Line-up",
    "fav.desc": "Tus spots favoritos de un vistazo. Análisis en vivo.",
    "fav.empty.title": "Sin spot favorito",
    "fav.empty.desc": "Conéctate para ver tus favoritos guardados.",
    "fav.empty.btn": "Conectar",
    "vs.title": "FACE‑OFF",
    "vs.sub": "Comparador de análisis en tiempo real",
    "vs.a": "RETADOR A",
    "vs.b": "RETADOR B",
    "vs.stat.waves": "OLAS",
    "vs.stat.period": "PERIODO",
    "vs.stat.wind": "VIENTO",
    "vs.verdict.calc": "Cálculo IA en curso...",
    "vs.verdict.analyse": "Análisis...",
    "vs.verdict.winner": "Ganador:",
    "vs.verdict.draw": "Empate perfecto. ¡Elige!",
    "contact.title": "Contacto",
    "contact.sub": "Preguntas, problemas o info extra — respondemos rápido.",
    "contact.card.title": "Equipo de soporte • SwellSync",
    "contact.card.desc": "Completa el formulario. Tu solicitud se enviará al soporte.",
    "contact.label.name": "Nombre completo",
    "contact.placeholder.name": "ej. Juan Pérez",
    "contact.label.email": "Email",
    "contact.placeholder.email": "ej. juan@ejemplo.com",
    "contact.label.category": "Categoría",
    "contact.label.subject": "Asunto (opcional)",
    "contact.placeholder.subject": "ej. Error en la página de Condiciones",
    "contact.label.message": "Mensaje",
    "contact.placeholder.message": "Describe tu solicitud...",
    "contact.submit": "Enviar",
    "contact.info.title": "Información útil",
    "contact.info.sub": "Antes de enviar —",
    "contact.info.li1": "Indica el spot, hora y página si es un problema.",
    "contact.info.li2": "Para pedidos de funciones, describe el uso concreto.",
    "contact.info.li3": "Puedes añadir enlaces externos (cam, artículo, etc.).",
    "contact.copy": "Copiar dirección",
    "news.feed.title": "Feed de noticias",
    "gate.title": "PROTOCOLO DE ACCESO SURFSENSE",
    "gate.label": "SISTEMA DE ANÁLISIS IA v2.0",
    "gate.tab.metrics": "Métricas",
    "gate.tab.robots": "Robots",
    "gate.tab.how": "Funcionamiento",
    "gate.tab.legal": "Legal",
    "gate.accept": "ACEPTAR Y ENTRAR",
    "gate.refuse": "RECHAZAR"
  }
};
function t(key) {
  return (i18n[window.lang] && i18n[window.lang][key]) || (i18n.fr && i18n.fr[key]) || key;
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    const v = t(k);
    if (!v) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.setAttribute("placeholder", v);
    } else {
      el.textContent = v;
    }
  });
  const shareBtn = document.getElementById("share-story-btn");
  if (shareBtn) {
    const label = window.lang === "fr" ? "Partager Story" : window.lang === "en" ? "Share Story" : "Compartir Story";
    shareBtn.setAttribute("aria-label", label);
    shareBtn.setAttribute("title", label);
  }
}

const initContactPage = () => {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("contact-status");
  if (!form) return;
  const copyBtn = document.getElementById("copy-email");
  const emailText = document.getElementById("support-email-text");
  if (copyBtn && emailText) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(emailText.textContent.trim());
        if (statusEl) statusEl.textContent = "Adresse copiée dans le presse‑papier.";
      } catch {
        if (statusEl) statusEl.textContent = "Copie impossible. Adresse: swellsync@gmail.com";
      }
    });
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("ct-name").value.trim();
    const email = document.getElementById("ct-email").value.trim();
    const category = document.getElementById("ct-category").value;
    const subject = document.getElementById("ct-subject").value.trim();
    const message = document.getElementById("ct-message").value.trim();
    if (!name || !email || !message) {
      if (statusEl) statusEl.textContent = "Veuillez remplir les champs requis.";
      return;
    }
    if (statusEl) statusEl.textContent = "Envoi en cours…";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, subject, message })
      });
      const data = await res.json();
      if (data && data.success) {
        if (statusEl) statusEl.textContent = "Message envoyé. Merci !";
        form.reset();
      } else {
        if (statusEl) statusEl.textContent = "Échec de l’envoi. Réessayez.";
      }
    } catch {
      if (statusEl) statusEl.textContent = "Erreur réseau. Réessayez.";
    }
  });
};
const attachAdminSecret = () => {
  const openPrompt = async () => {
    const t = prompt("Jeton Admin");
    if (!t) return;
    try {
      const r = await fetch("/api/admin/session/token", { method:"POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ token: t }) });
      const dj = await r.json();
      if (!r.ok) { alert(dj.error || "Jeton invalide"); return; }
      window.location.href = "/admin/";
    } catch { alert("Erreur réseau"); }
  };
  const logo = document.querySelector(".logo");
  if (logo) {
    logo.addEventListener("click", (e) => { if (e.altKey) openPrompt(); });
  }
  document.addEventListener("keydown", (e) => {
    const mac = navigator.platform.toLowerCase().includes("mac");
    const ctrlOrMeta = mac ? e.metaKey : e.ctrlKey;
    if (ctrlOrMeta && e.shiftKey && e.key && e.key.toLowerCase() === "a") { e.preventDefault(); openPrompt(); }
  });
};
const attachShareFeature = () => {
  const btn = document.getElementById("share-btn");
  if (!btn) return;
  const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const getShareInfo = () => {
    const url = window.location.href;
    let title = "SwellSync";
    let text = "Conditions surf essentielles";
    if (document.body.classList.contains("conditions-page")) {
      const p = new URLSearchParams(window.location.search);
      const s = p.get("spot");
      if (s) { title = "SwellSync — "+s; text = "Live conditions: "+s; }
    }
    return { title, text, url };
  };
  const ensureModal = (links) => {
    let modal = document.getElementById("share-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.id = "share-modal";
      modal.innerHTML = '<div class="modal-backdrop" data-modal-close></div><div class="modal-content" style="max-width:520px"><button class="modal-close" data-modal-close>✕</button><h3 style="margin-bottom:12px">Partager</h3><div id="share-links" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px"></div></div>';
      document.body.appendChild(modal);
    }
    const grid = modal.querySelector("#share-links");
    if (grid) {
      grid.innerHTML = links.map(l => '<a href="'+l.href+'" target="_blank" rel="noopener" class="primary-pill" style="text-align:center">'+l.label+'</a>').join("");
    }
    modal.classList.add("is-open");
  };
  const composeLinks = (info) => {
    const u = encodeURIComponent(info.url);
    const t = encodeURIComponent(info.text);
    const links = [
      { label: "WhatsApp", href: "https://api.whatsapp.com/send?text="+t+"%20"+u },
      { label: "Facebook", href: "https://www.facebook.com/sharer/sharer.php?u="+u },
      { label: "Twitter", href: "https://twitter.com/intent/tweet?text="+t+"&url="+u },
      { label: "Telegram", href: "https://t.me/share/url?url="+u+"&text="+t },
      { label: "LinkedIn", href: "https://www.linkedin.com/sharing/share-offsite/?url="+u }
    ];
    if (isMobile) {
      links.push({ label: "Instagram", href: "instagram://story-camera" });
      links.push({ label: "Snapchat", href: "snapchat://create" });
      links.push({ label: "TikTok", href: "tiktok://camera" });
      links.push({ label: "Messenger", href: "fb-messenger://share?link="+u });
    } else {
      links.push({ label: "Instagram", href: "https://instagram.com/" });
      links.push({ label: "Snapchat", href: "https://www.snapchat.com/scan?attachmentUrl="+u });
      links.push({ label: "TikTok", href: "https://www.tiktok.com/upload" });
      links.push({ label: "Messenger", href: "https://www.messenger.com/t/?link="+u });
    }
    return links;
  };
  btn.addEventListener("click", async () => {
    const info = getShareInfo();
    if (navigator.share) {
      try {
        await navigator.share({ title: info.title, text: info.text, url: info.url });
        return;
      } catch {}
    }
    ensureModal(composeLinks(info));
  });
};
const attachStoryShare = () => {
  const btns = Array.from(document.querySelectorAll("#share-story-btn, #btn-share-story"));
  if (!btns.length) return;
  const makeCanvas = (info) => {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = 1080, h = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, "#0b0e16");
    g.addColorStop(1, "#111827");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "rgba(124,58,237,.12)"; ctx.beginPath(); ctx.arc(140,140,220,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(34,197,94,.12)"; ctx.beginPath(); ctx.arc(w-140,h-160,240,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 54px Inter, system-ui, -apple-system, Segoe UI";
    ctx.fillText("SwellSync", 60, 120);
    ctx.fillStyle = "#94a3b8"; ctx.font = "600 22px Inter, system-ui";
    ctx.fillText("swellsync.fr", 60, 160);
    ctx.fillStyle = "#c4b5fd"; ctx.font = "800 42px Inter, system-ui";
    ctx.fillText(info.title, 60, 240);
    ctx.fillStyle = "#e5e7eb"; ctx.font = "600 28px Inter, system-ui";
    ctx.fillText(info.subtitle, 60, 288);
    const box = (label, value, x, y) => {
      ctx.fillStyle = "rgba(17,24,39,.85)";
      ctx.fillRect(x, y, 420, 120);
      ctx.strokeStyle = "rgba(124,58,237,.25)";
      ctx.strokeRect(x, y, 420, 120);
      ctx.fillStyle = "#94a3b8"; ctx.font = "700 24px Inter, system-ui"; ctx.fillText(label, x+20, y+46);
      ctx.fillStyle = "#fff"; ctx.font = "900 48px Inter, system-ui"; ctx.fillText(value, x+20, y+98);
    };
    box("Vagues", info.wave, 60, 380);
    box("Période", info.period, 60+440, 380);
    box("Vent", info.wind, 60, 520);
    box("Direction", info.windDir, 60+440, 520);
    const pill = (text, x, y, color) => {
      ctx.fillStyle = color; ctx.fillRect(x, y, 240, 54);
      ctx.fillStyle = "#0b0e16"; ctx.font = "800 24px Inter, system-ui"; ctx.fillText(text, x+18, y+36);
    };
    pill(info.status, 60, 700, "#22c55e");
    pill(info.quality, 60+260, 700, "#d946ef");
    ctx.fillStyle = "#94a3b8"; ctx.font = "600 20px Inter, system-ui"; ctx.fillText("Généré • "+new Date().toLocaleString(), 60, h-60);
    return canvas;
  };
  const getInfo = () => {
    let title = "Conditions Live";
    let subtitle = "Analyse IA Marine";
    let wave = "-", period = "-", wind = "-", windDir = "-", status = "WAIT", quality = "FAIR";
    if (document.body.classList.contains("conditions-page")) {
      title = document.getElementById("cond-name")?.textContent || title;
      subtitle = "Spot • "+title;
      wave = (document.getElementById("val-wave")?.textContent || "-")+" m";
      period = (document.getElementById("val-period")?.textContent || "-")+" s";
      wind = (document.getElementById("val-wind-speed")?.textContent || "-")+" km/h";
      windDir = document.getElementById("val-wind-dir")?.textContent || "-";
      status = document.getElementById("status-title")?.textContent || status;
      quality = document.getElementById("val-quality")?.textContent || quality;
    }
    return { title, subtitle, wave, period, wind, windDir, status, quality };
  };
  const handler = async () => {
    const info = getInfo();
    const canvas = makeCanvas(info);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "swell-story.png", { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: info.title, text: info.subtitle }); return; } catch {}
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "swell-story.png"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
      const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        setTimeout(() => {
          const tryOpen = (href) => { try { window.location.href = href; } catch {} };
          tryOpen("instagram://story-camera");
          tryOpen("snapchat://create");
          tryOpen("tiktok://camera");
        }, 500);
      }
    }, "image/png", 0.92);
  };
  btns.forEach(b => b.addEventListener("click", handler));
  window.shareStoryNow = handler;
};
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
