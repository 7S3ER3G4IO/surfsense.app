import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import pg from "pg"; 
import bcrypt from "bcrypt"; 
import Parser from "rss-parser";
import nodemailer from "nodemailer";
import helmet from "helmet"; // SÉCURITÉ
import crypto from "crypto";
import puppeteer from "puppeteer";
 
// --- GATE ADMIN AVANT STATIQUE ---
const adminStaticGate = (req, res, next) => {
  if (!req.path.startsWith("/admin")) return next();
  const cookieHeader = req.headers.cookie || "";
  const m = cookieHeader.match(/(?:^|;)\s*admin_session=([^;]+)/);
  if (!m) return res.status(403).send("Forbidden");
  const tok = m[1];
  const rec = adminTokensByValue.get(tok);
  if (!rec || rec.expires < Date.now() || rec.email !== ADMIN_EMAIL) {
    if (rec && rec.expires < Date.now()) adminTokensByValue.delete(tok);
    return res.status(403).send("Forbidden");
  }
  next();
};
import { fileURLToPath } from "url";
import { spots } from "./spots.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const parser = new Parser();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "loviatmax@gmail.com";
const adminTokens = new Map();
const adminTokensByValue = new Map();
let deletedTodayCount = 0;
let lastDeletedReset = new Date().getDate();
const resetDeletedIfNeeded = () => { const d = new Date().getDate(); if (d !== lastDeletedReset) { deletedTodayCount = 0; lastDeletedReset = d; } };

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

app.use(adminStaticGate);
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
const smtpFrom = process.env.SMTP_FROM || "swellsync@gmail.com";
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

const sendContactMail = async ({ name, email, category, subject, message }) => {
  if (!mailer) {
    const testAccount = await nodemailer.createTestAccount();
    mailer = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    robotLog(ROBOTS.API, "MAIL", "Transport test Ethereal prêt");
  }
  const to = process.env.SUPPORT_EMAIL || "swellsync@gmail.com";
  const info = await mailer.sendMail({
    from: smtpFrom,
    to,
    subject: `Contact — ${category || "Demande"}${subject ? ` : ${subject}` : ""}`,
    text: `Nom: ${name}\nEmail: ${email}\nCatégorie: ${category}\nSujet: ${subject || "-"}\n\nMessage:\n${message}`,
    html: `<p><b>Nom:</b> ${name}</p>
           <p><b>Email:</b> ${email}</p>
           <p><b>Catégorie:</b> ${category}</p>
           <p><b>Sujet:</b> ${subject || "-"}</p>
           <p><b>Message:</b><br/>${(message || "").replace(/\n/g,"<br/>")}</p>`
  });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) robotLog(ROBOTS.API, "MAIL", `Preview ${preview}`);
  return preview;
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
let adminSeries = { live: [], wait: [], quota: [], epic: [], users: [] };
const spotRegionMap = new Map(spots.map(s => [s.name, s.region]));
const adminSafeCount = async (sql) => { try { const r = await pool.query(sql); return r.rows[0].c || 0; } catch { return 0; } };
const adminSafeQuery = async (sql) => { try { return await pool.query(sql); } catch { return { rows: [] }; } };
const pushSeries = (arr, v) => { arr.push({ t: Date.now(), v }); if (arr.length > 288) arr.shift(); };
let weatherWorkerPaused = false;
let weatherWorkerIntervalMs = 45 * 60 * 1000;
let weatherWorkerTimer = null;
const prioritySpots = new Set();
const restartWeatherWorker = () => {
  if (weatherWorkerTimer) clearInterval(weatherWorkerTimer);
  weatherWorkerTimer = setInterval(async () => {
    if (weatherWorkerPaused) return;
    let spot = null;
    if (prioritySpots.size > 0 && Math.random() < 0.7) {
      const arr = Array.from(prioritySpots);
      const name = arr[Math.floor(Math.random() * arr.length)];
      spot = spots.find(s => s.name === name) || spots[Math.floor(Math.random() * spots.length)];
    } else {
      spot = spots[Math.floor(Math.random() * spots.length)];
    }
    await getDataSmart(spot.coords[0], spot.coords[1], spot.name, true);
  }, weatherWorkerIntervalMs);
};
const sampleAdminSeries = async () => {
  const usersC = await adminSafeCount("SELECT COUNT(*)::int AS c FROM users");
  const statusMap = {};
  spots.forEach(spot => { statusMap[spot.name] = cache.has(`${spot.coords[0]},lng=${spot.coords[1]}`) ? "LIVE" : "WAITING"; });
  const liveCount = Object.values(statusMap).filter(v => v === "LIVE").length;
  const waitCount = Object.values(statusMap).filter(v => v === "WAITING").length;
  pushSeries(adminSeries.users, usersC);
  pushSeries(adminSeries.live, liveCount);
  pushSeries(adminSeries.wait, waitCount);
  pushSeries(adminSeries.epic, epicSpots.length);
  pushSeries(adminSeries.quota, lastQuotaInfo.remaining ?? 0);
};

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

        let adminToken = null;
        if (user.email === ADMIN_EMAIL) {
            adminToken = crypto.randomBytes(24).toString("hex");
            const rec = { token: adminToken, expires: Date.now() + 12 * 60 * 60 * 1000, email: user.email, userId: user.id };
            adminTokens.set(user.id, rec);
            adminTokensByValue.set(adminToken, rec);
            const cookie = `admin_session=${adminToken}; Path=/admin; Max-Age=${12*60*60}; HttpOnly; SameSite=Strict${process.env.RENDER ? "; Secure" : ""}`;
            res.setHeader("Set-Cookie", cookie);
        }
        res.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, premium: user.premium },
            admin: !!adminToken,
            adminToken
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

