import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import Parser from "rss-parser";
import { fileURLToPath } from "url";
import { spots } from "./spots.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const parser = new Parser();
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURATION DES ROBOTS SURFSENSE (LOGS IMMERSIFS) ---
const ROBOTS = {
    TIDE: { name: "Tide-Master", icon: "🌊", msg: "Analyse des cycles de marée..." },
    SWELL: { name: "Swell-Pulse", icon: "⏱️", msg: "Mesure de la période et direction..." },
    VECTOR: { name: "Vector-Angle", icon: "📐", msg: "Calcul de l'incidence du vent..." },
    ENERGY: { name: "Energy-Core", icon: "⚡", msg: "Évaluation de la puissance (H²xT)..." },
    CHOP: { name: "Anti-Chop", icon: "🛡️", msg: "Filtrage du clapot de surface..." },
    NEWS: { name: "News-Bot", icon: "🤖", msg: "Scan des flux RSS et métadonnées..." },
    QUIVER: { name: "Quiver-AI", icon: "🏄‍♂️", msg: "Génération des recommandations board..." },
    CROWD: { name: "Crowd-Predict", icon: "👥", msg: "Estimation de l'affluence..." },
    FEEL: { name: "Feel-Real", icon: "🌡️", msg: "Calcul du windchill thermique..." },
    SOLAR: { name: "Solar-Sync", icon: "☀️", msg: "Synchronisation cycle UV..." },
    ECO: { name: "Eco-Scan", icon: "🧬", msg: "Contrôle de la qualité de l'eau..." },
    HUNTER: { name: "Swell-Hunter", icon: "🏹", msg: "Traque des meilleures sessions..." }
};

const robotLog = (robot, status = "OK", details = "") => {
    const timestamp = new Date().toLocaleTimeString();
    const detailStr = details ? ` | \x1b[90m${details}\x1b[0m` : "";
    console.log(`[\x1b[90m${timestamp}\x1b[0m] ${robot.icon} \x1b[36mRobot ${robot.name}\x1b[0m : ${robot.msg} [\x1b[32m${status}\x1b[0m]${detailStr}`);
};

// --- CONFIGURATION SÉCURISÉE ---
const STORMGLASS_API_KEY = "91e3ecb4-0596-11f1-b82f-0242ac120004-91e3ed18-0596-11f1-b82f-0242ac120004";
const CACHE_FILE = "./cache.json";

// --- RÉGLAGES ÉCONOMIQUES ---
const MAX_DAILY_CALLS = 480; 
const CACHE_DURATION = 3 * 60 * 60 * 1000; 
const WEATHER_ROBOT_INTERVAL = 45 * 60 * 1000; 

// Mémoire globale
let globalNews = [];
let epicSpots = []; 
let apiCallCount = 0;
let lastQuotaInfo = { limit: 500, remaining: 500, used: 0 };
let lastReset = new Date().getDate();

const fallbackImages = [
    "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800",
    "https://images.unsplash.com/photo-1415931633537-351139717d27?w=800",
    "https://images.unsplash.com/photo-1455729552865-3658a5d39692?w=800",
    "https://images.unsplash.com/photo-1531722569936-825d3dd91b15?w=800",
    "https://images.unsplash.com/photo-1528150395403-992a693e26c8?w=800"
];

const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return new Map(JSON.parse(data));
    }
  } catch (e) { console.error("⚠️ Nouveau stockage initialisé."); }
  return new Map();
};

const saveCache = () => {
  try {
    const data = JSON.stringify(Array.from(cache.entries()));
    fs.writeFileSync(CACHE_FILE, data, "utf8");
  } catch (e) { console.error("❌ Erreur sauvegarde stockage."); }
};

const cache = loadCache();

app.use(cors());
app.use(express.static(path.join(__dirname, '../main')));

// --- MIDDLEWARE DE MONITORING API ---
app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
        const randomRobots = [ROBOTS.ENERGY, ROBOTS.VECTOR, ROBOTS.CHOP, ROBOTS.FEEL];
        const robot = randomRobots[Math.floor(Math.random() * randomRobots.length)];
        robotLog(robot, "SCANNING", `${req.method} ${req.url}`);
    }
    next();
});

