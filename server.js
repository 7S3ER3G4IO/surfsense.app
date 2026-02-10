import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import pg from "pg"; 
import bcrypt from "bcrypt"; 
import Parser from "rss-parser";
import { fileURLToPath } from "url";
import { spots } from "./spots.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const parser = new Parser();

// --- CONFIGURATION BASE DE DONNÉES RENDER ---
const dbUrl = process.env.INTERNAL_DATABASE_URL || process.env.DATABASE_URL;

const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: process.env.RENDER ? { rejectUnauthorized: false } : false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); 

// --- CONFIGURATION ROBOTS (Code inchangé) ---
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

const STORMGLASS_API_KEY = process.env.STORMGLASS_API_KEY || "91e3ecb4-0596-11f1-b82f-0242ac120004-91e3ed18-0596-11f1-b82f-0242ac120004";
const MAX_DAILY_CALLS = 480; 
const CACHE_DURATION = 3 * 60 * 60 * 1000; 
const WEATHER_ROBOT_INTERVAL = 45 * 60 * 1000; 

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

// --- GESTION DB & MIGRATION AUTOMATIQUE ---
const cache = new Map(); 

const initDB = async () => {
    try {
        // 1. Table CACHE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                data JSONB,
                expires BIGINT
            );
        `);

        // 2. Table USERS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                premium BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 3. MIGRATION AUTOMATIQUE POUR 2FA (C'EST ICI QUE ÇA SE PASSE)
        // Le serveur va essayer d'ajouter les colonnes. Si elles existent déjà, il ignore.
        try {
            await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code TEXT;");
            await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires BIGINT;");
            console.log("✅ [DB] Colonnes 2FA (Secu) vérifiées.");
        } catch (e) {
            console.log("ℹ️ [DB] Colonnes 2FA déjà présentes.");
        }

        console.log("✅ [DB] Base de données prête.");

        // 4. Migration Cache.json si vide
        const countRes = await pool.query("SELECT COUNT(*) FROM cache");
        if (parseInt(countRes.rows[0].count) === 0) {
            console.log("📂 [MIGRATION] Base vide. Importation de cache.json...");
            await migrateLocalCacheToDB();
        }

        await loadCacheFromDB();
    } catch (err) {
        console.error("❌ [DB CRITICAL] Erreur connexion:", err.message);
    }
};

const migrateLocalCacheToDB = async () => {
    const localCachePath = path.join(__dirname, "cache.json");
    if (fs.existsSync(localCachePath)) {
        try {
            const raw = fs.readFileSync(localCachePath, "utf8");
            const data = JSON.parse(raw);
            for (const [key, value] of data) {
                await pool.query(
                    `INSERT INTO cache (key, data, expires) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
                    [key, JSON.stringify(value.data), value.expires]
                );
            }
        } catch (e) { console.error("❌ Erreur migration:", e); }
    }
};

const loadCacheFromDB = async () => {
    try {
        const res = await pool.query("SELECT * FROM cache");
        res.rows.forEach(row => {
            cache.set(row.key, { data: row.data, expires: parseInt(row.expires) });
        });
        console.log(`📥 [DB LOAD] ${cache.size} spots chargés en mémoire.`);
    } catch (e) { console.error("⚠️ Erreur lecture DB:", e.message); }
};

const saveToDB = async (key, data, expires) => {
    try {
        const query = `
            INSERT INTO cache (key, data, expires) 
            VALUES ($1, $2, $3)
            ON CONFLICT (key) 
            DO UPDATE SET data = EXCLUDED.data, expires = EXCLUDED.expires;
        `;
        await pool.query(query, [key, JSON.stringify(data), expires]);
    } catch (e) { console.error("❌ Erreur sauvegarde DB:", e.message); }
};

app.use(cors());

// --- FONCTION UTILITAIRE : GÉNÉRER CODE 2FA ---
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


// --- ROUTES D'AUTHENTIFICATION (AVEC 2FA) ---

// INSCRIPTION
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Champs manquants" });

    try {
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(409).json({ error: "Email déjà utilisé." });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            "INSERT INTO users (name, email, password, premium) VALUES ($1, $2, $3, $4) RETURNING id, name, email, premium",
            [name, email, hash, true]
        );

        res.json({ success: true, user: newUser.rows[0] });
        console.log(`👤 [AUTH] Nouvel agent : ${name}`);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// CONNEXION (ÉTAPE 1 : CHECK PASS + GEN CODE)
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "Utilisateur inconnu." });

        const user = userRes.rows[0];
        const validPass = await bcrypt.compare(password, user.password);

        if (!validPass) return res.status(401).json({ error: "Mot de passe incorrect." });

        // GÉNÉRATION 2FA
        const code = generateOTP();
        const expires = Date.now() + 5 * 60 * 1000; // 5 min

        await pool.query("UPDATE users SET otp_code = $1, otp_expires = $2 WHERE id = $3", [code, expires, user.id]);

        // LOG POUR LE DEV (Simule l'envoi d'email)
        console.log(`📨 [EMAIL SIMULATION] Code pour ${user.email} : ${code}`);

        res.json({ step: "2FA", email: user.email, message: "Code envoyé" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur connexion" });
    }
});

// VÉRIFICATION (ÉTAPE 2 : CHECK CODE)
app.post("/api/auth/verify-2fa", async (req, res) => {
    const { email, code } = req.body;
    try {
        const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable." });
        
        const user = userRes.rows[0];

        if (!user.otp_code || user.otp_code !== code) {
            return res.status(400).json({ error: "Code invalide." });
        }
        if (Date.now() > parseInt(user.otp_expires)) {
            return res.status(400).json({ error: "Code expiré." });
        }

        // Nettoyage code
        await pool.query("UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = $1", [user.id]);

        res.json({ 
            success: true, 
            user: { id: user.id, name: user.name, email: user.email, premium: user.premium } 
        });
        console.log(`🔓 [AUTH] Succès 2FA : ${user.name}`);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur 2FA" });
    }
});


// --- RESTES DES ROUTES & LOGIQUE MÉTIER ---

app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
        const randomRobots = [ROBOTS.ENERGY, ROBOTS.VECTOR, ROBOTS.CHOP, ROBOTS.FEEL];
        const robot = randomRobots[Math.floor(Math.random() * randomRobots.length)];
        // robotLog(robot, "SCANNING", `${req.method} ${req.url}`);
    }
    next();
});

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
      
      const dataToStore = { allTides: futureTides, stage: futureTides[0]?.stage || "Stable" };
      const expiresAt = now + (12 * 60 * 60 * 1000);

      cache.set(key, { data: dataToStore, expires: expiresAt });
      saveToDB(key, dataToStore, expiresAt);
      apiCallCount++;
      robotLog(ROBOTS.TIDE, "UPDATE", spot.name);
    } catch (e) { robotLog(ROBOTS.TIDE, "ERROR", spot.name); }
  }
};

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

    const expiresAt = now + CACHE_DURATION;
    cache.set(key, { data: realData, expires: expiresAt });
    saveToDB(key, realData, expiresAt); 
    apiCallCount++;
    return realData;
  } catch (e) { return cache.get(key)?.data || null; }
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- DÉMARRAGE AVEC SÉQUENCE BOOT ROBOTS ---
app.listen(PORT, () => {
    console.log("\n\x1b[44m\x1b[37m  SURFSENSE PREMIUM v2.0 - SYSTÈME OPÉRATIONNEL  \x1b[0m\n");
    
    initDB(); // CETTE FONCTION FAIT TOUT LE TRAVAIL (Création tables + Migration 2FA)

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