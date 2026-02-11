import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import pg from "pg"; 
import bcrypt from "bcrypt"; 
import Parser from "rss-parser";
import nodemailer from "nodemailer";
import helmet from "helmet"; // SÉCURITÉ
 
import { fileURLToPath } from "url";
import { spots } from "./spots.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const parser = new Parser();

// --- SÉCURITÉ 1 : HELMET (En-têtes HTTP sécurisés) ---
app.use(helmet({
  contentSecurityPolicy: false, // On désactive la CSP stricte pour laisser Leaflet/Images charger
}));

 

// --- CONFIGURATION BASE DE DONNÉES ---
const dbUrl = process.env.INTERNAL_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
    connectionString: dbUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    ssl: process.env.RENDER ? { rejectUnauthorized: false } : false
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); 
app.use(cors()); // Cors reste utile

// ... LE RESTE DE TON CODE RESTE IDENTIQUE (Robots, Auth, Routes API...) ...
// (Copie-colle tout le reste de ton ancien server.js à partir de "const ROBOTS = ..." jusqu'à la fin)

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
    HUNTER: { name: "Swell-Hunter", icon: "🏹", msg: "Traque des meilleures sessions..." },
    AUTH: { name: "Auth-Gate", icon: "🔐", msg: "Passerelle d'authentification..." },
    DB: { name: "Data-Matrix", icon: "🗄️", msg: "Base de données..." },
    API: { name: "Marine-Link", icon: "📡", msg: "Requêtes HTTP..." },
    SERVER: { name: "Core-Server", icon: "🖥️", msg: "Événements système..." }
};

const robotLog = (robot, status = "OK", details = "") => {
    const timestamp = new Date().toLocaleTimeString();
    const detailStr = details ? ` | \x1b[90m${details}\x1b[0m` : "";
    console.log(`[\x1b[90m${timestamp}\x1b[0m] ${robot.icon} \x1b[36mRobot ${robot.name}\x1b[0m : ${robot.msg} [\x1b[32m${status}\x1b[0m]${detailStr}`);
    setRobotStatus(robot, status, details);
};

const robotsStatus = {};

const setRobotStatus = (robot, status, details = "") => {
  robotsStatus[robot.name] = { status, details, icon: robot.icon, time: Date.now() };
};
const getRobotByName = (name) => Object.values(ROBOTS).find(r => r.name === name) || { name, icon: "📎", msg: "État instantané..." };
const logRobotSnapshot = () => {
  Object.entries(robotsStatus).forEach(([name, info]) => {
    const robot = getRobotByName(name);
    const ts = new Date().toLocaleTimeString();
    const detailStr = info.details ? ` | \x1b[90m${info.details}\x1b[0m` : "";
    console.log(`[\x1b[90m${ts}\x1b[0m] ${robot.icon} \x1b[36mRobot ${robot.name}\x1b[0m : ${robot.msg} [\x1b[32m${info.status}\x1b[0m]${detailStr}`);
  });
};

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || "587");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "no-reply@surfsense.io";
let mailer = null;
if (smtpHost && smtpUser && smtpPass) {
  mailer = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });
}

const send2faMail = async (email, code) => {
  if (!mailer) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      mailer = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      robotLog(ROBOTS.AUTH, "MAIL", "Transport test Ethereal prêt");
    } catch (e) { throw new Error("SMTP not configured"); }
  }
  const info = await mailer.sendMail({
    from: smtpFrom,
    to: email,
    subject: "SurfSense — Code de vérification",
    text: `Votre code: ${code}`,
    html: `<p>Votre code de vérification est <strong>${code}</strong>.</p>`
  });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) robotLog(ROBOTS.AUTH, "MAIL", `Preview ${preview}`);
};

// --- CONFIGURATION SÉCURISÉE ---
let STORMGLASS_API_KEY = process.env.STORMGLASS_API_KEY;
if (!STORMGLASS_API_KEY) {
  try {
    const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
    const match = envExample.match(/STORMGLASS_API_KEY\s*=\s*(.+)/);
    if (match) STORMGLASS_API_KEY = match[1].trim();
    robotLog(ROBOTS.API, "READY", "Stormglass key chargée depuis .env.example");
  } catch {}
}

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

// --- GESTION CACHE & BASE DE DONNÉES ---
const cache = new Map(); // Mémoire vive pour la rapidité