// --- ROBOT 1 : SWELL HUNTER ---
const runSwellHunter = () => {
  robotLog(ROBOTS.HUNTER, "RUNNING");
  const alerts = [];
  cache.forEach((value, key) => {
    if (key.startsWith("tide-")) return;
    const d = value.data;
    if (!d) return;

    let score = 0;
    const isOffshore = ["E", "SE", "NE"].includes(d.windDirection);
    if (d.waveHeight >= 1.2 && d.waveHeight <= 2.5) score += 30; 
    if (d.wavePeriod >= 9) score += 20; 
    if (isOffshore) score += 30; 
    if (d.windSpeed < 15) score += 20; 

    if (score >= 80) {
      const spot = spots.find(s => `${s.coords[0]},lng=${s.coords[1]}` === key);
      if (spot) alerts.push({ name: spot.name, quality: score >= 95 ? "ÉPIQUE" : "TRÈS BON", reliability: score + "%" });
    }
  });
  epicSpots = alerts;
  if(epicSpots.length > 0) robotLog(ROBOTS.HUNTER, "SUCCESS", `${epicSpots.length} sessions validées`);
};

// --- ROBOT 2 : TIDE MASTER ---
const runTideMaster = async () => {
  robotLog(ROBOTS.TIDE, "CHECKING");
  const now = Date.now();

  for (const spot of spots) {
    const key = `tide-${spot.name}`;
    if (cache.has(key)) {
        const cached = cache.get(key);
        if (now < cached.expires && cached.data.allTides) continue;
    }
    if (apiCallCount >= MAX_DAILY_CALLS) break;

    try {
      await new Promise(r => setTimeout(r, 1200)); 
      const response = await fetch(`https://api.stormglass.io/v2/tide/extremes/point?lat=${spot.coords[0]}&lng=${spot.coords[1]}`, {
        headers: { "Authorization": STORMGLASS_API_KEY }
      });
      
      const limit = response.headers.get('x-ratelimit-limit');
      const remaining = response.headers.get('x-ratelimit-remaining');
      if(limit && remaining) lastQuotaInfo = { limit: parseInt(limit), remaining: parseInt(remaining), used: limit - remaining };

      if (!response.ok) throw new Error("API Limit");
      const json = await response.json();
      
      const futureTides = json.data
        .filter(e => new Date(e.time) > new Date())
        .map(e => ({
          stage: e.type === "high" ? "Haute" : "Basse",
          level: e.height.toFixed(1) + "m",
          time: e.time
        }));
      
      cache.set(key, { 
        data: { allTides: futureTides, stage: futureTides[0]?.stage || "Stable" }, 
        expires: now + (12 * 60 * 60 * 1000) 
      });
      apiCallCount++;
      saveCache();
      robotLog(ROBOTS.TIDE, "UPDATE", spot.name);
    } catch (e) { robotLog(ROBOTS.TIDE, "ERROR", spot.name); }
  }
};

// --- ROBOT 3 : NEWS BOT ---
const fetchSurfNews = async () => {
  robotLog(ROBOTS.NEWS, "SCANNING");
  try {
    const sources = ['https://www.surfsession.com/rss/', 'https://full-bloom.fr/feed/'];
    let allArticles = [];
    for (const url of sources) {
      try {
        const feed = await parser.parseURL(url);
        allArticles = [...allArticles, ...feed.items.map(item => {
          const imgMatch = item.content?.match(/<img[^>]+src="([^">]+)"/) || item['content:encoded']?.match(/<img[^>]+src="([^">]+)"/);
          const finalImg = imgMatch ? imgMatch[1] : (item.enclosure?.url || fallbackImages[Math.floor(Math.random() * fallbackImages.length)]);

          return {
            tag: "ACTU SURF",
            title: item.title,
            desc: item.contentSnippet?.slice(0, 100) + "...",
            img: finalImg,
            link: item.link,
            date: item.pubDate
          };
        })];
      } catch (err) { }
    }
    globalNews = allArticles.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    robotLog(ROBOTS.NEWS, "READY", `${globalNews.length} articles chargés`);
  } catch (e) { robotLog(ROBOTS.NEWS, "ERROR"); }
};

const getCardinal = (deg) => {
  if (deg == null) return "--";
  const arr = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return arr[(Math.floor((deg / 45) + 0.5) % 8)];
};

const pickValue = (obj) => obj ? (obj.sg || obj.noaa || Object.values(obj)[0] || null) : null;

