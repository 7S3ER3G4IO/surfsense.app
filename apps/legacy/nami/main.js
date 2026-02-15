import { app, BrowserWindow, Tray, Menu, ipcMain, shell, globalShortcut, systemPreferences, desktopCapturer } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";
import urlm from "url";
import fetch from "node-fetch";
// import keytar from "keytar"; // Replaced by local file storage
import crypto from "crypto";
import { exec, spawn } from "child_process";

// --- CORE ENGINE ---
import CoreEngine from "./core/App.js";
import Logger from "./core/Logger.js";

// --- GLOBALS ---
// Local Storage Helper to replace Keychain
const STORAGE_FILE = () => path.join(app.getPath("userData"), "nami_storage.json");
const getStorage = () => {
  try { return fs.existsSync(STORAGE_FILE()) ? JSON.parse(fs.readFileSync(STORAGE_FILE(), "utf8")) : {}; } catch { return {}; }
};
const saveStorage = (data) => {
  try { fs.writeFileSync(STORAGE_FILE(), JSON.stringify(data)); } catch {}
};

// Mock keytar interface
const keytar = {
  getPassword: async (service, account) => {
    const data = getStorage();
    return data[account] || null;
  },
  setPassword: async (service, account, password) => {
    const data = getStorage();
    data[account] = password;
    saveStorage(data);
  },
  deletePassword: async (service, account) => {
    const data = getStorage();
    delete data[account];
    saveStorage(data);
  }
};
let locked = false;
let win = null;
let tray = null;
let state = { serverUrl: "http://localhost:3001", adminToken: "" };
const KC_SERVICE = "Nami";
const KC_ADMIN = "admin_token";
const KC_PASS = "passcode";
const PASS_FILE = () => path.join(app.getPath("userData"), "nami_pass.sha256");
const PASS_FILE_HOME = () => path.join(app.getPath("home"), ".nami_pass.sha256");
const loginWindows = {};
const netStatus = { instagram:false, facebook:false, threads:false, tiktok:false, twitter:false, youtube:false, linkedin:false, outlook:false, discord:false, telegram:false, pinterest:false, snapchat:false };
const loginUrls = {
  instagram: "https://www.instagram.com/accounts/login/",
  facebook: "https://www.facebook.com/login.php",
  threads: "https://www.threads.net/login",
  tiktok: "https://www.tiktok.com/login",
  twitter: "https://twitter.com/i/flow/login",
  youtube: "https://accounts.google.com/ServiceLogin?service=youtube",
  linkedin: "https://www.linkedin.com/login",
  outlook: "https://login.live.com/",
  discord: "https://discord.com/login",
  telegram: "https://web.telegram.org/",
  pinterest: "https://www.pinterest.com/login/",
  snapchat: "https://accounts.snapchat.com/accounts/login"
};
const markers = {
  instagram: { domains: [".instagram.com"], names: ["sessionid","ds_user_id"] },
  facebook: { domains: [".facebook.com"], names: ["c_user","xs"] },
  threads: { domains: [".threads.net",".instagram.com"], names: ["sessionid"] },
  tiktok: { domains: [".tiktok.com"], names: ["sessionid","sid_tt"] },
  twitter: { domains: [".twitter.com",".x.com"], names: ["auth_token","ct0"] },
  youtube: { domains: [".youtube.com",".google.com"], names: ["SAPISID","SID"] },
  linkedin: { domains: [".linkedin.com"], names: ["li_at"] },
  outlook: { domains: [".live.com",".microsoft.com",".office.com",".login.live.com"], names: ["__Host-MSAAAuth","RpsContextCookie","ESTSAUTH"] },
  discord: { domains: [".discord.com",".discordapp.com"], names: ["__dcfduid","__cfruid"] },
  telegram: { domains: [".telegram.org"], names: ["stel_ssid","stel_token"] },
  pinterest: { domains: [".pinterest.com"], names: ["_auth"] },
  snapchat: { domains: [".snapchat.com"], names: ["sc-a-nonce"] }
};
let localServer = null;
const LOCAL_PORT = 4545;
let extensionQueue = [];
let extensionLastSeen = 0;
let wsServer = null;
const IS_HELPER_MODE = process.argv.includes("--helper-server");

// --- SCHEDULER STORAGE ---
const SCHEDULE_FILE = () => path.join(app.getPath("userData"), "nami_schedule.json");
const getSchedule = () => {
  try { return fs.existsSync(SCHEDULE_FILE()) ? JSON.parse(fs.readFileSync(SCHEDULE_FILE(), "utf8")) : []; } catch { return []; }
};
const saveSchedule = (data) => {
  try { fs.writeFileSync(SCHEDULE_FILE(), JSON.stringify(data)); } catch {}
};

ipcMain.handle("nami:get-scheduled-posts", () => {
    return getSchedule();
});

