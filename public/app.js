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

// --- 3. GATEKEEPER & AUTHENTIFICATION ---
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

const handleAuthSwitch = () => {
    const loginView = document.getElementById("auth-login-view");
    const registerView = document.getElementById("auth-register-view");
    
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

const initAuthLogic = () => {
    const regForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");

    // INSCRIPTION
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
                    localStorage.setItem("surfUser", JSON.stringify(data.user));
                    alert("Compte créé. Bienvenue Agent " + data.user.name);
                    window.location.reload();
                } else alert("Erreur : " + data.error);
            } catch (err) { alert("Erreur connexion serveur."); }
        };
    }

    // CONNEXION + 2FA
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-pass").value;
            const btn = loginForm.querySelector("button");
            const originalText = btn.innerText;
            btn.innerText = "SÉCURISATION...";

            try {
                // ÉTAPE 1 : LOGIN
                const res = await fetch("/api/auth/login", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();

                if (data.step === "2FA") {
                    // SI 2FA REQUIS -> ON AFFICHE L'INPUT CODE
                    document.getElementById("auth-login-view").style.display = "none";
                    document.getElementById("auth-2fa-view").style.display = "block";
                    
                    // GESTION DU FORMULAIRE CODE
                    const form2FA = document.getElementById("2fa-form");
                    form2FA.onsubmit = async (evt) => {
                        evt.preventDefault();
                        const code = document.getElementById("2fa-code").value;
                        
                        // ÉTAPE 2 : VERIFY CODE
                        const res2 = await fetch("/api/auth/verify-2fa", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email, code })
                        });
                        const data2 = await res2.json();
                        
                        if (data2.success) {
                            localStorage.setItem("surfUser", JSON.stringify(data2.user));
                            window.location.reload();
                        } else alert("CODE INVALIDE OU EXPIRÉ");
                    };
                } else if (data.error) {
                    alert("Erreur : " + data.error);
                    btn.innerText = originalText;
                }
            } catch (err) { alert("Erreur serveur."); btn.innerText = originalText; }
        };
    }
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

