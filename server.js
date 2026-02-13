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
 
import { IgApiClient } from 'instagram-private-api';
import { TwitterApi } from 'twitter-api-v2';
import TelegramBot from 'node-telegram-bot-api';
import threadsPkg from 'threads-api';
const { ThreadsAPI } = threadsPkg;
import { google } from 'googleapis';
import axios from 'axios';
import socialAutomator from './social_automator.js'; // STEALTH AUTOMATOR
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import multer from 'multer';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// --- GATE ADMIN AVANT STATIQUE ---
const adminStaticGate = (req, res, next) => {
  if (!req.path.startsWith("/admin")) return next();
  const t = (req.query && req.query.token) || "";
  if (t && t === ADMIN_TOKEN) {
    const secure = process.env.RENDER ? "Secure; " : "";
    res.setHeader("Set-Cookie", `admin_session=${ADMIN_TOKEN}; ${secure}HttpOnly; SameSite=Strict; Path=/`);
    return next();
  }
  const cookieHeader = req.headers.cookie || "";
  const sessions = (cookieHeader || "").split(";").map(s => s.trim()).filter(s => /^admin_session=/i.test(s)).map(s => s.split("=")[1]);
  if (sessions.includes(ADMIN_TOKEN)) return next();
  const tok = sessions[0];
  if (tok) {
    const rec = adminTokensByValue.get(tok);
    if (rec && rec.expires >= Date.now() && rec.email === ADMIN_EMAIL) return next();
  }
  return res.status(403).send("Forbidden");
};
import { fileURLToPath } from "url";
import { spots } from "./spots.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ dest: path.join(__dirname, 'public/temp_uploads/') });
if (!fs.existsSync(path.join(__dirname, 'public/temp_uploads/'))) {
    fs.mkdirSync(path.join(__dirname, 'public/temp_uploads/'), { recursive: true });
}
const parser = new Parser();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "loviatmax@gmail.com";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "Hinalol08-";
const MARKETING_EMAIL = process.env.MARKETING_EMAIL || process.env.SOCIAL_EMAIL || process.env.SUPPORT_EMAIL || "swellsync@outlook.fr";
const adminTokens = new Map();
const adminTokensByValue = new Map();
let deletedTodayCount = 0;
let lastDeletedReset = new Date().getDate();
const resetDeletedIfNeeded = () => { const d = new Date().getDate(); if (d !== lastDeletedReset) { deletedTodayCount = 0; lastDeletedReset = d; } };

// --- SÉCURITÉ 1 : HELMET (En-têtes HTTP sécurisés) ---
app.use(helmet({
  contentSecurityPolicy: false, // On désactive la CSP stricte pour laisser Leaflet/Images charger
}));

const baseUrlForReq = (req) => {
  const envUrl = process.env.BASE_URL;
  if (envUrl) return envUrl;
  const h = req && typeof req.get === "function" ? req.get("host") : "localhost:3001";
  const rawProto = req && req.headers ? (req.headers["x-forwarded-proto"] || req.protocol || "http") : "http";
  const proto = String(rawProto).split(",")[0];
  return `${proto}://${h}`;
};

const buildSpotOg = async (spotName) => {
  const s = spots.find(x => x.name === spotName);
  if (!s) {
    return {
      title: `Conditions Live`,
      desc: `Analyse en temps réel`,
      imagePath: `/logo-og.png`
    };
  }
  const key = `${s.coords[0]},lng=${s.coords[1]}`;
  let d = cache.get(key)?.data || null;
  if (!d) {
    try { d = await getDataSmart(s.coords[0], s.coords[1], s.name); } catch {}
  }
  const h = d?.waveHeight != null ? `${Number(d.waveHeight).toFixed(1)}m` : "--";
  const p = d?.wavePeriod != null ? `${Math.round(Number(d.wavePeriod))}s` : "--";
  const w = d?.windSpeed != null ? `${Number(d.windSpeed)} km/h` : "--";
  const wd = d?.windDirection || "--";
  const title = `${s.name} • Conditions Live`;
  const desc = `Houle ${h} • Période ${p} • Vent ${w} ${wd}`;
  return { title, desc, imagePath: `/og/spot.png?spot=${encodeURIComponent(s.name)}` };
};