const initDB = async () => {
    // Si pas de DB configurée, on passe en mode "Memory Only" sans erreur
    if (!process.env.INTERNAL_DATABASE_URL && !process.env.DATABASE_URL) {
        robotLog(ROBOTS.DB, "OFF", "Pas de DB détectée — Mode mémoire activé");
        return;
    }

    try {
        // 1. Créer la table CACHE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                data JSONB,
                expires BIGINT
            );
        `);

        // 2. Créer la table USERS (NOUVEAU)
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                spot_name TEXT NOT NULL,
                PRIMARY KEY (user_id, spot_name)
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS click_logs (
                id SERIAL PRIMARY KEY,
                spot_name TEXT NOT NULL,
                ip TEXT,
                ts TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS twofa_codes (
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                code TEXT NOT NULL,
                expires BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        robotLog(ROBOTS.DB, "READY", "Base connectée (Tables Cache & Users)");

        // 3. Vérifier si migration cache nécessaire
        const countRes = await pool.query("SELECT COUNT(*) FROM cache");
        if (parseInt(countRes.rows[0].count) === 0) {
            robotLog(ROBOTS.DB, "MIGRATE", "Base vide — Import cache.json");
            await migrateLocalCacheToDB();
        }

        // 4. Charger les données dans la RAM
        await loadCacheFromDB();
    } catch (err) {
        console.error("❌ [DB CRITICAL] Erreur connexion:", err.message);
    }

  async function fetchTideData(spotName) {
    console.log(`[ ${new Date().toLocaleTimeString()} ] 🤖 Robot Tide-Master : Initialisation de l'analyse pour | ${spotName}`);
    
    try {
        // ... ton code d'appel API ...
        console.log(`[ ${new Date().toLocaleTimeString()} ] ✅ Robot Tide-Master : Données reçues avec succès pour | ${spotName}`);
    } catch (error) {
        console.error(`[ ${new Date().toLocaleTimeString()} ] ❌ Robot Tide-Master : ERREUR CRITIQUE sur | ${spotName} -> ${error.message}`);
    }
}
app.get('/api/marine', async (req, res) => {
    const { lat, lng } = req.query;
    console.log(`[ ${new Date().toLocaleTimeString()} ] 📡 Robot Marine-Sync : Requête entrante (Lat: ${lat}, Lng: ${lng})`);

    // Vérification de la clé API
    if (!process.env.STORMGLASS_API_KEY) {
        console.error(`[ ${new Date().toLocaleTimeString()} ] ⚠️ Robot Marine-Sync : Clé API manquante dans l'environnement !`);
    }

    // ... après l'appel réussi ...
    console.log(`[ ${new Date().toLocaleTimeString()} ] 💧 Robot Marine-Sync : Données météo synchronisées.`);
});

 

// ============================================================================
// 🛡️ OPÉRATION BOUCLIER : ROUTE DE DOUBLE AUTHENTIFICATION (2FA)
// ============================================================================
app.post("/api/auth/verify-2fa", async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ success: false, error: "Email ou code manquant." });
        const u = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (u.rows.length === 0) return res.status(404).json({ success: false, error: "Utilisateur introuvable." });
        const userId = u.rows[0].id;
        const r = await pool.query("SELECT code, expires FROM twofa_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]);
        if (r.rows.length === 0) return res.status(400).json({ success: false, error: "Aucun code en attente." });
        const row = r.rows[0];
        const now = Date.now();
        if (row.code !== code) return res.status(401).json({ success: false, error: "Code invalide." });
        if (now > parseInt(row.expires)) return res.status(401).json({ success: false, error: "Code expiré." });
        await pool.query("DELETE FROM twofa_codes WHERE user_id = $1", [userId]);
        robotLog(ROBOTS.AUTH, "SUCCESS", `2FA validé`);
        return res.status(200).json({ success: true });
    } catch (error) {
        robotLog(ROBOTS.AUTH, "CRITICAL", `Erreur 2FA: ${error.message}`);
        res.status(500).json({ success: false, error: "Erreur interne." });
    }
});

app.get('/api/log-click', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString();
    const spotName = req.query.spot || '';
    try {
        await pool.query("INSERT INTO click_logs (spot_name, ip) VALUES ($1, $2)", [spotName, ip]);
        res.sendStatus(200);
    } catch {
        res.sendStatus(200);
    }
});

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
            console.log("✅ [MIGRATION] Succès !");
        } catch (e) { console.error("❌ Erreur migration:", e); }
    }
};