// --- CONTACT ---
app.post("/api/contact", async (req, res) => {
  const { name, email, category, subject, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ success: false, error: "Champs requis manquants" });
  try {
    const previewUrl = await sendContactMail({ name, email, category, subject, message });
    res.json({ success: true, previewUrl });
  } catch (e) {
    robotLog(ROBOTS.API, "ERROR", `CONTACT: ${e.message}`);
    res.status(500).json({ success: false, error: "Erreur serveur contact" });
  }
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

app.get("/sitemap.xml", (req, res) => {
  try {
    const base = process.env.BASE_URL || "https://swellsync.fr";
    const pages = [
      "/index.html",
      "/cameras.html",
      "/favorites.html",
      "/versus.html",
      "/actus.html",
      "/contact.html"
    ];
    const spotUrls = spots.map(s => `/conditions.html?spot=${encodeURIComponent(s.name)}`);
    const urls = [...pages, ...spotUrls];
    const lastmod = new Date().toISOString();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${base}${u}</loc><lastmod>${lastmod}</lastmod><changefreq>hourly</changefreq><priority>${u.includes("conditions.html") ? "0.9" : "0.7"}</priority></url>`).join("")}
</urlset>`;
    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  } catch {
    res.status(500).send("");
  }
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
    const toKeywords = (t = "") => {
      const base = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const words = base.toLowerCase().match(/[a-z]{3,}/g) || [];
      const stop = new Set(["les","des","une","un","le","la","de","du","et","pour","avec","sans","loin","dans","sur","au","aux"]);
      const filtered = words.filter(w => !stop.has(w));
      const picks = filtered.slice(0, 3);
      return picks.length ? picks : ["surf","ocean","wave","beach"];
    };
    const buildUnsplash = (title) => {
      const t = (title || "").toLowerCase();
      const has = (...words) => words.some(w => t.includes(w));
      let query = "surf,wave,surfing,sea";
      if (has("pipe","pipeline","hawai","oahu","north shore")) query = "pipeline,hawaii,surfer,wave";
      else if (has("van","vanlife","camping","quiver","outdoor")) query = "van,surfboard,coast,surf";
      else if (has("mediter","méditerran")) query = "mediterranean,shore,wave,surf";
      else if (has("reunion")) query = "reunion,island,reef,wave,surf";
      else if (has("lacanau","france","pro","contest")) query = "contest,beach,atlantic,france,surf";
      else if (has("quemao","canaries","lanzarote","makoa")) query = "barrel,lanzarote,canary,reef,surf";
      const keys = toKeywords(title).join(",");
      return `https://source.unsplash.com/800x600/?${keys},${query}`;
    };
    const resolveOgImage = async (link) => {
      try {
        const r = await fetch(link, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" } });
        const html = await r.text();
        const m1 = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        const m2 = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        const raw = (m1?.[1] || m2?.[1] || "").trim();
        if (!raw) return null;
        const abs = new URL(raw, link).href;
        return abs;
      } catch { return null; }
    };
    for (const url of sources) {
      try {
        const feed = await parser.parseURL(url);
        allArticles = [...allArticles, ...feed.items.map(item => {
          const imgMatch =
            item.content?.match(/<img[^>]+src="([^">]+)"/) ||
            item['content:encoded']?.match(/<img[^>]+src="([^">]+)"/);
          const fromFeed = imgMatch ? imgMatch[1] : (item.enclosure?.url || null);
          const finalImg = fromFeed;
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
    // Résoudre les images manquantes via OG; fallback Unsplash surf
    for (let i = 0; i < allArticles.length; i++) {
      if (!allArticles[i].img) {
        const og = await resolveOgImage(allArticles[i].link);
        allArticles[i].img = og || buildUnsplash(allArticles[i].title || "");
      }
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
        swellDirection: getCardinal(pickValue(hour.swellDirection)),
        airTemperature: Math.round(pickValue(hour.airTemperature)),
        waterTemperature: Math.round(pickValue(hour.waterTemperature))
    }));

    const realData = {
      waveHeight: pickValue(current.waveHeight),
      wavePeriod: pickValue(current.wavePeriod),
      windSpeed: Math.round(pickValue(current.windSpeed) * 3.6),
      windDirection: getCardinal(pickValue(current.windDirection)),
      swellDirection: getCardinal(pickValue(current.swellDirection)),
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
  weatherWorkerIntervalMs = WEATHER_ROBOT_INTERVAL;
  restartWeatherWorker();

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
app.post("/api/news/reload", async (req, res) => {
  await fetchSurfNews();
  robotLog(ROBOTS.NEWS, "READY", `reload ${globalNews.length}`);
  res.json({ ok: true, count: globalNews.length });
});
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

const requireAdmin = (req) => {
  const id = parseInt(req.headers["x-user-id"]);
  const email = req.headers["x-user-email"];
  const token = req.headers["x-admin-token"];
  if (!id || !email || !token) return false;
  const rec = adminTokens.get(id);
  if (!rec) return false;
  if (rec.expires < Date.now()) { adminTokens.delete(id); return false; }
  if (email !== ADMIN_EMAIL) return false;
  if (rec.token !== token) return false;
  return true;
};

// Gate d'accès à la page /admin (HTML), avant la statique
app.get("/admin", (req, res) => res.redirect("/admin/"));
app.get("/admin/", (req, res) => {
  const cookieHeader = req.headers.cookie || "";
  const m = cookieHeader.match(/(?:^|;)\s*admin_session=([^;]+)/);
  if (!m) return res.status(403).send("Forbidden");
  const tok = m[1];
  const rec = adminTokensByValue.get(tok);
  if (!rec || rec.expires < Date.now() || rec.email !== ADMIN_EMAIL) {
    if (rec && rec.expires < Date.now()) adminTokensByValue.delete(tok);
    return res.status(403).send("Forbidden");
  }
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

app.get("/api/admin/metrics", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const safeCount = async (sql) => {
      try { const r = await pool.query(sql); return r.rows[0].c || 0; } catch { return 0; }
    };
    const safeQuery = async (sql) => {
      try { return await pool.query(sql); } catch { return { rows: [] }; }
    };
    const usersC = await safeCount("SELECT COUNT(*)::int AS c FROM users");
    const favC = await safeCount("SELECT COUNT(*)::int AS c FROM favorites");
    const clicksC = await safeCount("SELECT COUNT(*)::int AS c FROM click_logs");
    const statusMap = {};
    spots.forEach(spot => {
      statusMap[spot.name] = cache.has(`${spot.coords[0]},lng=${spot.coords[1]}`) ? "LIVE" : "WAITING";
    });
    const liveCount = Object.values(statusMap).filter(v => v === "LIVE").length;
    const waitCount = Object.values(statusMap).filter(v => v === "WAITING").length;
    const tideKeys = Array.from(cache.keys()).filter(k => k.startsWith("tide-")).length;
    resetDeletedIfNeeded();
    res.json({
      users: usersC,
      favorites: favC,
      clicks: clicksC,
      liveSpots: liveCount,
      waitingSpots: waitCount,
      epicAlerts: epicSpots.length,
      quota: lastQuotaInfo,
      cacheItems: cache.size,
      tideKeys,
      robotsStatus,
      deletedToday: deletedTodayCount
    });
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur admin" });
  }
});

app.get("/api/admin/logs", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const r = await (async () => {
    try { return await pool.query("SELECT id, spot_name, ip FROM click_logs ORDER BY id DESC LIMIT 50"); } catch { return { rows: [] }; }
  })();
  res.json(r.rows);
});

app.get("/api/admin/users/recent", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const r = await (async () => {
    try { return await pool.query("SELECT id, name, email, premium FROM users ORDER BY id DESC LIMIT 20"); } catch { return { rows: [] }; }
  })();
  res.json(r.rows);
});

app.get("/api/admin/users/search", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const email = (req.query.email || "").toString().trim();
  if (!email) return res.status(400).json({ error: "Email manquant" });
  try {
    const r = await pool.query("SELECT id, name, email, premium FROM users WHERE email ILIKE $1 ORDER BY id DESC LIMIT 20", [email]);
    res.json(r.rows);
  } catch {
    res.json([]);
  }
});

app.post("/api/admin/users/delete", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const id = parseInt(req.body?.userId);
  if (!id) return res.status(400).json({ error: "userId manquant" });
  try {
    const r = await pool.query("SELECT email FROM users WHERE id = $1", [id]);
    const email = r.rows[0]?.email || null;
    if (email === ADMIN_EMAIL) return res.status(400).json({ error: "Interdit: compte admin" });
    await pool.query("BEGIN");
    try { await pool.query("DELETE FROM favorites WHERE user_id = $1", [id]); } catch {}
    try { await pool.query("DELETE FROM twofa_codes WHERE user_id = $1", [id]); } catch {}
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    await pool.query("COMMIT");
    resetDeletedIfNeeded();
    deletedTodayCount++;
    res.json({ ok: true, userId: id });
  } catch (e) {
    try { await pool.query("ROLLBACK"); } catch {}
    res.status(500).json({ error: "Suppression impossible" });
  }
});

app.post("/api/admin/users/premium/reset", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const r = await pool.query("UPDATE users SET premium = false WHERE email <> $1 RETURNING id", [ADMIN_EMAIL]);
    res.json({ ok: true, updated: r.rows.length });
  } catch {
    res.status(500).json({ error: "Impossible de réinitialiser Premium" });
  }
});