const getDataSmart = async (lat, lng, spotName = "Inconnu", isAuto = false) => {
  const key = `${lat},lng=${lng}`;
  const now = Date.now();

  if (new Date().getDate() !== lastReset) { apiCallCount = 0; lastReset = new Date().getDate(); }
  if (cache.has(key) && now < cache.get(key).expires) return cache.get(key).data;
  if (apiCallCount >= MAX_DAILY_CALLS) return cache.get(key)?.data || null;

  try {
    await new Promise(r => setTimeout(r, 800)); 
    const params = "waveHeight,wavePeriod,windSpeed,windDirection,swellDirection,waterTemperature,airTemperature,cloudCover";
    const response = await fetch(`https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${params}`, {
      headers: { "Authorization": STORMGLASS_API_KEY }
    });

    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (limit && remaining) {
      lastQuotaInfo = { limit: parseInt(limit), remaining: parseInt(remaining), used: limit - remaining };
      robotLog(ROBOTS.SWELL, "SYNC", `${spotName} (${remaining} left)`);
    }

    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const json = await response.json();
    const current = json.hours[0];
    
    const forecast = json.hours.filter((h, i) => i < 24 || (new Date(h.time).getHours() === 12)).map(hour => ({
        time: hour.time,
        waveHeight: pickValue(hour.waveHeight),
        wavePeriod: pickValue(hour.wavePeriod),
        windSpeed: Math.round(pickValue(hour.windSpeed) * 3.6),
        windDirection: getCardinal(pickValue(hour.windDirection)),
        airTemperature: Math.round(pickValue(hour.airTemperature)),
        waterTemperature: Math.round(pickValue(hour.waterTemperature))
    }));

    const realData = {
      waveHeight: pickValue(current.waveHeight),
      wavePeriod: pickValue(current.wavePeriod),
      windSpeed: Math.round(pickValue(current.windSpeed) * 3.6),
      windDirection: getCardinal(pickValue(current.windDirection)),
      sourceTime: current.time,
      forecast: forecast,
      source: "LIVE PREMIUM"
    };

    cache.set(key, { data: realData, expires: now + CACHE_DURATION });
    saveCache(); 
    apiCallCount++;
    return realData;
  } catch (e) {
    return cache.get(key)?.data || null;
  }
};

const startBackgroundWorkers = () => {
  setInterval(async () => {
    const spot = spots[Math.floor(Math.random() * spots.length)];
    await getDataSmart(spot.coords[0], spot.coords[1], spot.name, true);
  }, WEATHER_ROBOT_INTERVAL);

  setInterval(fetchSurfNews, 4 * 60 * 60 * 1000);
  fetchSurfNews();

  setInterval(runSwellHunter, 60 * 60 * 1000); 
  setTimeout(runSwellHunter, 5000);

  setInterval(runTideMaster, 12 * 60 * 60 * 1000);
  runTideMaster();
};

app.get("/api/marine", async (req, res) => {
  const data = await getDataSmart(req.query.lat, req.query.lng, "Spot Client");
  res.json(data);
});

app.get("/api/alerts", (req, res) => res.json(epicSpots));
app.get("/api/news", (req, res) => res.json(globalNews));
app.get("/api/tide", (req, res) => {
    const spotName = req.query.spot;
    const cacheData = cache.get(`tide-${spotName}`)?.data;
    res.json(cacheData || { allTides: [], stage: "Inconnu" });
});
app.get("/api/quota", (req, res) => res.json(lastQuotaInfo));

app.get("/api/all-status", (req, res) => {
  const statusMap = {};
  spots.forEach(spot => {
    statusMap[spot.name] = cache.has(`${spot.coords[0]},lng=${spot.coords[1]}`) ? "LIVE" : "WAITING";
  });
  res.json(statusMap);
});

// --- DÉMARRAGE AVEC SÉQUENCE BOOT ROBOTS ---
app.listen(PORT, () => {
    console.log("\n\x1b[44m\x1b[37m  SURFSENSE PREMIUM v2.0 - SYSTÈME OPÉRATIONNEL  \x1b[0m\n");
    
    // Boot visuel des robots
    const startupRobots = Object.values(ROBOTS).slice(0, 6);
    startupRobots.forEach((robot, index) => {
        setTimeout(() => {
            robotLog(robot, "ACTIF");
        }, index * 200);
    });

    setTimeout(() => {
        console.log(`\n🚀 Serveur : http://localhost:${PORT}`);
        console.log(`📡 Liaison : \x1b[32mÉTABLIE\x1b[0m\n`);
        startBackgroundWorkers();
    }, 1500);
});