app.get("/og/spot.png", async (req, res) => {
  const spotName = (req.query.spot || "").toString();
  const s = spots.find(x => x.name === spotName);
  const info = await buildSpotOg(spotName);
  const size = { w: 1200, h: 630 };
  const html = `
  <html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0b0e16;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto;color:#fff}
    .wrap{width:${size.w}px;height:${size.h}px;display:flex;flex-direction:column;justify-content:space-between;padding:40px;background:
      radial-gradient(600px 300px at 0% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(600px 300px at 100% 100%, rgba(34,197,94,.18), transparent 60%)
    }
    .brand{font-size:24px;font-weight:900;color:#c4b5fd}
    .title{font-size:48px;font-weight:900}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .box{background:rgba(17,24,39,.85);border:1px solid rgba(124,58,237,.25);border-radius:12px;padding:16px}
    .label{color:#94a3b8;font-weight:700;font-size:18px}
    .val{font-size:34px;font-weight:900}
    .foot{display:flex;justify-content:space-between;align-items:center;color:#94a3b8}
  </style></head>
  <body><div class="wrap">
    <div class="brand">SwellSync</div>
    <div class="title">${info.title}</div>
    <div class="grid">
      <div class="box"><div class="label">Résumé</div><div class="val">${info.desc}</div></div>
      <div class="box"><div class="label">Spot</div><div class="val">${s ? s.region : "—"}</div></div>
    </div>
    <div class="foot"><div>Généré • ${new Date().toLocaleString("fr-FR")}</div><div>swellsync.fr</div></div>
  </div></body></html>`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = await page.screenshot({ type: "png" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=600");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send("");
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
});

app.get("/og/post.png", async (req, res) => {
  const spotName = (req.query.spot || "").toString();
  const format = (req.query.format || "post").toString();
  const s = spots.find(x => x.name === spotName);
  const info = await buildSpotOg(spotName);
  
  // Dimensions par défaut (16:9 post horizontal)
  let size = { w: 1200, h: 630 };
  let bgGradient = "radial-gradient(800px 400px at 0% 0%, rgba(124,58,237,.18), transparent 60%), radial-gradient(800px 400px at 100% 100%, rgba(34,197,94,.18), transparent 60%)";
  let brandSize = "28px";
  let titleSize = "56px";
  let valSize = "38px";
  let pad = "48px";
  
  // Adaptation selon format
  if (format === "portrait") {
    // 4:5 (1080x1350)
    size = { w: 1080, h: 1350 };
    bgGradient = "radial-gradient(800px 800px at 0% 0%, rgba(124,58,237,.18), transparent 60%), radial-gradient(800px 800px at 100% 100%, rgba(34,197,94,.18), transparent 60%)";
    titleSize = "64px";
    valSize = "42px";
    pad = "56px";
  } else if (format === "square") {
    // 1:1 (1080x1080)
    size = { w: 1080, h: 1080 };
    bgGradient = "radial-gradient(800px 800px at 0% 0%, rgba(124,58,237,.18), transparent 60%), radial-gradient(800px 800px at 100% 100%, rgba(34,197,94,.18), transparent 60%)";
    titleSize = "56px";
    valSize = "40px";
    pad = "48px";
  }

  const html = `
  <html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0b0e16;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto;color:#fff}
    .wrap{width:${size.w}px;height:${size.h}px;display:flex;flex-direction:column;justify-content:space-between;padding:${pad};background:${bgGradient}}
    .brand{font-size:${brandSize};font-weight:900;color:#c4b5fd}
    .title{font-size:${titleSize};font-weight:900}
    .grid{display:grid;grid-template-columns:1fr;gap:16px}
    .box{background:rgba(17,24,39,.85);border:1px solid rgba(124,58,237,.25);border-radius:16px;padding:18px}
    .label{color:#94a3b8;font-weight:700;font-size:20px}
    .val{font-size:${valSize};font-weight:900}
    .foot{display:flex;justify-content:space-between;align-items:center;color:#94a3b8}
  </style></head>
  <body><div class="wrap">
    <div class="brand">SwellSync</div>
    <div class="title">${info.title}</div>
    <div class="grid">
      <div class="box"><div class="label">Résumé</div><div class="val">${info.desc}</div></div>
      <div class="box"><div class="label">Spot</div><div class="val">${s ? s.region : "—"}</div></div>
    </div>
    <div class="foot"><div>Généré • ${new Date().toLocaleString("fr-FR")}</div><div>swellsync.fr</div></div>
  </div></body></html>`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = await page.screenshot({ type: "png" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=600");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send("");
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
});

app.get("/og/story.png", async (req, res) => {
  const spotName = (req.query.spot || "").toString();
  const s = spots.find(x => x.name === spotName);
  const info = await buildSpotOg(spotName);
  const size = { w: 1080, h: 1920 };
  const html = `
  <html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0b0e16;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto;color:#fff}
    .wrap{width:${size.w}px;height:${size.h}px;display:flex;flex-direction:column;justify-content:space-between;padding:64px;background:
      radial-gradient(800px 800px at 0% 0%, rgba(124,58,237,.18), transparent 60%),
      radial-gradient(800px 800px at 100% 100%, rgba(34,197,94,.18), transparent 60%)
    }
    .brand{font-size:34px;font-weight:900;color:#c4b5fd}
    .title{font-size:72px;font-weight:900}
    .grid{display:grid;grid-template-columns:1fr;gap:18px}
    .box{background:rgba(17,24,39,.85);border:1px solid rgba(124,58,237,.25);border-radius:20px;padding:24px}
    .label{color:#94a3b8;font-weight:700;font-size:24px}
    .val{font-size:44px;font-weight:900}
    .foot{display:flex;justify-content:space-between;align-items:center;color:#94a3b8}
  </style></head>
  <body><div class="wrap">
    <div class="brand">SwellSync</div>
    <div class="title">${info.title}</div>
    <div class="grid">
      <div class="box"><div class="label">Résumé</div><div class="val">${info.desc}</div></div>
      <div class="box"><div class="label">Spot</div><div class="val">${s ? s.region : "—"}</div></div>
    </div>
    <div class="foot"><div>Généré • ${new Date().toLocaleString("fr-FR")}</div><div>swellsync.fr</div></div>
  </div></body></html>`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = await page.screenshot({ type: "png" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=600");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send("");
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
});
app.get("/conditions.html", async (req, res, next) => {
  try {
    const spotName = (req.query.spot || "").toString();
    const og = await buildSpotOg(spotName);
    const base = baseUrlForReq(req);
    const url = `${base}/conditions.html${spotName ? `?spot=${encodeURIComponent(spotName)}` : ""}`;
    const filePath = path.join(__dirname, "public", "conditions.html");
    let html = fs.readFileSync(filePath, "utf8");
    const meta = `
      <link rel="canonical" href="${url}">
      <meta property="og:title" content="${og.title}">
      <meta property="og:description" content="${og.desc}">
      <meta property="og:image" content="${base}${og.imagePath}">
      <meta property="og:url" content="${url}">
      <meta property="og:type" content="article">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${og.title}">
      <meta name="twitter:description" content="${og.desc}">
      <meta name="twitter:image" content="${base}${og.imagePath}">
    `;
    html = html.replace("<head>", "<head>" + meta);
    res.setHeader("Cache-Control", "no-cache");
    res.status(200).send(html);
  } catch (e) { next(); }
});
 

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
const smtpFrom = process.env.SMTP_FROM || "swellsync@outlook.fr";
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
  const to = process.env.SUPPORT_EMAIL || "swellsync@outlook.fr";
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
                utm_source TEXT,
                utm_medium TEXT,
                utm_campaign TEXT,
                utm_content TEXT,
                ts TIMESTAMP DEFAULT NOW()
            );
        `);
        // Ensure columns exist for old tables
        await pool.query(`ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_source TEXT`);
        await pool.query(`ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_medium TEXT`);
        await pool.query(`ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_campaign TEXT`);
        await pool.query(`ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS utm_content TEXT`);
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

// --- ROUTES PUBLIQUES & AUTH ---
// route /api/marine est définie plus bas avec getDataSmart

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

app.get('/og/square.png', async (req, res) => {
    try {
        const spotName = req.query.spot || 'SurfSense';
        // Generate a 1:1 image (1080x1080)
        // For simplicity, we can reuse the existing Puppeteer logic but with a square viewport.
        // Or we can just resize/crop via CSS in the template if we were dynamically generating HTML.
        // Here we'll just trigger the same generation logic but with a 'square' type hint if needed,
        // or just rely on a query param to the generic generator if we had one.
        // Since we don't have a generic generator function exposed here, let's assume we use the existing
        // screenshot logic but set the viewport to 1080x1080.
        
        // However, looking at existing code, we might not have the full Puppeteer setup exposed as a helper function yet.
        // Let's implement a quick specific handler for this route using the same pattern as others if they exist,
        // or just return a placeholder if Puppeteer isn't set up.
        // Wait, the user mentioned "Puppeteer" in the memory but I don't see the route definition for /og/post.png here.
        // Let's assume there is a generic handler or we need to add one.
        // Searching for '/og/' routes in the file...
        // Ah, I see no /og/post.png route in the snippets I read.
        // Let's verify if there are existing OG routes further down or if they are handled by static files.
        // If they are static, we can't dynamic generate. But the memory says "Puppeteer, 1200x630".
        // Let's check the file again for any Puppeteer usage or /og/ routes.
        
        // Actually, let's look for where /og/post.png is defined.
        // If it's not in the file, it might be in a separate router or I missed it.
        // I'll search for "app.get" and "og" to find it.
        
        // For now, I'll add the route definitions for the new formats, 
        // assuming I can copy the logic from the existing one once I find it.
        // If I can't find it, I'll implement a basic one.
        
        // Let's assume for a moment we are adding these routes.
        
        // Placeholder for now, will replace with real logic after finding the reference.
        res.redirect(`/og/post.png?spot=${encodeURIComponent(spotName)}&format=square`);
    } catch (e) { res.status(500).end(); }
});

app.get('/og/portrait.png', async (req, res) => {
    // 4:5 ratio (1080x1350)
    const spotName = req.query.spot || 'SurfSense';
    res.redirect(`/og/post.png?spot=${encodeURIComponent(spotName)}&format=portrait`);
});


app.post("/api/support/checkout", async (req, res) => {
  try {
    const { amount } = req.body || {};
    const amt = parseInt(amount, 10);
    if (!amt || amt < 1) return res.status(400).json({ success: false, error: "Montant invalide." });
    const secret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: "Stripe non configuré côté serveur." });
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http");
    const host = req.get("host");
    const baseUrl = `${proto}://${host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: amt * 100,
            product_data: { name: "Don SurfSense" }
          },
          quantity: 1
        }
      ],
      success_url: `${baseUrl}/contact.html?don=${encodeURIComponent(amt)}&ok=1`,
      cancel_url: `${baseUrl}/contact.html?don=${encodeURIComponent(amt)}&cancel=1`,
      metadata: { kind: "donation", amount: `${amt}` }
    });
    return res.json({ success: true, url: session.url });
  } catch (error) {
    robotLog(ROBOTS.AUTH, "ERROR", `Stripe: ${error.message}`);
    return res.status(500).json({ success: false, error: "Erreur Stripe." });
  }
});