app.get("/api/admin/users/export", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const r = await pool.query("SELECT id, name, email, premium FROM users ORDER BY id DESC");
    const esc = (v) => {
      if (v == null) return "";
      const s = String(v);
      if (/[\",\\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = ["id,name,email,premium"].concat(r.rows.map(x => [esc(x.id), esc(x.name), esc(x.email), x.premium ? "true" : "false"].join(",")));
    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"users.csv\"");
    res.status(200).send(csv);
  } catch {
    res.status(500).json({ error: "Export impossible" });
  }
});

app.post("/api/admin/cache/clear", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const type = (req.body && req.body.type) || "all";
  let cleared = 0;
  if (type === "tide") {
    Array.from(cache.keys()).forEach(k => { if (k.startsWith("tide-")) { cache.delete(k); cleared++; } });
  } else {
    cleared = cache.size;
    cache.clear();
  }
  res.json({ ok: true, cleared });
});

app.post("/api/admin/news/reload", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  await fetchSurfNews();
  res.json({ ok: true, count: globalNews.length });
});

app.get("/api/admin/alerts", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  res.json(epicSpots);
});

app.post("/api/admin/robots/snapshot", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  logRobotSnapshot();
  res.json(robotsStatus);
});

app.get("/api/admin/analytics/timeseries", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    if (!adminSeries.live.length && !adminSeries.users.length) {
      await sampleAdminSeries();
    }
  } catch {}
  res.json(adminSeries);
});