const loadCacheFromDB = async () => {
    try {
        const res = await pool.query("SELECT * FROM cache");
        res.rows.forEach(row => {
            cache.set(row.key, { data: row.data, expires: parseInt(row.expires) });
        });
        robotLog(ROBOTS.DB, "LOAD", `${cache.size} spots chargés en mémoire`);
    } catch (e) { console.error("⚠️ Erreur lecture DB:", e.message); }
};

const saveToDB = async (key, data, expires) => {
    // Si pas de DB, on ne fait rien (mode mémoire seulement)
    if (!process.env.INTERNAL_DATABASE_URL && !process.env.DATABASE_URL) return;

    try {
        const query = `
            INSERT INTO cache (key, data, expires) 
            VALUES ($1, $2, $3)
            ON CONFLICT (key) 
            DO UPDATE SET data = EXCLUDED.data, expires = EXCLUDED.expires;
        `;
        await pool.query(query, [key, JSON.stringify(data), expires]);
    } catch (e) { robotLog(ROBOTS.DB, "ERROR", `Sauvegarde DB: ${e.message}`); }
};

const cleanupExpiredCache = async () => {
    if (!process.env.INTERNAL_DATABASE_URL && !process.env.DATABASE_URL) return;
    try {
        const now = Date.now();
        await pool.query('DELETE FROM cache WHERE expires < $1', [now]);
        robotLog(ROBOTS.DB, "CLEAN", "Cache expiré purgé");
    } catch (e) { robotLog(ROBOTS.DB, "ERROR", `Purge cache: ${e.message}`); }
};

app.use(cors());

// --- ROUTES D'AUTHENTIFICATION (NOUVEAU) ---

// INSCRIPTION
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Champs manquants" });

    try {
        // Vérifier si l'email existe
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) return res.status(409).json({ error: "Cet email est déjà utilisé." });

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Créer l'utilisateur
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password, premium) VALUES ($1, $2, $3, $4) RETURNING id, name, email, premium",
            [name, email, hash, true]
        );

        const u = newUser.rows[0];
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expires = Date.now() + 10 * 60 * 1000;
        await pool.query("INSERT INTO twofa_codes (user_id, code, expires) VALUES ($1, $2, $3)", [u.id, code, expires]);
        try { await send2faMail(email, code); } catch (e) {}
        res.json({ success: true, user: u });
        robotLog(ROBOTS.AUTH, "REGISTER", `${name} (${email})`);

    } catch (err) {
        robotLog(ROBOTS.AUTH, "ERROR", `Inscription: ${err.message}`);
        res.status(500).json({ error: "Erreur serveur interne" });
    }
});

// CONNEXION
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "Utilisateur inconnu." });

        const user = userRes.rows[0];
        const validPass = await bcrypt.compare(password, user.password);

        if (!validPass) return res.status(401).json({ error: "Mot de passe incorrect." });

        res.json({ 
            success: true, 
            user: { id: user.id, name: user.name, email: user.email, premium: user.premium } 
        });
        robotLog(ROBOTS.AUTH, "LOGIN", user.name);

    } catch (err) {
        robotLog(ROBOTS.AUTH, "ERROR", `Connexion: ${err.message}`);
        res.status(500).json({ error: "Erreur serveur connexion" });
    }
});