app.post("/api/support/intent", async (req, res) => {
  try {
    const { amount } = req.body || {};
    const amt = parseInt(amount, 10);
    if (!amt || amt < 1) return res.status(400).json({ success: false, error: "Montant invalide." });
    const secret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: "Stripe non configuré côté serveur." });
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const intent = await stripe.paymentIntents.create({
      amount: amt * 100,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: { kind: "donation", amount: `${amt}` }
    });
    return res.json({ success: true, clientSecret: intent.client_secret });
  } catch (error) {
    robotLog(ROBOTS.AUTH, "ERROR", `Stripe Intent: ${error.message}`);
    return res.status(500).json({ success: false, error: "Erreur Stripe." });
  }
});
// INSCRIPTION
// PAYPAL CONFIG + ORDERS (Sandbox par défaut)
app.get("/api/paypal/config", (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_SECRET || "";
  const mode = (process.env.PAYPAL_MODE === "live") ? "live" : "sandbox";
  if (!clientId || !secret) return res.json({ enabled: false });
  res.json({ enabled: true, clientId, currency: "EUR", mode });
});
const paypalApiBase = () => (process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
const getPaypalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error("PayPal non configuré");
  const creds = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const r = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!r.ok) throw new Error("OAuth PayPal échoué");
  const j = await r.json();
  return j.access_token;
};
app.post("/api/paypal/order/create", async (req, res) => {
  try {
    const { amount } = req.body || {};
    const amt = parseFloat(amount);
    if (!amt || amt < 1) return res.status(400).json({ success: false, error: "Montant invalide." });
    const token = await getPaypalAccessToken();
    const r = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "EUR", value: amt.toFixed(2) }, description: "Don SurfSense" }]
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || "Création commande PayPal échouée");
    res.json({ success: true, id: j.id });
  } catch (error) {
    robotLog(ROBOTS.AUTH, "ERROR", `PayPal Create: ${error.message}`);
    res.status(500).json({ success: false, error: "Erreur PayPal (create)." });
  }
});
app.post("/api/paypal/order/capture", async (req, res) => {
  try {
    const { orderID } = req.body || {};
    if (!orderID) return res.status(400).json({ success: false, error: "orderID manquant" });
    const token = await getPaypalAccessToken();
    const r = await fetch(`${paypalApiBase()}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.message || "Capture PayPal échouée");
    res.json({ success: true, details: j });
  } catch (error) {
    robotLog(ROBOTS.AUTH, "ERROR", `PayPal Capture: ${error.message}`);
    res.status(500).json({ success: false, error: "Erreur PayPal (capture)." });
  }
});
// INSCRIPTION
// --- MARKETING AUTO-POST (via Webhook orchestrateur type Zapier/Make/Buffer) ---
// ENRICHED HOOKS FOR TRAFFIC & VARIETY
const VIRAL_HOOKS = [
    // Urgency / FOMO
    "🚨 ALERTE SURF : C'est le feu !",
    "⏳ Dépêche-toi, ça ne va pas durer !",
    "🏃‍♂️ Cours à l'eau MAINTENANT !",
    "⚡ Session validée par le robot.",
    "🛑 Arrête tout : regarde ces conditions.",
    
    // Community / Social Proof
    "🤙 Qui va à l'eau maintenant ?",
    "👥 Tag ton pote de surf qui rate ça.",
    "👀 150 personnes regardent ce spot en ce moment.",
    "🔥 Le spot est en feu !",
    
    // Curiosity / Clickbait
    "💎 Pépite en vue sur le spot.",
    "🤫 Le secret le mieux gardé d'aujourd'hui.",
    "📊 Les chiffres sont formels : c'est parfait.",
    "🌊 Tu n'as jamais vu le spot comme ça.",
    "🤯 C'est quoi ces conditions ?!",
    
    // Direct Benefit
    "🏄‍♂️ Sortez les planches !",
    "✅ Conditions validées : 5 étoiles.",
    "📈 Houle parfaite, vent offshore.",
    "🎯 La session de la semaine est là."
];
const VIRAL_HASHTAGS = ["#surf", "#waves", "#ocean", "#surfing", "#france", "#beach", "#nature", "#travel", "#surfsense", "#live", "#surfreport", "#now"];

// HISTORY MEMORY
const MARKETING_HISTORY_FILE = path.join(__dirname, "marketing_history.json");
let marketingHistory = [];
try {
    if(fs.existsSync(MARKETING_HISTORY_FILE)) {
        marketingHistory = JSON.parse(fs.readFileSync(MARKETING_HISTORY_FILE, 'utf8'));
    }
} catch(e) {}

const addToHistory = (entry) => {
    marketingHistory.unshift({ timestamp: Date.now(), ...entry });
    if(marketingHistory.length > 50) marketingHistory = marketingHistory.slice(0, 50); // Keep last 50
    try { fs.writeFileSync(MARKETING_HISTORY_FILE, JSON.stringify(marketingHistory)); } catch(e){}
};

let marketing = {
  running: false,
  timer: null,
  intervalMs: (parseInt(process.env.MARKETING_INTERVAL_MINUTES || "0", 10) || 0) * 60 * 1000,
  webhookUrl: process.env.MARKETING_WEBHOOK_URL || "https://hook.eu1.make.com/eak8dpssccvf9e1hoibtlzma9k2dbe43",
  channels: (process.env.MARKETING_CHANNELS || "").split(",").map(s => s.trim()).filter(Boolean),
  nextRunAt: 0,
  template: process.env.MARKETING_MESSAGE || "{hook} Conditions live sur {spot} • {desc} {tags}",
  contentType: "story",
  connectors: {
    instagram: { enabled: false, webhook: "", profileUrl: "https://www.instagram.com/swellsyncfr/", format: "story" },
    facebook: { enabled: false, webhook: "", profileUrl: "https://www.facebook.com/profile.php?id=61588121698712", format: "post" },
    tiktok: { enabled: false, webhook: "", profileUrl: "https://www.tiktok.com/@user5167910544838", format: "video" },
    youtube: { enabled: false, webhook: "", profileUrl: "https://www.youtube.com/@SwellSync.surf-report", format: "video" },
    twitter: { enabled: false, webhook: "", profileUrl: "https://x.com/swellsync", format: "post" },
    threads: { enabled: false, webhook: "", profileUrl: "https://www.threads.net/@swellsyncfr", format: "post" },
    telegram: { enabled: false, webhook: "", profileUrl: "https://web.telegram.org/k/", format: "post" },
    discord: { enabled: false, webhook: "", profileUrl: "https://discord.com/channels/@me", format: "message" }
  },
  email: MARKETING_EMAIL,
  lastRunAt: 0,
  lastError: "",
  stoppedByAdmin: false,
  failureCount: 0,
  lastErrorAt: 0
};

// --- PERSISTENCE CONFIGURATION MARKETING ---
const MARKETING_CONFIG_FILE = path.join(__dirname, "marketing.json");
const saveMarketingConfig = () => {
  try {
    const data = {
      intervalMinutes: Math.round(marketing.intervalMs / 60000),
      webhookUrl: marketing.webhookUrl,
      channels: marketing.channels,
      template: marketing.template,
      contentType: marketing.contentType,
      connectors: marketing.connectors
    };
    fs.writeFileSync(MARKETING_CONFIG_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erreur sauvegarde marketing.json", e);
  }
};
const loadMarketingConfig = () => {
  if (fs.existsSync(MARKETING_CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(MARKETING_CONFIG_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data.intervalMinutes) marketing.intervalMs = data.intervalMinutes * 60 * 1000;
      if (data.webhookUrl !== undefined) marketing.webhookUrl = data.webhookUrl;
      if (Array.isArray(data.channels)) marketing.channels = data.channels;
      if (data.template) marketing.template = data.template;
      if (data.contentType) marketing.contentType = data.contentType;
      if (data.connectors) {
          // Merge deep to preserve defaults if keys missing
          Object.keys(data.connectors).forEach(k => {
              if (marketing.connectors[k]) {
                  marketing.connectors[k] = { ...marketing.connectors[k], ...data.connectors[k] };
              }
          });
      }
      console.log("✅ Config marketing chargée depuis marketing.json");
    } catch (e) {
      console.error("Erreur lecture marketing.json", e);
    }
  } else {
      // Default fallback from ENV if no JSON
      if (process.env.DISCORD_WEBHOOK_URL) {
          marketing.connectors.discord.webhook = process.env.DISCORD_WEBHOOK_URL;
          marketing.connectors.discord.enabled = true; // Auto enable if env provided? Maybe safer to just set webhook.
      }
  }
};
loadMarketingConfig();
if (marketing.intervalMs >= 60000 && marketing.webhookUrl) {
  try { startMarketingTimer(undefined, marketing.intervalMs); } catch {}
}
setInterval(() => {
  const okCfg = marketing.intervalMs >= 60000 && !!marketing.webhookUrl;
  if (!marketing.running && okCfg && !marketing.stoppedByAdmin) {
    try { startMarketingTimer(undefined, marketing.intervalMs); } catch {}
  }
}, 60 * 1000);

const aggregator = {
  deliveries: [],
  queue: []
};
const pickSpotForMarketing = () => {
  // Use History to avoid repetition
  const lastSpots = marketingHistory.slice(0, 5).map(h => h.spot);
  
  let candidates = [];
  if (epicSpots && epicSpots.length) {
      candidates = epicSpots.filter(s => !lastSpots.includes(s.name));
      if(candidates.length === 0) candidates = epicSpots; // Fallback if all recent
  } else {
      candidates = spots.filter(s => !lastSpots.includes(s.name));
      if(candidates.length === 0) candidates = spots;
  }

  if(!candidates.length) return null;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx]?.name || null;
};
const buildMarketingPayload = (req) => {
  const spot = pickSpotForMarketing();
  const base = baseUrlForReq(req);
  
  // UTM Tracking for Traffic Analysis
  const campaignId = `auto_${new Date().toISOString().split('T')[0]}`;
  const utm = `?utm_source=swellsync_bot&utm_medium=social&utm_campaign=${campaignId}&utm_content=${encodeURIComponent(spot || "spot")}`;
  const trackedLink = `${base}${utm}`;

  let image = `${base}/logo-og.png`;
  if (spot) {
    if (marketing.contentType === "story") image = `${base}/og/story.png?spot=${encodeURIComponent(spot)}`;
    else if (marketing.contentType === "classic") image = `${base}/og/post.png?spot=${encodeURIComponent(spot)}`;
    else image = `${base}/og/post.png?spot=${encodeURIComponent(spot)}`;
  }
  
  // Pick a hook that wasn't used recently
  const lastHooks = marketingHistory.slice(0, 3).map(h => h.hook);
  const availableHooks = VIRAL_HOOKS.filter(h => !lastHooks.includes(h));
  const hook = availableHooks.length > 0 
      ? availableHooks[Math.floor(Math.random() * availableHooks.length)] 
      : VIRAL_HOOKS[Math.floor(Math.random() * VIRAL_HOOKS.length)];

  // Select 5 random tags
  const tags = VIRAL_HASHTAGS.sort(() => 0.5 - Math.random()).slice(0, 5).join(" ");

  const descObj = { title: "", desc: "" };
  try {
    descObj.title = `${spot} • Conditions Live`;
    descObj.desc = `Houle & période en temps réel`;
  } catch {}

  const text = marketing.template
    .replace("{spot}", spot || "ton spot favori")
    .replace("{desc}", descObj.desc || "Analyse en temps réel")
    .replace("{hook}", hook)
    .replace("{tags}", tags)
    + `\n\n👉 Voir le report : ${base}/conditions.html?spot=${encodeURIComponent(spot || "")}`; // Always append Link for Traffic

  // Save to History
  addToHistory({ spot, hook, type: marketing.contentType });

  const channels = marketing.channels.length ? marketing.channels : ["instagram","facebook","tiktok","threads","youtube","twitter","telegram","discord"];
  const profiles = {};
  Object.keys(marketing.connectors).forEach(k => {
    if (marketing.connectors[k].profileUrl) profiles[k] = marketing.connectors[k].profileUrl;
  });
  
  // Use tracked link for the payload 'link' field
  return { text, image, channels, link: trackedLink, type: marketing.contentType, email: marketing.email, profiles, spot };
};

// --- DIRECT INSTAGRAM POSTING ---
const postToInstagram = async (imageUrl, caption) => {
  const username = process.env.INSTAGRAM_USERNAME || "swellsyncfr";
  const password = process.env.INSTAGRAM_PASSWORD || "Hinalol08-";
  
  robotLog(ROBOTS.NEWS, "INSTA", `Connexion directe en cours pour ${username}...`);
  
  try {
    const ig = new IgApiClient();
    ig.state.generateDevice(username);
    await ig.account.login(username, password);
    
    // Download image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Publish
    const publishResult = await ig.publish.photo({
      file: buffer,
      caption: caption,
    });
    
    if (publishResult.status === 'ok') {
      robotLog(ROBOTS.NEWS, "INSTA", `✅ Post publié avec succès ! (PK: ${publishResult.media.pk})`);
      return true;
    } else {
      throw new Error("Statut non-OK: " + JSON.stringify(publishResult));
    }
  } catch (e) {
    robotLog(ROBOTS.NEWS, "ERROR", `Insta Direct: ${e.message}`);
    if (e.name === 'IgCheckpointError') {
      robotLog(ROBOTS.NEWS, "WARN", "⚠️ Checkpoint requis !");
    }
    return false;
  }
};

// --- DIRECT TWITTER POSTING ---
const postToTwitter = async (imageUrl, caption) => {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    robotLog(ROBOTS.NEWS, "WARN", "Twitter Direct: Identifiants manquants (.env)");
    return false;
  }

  robotLog(ROBOTS.NEWS, "X-TWIT", "Post Direct en cours...");

  try {
    const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
    
    // Download image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload Media (v1 API required for media upload)
    const mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/png' });

    // Tweet (v2 API)
    await client.v2.tweet({
      text: caption,
      media: { media_ids: [mediaId] }
    });

    robotLog(ROBOTS.NEWS, "X-TWIT", "✅ Tweet publié avec succès !");
    return true;
  } catch (e) {
    robotLog(ROBOTS.NEWS, "ERROR", `Twitter Direct: ${e.message}`);
    return false;
  }
};

// --- DIRECT THREADS POSTING ---
const postToThreads = async (imageUrl, caption) => {
  const username = process.env.THREADS_USERNAME || process.env.INSTAGRAM_USERNAME || "swellsyncfr";
  const password = process.env.THREADS_PASSWORD || process.env.INSTAGRAM_PASSWORD || "Hinalol08-";

  robotLog(ROBOTS.NEWS, "THREADS", `Connexion directe en cours pour ${username}...`);

  try {
    const threadsAPI = new ThreadsAPI({
      username,
      password,
    });

    // ThreadsAPI usually takes URL for image if public, or buffer?
    // The library documentation says: publish({ text, image: 'url' or 'path' })
    // Since our image URL is local (localhost) or public (if BASE_URL is set).
    // If localhost, we might need to expose it via ngrok or save to file.
    // However, let's try passing the URL first. If it fails, we might need a workaround.
    // Note: unofficial threads-api can be flaky.
    
    // For safety, we rely on the public URL if available, otherwise we might skip.
    // But since we are generating OG images, they are served by THIS server.
    // If this server is localhost, Threads servers cannot reach it to fetch the image.
    // BUT `threads-api` might upload the image itself?
    // Checking docs... usually it uploads.
    
    // Workaround: Save buffer to temp file and upload.
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const tempPath = path.join(__dirname, `temp_threads_${Date.now()}.png`);
    fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
    
    // Publish using file path
    await threadsAPI.publish({
      text: caption,
      image: tempPath
    });

    // Cleanup
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    robotLog(ROBOTS.NEWS, "THREADS", "✅ Thread publié avec succès !");
    return true;
  } catch (e) {
    robotLog(ROBOTS.NEWS, "ERROR", `Threads Direct: ${e.message}`);
    return false;
  }
};

// --- DIRECT TELEGRAM POSTING ---
const postToTelegram = async (imageUrl, caption) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    robotLog(ROBOTS.NEWS, "WARN", "Telegram Direct: Token ou ChatID manquant (.env)");
    return false;
  }

  robotLog(ROBOTS.NEWS, "TELEG", "Envoi Direct en cours...");

  try {
    const bot = new TelegramBot(token, { polling: false });
    
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await bot.sendPhoto(chatId, buffer, { caption });

    robotLog(ROBOTS.NEWS, "TELEG", "✅ Message envoyé avec succès !");
    return true;
  } catch (e) {
    robotLog(ROBOTS.NEWS, "ERROR", `Telegram Direct: ${e.message}`);
    return false;
  }
};

// --- DIRECT FACEBOOK POSTING ---
const postToFacebook = async (imageUrl, caption) => {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!accessToken || !pageId) {
    robotLog(ROBOTS.NEWS, "WARN", "Facebook Direct: Token ou Page ID manquant (.env)");
    return false;
  }

  robotLog(ROBOTS.NEWS, "FB", "Envoi Direct en cours...");

  try {
    const url = `https://graph.facebook.com/v18.0/${pageId}/photos`;
    await axios.post(url, {
      url: imageUrl,
      caption: caption,
      access_token: accessToken
    });

    robotLog(ROBOTS.NEWS, "FB", "✅ Post Facebook publié avec succès !");
    return true;
  } catch (e) {
    robotLog(ROBOTS.NEWS, "ERROR", `Facebook Direct: ${e.response?.data?.error?.message || e.message}`);
    return false;
  }
};

// --- HELPER: CONVERT IMAGE TO VIDEO (FFMPEG) OR GENERATE MONTAGE ---
const createVideoFromImage = async (imageUrl, spotName = "Spot") => {
  return new Promise(async (resolve, reject) => {
    try {
        const tempVideo = path.join(__dirname, `temp_vid_${Date.now()}.mp4`);
        const tempImage = path.join(__dirname, `temp_img_${Date.now()}.png`);

        // Check if we want a full montage (if spotName provided and url is generic)
        // Actually, let's keep it simple: If imageUrl is provided, we just animate THAT image.
        // If we want a montage, we should have a separate function.
        // But for "YouTube Direct" existing call, it passes one imageUrl.
        // Let's Upgrade this to be a "Smart Video Generator"
        
        // Download Image
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(tempImage, Buffer.from(arrayBuffer));

        // Create a Zoom In effect (Ken Burns)
        ffmpeg()
          .input(tempImage)
          .inputOptions(['-loop 1'])
          .videoFilter([
              `zoompan=z='min(zoom+0.0015,1.5)':d=150:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920`
          ])
          .duration(5)
          .fps(30)
          .videoCodec('libx264')
          .format('mp4')
          .outputOptions([
             '-pix_fmt yuv420p',
             '-shortest'
          ])
          .save(tempVideo)
          .on('end', () => {
             if (fs.existsSync(tempImage)) fs.unlinkSync(tempImage);
             resolve(tempVideo);
          })
          .on('error', (err) => {
             if (fs.existsSync(tempImage)) fs.unlinkSync(tempImage);
             reject(err);
          });

    } catch (e) {
        reject(e);
    }
  });
};

// --- ADVANCED VIDEO MONTAGE GENERATOR ---
const generateVideoMontage = async (spotName) => {
    robotLog(ROBOTS.NEWS, "VIDEO", `Génération montage vidéo intelligent pour ${spotName}...`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    
    const slidePaths = [];
    const outputVideo = path.join(__dirname, `montage_${Date.now()}.mp4`);

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1920 }); // Vertical 9:16
        
        // Load Base URL
        const baseUrl = "http://localhost:3001"; 
        const url = `${baseUrl}/conditions.html?spot=${encodeURIComponent(spotName)}`;
        
        await page.goto(url, { waitUntil: "networkidle0" });

        // --- RANDOM SCENARIO & STYLE ---
        const scenarios = ["CLASSIC", "ALERT", "DATA_FIRST", "VIBE", "MINIMAL", "CHAOS"];
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        
        const styles = [
            { name: "Dark", bg: "#0f172a", filter: "none" },
            { name: "Neon", bg: "#000000", filter: "contrast(1.2) saturate(1.2)" },
            { name: "Sunset", bg: "#2a1b3d", filter: "sepia(0.2)" },
            { name: "Ocean", bg: "#0c4a6e", filter: "brightness(1.1)" },
            { name: "Forest", bg: "#064e3b", filter: "hue-rotate(90deg)" },
            { name: "Retro", bg: "#78350f", filter: "sepia(0.6) contrast(0.8)" }
        ];
        const style = styles[Math.floor(Math.random() * styles.length)];
        
        robotLog(ROBOTS.NEWS, "VIDEO", `Scenario: ${scenario} | Style: ${style.name}`);

        // Base Clean Up
        await page.addStyleTag({ content: `
            .nav, .footer, .cta, .premium-tags { display: none !important; }
            body { background: ${style.bg} !important; overflow: hidden; filter: ${style.filter}; }
            .cond-container { padding-top: 40px !important; }
        `});

        // Helper to take slide
        const takeSlide = async (name, css) => {
            await page.reload({ waitUntil: "networkidle0" });
            // Re-apply base style after reload
            await page.addStyleTag({ content: `
                .nav, .footer, .cta, .premium-tags { display: none !important; }
                body { background: ${style.bg} !important; overflow: hidden; filter: ${style.filter}; }
                .cond-container { padding-top: 40px !important; }
            `});
            // Apply specific slide CSS
            await page.addStyleTag({ content: css });
            const p = path.join(__dirname, `slide_${name}_${Date.now()}.png`);
            await page.screenshot({ path: p });
            slidePaths.push(p);
        };

        // --- SLIDE DEFINITIONS ---
        const slideTitle = async () => {
            await takeSlide("title", `
                .dashboard-layout { display: none !important; }
                .cond-header { display: flex !important; flex-direction: column; align-items: center; justify-content: center; height: 80vh; transform: scale(1.5); }
                h1 { font-size: 4rem !important; text-shadow: 0 0 20px rgba(255,255,255,0.5); }
            `);
        };

        const slideData = async () => {
            await takeSlide("data", `
                .cond-header { display: none !important; }
                .dashboard-layout { display: block !important; margin-top: 200px; transform: scale(1.3); transform-origin: top center; }
                .status-banner, #ai-robot-hub { display: none !important; }
                .stats-card { border: 2px solid rgba(255,255,255,0.2) !important; box-shadow: 0 0 30px rgba(0,0,0,0.5) !important; }
            `);
        };

        const slideStatus = async () => {
            await takeSlide("status", `
                .cond-header { display: none !important; }
                .dashboard-layout { display: flex !important; align-items: center; justify-content: center; height: 100vh; }
                .status-banner { transform: scale(1.8); margin: 0 !important; box-shadow: 0 0 50px rgba(0,0,0,0.8); }
                .stats-grid-6, #ai-robot-hub { display: none !important; }
            `);
        };

        const slideCTA = async () => {
             const ctaTexts = ["LIEN EN BIO 🔗", "CHECK LE REPORT", "CONDITIONS LIVE", "ABONNE-TOI 🤙", "SURF REPORT 🌊"];
             const ctaText = ctaTexts[Math.floor(Math.random() * ctaTexts.length)];
             
             // Inject a custom HTML overlay for CTA
             await page.evaluate((spot, text) => {
                 document.body.innerHTML = `
                    <div style="height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; color:white; font-family:sans-serif;">
                        <h1 style="font-size:3rem; margin-bottom:20px;">🌊 ${spot}</h1>
                        <h2 style="font-size:2rem; color:#4ade80;">REPORT COMPLET</h2>
                        <div style="background:white; color:black; padding:20px 40px; font-size:2rem; font-weight:bold; border-radius:50px; margin-top:50px; box-shadow:0 0 30px rgba(255,255,255,0.3);">
                            ${text}
                        </div>
                        <p style="margin-top:30px; opacity:0.7;">swellsync.fr</p>
                    </div>
                 `;
             }, spotName, ctaText);
             const p = path.join(__dirname, `slide_cta_${Date.now()}.png`);
             await page.screenshot({ path: p });
             slidePaths.push(p);
        };

        // --- EXECUTE SCENARIO ---
        if (scenario === "CLASSIC") {
            await slideTitle();
            await slideData();
            await slideStatus();
        } else if (scenario === "ALERT") {
            await slideStatus();
            await slideTitle();
            await slideData();
        } else if (scenario === "DATA_FIRST") {
            await slideData();
            await slideTitle();
            await slideStatus();
        } else if (scenario === "MINIMAL") {
            await slideTitle();
            await slideStatus();
        } else { // VIBE / CHAOS
            await slideTitle();
            await slideStatus();
            await slideData();
        }
        
        // ALWAYS END WITH CTA
        await slideCTA();

        await browser.close();

        // --- STITCH WITH FFMPEG (Enhanced with Ken Burns & Transitions) ---
        return new Promise((resolve, reject) => {
            const cmd = ffmpeg();
            
            // Input all slides
            slidePaths.forEach(p => {
                cmd.input(p).inputOptions(['-loop 1', '-t 3.5']); // 3.5 seconds each for dynamic feel
            });

            // Music Selection (Random from public/music if exists)
            const musicDir = path.join(__dirname, 'public', 'assets', 'music');
            let hasMusic = false;
            if (fs.existsSync(musicDir)) {
                const files = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
                if (files.length > 0) {
                    const randomMusic = files[Math.floor(Math.random() * files.length)];
                    cmd.input(path.join(musicDir, randomMusic));
                    hasMusic = true;
                    // Fade out audio at end
                    // We need total duration
                    const totalDuration = slidePaths.length * 3.5;
                    cmd.audioFilters(`afade=t=out:st=${totalDuration-2}:d=2`);
                }
            }

            // Dynamic Filter Construction
            // We apply a zoompan (Ken Burns) to each input, then concat
            const filters = [];
            const inputs = [];
            
            slidePaths.forEach((_, i) => {
                // Randomize zoom effect (In or Out)
                const zoomType = Math.random() > 0.5 ? "IN" : "OUT";
                const z = zoomType === "IN" ? "'min(zoom+0.0015,1.2)'" : "'if(eq(on,1),1.2,max(1.0,zoom-0.0015))'"; // 1.2 max zoom
                
                // Scale to HD first, then apply zoompan
                filters.push(`[${i}:v]scale=1080:1920,setsar=1,zoompan=z=${z}:d=120:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920[v${i}]`);
                inputs.push(`[v${i}]`);
            });
            
            // Simple Concat (Crossfade is complex with fluent-ffmpeg chain, using simple concat for reliability first)
            // To do proper crossfade, we'd need complex filter logic with offsets. 
            // For now, let's stick to simple concat but with the motion effect which is already a huge upgrade.
            const concatFilter = `${inputs.join('')}concat=n=${slidePaths.length}:v=1:a=0[outv]`;
            filters.push(concatFilter);
            
            // Map output
            let chain = cmd.complexFilter(filters)
            .map('[outv]');
            
            if (hasMusic) {
                // Map the last input as audio (index = slidePaths.length)
                chain = chain.map(`${slidePaths.length}:a`);
                chain.outputOptions(['-shortest']); // Cut audio to video length
            }

            chain
            .videoCodec('libx264')
            .outputOptions([
                '-pix_fmt yuv420p', // Ensure compatibility
                '-r 30'
            ])
            .save(outputVideo)
            .on('end', () => {
                // Cleanup slides
                slidePaths.forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
                resolve(outputVideo);
            })
            .on('error', (err) => {
                console.error("FFMPEG Error:", err);
                slidePaths.forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
                reject(err);
            });
        });

    } catch (e) {
        if(browser) await browser.close();
        slidePaths.forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
        throw e;
    }
};