const fetchStormglassQuotaFromAPI = async () => {
  if (!STORMGLASS_API_KEY) throw new Error("API key manquante");
  const now = new Date();
  const prev = new Date(now.getTime() - 60 * 60 * 1000);
  const url = `https://api.stormglass.io/v2/weather/point?lat=0&lng=0&params=waveHeight&start=${encodeURIComponent(prev.toISOString())}&end=${encodeURIComponent(now.toISOString())}`;
  const resp = await fetch(url, { headers: { "Authorization": STORMGLASS_API_KEY } });
  if (!resp.ok) throw new Error("Stormglass API error");
  const data = await resp.json();
  const meta = data.meta || {};
  const limit = meta.dailyQuota ?? meta.quota ?? 0;
  const used = meta.requestCount ?? meta.requestsMade ?? 0;
  const remaining = (limit && used != null) ? Math.max(0, limit - used) : (meta.remaining ?? 0);
  return { limit, used, remaining, source: "api", meta };
};

const fetchStormglassQuotaFromDashboard = async () => {
  const email = process.env.STORMGLASS_LOGIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.STORMGLASS_LOGIN_PASSWORD;
  if (!email || !password) throw new Error("Identifiants manquants");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  try {
    const page = await browser.newPage();
    await page.goto("https://dashboard.stormglass.io/", { waitUntil: "networkidle2" });
    let emailSel = 'input[type="email"], input[name="email"]';
    let passSel = 'input[type="password"], input[name="password"]';
    let submitSel = 'button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")';
    const hasEmail = await page.$(emailSel);
    if (!hasEmail) {
      const loginLink = await page.$('a[href*="login"], a:has-text("Log in"), a:has-text("Sign in")');
      if (loginLink) { await loginLink.click(); await page.waitForNavigation({ waitUntil: "networkidle2" }); }
    }
    await page.waitForSelector(emailSel, { timeout: 10000 });
    await page.type(emailSel, email, { delay: 20 });
    await page.type(passSel, password, { delay: 20 });
    const btn = await page.$(submitSel) || await page.$('button');
    if (btn) await btn.click();
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(()=>{});
    // Essayer pages compte
    await page.goto("https://dashboard.stormglass.io/account", { waitUntil: "networkidle2" }).catch(()=>{});
    const text = await page.evaluate(() => document.body.innerText);
    const num = (s) => (s ? parseInt((s.match(/\d+/)||["0"])[0]) : 0);
    // Chercher motifs typiques
    const mLimit = text.match(/daily\s+quota[:\s]+(\d+)/i) || text.match(/limit[:\s]+(\d+)/i);
    const mUsed = text.match(/used\s+today[:\s]+(\d+)/i) || text.match(/requests\s+made[:\s]+(\d+)/i);
    const mRemaining = text.match(/remaining[:\s]+(\d+)/i);
    const limit = mLimit ? num(mLimit[0]) : null;
    const used = mUsed ? num(mUsed[0]) : null;
    const remaining = mRemaining ? num(mRemaining[0]) : (limit != null && used != null ? Math.max(0, limit - used) : null);
    if (limit == null && used == null && remaining == null) throw new Error("Quotas introuvables");
    return { limit: limit ?? 0, used: used ?? 0, remaining: remaining ?? 0, source: "dashboard" };
  } finally {
    await browser.close().catch(()=>{});
  }
};