const getWeatherIcon = (cloudCover) => {
  if (cloudCover == null) return "☀️";
  if (cloudCover < 30) return "☀️"; 
  if (cloudCover < 70) return "⛅"; 
  return "☁️";                      
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
        <div class="ai-robot-card"><div class="robot-icon">🏄‍♂️</div><div class="robot-info"><span class="robot-name">Quiver-AI</span><span class="robot-value">${board}</span></div></div>
        <div class="ai-robot-card"><div class="robot-icon">👥</div><div class="robot-info"><span class="robot-name">Crowd-Predict</span><span class="robot-value">${crowd}</span></div></div>
        <div class="ai-robot-card"><div class="robot-icon">🌡️</div><div class="robot-info"><span class="robot-name">Feel-Real</span><span class="robot-value">${feel}°C</span></div></div>
        <div class="ai-robot-card"><div class="robot-icon">☀️</div><div class="robot-info"><span class="robot-name">Solar-Sync</span><span class="robot-value">${solar}</span></div></div>
        <div class="ai-robot-card"><div class="robot-icon">🧬</div><div class="robot-info"><span class="robot-name">Eco-Scan</span><span class="robot-value">${pollution}</span></div></div>
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
  const glowIcon = L.divIcon({ className: "leaflet-marker-wrapper", html: '<div class="spot-marker"></div>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -35] });
  spots.forEach((spot) => {
    const marker = L.marker(spot.coords, { icon: glowIcon });
    marker.bindPopup(renderSpotPopup(spot), { closeButton: false, offset: [0, -10], className: "surf-popup" });
    marker.on("click", () => selectSpot(spot, marker));
    markersCluster.addLayer(marker);
    markersByName.set(spot.name, marker);
  });
  map.addLayer(markersCluster);
  setTimeout(() => map.invalidateSize(), 200);
};

const selectSpot = (spot, marker, { openPopup = true } = {}) => {
  if (!spot) return;

  // 📡 SIGNAL RADAR : Envoie l'info au serveur pour affichage dans Render
  fetch(`/api/log-click?spot=${encodeURIComponent(spot.name)}`).catch(() => {});

  const resolvedMarker = marker || markersByName.get(spot.name);
  if (activeMarker && activeMarker.getElement()) activeMarker.getElement().querySelector('.spot-marker')?.classList.remove("spot-marker--active");
  
  if (resolvedMarker) {
      markersCluster.zoomToShowLayer(resolvedMarker, () => {
          if (resolvedMarker.getElement()) { resolvedMarker.getElement().querySelector('.spot-marker')?.classList.add("spot-marker--active"); }
          if (openPopup) resolvedMarker.openPopup();
          activeMarker = resolvedMarker;
      });
  } else { 
      map.setView(spot.coords, 9, { animate: true }); 
  }
  
  updateSpotListSelection(spot.name);
  localStorage.setItem("selectedSpot", spot.name);
};

const renderSpotPopup = (spot) => {
  const isFav = (JSON.parse(localStorage.getItem("surfFavorites") || "[]")).includes(spot.name);
  const badgeId = `badge-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`;
  const isLive = document.getElementById(badgeId)?.classList.contains('is-live');
  const statusHtml = isLive 
    ? '<span style="color: #4ade80; font-size: 0.8rem; font-weight: 800; margin-left: 10px;">● LIVE</span>' 
    : '<span style="color: #94a3b8; font-size: 0.8rem; font-weight: 800; margin-left: 10px;">○ WAITING</span>';

  return `
    <div class="spot-popup compact-popup">
        <button class="popup-close" onclick="map.closePopup()">✕</button>
        <div class="popup-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <h4 style="margin:0;">${spot.name}</h4>
            ${statusHtml}
        </div>
        <div class="spot-popup-actions" style="display:flex; flex-direction:column; gap:8px;">
            <a class="popup-btn popup-btn--primary" href="conditions.html?spot=${encodeURIComponent(spot.name)}" style="text-align:center; text-decoration:none;">Voir Conditions</a>
            <a class="popup-btn" href="cameras.html?spot=${encodeURIComponent(spot.name)}" style="text-align:center; text-decoration:none; background: rgba(255,255,255,0.1); color: #fff;">📷 Webcams</a>
            <button class="popup-btn popup-btn--fav ${isFav ? 'active' : ''}" onclick="window.toggleFav('${spot.name}', this)" style="width:100%;">
               ${isFav ? '♥ Retirer Favori' : '♡ Ajouter Favori'}
            </button>
        </div>
    </div>`;
};

window.toggleFav = (name, btn) => {
    toggleFavorite(name);
    const isFav = (JSON.parse(localStorage.getItem("surfFavorites") || "[]")).includes(name);
    if(btn && btn.classList) {
        btn.classList.toggle('active');
        btn.innerHTML = isFav ? '♥ Favori' : '♡ Ajouter Favori';
        btn.style.color = isFav ? '#ff304a' : '#fff';
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

const updateSpotListSelection = (name) => {
  document.querySelectorAll(".spot-card").forEach(c => {
    c.classList.toggle("is-active", c.dataset.spot === name);
    if (c.dataset.spot === name) c.scrollIntoView({ behavior: "smooth", block: "center" });
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

const toggleFavorite = (name) => {
  const favs = JSON.parse(localStorage.getItem("surfFavorites") || "[]");
  const idx = favs.indexOf(name);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(name);
  localStorage.setItem("surfFavorites", JSON.stringify(favs));
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
            <img src="${n.img}" class="news-img" alt="${n.title}" loading="lazy">
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
                <div class="hero-bg" style="background-image: url('${topStory.img}');"></div>
                <div class="hero-overlay">
                    <span class="hero-tag">🔥 À LA UNE</span>
                    <h1 class="hero-title">${topStory.title}</h1>
                    <p class="hero-desc">${topStory.desc}</p>
                    <a href="${topStory.link}" target="_blank" class="hero-btn">Lire l'article</a>
                </div>
            </div>`;
            
        grid.innerHTML = otherStories.map(n => `
            <article class="news-card">
                <div class="news-img-wrapper"><img src="${n.img}" class="news-img" loading="lazy"><span class="news-badge">${n.tag}</span></div>
                <div class="news-content"><h3>${n.title}</h3><a href="${n.link}" target="_blank" class="news-btn">Lire la suite</a></div>
            </article>`).join('');
    } catch (e) { console.error("Erreur news:", e); }
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
    const isFav = (JSON.parse(localStorage.getItem("surfFavorites") || "[]")).includes(spot.name);
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
    document.getElementById("val-wind-dir").textContent = weather.windDirection || "-";
    document.getElementById("val-swell-dir").textContent = weather.swellDirection || "-";

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
    if (list && weather.forecast) {
        list.innerHTML = weather.forecast.map(item => {
            const d = new Date(item.time);
            const isToday = d.getDate() === now.getDate();
            const timeLabel = isToday ? d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : d.toLocaleDateString("fr-FR", { weekday: 'short', day: 'numeric' });
            const dayQual = calculateQuality(item.waveHeight, item.windSpeed, item.wavePeriod, item.windDirection, safeTideStage, spotNameActual);
            const icon = getWeatherIcon(item.cloudCover);
            return `
              <div class="day-card ${dayQual.class} ${isToday ? 'is-hourly' : ''}">
                <div class="day-header">
                  <div style="display:flex; flex-direction:column; min-width:70px;">
                    <span class="day-date">${timeLabel}</span>
                    ${isToday ? '<span style="font-size:0.6rem; color:var(--accent); font-weight:700;">PRO-BOT</span>' : ''}
                  </div>
                  <span class="quality-badge" style="color:${dayQual.color}">${dayQual.label}</span>
                  <div class="surf-stats-group" style="flex:1; margin-left:20px;">
                    <span class="surf-primary" style="font-weight:700;">${item.waveHeight?.toFixed(1)}m | ${item.windSpeed} km/h</span><br>
                    <span class="surf-secondary" style="font-size:0.75rem; color:#888;">Energie ${dayQual.energy} | Période ${Math.round(item.wavePeriod)}s</span>
                  </div>
                  <div class="weather-stats-group">
                    <div class="weather-pill"><span>${icon}</span><span>${item.airTemperature}°</span></div>
                  </div>
                  <span class="day-arrow">▼</span>
                </div>
                <div class="day-details">
                  <div class="detail-box"><span class="detail-label">BOT-INFO</span><span class="detail-value">${dayQual.botMsg}</span></div>
                  <div class="detail-box"><span class="detail-label">VENT</span><span class="detail-value">${item.windDirection}</span></div>
                  <div class="detail-box"><span class="detail-label">HOULE</span><span class="detail-value">${item.swellDirection || 'N/A'}</span></div>
                </div>
              </div>`;
        }).join('');
        document.querySelectorAll('.day-card').forEach(c => c.onclick = () => c.classList.toggle("is-open"));
    }
  };
  fetchConditions();
};

const initFavoritesPage = async () => {
    const container = document.getElementById("fav-grid");
    const emptyState = document.getElementById("empty-favs");
    if (!container || !emptyState) return;

    const favs = JSON.parse(localStorage.getItem("surfFavorites") || "[]");
    
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

      if(waterEl && weather.waterTemperature != null) {
          waterEl.querySelector(".bubble-value").textContent = `${weather.waterTemperature}°C`;
          waterEl.querySelector(".bubble-value").style.color = "#4ade80";
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

const initRadar = () => {
    const container = document.getElementById("radar-container");
    if (!container) return; 

    const trendingSpots = [spots[0], spots[7], spots[18], spots[9]]; 

    container.innerHTML = trendingSpots.map(spot => `
        <div class="radar-card" onclick="window.location.href='conditions.html?spot=${encodeURIComponent(spot.name)}'">
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

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    document.querySelectorAll(".store-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            installModal.classList.add("is-open");
            
            if (isIOS) {
                iosGuide.style.display = "block";
                androidGuide.style.display = "none";
            } else {
                iosGuide.style.display = "none";
                androidGuide.style.display = "block";
            }
        });
    });

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

const initCamerasPage = () => {
    const listContainer = document.getElementById("cam-list-container");
    const mainScreen = document.getElementById("main-cam-screen");
    const liveName = document.getElementById("cam-live-name");
    const metaTitle = document.getElementById("meta-title");
    const metaDesc = document.getElementById("meta-desc");
    const btnRedirect = document.getElementById("cam-redirect-btn");
    const timeDisplay = document.getElementById("cam-live-time");

    if (!listContainer || !mainScreen) return;

    if (camClockInterval) clearInterval(camClockInterval);
    camClockInterval = setInterval(() => {
        const now = new Date();
        if(timeDisplay) timeDisplay.textContent = now.toLocaleTimeString();
    }, 1000);

    const camImages = [
        "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800",
        "https://images.unsplash.com/photo-1520443240718-fce21901db79?w=800",
        "https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?w=800",
        "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800",
        "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=800",
        "https://images.unsplash.com/photo-1506477331477-33d5d8b3dc85?w=800",
        "https://images.unsplash.com/photo-1531771686035-25f475954919?w=800",
        "https://images.unsplash.com/photo-1415604934674-561df9abf539?w=800"
    ];

    const loadCam = (spot, imgUrl) => {
        mainScreen.style.backgroundImage = `url('${imgUrl}')`;
        if(liveName) liveName.textContent = spot.name.toUpperCase();
        if(metaTitle) metaTitle.textContent = spot.name;
        if(metaDesc) metaDesc.textContent = `Vue directe sur le spot de ${spot.name} (${spot.region}). Flux HD optimisé.`;
        
        const searchUrl = `https://www.google.com/search?q=webcam+surf+${encodeURIComponent(spot.name)}+live`;
        if(btnRedirect) btnRedirect.href = searchUrl;

        document.querySelectorAll(".cam-item").forEach(c => c.classList.remove("active"));
        const activeItem = document.getElementById(`cam-item-${spot.name.replace(/[^a-zA-Z0-9]/g, '')}`);
        if(activeItem) activeItem.classList.add("active");
    };

    listContainer.innerHTML = spots.map((spot, index) => {
        const img = camImages[index % camImages.length];
        const safeId = spot.name.replace(/[^a-zA-Z0-9]/g, '');
        return `
            <div class="cam-item" id="cam-item-${safeId}" onclick='window.selectCam(${JSON.stringify(spot)}, "${img}")'>
                <div class="cam-thumb" style="background-image: url('${img}');"></div>
                <div class="cam-info">
                    <h4>${spot.name}</h4>
                    <span class="cam-status">● LIVE</span>
                </div>
            </div>
        `;
    }).join('');

    window.selectCam = (spot, img) => loadCam(spot, img);

    if (spots.length > 0) loadCam(spots[0], camImages[0]);
    
    const fetchCamStats = async () => {
        try {
            const spot = spots[0]; 
            const res = await fetch(`/api/marine?lat=${spot.coords[0]}&lng=${spot.coords[1]}`);
            const data = await res.json();
            if(document.getElementById("cs-wind")) document.getElementById("cs-wind").textContent = `${data.windSpeed} km/h`;
            if(document.getElementById("cs-swell")) document.getElementById("cs-swell").textContent = `${data.waveHeight.toFixed(1)}m`;
            if(document.getElementById("cs-tide")) document.getElementById("cs-tide").textContent = "Montante"; 
        } catch(e) {}
    };
    fetchCamStats();
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

  const loader = document.getElementById("app-loader");
  if(loader) { setTimeout(() => loader.classList.add("loader-hidden"), 800); }

  try {
      if (document.getElementById("surf-map")) { 
        initMap(); renderSpotList(); renderHomeNews(); checkGlobalAlerts(); updateHomeStats(); initRadar(); initMobileInstall(); 
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