// --- DIRECT YOUTUBE POSTING (Video Upload) ---
const postToYouTube = async (imageUrl, caption) => {
    robotLog(ROBOTS.NEWS, "YOUTUBE", "Préparation de la vidéo (Image -> MP4)...");
    
    // Credentials
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
         robotLog(ROBOTS.NEWS, "WARN", "YouTube Direct: Credentials manquants (.env)");
         return false;
    }

    let videoPath = null;
    try {
        // 1. Generate Video Montage (Smart)
        videoPath = await generateVideoMontage(caption.match(/conditions live sur (.*?) •/i)?.[1] || "Spot");
        robotLog(ROBOTS.NEWS, "YOUTUBE", "Montage terminé. Upload en cours...");

        // 2. Auth
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "https://developers.google.com/oauthplayground");
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // 3. Upload
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: caption.split('\n')[0].substring(0, 100), // First line as title
                    description: caption,
                    tags: ['surf', 'swellsync', 'report'],
                    categoryId: '17' // Sports
                },
                status: {
                    privacyStatus: 'public', // or 'unlisted'
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(videoPath)
            }
        });

        robotLog(ROBOTS.NEWS, "YOUTUBE", `✅ Vidéo uploadée: https://youtu.be/${res.data.id}`);
        
        // Clean up video
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        return true;

    } catch (e) {
        robotLog(ROBOTS.NEWS, "ERROR", `YouTube Direct: ${e.message}`);
        if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        return false;
    }
};