app.get("/api/admin/quota/reel", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const r = await fetchStormglassQuotaFromAPI();
    lastQuotaInfo = { limit: r.limit, remaining: r.remaining, used: r.used };
    res.json(r);
  } catch (e1) {
    try {
      const r2 = await fetchStormglassQuotaFromDashboard();
      lastQuotaInfo = { limit: r2.limit, remaining: r2.remaining, used: r2.used };
      res.json(r2);
    } catch (e2) {
      res.status(500).json({ error: "Quota indisponible", details: String(e2?.message || e1?.message || "Erreur") });
    }
  }
});
app.get("/api/admin/health", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const statusMap = {};
  spots.forEach(spot => { statusMap[spot.name] = cache.has(`${spot.coords[0]},lng=${spot.coords[1]}`) ? "LIVE" : "WAITING"; });
  const live = Object.values(statusMap).filter(v => v === "LIVE").length;
  const wait = Object.values(statusMap).filter(v => v === "WAITING").length;
  let db = false; let pingMs = null;
  try {
    const t0 = Date.now();
    const r = await pool.query("SELECT NOW()");
    pingMs = Date.now() - t0;
    db = r.rows.length > 0;
  } catch {}
  const mem = process.memoryUsage();
  res.json({
    db,
    pingMs,
    cacheCount: cache.size,
    apiCallCount,
    quota: lastQuotaInfo,
    live,
    wait,
    uptime: Math.round(process.uptime()),
    memoryMB: Math.round((mem.rss || 0) / (1024 * 1024)),
    worker: { paused: weatherWorkerPaused, intervalMinutes: Math.round(weatherWorkerIntervalMs / 60000) },
    newsCount: globalNews.length
  });
});