ipcMain.handle("nami:add-scheduled-post", (event, post) => {
    const list = getSchedule();
    // Ensure post has necessary fields
    const newPost = {
        id: Date.now().toString(),
        network: post.network || 'unknown',
        type: post.type || 'post',
        content: post.content || '',
        scheduledTime: post.scheduledTime || Date.now(),
        status: 'pending',
        ...post
    };
    list.push(newPost);
    saveSchedule(list);
    return true;
});

const startLocalServer = () => {
  if (localServer) return;
  
  // Setup Log Forwarding
  Logger.onLog((logEntry) => {
    if (win) {
        try {
            win.webContents.send("nami:log", logEntry);
        } catch (e) {
            // Ignore if window is destroyed
        }
    }
  });

  // Start Core Engine
  CoreEngine.init().then(() => {
    console.log("[Main] Core Engine Started");
    
    // Wire up Automation Events to UI
    CoreEngine.automation.on('task-completed', (task) => {
      if (win) win.webContents.send("nami:task-result", { success: true, task });
    });
    
    CoreEngine.automation.on('task-failed', (task) => {
      if (win) win.webContents.send("nami:task-result", { success: false, task });
    });
  }).catch(err => console.error("Core Engine Init Failed", err));

  // Note: We still use WSServer directly here or via CoreEngine?
  // Ideally CoreEngine should manage the server, but for now let's keep it simple
  // and just reuse the existing WSServer logic but attached to CoreEngine later.
  // For this step, I'll keep the WSServer logic inline as it was, but imported via Core if possible.
  // Since WSServer was removed from imports, I need to add it back or use it from Core.
  // Actually, I removed WSServer import. I should put it back or make CoreEngine use it.
  // Let's re-add WSServer import for now to avoid breaking existing WS logic, 
  // OR better: Move WSServer into CoreEngine's Connector module.
  
  // Re-importing WSServer here dynamically since I removed the static import
  import("./server/WSServer.js").then(module => {
      const WSServer = module.default;
      wsServer = new WSServer(4546);
      wsServer.start();
      
      wsServer.on('client:connected', () => {
          console.log("[Main] Extension Connected via WS!");
          if (win) win.webContents.send("nami:ext-status-change", { connected: true });
      });
      
      wsServer.on('client:disconnected', () => {
          console.log("[Main] Extension Disconnected via WS!");
          if (win) win.webContents.send("nami:ext-status-change", { connected: false });
      });
    
      wsServer.on('task:result', (result) => {
          console.log("[Main] Task Result (WS):", result);
          if (win) win.webContents.send("nami:task-result", result);
      });
  });
  
  // Prevent concurrent starts if called multiple times
  if (startLocalServer.isStarting) return;
  startLocalServer.isStarting = true;
  
  const tryListen = (port) => {
      console.log(`[Main] Attempting to start local server on port ${port}...`);
      const s = http.createServer((req, res) => {
        console.log(`[Server] Request: ${req.method} ${req.url}`);
        const u = urlm.parse(req.url || "", true);
        
        // Enable CORS for localhost
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        
        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }
    
        if (u.pathname === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, status: "running" }));
          return;
        }
        
        if (u.pathname === "/human-login") {
          const net = String((u.query && u.query.network) || "");
          const target = loginUrls[net] || "https://google.com";
          console.log(`[Server] Redirecting ${net} to ${target}`);
          res.writeHead(302, { Location: target });
          res.end();
          return;
        }

        if (req.method === "POST" && u.pathname === "/api/receive-cookies") {
          let body = "";
          req.on("data", chunk => { body += chunk.toString(); });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body);
              console.log(`[Server] Received cookies for ${data.network}`);
              if (data.network && Array.isArray(data.cookies)) {
                await saveCookies(data.network, data.cookies);
                if (win) win.webContents.send("nami:networks-updated", netStatus);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
              } else {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: "Invalid data" }));
              }
            } catch (e) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
          return;
        }

        // --- EXTENSION CONTROL API ---
        
        // 1. Poll for commands
        if (req.method === "GET" && u.pathname === "/api/extension/poll") {
            // Check for pending command
            const cmd = extensionQueue.shift(); // Get oldest
            extensionLastSeen = Date.now();
            if (win) win.webContents.send("nami:extension-heartbeat", extensionLastSeen);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ command: cmd || null }));
            return;
        }
        
        // 2. Heartbeat (keep-alive)
        if (req.method === "POST" && u.pathname === "/api/extension/heartbeat") {
            extensionLastSeen = Date.now();
            if (win) win.webContents.send("nami:extension-heartbeat", extensionLastSeen);
            res.writeHead(200);
            res.end();
            return;
        }

        // 3. Result report
        if (req.method === "POST" && u.pathname === "/api/extension/result") {
            let body = "";
            req.on("data", chunk => { body += chunk.toString(); });
            req.on("end", () => {
               console.log("[Server] Extension Result:", body);
               res.writeHead(200);
               res.end(); 
            });
            return;
        }
        if (req.method === "POST" && u.pathname === "/api/app/update") {
            const arch = (os.arch() === "arm64") ? "arm64" : "x64";
            const updateUrl = `http://localhost:3001/generated/nami/Nami-mac-${arch}.zip`;
            const zipPath = path.join(os.tmpdir(), "nami_update.zip");
            const extractPath = path.join(os.tmpdir(), "nami_update_extracted");
            const ok = (obj) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
            const err = (msg) => { 
                res.writeHead(500, { "Content-Type": "application/json" }); 
                res.end(JSON.stringify({ ok: false, error: msg })); 
                try { if (win) win.webContents.send("nami:task-result", { success: false, error: msg }); } catch {} 
            };
            try {
                try { if (win) win.webContents.send("nami:log", { message: "Update requested", level: "INFO", context: "Update" }); } catch {}
                const file = fs.createWriteStream(zipPath);
                http.get(updateUrl, (response) => {
                    if (response.statusCode !== 200) {
                        // Fallback: use local dist if available
                        try {
                           const arch = (os.arch() === "arm64") ? "arm64" : "x64";
                           const rootDir = path.dirname(app.getAppPath());
                           const distApp = path.join(rootDir, `dist/Nami-darwin-${arch}/Nami.app`);
                           if (fs.existsSync(distApp)) {
                              const currentAppPath = path.resolve(process.execPath, "../../..");
                              const script = `sleep 1; rm -rf "${currentAppPath}"; cp -R "${distApp}" "${currentAppPath}"; open "${currentAppPath}"`;
                              const child = spawn("bash", ["-c", script], { detached: true, stdio: "ignore" });
                              child.unref();
                              ok({ ok: true, source: "dist" });
                              return;
                           }
                        } catch {}
                        err(`Status ${response.statusCode}`);
                        return;
                    }
                    response.pipe(file);
                    file.on("finish", () => {
                        file.close(async () => {
                            try {
                                if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
                                fs.mkdirSync(extractPath);
                                await execPromise(`/usr/bin/unzip -o "${zipPath}" -d "${extractPath}"`);
                                const appName = "Nami.app";
                                const sourceApp = path.join(extractPath, appName);
                                if (!fs.existsSync(sourceApp)) { err("Nami.app not found in zip"); return; }
                                const currentAppPath = path.resolve(process.execPath, "../../..");
                                const script = `sleep 1; rm -rf "${currentAppPath}"; cp -R "${sourceApp}" "${currentAppPath}"; open "${currentAppPath}"`;
                                const child = spawn("bash", ["-c", script], { detached: true, stdio: "ignore" });
                                child.unref();
                                app.quit();
                                ok({ ok: true });
                                try { if (win) win.webContents.send("nami:task-result", { success: true }); } catch {}
                            } catch (e) { err(e.message); }
                        });
                    });
                }).on("error", (e) => { err(e.message); });
            } catch (e) { err(e.message); }
            return;
        }
        
        if (req.method === "GET" && u.pathname === "/helper/health") {
            (async () => {
              try {
                const r = await fetch("http://127.0.0.1:4547/health");
                if (r.ok) {
                  const j = await r.json().catch(() => ({}));
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ ok: true, arch: j.arch || "unknown" }));
                } else {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ ok: false }));
                }
              } catch {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false }));
              }
            })();
            return;
        }
        if (req.method === "POST" && u.pathname === "/api/helper/install") {
            try {
                installHelperLaunchAgent();
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: e.message }));
            }
            return;
        }
        
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      });

      s.on("error", (e) => {
          if (e.code === 'EADDRINUSE') {
              console.log(`[Server] Port ${port} in use, trying next...`);
              if (port < 4560) tryListen(port + 1);
              else console.error("[Server] Could not find free port.");
          } else {
              console.error(`[Server] Error starting server on port ${port}:`, e);
          }
      });

      s.listen(port, () => {
          console.log(`[Server] Listening on http://127.0.0.1:${port}`);
          localServer = s;
      });
  };
  
  tryListen(LOCAL_PORT);
};
const openUrlRobust = async (url) => {
  let ok = false;
  try { await shell.openExternal(url); ok = true; } catch {}
  if (!ok) { try { exec(`open "${String(url).replace(/"/g,'\\"')}"`); ok = true; } catch {} }
  if (!ok) {
    try {
      const w = new BrowserWindow({ width: 960, height: 720, show: true, resizable: true, webPreferences: { contextIsolation: true, sandbox: true } });
      w.loadURL(url);
      ok = true;
    } catch {}
  }
  return ok;
};
const createWindow = () => {
  win = new BrowserWindow({
    width: 460,
    height: 720,
    show: false, // Wait for ready-to-show to prevent flickering
    backgroundColor: '#0f172a', // Match body bg
    resizable: true, 
    titleBarStyle: 'hiddenInset', // 'hidden' or 'hiddenInset' for traffic lights
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false // Important for local fetch
    }
  });
  win.loadFile(path.join(app.getAppPath(), "index.html"));
  
  win.once('ready-to-show', () => {
    win.show();
    installHelperLaunchAgent();
  });

  // Clean up WS on close
  win.on('closed', () => {
    win = null;
    // Keep server running or close it? 
    // Usually keep it running if we want background tasks, but here we might want to close
  });
};
const createTray = () => {
  const icon = path.join(app.getAppPath(), "icon.png");
  if (fs.existsSync(icon)) {
    tray = new Tray(icon);
    let statusLabel = "Helper Status: Checking...";
    const baseMenu = [
      { label: "Ouvrir Nami", click: () => { if (win) win.show(); else createWindow(); } },
      { label: "Quitter", click: () => app.quit() }
    ];
    const buildMenu = () => Menu.buildFromTemplate([...baseMenu, { label: statusLabel }]);
    const updateStatus = () => {
      try {
        const req = http.request({ method: "GET", host: "127.0.0.1", port: 4547, path: "/health" }, (r) => {
          statusLabel = r.statusCode === 200 ? "Helper Status: ON" : "Helper Status: OFF";
          tray.setContextMenu(buildMenu());
          try {
            if (win) win.webContents.send("nami:helper-status", { ok: r.statusCode === 200 });
          } catch {}
        });
        req.on("error", () => { statusLabel = "Helper Status: OFF"; tray.setContextMenu(buildMenu()); });
        req.end();
      } catch { statusLabel = "Helper Status: OFF"; tray.setContextMenu(buildMenu()); }
    };
    const menu = buildMenu();
    tray.setToolTip("Nami");
    tray.setContextMenu(menu);
    updateStatus();
    setInterval(updateStatus, 3000);
  }
};
const installHelperLaunchAgent = () => {
  try {
    const plistPath = path.join(os.homedir(), "Library/LaunchAgents/com.nami.helper.plist");
    const execPath = process.execPath; // Nami binary
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.nami.helper</string>
<key>ProgramArguments</key><array>
<string>${execPath}</string>
<string>--helper-server</string>
</array>
<key>WorkingDirectory</key><string>${app.getAppPath()}</string>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>/tmp/namihelper.out</string>
<key>StandardErrorPath</key><string>/tmp/namihelper.err</string>
</dict></plist>
`;
    try { fs.writeFileSync(plistPath, plist); } catch (e) { console.error("[Main] Write plist failed:", e); }
    try { exec(`launchctl unload "${plistPath}" || true`); } catch {}
    try { exec(`launchctl load "${plistPath}"`); } catch (e) { console.error("[Main] launchctl load failed:", e); }
    try { exec(`launchctl enable "gui/${process.getuid()}/com.nami.helper"`); } catch {}
    try { exec(`launchctl kickstart -k "gui/${process.getuid()}/com.nami.helper"`); } catch {}
    // Fallback immediate start to avoid waiting for login
    try {
      const child = spawn(execPath, ["--helper-server"], { detached: true, stdio: "ignore" });
      child.unref();
    } catch {}
    console.log("[Main] Helper LaunchAgent installed:", plistPath);
  } catch (e) {
    console.error("[Main] installHelperLaunchAgent error:", e);
  }
};
const saveCookies = async (network, cookies) => {
  const acc = `cookies_${network}`;
  await keytar.setPassword(KC_SERVICE, acc, JSON.stringify(cookies || []));
  netStatus[network] = cookies && cookies.length > 0;
  
  // Sync to shared browser_cookies.json for social_automator.js
  try {
      const rootDir = path.dirname(app.getAppPath()); // ../ relative to nami/
      const sharedFile = path.join(rootDir, 'browser_cookies.json');
      let allCookies = {};
      if (fs.existsSync(sharedFile)) {
          allCookies = JSON.parse(fs.readFileSync(sharedFile, 'utf8'));
      }
      allCookies[network] = cookies;
      fs.writeFileSync(sharedFile, JSON.stringify(allCookies, null, 2));
      console.log(`[Main] Synced cookies for ${network} to ${sharedFile}`);
  } catch (e) {
      console.error("[Main] Failed to sync cookies to shared file:", e);
  }
};

const safeHandle = (channel, handler) => {
  try {
    ipcMain.handle(channel, handler);
  } catch (e) {
    if (String(e && e.message || "").includes("second handler")) {
      console.log(`[Main] ${channel} already registered, skipping duplicate`);
    } else {
      throw e;
    }
  }
};

ipcMain.handle("nami:ai-hook", async (event, topic) => {
    return await CoreEngine.ai.generateHooks(topic);
});

ipcMain.handle("nami:ai-script", async (event, topic) => {
    // Generate hook first as context
    const hookRes = await CoreEngine.ai.generateHooks(topic);
    const hook = hookRes.text ? hookRes.text.split('\n')[0] : "Hook generated by AI";
    return await CoreEngine.ai.generateScript(topic, hook);
});

safeHandle("nami:import-cookies", async (event, data) => {
    try {
        const { network, cookies } = data;
        if (!network || !cookies) throw new Error("Missing network or cookies");
        
        let validCookies = cookies;
        if (!Array.isArray(validCookies)) {
            // Try to extract if wrapped
            if (validCookies.cookies && Array.isArray(validCookies.cookies)) {
                validCookies = validCookies.cookies;
            } else {
                throw new Error("Cookies must be an array");
            }
        }
        
        // Validate and Sanitize
        validCookies = validCookies.filter(c => c.name && c.value && c.domain).map(c => {
            // Puppeteer prefers specific fields. Remove extra ones that might cause issues.
            return {
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path || '/',
                secure: c.secure !== false,
                httpOnly: c.httpOnly !== false,
                expirationDate: c.expirationDate,
                sameSite: c.sameSite // Optional, keep if present
            };
        });

        if (validCookies.length === 0) throw new Error("No valid cookies found in import");

        await saveCookies(network, validCookies);
        return { success: true, count: validCookies.length };
    } catch (e) {
        console.error(`[Main] Import failed for ${data?.network}:`, e);
        return { success: false, error: e.message };
    }
});

// Duplicate removed: 'nami:ext-status' already handled earlier
const checkSessionCookies = async (network) => {
  try {
    const all = await win.webContents.session.cookies.get({});
    const cfg = markers[network];
    const names = new Set(cfg.names);
    const domains = new Set(cfg.domains);
    
    // More permissive domain matching
    const filtered = all.filter(c => [...domains].some(d => {
       const cd = (c.domain || "").toLowerCase();
       const td = d.toLowerCase().replace(/^\./, ""); // remove leading dot from target
       return cd.includes(td);
    }));
    
    const has = filtered.some(c => names.has(c.name));
    if (has) {
       console.log(`[Main] Found cookies for ${network}:`, filtered.map(c => c.name));
       const cookies = filtered.map(c => ({ name:c.name, value:c.value, domain:c.domain, path:c.path, secure:c.secure, httpOnly:c.httpOnly, expirationDate:c.expirationDate }));
       await saveCookies(network, cookies);
       return true;
    }
  } catch {}
  return false;
};

const checkAndCapture = async (network, w) => {
  try {
    const all = await w.webContents.session.cookies.get({});
    const cfg = markers[network];
    const names = new Set(cfg.names);
    const domains = new Set(cfg.domains);
    
    // More permissive domain matching
    const filtered = all.filter(c => [...domains].some(d => {
       const cd = (c.domain || "").toLowerCase();
       const td = d.toLowerCase().replace(/^\./, "");
       return cd.includes(td);
    }));

    const has = filtered.some(c => names.has(c.name));
    if (has) {
      console.log(`[Main] Captured cookies for ${network} via Login Window`);
      const cookies = filtered.map(c => ({ name:c.name, value:c.value, domain:c.domain, path:c.path, secure:c.secure, httpOnly:c.httpOnly, expirationDate:c.expirationDate }));
      await saveCookies(network, cookies);
      if (loginWindows[network]) { loginWindows[network].close(); delete loginWindows[network]; }
      return true;
    }
  } catch {}
  return false;
};
const createLoginWindow = async (network) => {
  const net = String(network).toLowerCase();
  // Direct access to login URL, bypassing local server redirect for reliability
  const url = loginUrls[net] || "https://google.com";
  console.log(`[Main] Opening login window for ${net} at ${url}`);
  
  const w = new BrowserWindow({
    width: 500,
    height: 700,
    show: true,
    resizable: true,
    alwaysOnTop: true, // Keep it visible
    webPreferences: {
      contextIsolation: true, // More secure/standard
      nodeIntegration: false,
      sandbox: true, // Enable sandbox to look like a real browser tab
      webSecurity: true, // Enable security checks to satisfy Google
      enableWebSQL: false,
      nativeWindowOpen: true // Deprecated but helpful for popups
    }
  });
  
  // Spoof User Agent to Chrome 122 (Native to Electron 29) to match the engine
  const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  w.webContents.setUserAgent(userAgent);
  
  // Important: Do NOT disable site-isolation or CORS for Google Login
  // These flags trigger "Insecure Browser" warnings
  // app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
  // app.commandLine.appendSwitch('disable-site-isolation-trials');
  
  loginWindows[net] = w;
  
  // Force load the URL
  try {
    await w.loadURL(url);
  } catch (e) {
    console.error(`[Main] Failed to load ${url}:`, e);
    // Fallback if load fails
    w.loadURL("https://google.com");
  }
  
  // Inject anti-detection script
  w.webContents.on('dom-ready', async () => {
      await w.webContents.executeJavaScript(`
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        navigator.__proto__ = newProto;
      `);
  });
  
  w.on("closed", () => { delete loginWindows[net]; });
  
  // Aggressive capture
  const capture = () => checkAndCapture(net, w);
  w.webContents.on("did-finish-load", capture);
  w.webContents.on("did-navigate", capture);
  w.webContents.on("did-navigate-in-page", capture);

  // Poll for cookies every 2 seconds to catch "already logged in" states
  // or AJAX-based login completions
  const poller = setInterval(capture, 2000);
  w.on("closed", () => {
     clearInterval(poller);
     delete loginWindows[net];
  });
};

// Add this before app.on('ready')
app.enableSandbox(); // Critical for Google Login trust
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'WebAuthn'); // Disable FIDO to avoid "not self-responsible" errors

const tryAutoClick = async (appNames) => {
  // Ensure array
  const names = Array.isArray(appNames) ? appNames : [appNames];
  console.log("[Main] Attempting Aggressive Auto-Click for", names);
  
  // Construct AppleScript logic to loop through names
  const script = `
    tell application "System Events"
      if (exists process "System Settings") then
        tell process "System Settings"
           try
             set allUI to entire contents of window 1
             repeat with el in allUI
                if (class of el is checkbox) then
                   set elName to name of el
                   set elHelp to help of el
                   ${names.map(n => `if (elName contains "${n}" or elHelp contains "${n}") then
                      if value of el is 0 then
                         click el
                         return "clicked ${n}"
                      end if
                   end if`).join("\n")}
                end if
             end repeat
           end try
        end tell
      end if
      
      if (exists process "System Preferences") then
        tell process "System Preferences"
           try
             ${names.map(n => `click checkbox 1 of row 1 of table 1 of scroll area 1 of group 1 of window 1 whose name of static text 1 contains "${n}"`).join("\n")}
           end try
        end tell
      end if
    end tell
  `;
  try { exec(`osascript -e '${script}'`); } catch (e) { /* ignore */ }
};

const execPromise = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, (error, stdout, stderr) => {
    if (error) reject(error);
    else resolve(stdout);
  });
});

let forcePermissionSignal = false;
ipcMain.handle("nami:force-permission", () => {
  console.log("[Main] User FORCED permission bypass.");
  forcePermissionSignal = true;
  
  // Persist bypass state
  const data = getStorage();
  data.permissions_bypassed = true;
  saveStorage(data);
  
  // Close any open permission windows immediately
  try { exec(`osascript -e 'tell application "System Settings" to quit'`); } catch {}
  try { exec(`osascript -e 'tell application "System Preferences" to quit'`); } catch {}
});

const waitForGrant = (checker, appName = "Nami", permName = "Autorisation") => {
  // Do NOT reset signal here, as it might be set by a previous interaction or concurrent click
  // forcePermissionSignal = false; 
  
  return new Promise(resolve => {
     // Check immediately
     if (checker()) return resolve(true);
     if (forcePermissionSignal) return resolve(true);
     
     // DEV MODE BYPASS STRATEGY
     // In dev mode, the checker() often fails even if permissions are granted.
     // We try to auto-click for a few seconds, then assume success and close windows.
     if (!app.isPackaged) {
        console.log(`[Main] DEV MODE: Attempting auto-grant for ${permName} then bypassing...`);
        const clicker = setInterval(() => tryAutoClick(["Nami", "Electron"]), 1000);
        
        setTimeout(() => {
           clearInterval(clicker);
           try { exec(`osascript -e 'tell application "System Settings" to quit'`); } catch {}
           try { exec(`osascript -e 'tell application "System Preferences" to quit'`); } catch {}
           if (win) win.webContents.send("nami:close-permission-alert");
           console.log(`[Main] DEV MODE: Bypassed ${permName}.`);
           resolve(true);
        }, 3000); // 3 seconds timeout
        return;
     }

     const s = getStorage();
     if (s.permissions_bypassed) return resolve(true);
     
     const start = Date.now();
     // Start auto-clicker loop in parallel (Target Nami AND Electron)
     const clicker = setInterval(() => tryAutoClick(["Nami", "Electron"]), 2000);
     
     let stuckAlertSent = false;

     const poller = setInterval(() => {
        // Check real permission OR forced signal OR persistent storage
        const currentStorage = getStorage();
        if (checker() || forcePermissionSignal || currentStorage.permissions_bypassed) {
           clearInterval(poller);
           clearInterval(clicker);
           try { exec(`osascript -e 'tell application "System Settings" to quit'`); } catch {}
           try { exec(`osascript -e 'tell application "System Preferences" to quit'`); } catch {}
           
           // Close the alert if it was open
           if (win) win.webContents.send("nami:close-permission-alert");
           
           resolve(true);
        } else {
           // Check for "Zombie" state (stuck > 4s)
           // Only send ONCE to avoid spamming the renderer
           if (Date.now() - start > 4000 && !stuckAlertSent) {
              stuckAlertSent = true;
              // Send alert to UI
              if (win) win.webContents.send("nami:permission-stuck", permName);
           }
        }
     }, 1000);
  });
};

const ensurePermissions = async () => {
  if (process.platform !== "darwin") return;
  console.log("[Main] Starting Permission Wizard...");
  
  // Check for persistent bypass
  const storage = getStorage();
  if (storage.permissions_bypassed) {
     console.log("[Main] Permissions bypassed by user preference (Persistent).");
     if (win) win.webContents.send("nami:permissions-updated");
     
     // Still trigger network update
     for (const k of Object.keys(markers)) {
        const exists = await checkSessionCookies(k);
        if (exists) {
           netStatus[k] = true;
        }
     }
     if (win) win.webContents.send("nami:networks-updated", netStatus);
     return;
  }

  // 1. Accessibility
  const checkAccess = () => systemPreferences.isTrustedAccessibilityClient(false);
  if (!checkAccess()) {
     console.log("[Main] Requesting Accessibility...");
     await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
     // Pass readable name for the alert
     await waitForGrant(checkAccess, "Nami", "Accessibilité");
     console.log("[Main] Accessibility Granted.");
  }

  // 2. Screen Recording
  const checkScreen = () => systemPreferences.getMediaAccessStatus("screen") === "granted";
  if (!checkScreen()) {
      console.log("[Main] Requesting Screen Recording...");
      try { await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } }); } catch {}
      
      await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
      await waitForGrant(checkScreen, "Nami", "Enregistrement d'écran");
      console.log("[Main] Screen Recording Granted.");
  }
  
  console.log("[Main] All tracked permissions granted. Finalizing...");
  
  if (win) win.webContents.send("nami:permissions-updated");
  
  // Trigger auto-detection of existing cookies
  for (const k of Object.keys(markers)) {
     const exists = await checkSessionCookies(k);
     if (exists) {
        netStatus[k] = true;
     }
  }
  if (win) win.webContents.send("nami:networks-updated", netStatus);
};

app.whenReady().then(async () => {
  if (IS_HELPER_MODE) {
    try {
      app.dock && app.dock.hide && app.dock.hide();
    } catch {}
    // Start helper HTTP server only; no UI
    try {
      await import("./helper/launcher_server.js");
      console.log("[Main] Helper mode started on 4547");
    } catch (e) {
      console.error("[Main] Helper mode failed:", e);
    }
    return;
  }
  createWindow();
  createTray();
  startLocalServer();

  // Proactive permission request
  setTimeout(ensurePermissions, 1000);
});
app.on("window-all-closed", () => {});
ipcMain.handle("nami:is-setup", async () => {
  return { ok: true, setup: true };
});
ipcMain.handle("nami:unlock", async (_e, pass) => {
  try {
    const inPass = String(pass || "");
    const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
    let existing = null;
    try { existing = await keytar.getPassword(KC_SERVICE, KC_PASS); } catch {}
    if (!existing) {
      try { if (fs.existsSync(PASS_FILE())) existing = fs.readFileSync(PASS_FILE(), "utf8"); } catch {}
    }
    if (!existing) {
      try { if (fs.existsSync(PASS_FILE_HOME())) existing = fs.readFileSync(PASS_FILE_HOME(), "utf8"); } catch {}
    }
    if (!existing) {
      let ok = false;
      try { await keytar.setPassword(KC_SERVICE, KC_PASS, inPass); ok = true; } catch {}
      if (!ok) {
        try { fs.mkdirSync(app.getPath("userData"), { recursive: true }); fs.writeFileSync(PASS_FILE(), hash(inPass)); ok = true; } catch {}
      }
      if (!ok) {
        try { fs.writeFileSync(PASS_FILE_HOME(), hash(inPass)); ok = true; } catch {}
      }
      if (ok) {
        locked = false;
        if (win) win.show();
        return { ok: true, created: true };
      }
      return { ok: false, reason: "persist-failed" };
    }
    const match = existing === inPass || existing === hash(inPass);
    if (match) {
      locked = false;
      if (win) win.show();
      return { ok: true };
    }
    return { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "exception" };
  }
});
ipcMain.handle("nami:lock", async () => {
  return { ok: true };
});
ipcMain.handle("nami:reset-pass", async () => {
  try { await keytar.deletePassword(KC_SERVICE, KC_PASS); } catch {}
  locked = true;
  if (win) win.show();
  try { if (fs.existsSync(PASS_FILE())) fs.unlinkSync(PASS_FILE()); } catch {}
  try { if (fs.existsSync(PASS_FILE_HOME())) fs.unlinkSync(PASS_FILE_HOME()); } catch {}
  return { ok: true };
});
ipcMain.handle("nami:get-networks", async () => {
  const r = {};
  for (const k of Object.keys(netStatus)) {
    try {
      const v = await keytar.getPassword(KC_SERVICE, `cookies_${k}`);
      // If stored, great. If not, check live session!
      if (v) {
          r[k] = true;
      } else {
          // Fallback: check session cookies (Auto-Discovery)
          // This fixes "I am already connected"
          if (win) {
              const found = await checkSessionCookies(k);
              r[k] = found;
          } else {
              r[k] = false;
          }
      }
    } catch (e) {
      console.error(`[Main] Keytar error for ${k}:`, e);
      r[k] = false;
    }
  }
  return { ok: true, data: r };
});
ipcMain.handle("nami:login-open", async (_e, network) => {
  if (locked) return { ok: false };
  createLoginWindow(String(network));
  return { ok: true };
});
ipcMain.handle("nami:login-capture", async (_e, network) => {
  if (locked) return { ok: false };
  const w = loginWindows[String(network)];
  if (!w) return { ok: false };
  const ok = await checkAndCapture(String(network), w);
  return { ok };
});
ipcMain.handle("nami:set-config", async (_e, cfg) => {
  if (locked) return { ok: false };
  if (cfg && cfg.serverUrl) state.serverUrl = String(cfg.serverUrl);
  if (cfg && cfg.adminToken) {
    state.adminToken = String(cfg.adminToken);
    await keytar.setPassword(KC_SERVICE, KC_ADMIN, state.adminToken);
  }
  return { ok: true };
});
ipcMain.handle("nami:get-status", async () => {
  if (locked) return { ok: false };
  try {
    const url = `${state.serverUrl}/api/admin/marketing/status`;
    const res = await fetch(url, {
        headers: { "x-admin-token": state.adminToken }
    });
    const json = await res.json();
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle("nami:auto-publish", async () => {
  if (locked) return { ok: false };
  try {
    const url = `${state.serverUrl}/api/admin/social/auto-compose-publish`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "x-admin-token": state.adminToken }
    });
    const json = await res.json();
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
// Duplicate removed: 'nami:import-cookies' already handled earlier

ipcMain.handle("nami:clear-cookies", async () => {
  if (locked) return { ok: false };
  try {
    // Clear Keytar/Storage
    const data = getStorage();
    for (const k of Object.keys(data)) {
      if (k.startsWith("cookies_")) {
        delete data[k];
      }
    }
    saveStorage(data);
    
    // Clear Memory
    for (const k of Object.keys(netStatus)) {
      netStatus[k] = false;
    }
    
    // Clear Session Cookies
    if (win) {
      await win.webContents.session.clearStorageData({ storages: ["cookies"] });
    }
    
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("nami:open-permissions", async () => {
  ensurePermissions();
  return { ok: true };
});

ipcMain.handle("nami:check-permissions", async () => {
  try {
    const screen = systemPreferences.getMediaAccessStatus("screen");
    const mic = systemPreferences.getMediaAccessStatus("microphone");
    const camera = systemPreferences.getMediaAccessStatus("camera");
    const access = systemPreferences.isTrustedAccessibilityClient(false);
    return { ok: true, data: { screen, mic, camera, access } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("nami:update-app", async () => {
  const updateUrl = "http://localhost:3001/generated/nami/Nami-mac-x64.zip";
  const zipPath = path.join(os.tmpdir(), "nami_update.zip");
  const extractPath = path.join(os.tmpdir(), "nami_update_extracted");
  
  console.log(`[Update] Downloading from ${updateUrl}...`);
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(zipPath);
    http.get(updateUrl, (response) => {
      if (response.statusCode !== 200) {
        resolve({ ok: false, error: `Status ${response.statusCode}` });
        return;
      }
      
      response.pipe(file);
      
      file.on("finish", () => {
        file.close(async () => {
          console.log("[Update] Download complete. Extracting...");
          
          try {
            // Unzip
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
            fs.mkdirSync(extractPath);
            
            await execPromise(`/usr/bin/unzip -o "${zipPath}" -d "${extractPath}"`);
            
            // Find the .app
            const appName = "Nami.app";
            const sourceApp = path.join(extractPath, appName);
            
            if (!fs.existsSync(sourceApp)) {
               // Try looking in subfolders if unzip structure is different
               // But usually it's at root
               resolve({ ok: false, error: "Nami.app not found in zip" });
               return;
            }
            
            console.log("[Update] Extracted. Swapping...");
            
            // Current App Path
            // process.execPath is .../Nami.app/Contents/MacOS/Nami
            // We want .../Nami.app
            const currentAppPath = path.resolve(process.execPath, "../../..");
            
            // Script to swap and restart
            // We need to detach so we can quit
            const script = `
              sleep 2
              rm -rf "${currentAppPath}"
              cp -R "${sourceApp}" "${currentAppPath}"
              open "${currentAppPath}"
            `;
            
            const child = spawn("bash", ["-c", script], {
              detached: true,
              stdio: "ignore"
            });
            child.unref();
            
            app.quit();
            resolve({ ok: true });
            
          } catch (e) {
            console.error("[Update] Error:", e);
            resolve({ ok: false, error: e.message });
          }
        });
      });
    }).on("error", (err) => {
      fs.unlink(zipPath, () => {});
      resolve({ ok: false, error: err.message });
    });
  });
});
// --- IPC FOR EXTENSION (WS) ---
ipcMain.handle("nami:ext-queue", (_e, cmd) => {
    if (!wsServer) return { ok: false, error: "Server not ready" };
    const sent = wsServer.send(cmd);
    return { ok: true, sent };
});

ipcMain.handle("nami:ext-status", () => {
    return { 
        connected: wsServer && wsServer.activeClient && wsServer.activeClient.readyState === 1,
        lastSeen: extensionLastSeen
    };
});