// --- DIRECT TIKTOK POSTING ---
// Uses Puppeteer because API is closed/complex.
const postToTikTok = async (imageUrl, caption) => {
    // Requires Puppeteer automation.
    // This is high risk/brittle.
    // For now, we will log a warning.
    robotLog(ROBOTS.NEWS, "WARN", "TikTok Direct: Nécessite un serveur dédié ou API partenaire. Utilisez le Webhook pour l'instant.");
    return false;
};

const fireMarketing = async (req) => {
  try {
    const payload = buildMarketingPayload(req);
    if (marketing.webhookUrl === ":internal") {
      const ok = await deliverAggregator(req, payload);
      if (ok) robotLog(ROBOTS.NEWS, "PROMO", `Payload interne (${payload.channels.join(", ")})`);
    } else if (marketing.webhookUrl) {
      // Global webhook: send generic payload
      await fetch(marketing.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      robotLog(ROBOTS.NEWS, "PROMO", `Payload envoyé (${payload.channels.join(", ")})`);
    } else {
      const enabled = Object.entries(marketing.connectors).filter(([k, v]) => !!v.enabled);
      
      for (const [name, conf] of enabled) {
        try {
          // Customize payload per channel format
          const channelPayload = { ...payload, channel: name, format: conf.format || "post" };
          
          // Adjust image based on detailed format specs
          let imagePath = "/og/post.png"; // Default landscape/horizontal
          const fmt = channelPayload.format;

          if (["story", "reel", "short", "video", "photo", "vertical"].includes(fmt)) {
            imagePath = "/og/story.png";
          } else if (["square", "community", "bulle"].includes(fmt)) {
            imagePath = "/og/square.png";
          } else if (["post"].includes(fmt)) {
            if (["instagram", "facebook", "threads"].includes(name)) {
               imagePath = "/og/portrait.png"; // 4:5
            } else {
               imagePath = "/og/post.png"; // 16:9 for Twitter/others
            }
          }

          channelPayload.image = `${payload.link}${imagePath}?spot=${encodeURIComponent(payload.spot || "spot")}`;

          // --- DIRECT MODE HANDLING ---
          // If Instagram AND (Webhook is empty OR explicit DIRECT)
          if (name === "instagram" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
             try {
                 // Try API first
                 await postToInstagram(channelPayload.image, channelPayload.text);
             } catch (e) {
                 robotLog(ROBOTS.NEWS, "ERROR", `IG API Fail: ${e.message}, trying Stealth...`);
                 // Fallback to Stealth Video
                 try {
                     const videoPath = await generateVideoMontage(payload.spot || "Spot");
                     await socialAutomator.postToInstagramVideo(videoPath, channelPayload.text);
                     setTimeout(() => { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); }, 60000);
                 } catch (err) {
                     robotLog(ROBOTS.NEWS, "ERROR", `IG Stealth Fail: ${err.message}`);
                 }
             }
             continue; // Skip webhook fetch
          }

          // If Twitter AND (Webhook is empty OR explicit DIRECT)
          if (name === "twitter" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
             try {
                 const ok = await postToTwitter(channelPayload.image, channelPayload.text);
                 if (!ok) throw new Error("API Failed");
             } catch (e) {
                 robotLog(ROBOTS.NEWS, "ERROR", `Twitter API Fail: ${e.message}, trying Stealth...`);
                 await socialAutomator.postToTwitter(channelPayload.image, channelPayload.text);
             }
             continue;
          }

          // If Threads AND (Webhook is empty OR explicit DIRECT)
          if (name === "threads" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
             await postToThreads(channelPayload.image, channelPayload.text);
             continue;
          }

          // If Telegram AND (Webhook is empty OR explicit DIRECT)
          if (name === "telegram" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
             await postToTelegram(channelPayload.image, channelPayload.text);
             continue;
          }

          // If Facebook AND (Webhook is empty OR explicit DIRECT)
          if (name === "facebook" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
             try {
                 const ok = await postToFacebook(channelPayload.image, channelPayload.text);
                 if (!ok) throw new Error("API Failed/Missing");
             } catch (e) {
                 robotLog(ROBOTS.NEWS, "WARN", `Facebook API Fail: ${e.message}, trying Stealth...`);
                 try {
                    // Prefer Video for Stealth
                    const videoPath = await generateVideoMontage(payload.spot || "Spot");
                    await socialAutomator.postToFacebook(videoPath, channelPayload.text);
                    // Cleanup handled inside generateVideoMontage? No, it returns path.
                    // We should delete it after a delay or let OS handle tmp.
                    // For now, leave it or use a cleanup helper.
                    setTimeout(() => { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); }, 60000);
                 } catch (err) {
                    robotLog(ROBOTS.NEWS, "ERROR", `Facebook Stealth Fail: ${err.message}`);
                 }
             }
             continue;
          }

          // If TikTok AND (Webhook is empty OR explicit DIRECT)
          if (name === "tiktok" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
              try {
                  // Always generate video for TikTok
                  let videoToPost = channelPayload.image;
                  if (!videoToPost.endsWith(".mp4")) {
                      videoToPost = await generateVideoMontage(payload.spot || "Spot");
                  }
                  await socialAutomator.postToTikTok(videoToPost, channelPayload.text);
                  
                  // Cleanup
                  if (videoToPost.endsWith(".mp4") && !channelPayload.image.endsWith(".mp4")) {
                      setTimeout(() => { if (fs.existsSync(videoToPost)) fs.unlinkSync(videoToPost); }, 60000);
                  }
              } catch (e) {
                  robotLog(ROBOTS.NEWS, "ERROR", `TikTok Stealth Fail: ${e.message}`);
              }
              continue;
          }

  // If YouTube AND (Webhook is empty OR explicit DIRECT)
          if (name === "youtube" && (!conf.webhook || conf.webhook === "DIRECT" || conf.webhook.trim() === "")) {
             try {
                 const ok = await postToYouTube(channelPayload.image, channelPayload.text);
                 if (!ok) throw new Error("API Failed/Missing");
             } catch (e) {
                 robotLog(ROBOTS.NEWS, "WARN", `YouTube API Fail: ${e.message}, trying Stealth...`);
                 try {
                     const videoPath = await generateVideoMontage(payload.spot || "Spot");
                     const title = channelPayload.text.split('\n')[0].substring(0, 100);
                     await socialAutomator.postToYouTube(videoPath, title, channelPayload.text);
                     setTimeout(() => { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); }, 60000);
                 } catch (err) {
                     robotLog(ROBOTS.NEWS, "ERROR", `YouTube Stealth Fail: ${err.message}`);
                 }
             }
             continue;
          }

          // If TikTok AND (Webhook is empty OR explicit DIRECT)
          // Handled above.
          // if (name === "tiktok" ... ) { ... }

          // Discord Webhook Handling (Custom Payload)
          if (name === "discord" && conf.webhook && conf.webhook.startsWith("http")) {
             // Discord expects "content" not "text"
             // We append the image URL so Discord auto-embeds it
             const discordBody = {
               content: `${channelPayload.text}\n${channelPayload.image}`,
               username: "SwellSync Bot",
               avatar_url: `${payload.link}/logo-og.png`
             };
             await fetch(conf.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(discordBody) });
             robotLog(ROBOTS.NEWS, "PROMO", `Discord Webhook envoyé`);
             continue;
          }
          
          if (!conf.webhook) continue; // Skip if no webhook and not handled directly

          await fetch(conf.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(channelPayload) });
          robotLog(ROBOTS.NEWS, "PROMO", `Payload ${name} (${conf.format})`);
        } catch (e) {
          robotLog(ROBOTS.NEWS, "ERROR", `Promo ${name}: ${e.message}`);
        }
      }
    }
    marketing.lastRunAt = Date.now();
    return true;
  } catch (e) {
    marketing.lastError = e.message || String(e);
    robotLog(ROBOTS.NEWS, "ERROR", `Promo: ${e.message}`);
    return false;
  }
};
const deliverAggregator = async (req, payload) => {
  try {
    const enabled = Object.entries(marketing.connectors).filter(([k, v]) => !!v.enabled && !!v.webhook);
    if (!enabled.length) {
      aggregator.queue.push({ when: Date.now(), payload, reason: "no_connectors" });
      return false;
    }
    for (const [name, conf] of enabled) {
      try {
        await fetch(conf.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, channel: name }) });
        aggregator.deliveries.push({ when: Date.now(), channel: name, ok: true });
      } catch (e) {
        aggregator.deliveries.push({ when: Date.now(), channel: name, ok: false, error: e.message });
        aggregator.queue.push({ when: Date.now(), payload: { ...payload, channel: name }, reason: "delivery_error" });
      }
    }
    return true;
  } catch (e) {
    aggregator.queue.push({ when: Date.now(), payload, reason: "internal_error" });
    return false;
  }
};
const drainAggregatorQueue = async (req) => {
  const pending = aggregator.queue.slice();
  aggregator.queue = [];
  for (const item of pending) {
    await deliverAggregator(req, item.payload);
  }
};
const startMarketingTimer = (req, intervalMs) => {
  if (marketing.timer) clearInterval(marketing.timer);
  marketing.intervalMs = intervalMs;
  marketing.running = true;
  marketing.nextRunAt = Date.now() + intervalMs;
  marketing.stoppedByAdmin = false;
  marketing.timer = setInterval(async () => {
    const ok = await fireMarketing(req);
    if (!ok) {
      marketing.failureCount++;
      marketing.lastErrorAt = Date.now();
      if (marketing.failureCount >= 3) {
        try {
          if (marketing.webhookUrl && marketing.webhookUrl !== ":internal") {
            await fetch(marketing.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "alert", service: "marketing", message: "fireMarketing failures threshold reached", time: Date.now() }) });
          }
        } catch {}
        marketing.failureCount = 0;
      }
    } else {
      marketing.failureCount = 0;
    }
    marketing.nextRunAt = Date.now() + marketing.intervalMs;
  }, intervalMs);
};
const stopMarketingTimer = () => {
  if (marketing.timer) clearInterval(marketing.timer);
  marketing.running = false;
  marketing.timer = null;
  marketing.nextRunAt = 0;
  marketing.stoppedByAdmin = true;
};
app.get("/api/admin/marketing/status", (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const iv = Math.round(marketing.intervalMs / 60000);
  let reason = "running";
  if (!marketing.running) {
    if (marketing.stoppedByAdmin) reason = "stopped_by_admin";
    else if (!marketing.webhookUrl || iv < 1) reason = "not_configured";
    else reason = "paused";
  }
  res.json({
    running: marketing.running,
    intervalMinutes: iv,
    channels: marketing.channels,
    webhookSet: !!marketing.webhookUrl,
    nextRunAt: marketing.nextRunAt,
    lastRunAt: marketing.lastRunAt,
    lastError: marketing.lastError || "",
    reason,
    failureCount: marketing.failureCount,
    lastErrorAt: marketing.lastErrorAt,
    cookieStatus: socialAutomator.getCookieStatus()
  });
});
app.post("/api/admin/marketing/start", (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { intervalMinutes, webhookUrl, channels, template } = req.body || {};
  const iv = parseInt(intervalMinutes, 10);
  if (!iv || iv < 1) return res.status(400).json({ success: false, error: "Intervalle invalide (minutes >= 1)" });
  if (!webhookUrl && !marketing.webhookUrl) return res.status(400).json({ success: false, error: "Webhook requis" });
  if (webhookUrl) marketing.webhookUrl = webhookUrl;
  if (Array.isArray(channels) && channels.length) marketing.channels = channels;
  if (template) marketing.template = template;
  startMarketingTimer(req, iv * 60 * 1000);
  res.json({ success: true, running: marketing.running, intervalMinutes: iv });
});
app.post("/api/admin/marketing/stop", (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  stopMarketingTimer();
  res.json({ success: true, running: marketing.running });
});
app.post("/api/admin/marketing/fire", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const ok = await fireMarketing(req);
  res.json({ success: ok });
});
// --- PROFILE UPDATE ENDPOINT ---
app.post("/api/admin/marketing/update-profile", adminStaticGate, upload.single('photo'), async (req, res) => {
    const { bio } = req.body;
    const photoPath = req.file ? req.file.path : null;
    
    if (!bio && !photoPath) {
        return res.status(400).json({ success: false, error: "Aucune donnée fournie (bio ou photo)" });
    }

    console.log(`📝 Bulk Profile Update requested. Bio: ${!!bio}, Photo: ${!!photoPath}`);
    
    // Networks to update (currently supported)
    const networks = ['instagram', 'twitter', 'tiktok']; 
    const results = [];
    
    // Process sequentially to save resources
    for (const net of networks) {
        try {
            console.log(`Processing ${net}...`);
            const r = await socialAutomator.updateProfileIdentity(net, { photoPath, bio });
            results.push(`${net}: ${r.success ? '✅ Success' : '❌ Failed (' + (r.error || 'Unknown') + ')'}`);
        } catch (e) {
            results.push(`${net}: ❌ Error (${e.message})`);
        }
    }

    // Cleanup temp file
    if (photoPath && fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
    }

    res.json({ success: true, details: results });
});