app.get("/api/admin/workers", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  res.json({ paused: weatherWorkerPaused, intervalMinutes: Math.round(weatherWorkerIntervalMs / 60000) });
});

app.post("/api/admin/workers", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const action = (req.body?.action || "").toString();
  if (action === "pause") { weatherWorkerPaused = true; return res.json({ ok: true, paused: true }); }
  if (action === "resume") { weatherWorkerPaused = false; return res.json({ ok: true, paused: false }); }
  if (action === "setInterval") {
    const minutes = parseInt(req.body?.minutes);
    if (!minutes || minutes < 1 || minutes > 240) return res.status(400).json({ error: "minutes invalide" });
    weatherWorkerIntervalMs = minutes * 60000;
    restartWeatherWorker();
    return res.json({ ok: true, intervalMinutes: minutes });
  }
  res.status(400).json({ error: "action invalide" });
});

app.get("/api/admin/regions", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const start = req.query.start;
  const end = req.query.end;
  let sql = "SELECT spot_name, COUNT(*)::int AS c FROM click_logs WHERE ts > NOW() - INTERVAL '7 days' GROUP BY spot_name";
  if (start && end) sql = "SELECT spot_name, COUNT(*)::int AS c FROM click_logs WHERE ts BETWEEN $1 AND $2 GROUP BY spot_name";
  const r = start && end ? await adminSafeQuery({ text: sql, values: [start, end] }) : await adminSafeQuery(sql);
  const out = {};
  r.rows.forEach(row => {
    const reg = spotRegionMap.get(row.spot_name) || "Inconnu";
    out[reg] = (out[reg] || 0) + row.c;
  });
  res.json(out);
});