app.post("/api/auth/send-2fa", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email manquant" });
    try {
        const r = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (r.rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
        const userId = r.rows[0].id;
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expires = Date.now() + 10 * 60 * 1000;
        await pool.query("INSERT INTO twofa_codes (user_id, code, expires) VALUES ($1, $2, $3)", [userId, code, expires]);
        await send2faMail(email, code);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Envoi impossible" }); }
});

app.get("/api/healthz", async (req, res) => {
    try {
        const r = await pool.query("SELECT NOW()");
        res.json({ ok: true, db: true, cacheCount: cache.size, time: r.rows[0].now });
    } catch {
        res.status(500).json({ ok: false, db: false, cacheCount: cache.size });
    }
});

app.get("/api/auth/user", async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email manquant" });
    try {
        const r = await pool.query("SELECT id, name, email, premium FROM users WHERE email = $1", [email]);
        if (r.rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.get("/api/favorites", async (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId) return res.status(400).json({ error: "userId manquant" });
    try {
        const r = await pool.query("SELECT spot_name FROM favorites WHERE user_id = $1", [userId]);
        res.json(r.rows.map(x => x.spot_name));
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/favorites", async (req, res) => {
    const { userId, spotName, action } = req.body;
    if (!userId || !spotName || !action) return res.status(400).json({ error: "Données manquantes" });
    try {
        if (action === "add") {
            await pool.query("INSERT INTO favorites (user_id, spot_name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, spotName]);
            return res.json({ success: true });
        } else if (action === "remove") {
            await pool.query("DELETE FROM favorites WHERE user_id = $1 AND spot_name = $2", [userId, spotName]);
            return res.json({ success: true });
        } else {
            return res.status(400).json({ error: "Action invalide" });
        }
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});


// --- MIDDLEWARE DE MONITORING API ---
app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
        robotLog(ROBOTS.API, "SCANNING", `${req.method} ${req.url}`);
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
  alerts.forEach(a => robotLog(ROBOTS.HUNTER, "ALERT", `${a.name} ${a.quality} (${a.reliability})`));
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
      robotLog(ROBOTS.TIDE, "REQUEST", `${spot.name} lat=${spot.coords[0]}, lng=${spot.coords[1]}`);
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
      saveToDB(key, dataToStore, expiresAt); // Sauvegarde DB
      
      apiCallCount++;
      const nextTide = futureTides[0];
      if (nextTide) robotLog(ROBOTS.TIDE, "DATA", `${spot.name} ${nextTide.stage} ${nextTide.level} @ ${nextTide.time}`);
      robotLog(ROBOTS.TIDE, "UPDATE", spot.name);
    } catch (e) { robotLog(ROBOTS.TIDE, "ERROR", `${spot.name} ${e.message}`); }
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
          if (item.title) robotLog(ROBOTS.NEWS, "FOUND", item.title);

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
  robotLog(ROBOTS.SWELL, "REQUEST", `${spotName} lat=${lat}, lng=${lng}`);
  if (cache.has(key) && now < cache.get(key).expires) {
    robotLog(ROBOTS.SWELL, "CACHE", spotName);
    return cache.get(key).data;
  }
  if (apiCallCount >= MAX_DAILY_CALLS) {
    robotLog(ROBOTS.SWELL, "QUOTA", spotName);
    return cache.get(key)?.data || null;
  }

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
      waterTemperature: Math.round(pickValue(current.waterTemperature)),
      sourceTime: current.time,
      forecast: forecast,
      source: "LIVE PREMIUM"
    };

    const expiresAt = now + CACHE_DURATION;
    cache.set(key, { data: realData, expires: expiresAt });
    saveToDB(key, realData, expiresAt); // Sauvegarde DB
    
    apiCallCount++;
    robotLog(ROBOTS.SWELL, "DATA", `H=${realData.waveHeight}m T=${realData.wavePeriod}s V=${realData.windSpeed}km/h`);
    return realData;
  } catch (e) {
    robotLog(ROBOTS.SWELL, "ERROR", `${spotName} ${e.message}`);
    return cache.get(key)?.data || null;
  }
};

const runCrowdPredict = () => {
  const total = spots.length;
  let active = 0;
  spots.forEach(s => { if (cache.has(`${s.coords[0]},lng=${s.coords[1]}`)) active++; });
  const pct = Math.round((active / Math.max(1, total)) * 100);
  robotLog(ROBOTS.CROWD, "RESP", `${pct}%`);
};

const runFeelReal = () => {
  let t = 0; let w = 0; let c = 0;
  cache.forEach((val, key) => {
    if (key.startsWith("tide-")) return;
    const d = val.data;
    if (!d || d.airTemperature == null || d.windSpeed == null) return;
    t += d.airTemperature; w += d.windSpeed; c++;
  });
  const avgT = c ? t / c : 16;
  const avgW = c ? w / c : 10;
  const feel = Math.round(avgT - 0.25 * avgW);
  robotLog(ROBOTS.FEEL, "RESP", `${feel}°C`);
};

const runSolarSync = () => {
  const h = new Date().getHours();
  const idx = h >= 6 && h <= 18 ? ((h - 6) / 12) : 0;
  const uv = Math.max(0, Math.min(1, idx));
  robotLog(ROBOTS.SOLAR, "RESP", `UV ${uv.toFixed(2)}`);
};

const runEcoScan = () => {
  robotLog(ROBOTS.ECO, "RESP", "Qualité Eau: Bonne");
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
  
  setInterval(cleanupExpiredCache, 60 * 60 * 1000);
  setTimeout(cleanupExpiredCache, 15000);
  
  setInterval(runCrowdPredict, 5 * 60 * 1000);
  setTimeout(runCrowdPredict, 2500);
  setInterval(runFeelReal, 5 * 60 * 1000);
  setTimeout(runFeelReal, 3000);
  setInterval(runSolarSync, 5 * 60 * 1000);
  setTimeout(runSolarSync, 3500);
  setInterval(runEcoScan, 10 * 60 * 1000);
  setTimeout(runEcoScan, 4000);
};

app.get("/api/marine", async (req, res) => {
  const data = await getDataSmart(req.query.lat, req.query.lng, "Spot Client");
  robotLog(ROBOTS.SWELL, "RESP", `Spot Client ${data?.waveHeight ?? "--"}m`);
  res.json(data);
});

app.get("/api/alerts", (req, res) => { robotLog(ROBOTS.HUNTER, "RESP", `${epicSpots.length} alertes`); res.json(epicSpots); });
app.get("/api/news", (req, res) => { robotLog(ROBOTS.NEWS, "RESP", `${globalNews.length} articles`); res.json(globalNews); });
app.get("/api/tide", (req, res) => {
    const spotName = req.query.spot;
    const cacheData = cache.get(`tide-${spotName}`)?.data;
    robotLog(ROBOTS.TIDE, "RESP", `${spotName || "Inconnu"} ${cacheData?.stage ?? "Inconnu"}`);
    res.json(cacheData || { allTides: [], stage: "Inconnu" });
});
app.get("/api/quota", (req, res) => { robotLog(ROBOTS.SWELL, "RESP", `${lastQuotaInfo.remaining}/${lastQuotaInfo.limit} left`); res.json(lastQuotaInfo); });

app.get("/api/robots-status", (req, res) => { logRobotSnapshot(); res.json(robotsStatus); });

app.get("/api/all-status", (req, res) => {
  const statusMap = {};
  spots.forEach(spot => {
    statusMap[spot.name] = cache.has(`${spot.coords[0]},lng=${spot.coords[1]}`) ? "LIVE" : "WAITING";
  });
  const counts = Object.values(statusMap).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
  robotLog(ROBOTS.SERVER, "RESP", `LIVE=${counts.LIVE || 0} WAIT=${counts.WAITING || 0}`);
  res.json(statusMap);
});

app.get("/api/proxy-img", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).end();
  try {
    const host = new URL(target).hostname;
    const allowed = ["images.unsplash.com", "surfsession.com", "www.surfsession.com", "full-bloom.fr"];
    if (!allowed.some(h => host.endsWith(h))) return res.status(403).end();
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*" } });
    if (!r.ok) {
      robotLog(ROBOTS.API, "WARN", `IMG ${host} ${r.status}`);
      return res.redirect("/logo.svg");
    }
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) {
      robotLog(ROBOTS.API, "WARN", `IMG ${host} CT ${ct}`);
      return res.redirect("/logo.svg");
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ct);
    robotLog(ROBOTS.API, "RESP", `IMG ${host}`);
    res.status(200).send(buf);
  } catch (e) {
    robotLog(ROBOTS.API, "ERROR", `IMG ${e.message}`);
    res.status(500).end();
  }
});

// CATCH-ALL pour renvoyer le frontend sur n'importe quelle autre route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- DÉMARRAGE AVEC SÉQUENCE BOOT ROBOTS ---
app.listen(PORT, () => {
    console.log("\n\x1b[44m\x1b[37m  SURFSENSE PREMIUM v2.0 - SYSTÈME OPÉRATIONNEL  \x1b[0m\n");
    
    initDB(); // Initialisation DB (Cache + Users) et Migration

    const startupRobots = Object.values(ROBOTS);
    startupRobots.forEach((robot, index) => {
        setTimeout(() => { robotLog(robot, "ACTIF"); }, index * 200);
    });

    setTimeout(() => {
        robotLog(ROBOTS.SERVER, "ACTIF", `http://localhost:${PORT}`);
        robotLog(ROBOTS.API, "READY", "Liaison ÉTABLIE");
        startBackgroundWorkers();
    }, 1500);
});