app.get("/api/admin/marketing/config", (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  res.json({
    channels: marketing.channels,
    webhookUrl: marketing.webhookUrl,
    intervalMinutes: Math.round(marketing.intervalMs / 60000),
    template: marketing.template,
    contentType: marketing.contentType,
    connectors: marketing.connectors,
    email: marketing.email
  });
});
app.post("/api/admin/marketing/config", (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const { channels, webhookUrl, intervalMinutes, template, contentType, connectors } = req.body || {};
  if (Array.isArray(channels)) marketing.channels = channels.map(s => String(s)).filter(Boolean);
  if (typeof webhookUrl === "string") marketing.webhookUrl = webhookUrl;
  if (template) marketing.template = String(template);
  if (contentType && ["story","classic","video"].includes(contentType)) marketing.contentType = contentType;
  if (connectors && typeof connectors === "object") {
    Object.keys(marketing.connectors).forEach(k => {
      const v = connectors[k];
      if (v && typeof v === "object") {
        marketing.connectors[k].enabled = !!v.enabled;
        marketing.connectors[k].webhook = String(v.webhook || "");
        marketing.connectors[k].profileUrl = String(v.profileUrl || "");
        marketing.connectors[k].format = String(v.format || "");
      }
    });
  }
  if (intervalMinutes) {
    const iv = parseInt(intervalMinutes, 10);
    if (iv >= 1) {
      startMarketingTimer(req, iv * 60 * 1000);
      saveMarketingConfig();
      return res.json({ success: true, running: marketing.running, intervalMinutes: iv });
    }
  }
  drainAggregatorQueue(req);
  saveMarketingConfig();
  res.json({ success: true });
});
app.post("/api/agg/entry", async (req, res) => {
  try {
    const payload = req.body || {};
    const ok = await deliverAggregator(req, payload);
    res.json({ success: ok });
  } catch (e) {
    res.status(500).json({ success: false, error: "Erreur agg." });
  }
});
app.get("/api/admin/agg/status", (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  res.json({
    deliveries: aggregator.deliveries.slice(-50),
    queued: aggregator.queue.length,
    internal: marketing.webhookUrl === ":internal"
  });
});
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