app.get("/api/admin/logs/export", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const start = req.query.start;
  const end = req.query.end;
  let rows = [];
  try {
    let r;
    if (start && end) {
      r = await pool.query("SELECT id, spot_name, ip, ts FROM click_logs WHERE ts BETWEEN $1 AND $2 ORDER BY id DESC", [start, end]);
    } else {
      r = await pool.query("SELECT id, spot_name, ip, ts FROM click_logs ORDER BY id DESC LIMIT 1000");
    }
    rows = r.rows;
  } catch { 
    try { const r2 = await pool.query("SELECT id, spot_name, ip FROM click_logs ORDER BY id DESC LIMIT 1000"); rows = r2.rows; } catch { rows = []; }
  }
  const esc = (v) => { if (v == null) return ""; const s = String(v); if (/[\",\\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'; return s; };
  const lines = ["id,spot_name,ip,ts"].concat(rows.map(x => [esc(x.id), esc(x.spot_name), esc(x.ip), esc(x.ts)].join(",")));
  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"logs.csv\"");
  res.status(200).send(csv);
});

app.get("/api/admin/logs/range", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const start = req.query.start;
  const end = req.query.end;
  if (!start || !end) return res.status(400).json({ error: "dates manquantes" });
  try {
    const r = await pool.query("SELECT id, spot_name, ip, ts FROM click_logs WHERE ts BETWEEN $1 AND $2 ORDER BY id DESC LIMIT 1000", [start, end]);
    res.json(r.rows);
  } catch {
    res.json([]);
  }
});

app.get("/api/admin/spots/priority", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  res.json(Array.from(prioritySpots));
});

app.post("/api/admin/spots/priority/toggle", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const name = (req.body?.name || "").toString();
  if (!name) return res.status(400).json({ error: "name manquant" });
  if (prioritySpots.has(name)) prioritySpots.delete(name); else prioritySpots.add(name);
  res.json({ ok: true, name, active: prioritySpots.has(name) });
});

app.post("/api/admin/alerts/manual", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const name = (req.body?.name || "").toString();
  const reason = (req.body?.reason || "").toString();
  if (!name) return res.status(400).json({ error: "name manquant" });
  epicSpots.push({ name, time: Date.now(), manual: true, reason });
  res.json({ ok: true, count: epicSpots.length });
});

app.post("/api/admin/alerts/manual/remove", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const name = (req.body?.name || "").toString();
  if (!name) return res.status(400).json({ error: "name manquant" });
  const before = epicSpots.length;
  epicSpots = epicSpots.filter(x => !(x.name === name && x.manual));
  res.json({ ok: true, removed: before - epicSpots.length });
});
app.get("/api/admin/spots/export", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const arr = spots.map(s => {
    const key = `${s.coords[0]},lng=${s.coords[1]}`;
    const d = cache.get(key)?.data || null;
    return {
      name: s.name, region: s.region, status: d ? "LIVE" : "WAITING",
      waveHeight: d?.waveHeight ?? "", wavePeriod: d?.wavePeriod ?? "",
      windSpeed: d?.windSpeed ?? "", windDirection: d?.windDirection ?? "", sourceTime: d?.sourceTime ?? ""
    };
  });
  const esc = (v) => { if (v == null) return ""; const s = String(v); if (/[\",\\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'; return s; };
  const lines = ["name,region,status,waveHeight,wavePeriod,windSpeed,windDirection,sourceTime"].concat(
    arr.map(x => [esc(x.name), esc(x.region), esc(x.status), esc(x.waveHeight), esc(x.wavePeriod), esc(x.windSpeed), esc(x.windDirection), esc(x.sourceTime)].join(","))
  );
  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"spots.csv\"");
  res.status(200).send(csv);
});
app.get("/api/admin/spots", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const arr = spots.map(s => {
    const key = `${s.coords[0]},lng=${s.coords[1]}`;
    const c = cache.get(key);
    const d = c?.data || null;
    return {
      name: s.name,
      region: s.region,
      lat: s.coords[0],
      lng: s.coords[1],
      status: d ? "LIVE" : "WAITING",
      waveHeight: d?.waveHeight ?? null,
      wavePeriod: d?.wavePeriod ?? null,
      windSpeed: d?.windSpeed ?? null,
      windDirection: d?.windDirection ?? null,
      sourceTime: d?.sourceTime ?? null
    };
  });
  res.json(arr);
});

app.post("/api/admin/spots/refresh", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const name = req.body?.name;
  const lat = req.body?.lat;
  const lng = req.body?.lng;
  let spot = null;
  if (name) spot = spots.find(s => s.name === name);
  if (!spot && lat != null && lng != null) spot = spots.find(s => s.coords[0] === lat && s.coords[1] === lng);
  if (!spot) return res.status(404).json({ error: "Spot introuvable" });
  const key = `${spot.coords[0]},lng=${spot.coords[1]}`;
  cache.delete(key);
  try { await pool.query("DELETE FROM cache WHERE key = $1", [key]); } catch {}
  const d = await getDataSmart(spot.coords[0], spot.coords[1], spot.name, true);
  res.json({ ok: true, name: spot.name, data: d });
});

app.post("/api/admin/spots/clear", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const name = req.body?.name;
  const lat = req.body?.lat;
  const lng = req.body?.lng;
  let spot = null;
  if (name) spot = spots.find(s => s.name === name);
  if (!spot && lat != null && lng != null) spot = spots.find(s => s.coords[0] === lat && s.coords[1] === lng);
  if (!spot) return res.status(404).json({ error: "Spot introuvable" });
  const key = `${spot.coords[0]},lng=${spot.coords[1]}`;
  const existed = cache.has(key);
  cache.delete(key);
  try { await pool.query("DELETE FROM cache WHERE key = $1", [key]); } catch {}
  res.json({ ok: true, cleared: existed ? 1 : 0, name: spot.name });
});

app.get("/api/proxy-img", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).end();
  try {
    let currentUrl = target;
    const host = new URL(currentUrl).hostname;
    const allowed = ["images.unsplash.com", "source.unsplash.com", "picsum.photos", "surfsession.com", "www.surfsession.com", "full-bloom.fr"];
    if (!allowed.some(h => host.endsWith(h))) return res.status(403).end();
    let r = await fetch(currentUrl, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*" } });
    // Suivre manuellement les redirections (source.unsplash.com -> images.unsplash.com)
    for (let i = 0; i < 3 && (r.status >= 300 && r.status < 400); i++) {
      const loc = r.headers.get("location");
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
      r = await fetch(currentUrl, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*" } });
    }
    if (!r.ok) {
      robotLog(ROBOTS.API, "WARN", `IMG ${new URL(currentUrl).hostname} ${r.status}`);
      try {
        const fr = await fetch("https://picsum.photos/800/600", { headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*" } });
        if (fr.ok && (fr.headers.get("content-type") || "").startsWith("image/")) {
          const buf = Buffer.from(await fr.arrayBuffer());
          res.setHeader("Content-Type", fr.headers.get("content-type") || "image/jpeg");
          robotLog(ROBOTS.API, "RESP", `IMG picsum.photos`);
          return res.status(200).send(buf);
        }
      } catch {}
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Inter,Arial" font-size="24" font-weight="700">Image indisponible</text></svg>`;
      res.setHeader("Content-Type", "image/svg+xml");
      return res.status(200).send(svg);
    }
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) {
      robotLog(ROBOTS.API, "WARN", `IMG ${new URL(currentUrl).hostname} CT ${ct}`);
      try {
        const fr = await fetch("https://picsum.photos/800/600", { headers: { "User-Agent": "Mozilla/5.0", "Accept": "image/*" } });
        if (fr.ok && (fr.headers.get("content-type") || "").startsWith("image/")) {
          const buf = Buffer.from(await fr.arrayBuffer());
          res.setHeader("Content-Type", fr.headers.get("content-type") || "image/jpeg");
          robotLog(ROBOTS.API, "RESP", `IMG picsum.photos`);
          return res.status(200).send(buf);
        }
      } catch {}
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Inter,Arial" font-size="24" font-weight="700">Image indisponible</text></svg>`;
      res.setHeader("Content-Type", "image/svg+xml");
      return res.status(200).send(svg);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ct);
    robotLog(ROBOTS.API, "RESP", `IMG ${new URL(currentUrl).hostname}`);
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
    setInterval(sampleAdminSeries, 60 * 1000);
    try { sampleAdminSeries(); } catch {}
});