app.post("/api/log-click", async (req, res) => {
    const { spot, source, medium, campaign, content } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
        // Only log if we have at least a spot or a source
        if (spot || source) {
            await pool.query(
                "INSERT INTO click_logs (spot_name, ip, utm_source, utm_medium, utm_campaign, utm_content) VALUES ($1, $2, $3, $4, $5, $6)",
                [spot || "unknown", ip, source, medium, campaign, content]
            );
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Log error:", e.message);
        res.status(500).json({ error: "Error logging" });
    }
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
  const headerTok = req.headers["x-admin-token"];
  if (headerTok && headerTok === ADMIN_TOKEN) return true;
  const cookieHeader = req.headers.cookie || "";
  const m = cookieHeader.match(/(?:^|;)\s*admin_session=([^;]+)/);
  if (m && m[1] === ADMIN_TOKEN) return true;
  const id = parseInt(req.headers["x-user-id"]);
  const email = req.headers["x-user-email"];
  const token = req.headers["x-admin-token"];
  if (id && email && token) {
    const rec = adminTokens.get(id);
    if (!rec) return false;
    if (rec.expires < Date.now()) { adminTokens.delete(id); return false; }
    if (email !== ADMIN_EMAIL) return false;
    if (rec.token !== token) return false;
    return true;
  }
  return false;
};

// Gate d'accès à la page /admin (HTML), avant la statique
app.get("/admin", (req, res) => res.redirect("/admin/"));
app.get("/admin/login", (req, res) => {
  const t = (req.query && req.query.token) || "";
  if (!t || t !== ADMIN_TOKEN) return res.status(403).send("Forbidden");
  const secure = process.env.RENDER ? "Secure; " : "";
  res.setHeader("Set-Cookie", `admin_session=${ADMIN_TOKEN}; ${secure}HttpOnly; SameSite=Strict; Path=/`);
  res.redirect("/admin/");
});
app.get("/admin/", (req, res) => {
  const t = (req.query && req.query.token) || "";
  if (t && t === ADMIN_TOKEN) {
    const secure = process.env.RENDER ? "Secure; " : "";
    res.setHeader("Set-Cookie", `admin_session=${ADMIN_TOKEN}; ${secure}HttpOnly; SameSite=Strict; Path=/`);
  } else {
    const cookieHeader = req.headers.cookie || "";
    const sessions = (cookieHeader || "").split(";").map(s => s.trim()).filter(s => /^admin_session=/i.test(s)).map(s => s.split("=")[1]);
    if (!sessions.includes(ADMIN_TOKEN)) {
      const tok = sessions[0];
      if (tok) {
        const rec = adminTokensByValue.get(tok);
        if (!rec || rec.expires < Date.now() || rec.email !== ADMIN_EMAIL) {
          if (rec && rec.expires < Date.now()) adminTokensByValue.delete(tok);
          return res.status(403).send("Forbidden");
        }
      } else {
        return res.status(403).send("Forbidden");
      }
    }
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

app.post("/api/admin/session/token", async (req, res) => {
  const tok = (req.body && req.body.token) || "";
  if (!tok || tok !== ADMIN_TOKEN) return res.status(403).json({ error: "Forbidden" });
  const secure = process.env.RENDER ? "Secure; " : "";
  res.setHeader("Set-Cookie", `admin_session=${ADMIN_TOKEN}; ${secure}HttpOnly; SameSite=Strict; Path=/`);
  res.json({ ok: true, adminToken: ADMIN_TOKEN });
});

app.get("/api/admin/logs", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const r = await (async () => {
    try { return await pool.query("SELECT id, spot_name, ip FROM click_logs ORDER BY id DESC LIMIT 50"); } catch { return { rows: [] }; }
  })();
  res.json(r.rows);
});

// --- PREVIEW VIDEO ENDPOINT ---
app.get("/api/admin/preview-video", async (req, res) => {
    if (!requireAdmin(req)) return res.status(403).send("Forbidden");
    const spot = req.query.spot || "Anglet";
    try {
        const videoPath = await generateVideoMontage(spot);
        res.sendFile(videoPath, () => {
            setTimeout(() => { if(fs.existsSync(videoPath)) fs.unlinkSync(videoPath); }, 60000);
        });
    } catch (e) {
        robotLog(ROBOTS.NEWS, "ERROR", `Preview Video Fail: ${e.message}`);
        res.status(500).send("Erreur génération vidéo");
    }
});

// --- COOKIE IMPORT ENDPOINT (STEALTH) ---
app.post("/api/admin/marketing/cookies", express.json({limit: '10mb'}), async (req, res) => {
    // Check admin
    if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    try {
        const cookies = req.body;
        // Validate structure roughly
        if (typeof cookies !== 'object') return res.status(400).send("Invalid format");
        
        // Merge with existing
        let existing = {};
        try {
            if (fs.existsSync('browser_cookies.json')) {
                existing = JSON.parse(fs.readFileSync('browser_cookies.json'));
            }
        } catch {}

        const merged = { ...existing, ...cookies };
        
        fs.writeFileSync('browser_cookies.json', JSON.stringify(merged, null, 2));
        // Reload in automator
        socialAutomator.loadCookies();
        res.json({ success: true });
    } catch (e) {
        console.error("Cookie Import Error:", e);
        res.status(500).send(e.message);
    }
});

app.post("/api/admin/marketing/cookies/collect", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const body = req.body || {};
  const nets = Array.isArray(body.networks) && body.networks.length ? body.networks : ["instagram","twitter","tiktok","facebook","youtube"];
  const timeoutMs = Math.max(5000, parseInt(body.timeoutMs || "15000", 10));
  const results = [];
  let browser = null, cleanup = null;
  try {
    const pr = await socialAutomator.launchBrowserWithSystemProfile("new");
    browser = pr.browser;
    cleanup = pr.cleanup;
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    for (const net of nets) {
      try {
        let url = "about:blank";
        if (net === "instagram") url = "https://www.instagram.com/";
        else if (net === "twitter") url = "https://x.com/home";
        else if (net === "tiktok") url = "https://www.tiktok.com/upload?lang=fr";
        else if (net === "facebook") url = "https://www.facebook.com/";
        else if (net === "youtube") url = "https://studio.youtube.com/";
        await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs }).catch(()=>{});
        await new Promise(r => setTimeout(r, 2000));
        const ck = await page.cookies().catch(()=>[]);
        if (Array.isArray(ck) && ck.length) {
          socialAutomator.cookies[net] = ck;
          results.push(`${net}: ok (${ck.length})`);
        } else {
          results.push(`${net}: empty`);
        }
      } catch (e) {
        results.push(`${net}: error (${e.message})`);
      }
    }
    socialAutomator.saveCookies();
    res.json({ success: true, details: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { if (cleanup) await cleanup(); } catch {}
  }
});

app.post("/api/admin/marketing/cookies/collect-auto", async (req, res) => {
  if (!requireAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const nets = (req.body && Array.isArray(req.body.networks)) ? req.body.networks : ["instagram","twitter","tiktok","facebook","youtube"];
    const r = await socialAutomator.autoLoginAndCollect(nets, 20000);
    if (r.success) return res.json(r);
    return res.status(500).json(r);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
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
        const auto = process.env.AUTO_COLLECT_COOKIES;
        if (auto && auto !== "0" && auto !== "false") {
          (async () => {
            try {
              const r = await socialAutomator.autoLoginAndCollect(["instagram","twitter","facebook","youtube"], 20000);
              if (r && r.success) robotLog(ROBOTS.NEWS, "STEALTH", `Cookies auto: ${r.details.join(", ")}`);
              else robotLog(ROBOTS.NEWS, "STEALTH", `Cookies auto: ERROR`);
            } catch {}
          })();
        }
    }, 1500);
    setInterval(sampleAdminSeries, 60 * 1000);
    try { sampleAdminSeries(); } catch {}
});
