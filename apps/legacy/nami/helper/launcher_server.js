import http from "http";
import os from "os";
import fs from "fs";
import path from "path";
import { spawn, exec } from "child_process";
import { fileURLToPath } from "url";

const PORT = 4547;
const ZIP_URL_X64 = "http://localhost:3001/generated/nami/Nami-mac-x64.zip";
const ZIP_URL_ARM = "http://localhost:3001/generated/nami/Nami-mac-arm64.zip";

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const detectArch = () => {
  const arch = os.arch(); // 'x64' or 'arm64'
  return arch === "arm64" ? "arm64" : "x64";
};

const openNami = () => new Promise((resolve) => {
  const candidates = [
    "/Applications/Nami.app",
    path.join(process.cwd(), "dist/Nami-darwin-x64/Nami.app"),
    path.join(process.cwd(), "dist/Nami-darwin-arm64/Nami.app"),
    path.join(process.env.HOME || os.homedir(), "Applications/Nami.app")
  ];
  const target = candidates.find(p => fs.existsSync(p));
  if (!target) return resolve({ ok: false, error: "Nami.app introuvable" });
  try {
    exec(`open "${target.replace(/"/g, '\\"')}"`, (err) => {
      if (err) resolve({ ok: false, error: err.message });
      else resolve({ ok: true, path: target });
    });
  } catch (e) {
    resolve({ ok: false, error: e.message });
  }
});

const updateNami = () => new Promise((resolve) => {
  const arch = detectArch();
  const url = arch === "arm64" ? ZIP_URL_ARM : ZIP_URL_X64;
  const zipPath = path.join(os.tmpdir(), "nami_update.zip");
  const extractPath = path.join(os.tmpdir(), "nami_update_extracted");
  const distApp = path.join(process.cwd(), `dist/Nami-darwin-${arch}/Nami.app`);

  const file = fs.createWriteStream(zipPath);
  http.get(url, (response) => {
    if (response.statusCode !== 200) {
      // Fallback: copy from local dist if available
      if (fs.existsSync(distApp)) {
        (async () => {
          try {
            const dst = "/Applications/Nami.app";
            if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
            await new Promise((res, rej) => exec(`cp -R "${distApp}" "${dst}"`, (err) => err ? rej(err) : res()));
            // Read version
            const plist = path.join(distApp, "Contents", "Info.plist");
            let version = null;
            if (fs.existsSync(plist)) {
              await new Promise((res) => exec(`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plist}"`, (err, stdout) => { version = err ? null : String(stdout).trim(); res(); }));
            }
            resolve({ ok: true, installedAt: dst, arch, version, source: "dist" });
          } catch (e) {
            resolve({ ok: false, error: `Fallback dist échoué: ${e.message}` });
          }
        })();
      } else {
        resolve({ ok: false, error: `Téléchargement échoué: ${response.statusCode}` });
        return;
      }
    }
    response.pipe(file);
    file.on("finish", () => {
      file.close(async () => {
        try {
          if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
          fs.mkdirSync(extractPath);
          await new Promise((res, rej) => {
            exec(`/usr/bin/unzip -o "${zipPath}" -d "${extractPath}"`, (err) => err ? rej(err) : res());
          });
          const appSrc = path.join(extractPath, "Nami.app");
          if (!fs.existsSync(appSrc)) {
            resolve({ ok: false, error: "Nami.app manquant dans l’archive" });
            return;
          }
          const readVersion = (app) => new Promise((res) => {
            const plist = path.join(app, "Contents", "Info.plist");
            if (!fs.existsSync(plist)) return res(null);
            exec(`/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plist}"`, (err, stdout) => {
              if (err) {
                exec(`/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${plist}"`, (e2, out2) => {
                  if (e2) res(null); else res(String(out2).trim());
                });
              } else {
                res(String(stdout).trim());
              }
            });
          });
          const newVersion = await readVersion(appSrc);
          const dstCandidates = [
            "/Applications/Nami.app",
            path.join(process.env.HOME || os.homedir(), "Applications/Nami.app")
          ];
          // If installed and same version, report up-to-date
          for (const dst of dstCandidates) {
            if (fs.existsSync(dst)) {
              const curVersion = await readVersion(dst);
              if (newVersion && curVersion && newVersion === curVersion) {
                resolve({ ok: true, upToDate: true, version: newVersion, arch });
                return;
              }
            }
          }
          let copied = false, lastErr = null;
          for (const dst of dstCandidates) {
            try {
              if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
              await new Promise((res, rej) => {
                const cmd = `cp -R "${appSrc}" "${dst}"`;
                exec(cmd, (err) => err ? rej(err) : res());
              });
              copied = true;
              resolve({ ok: true, installedAt: dst, arch, version: newVersion });
              break;
            } catch (e) { lastErr = e; }
          }
          if (!copied) resolve({ ok: false, error: lastErr ? lastErr.message : "Copie échouée" });
        } catch (e) {
          resolve({ ok: false, error: e.message });
        }
      });
    });
  }).on("error", (e) => resolve({ ok: false, error: e.message }));
});

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, arch: detectArch() }));
    return;
  }
  if (req.method === "POST" && req.url === "/install") {
    try {
      const plistPath = path.join(os.homedir(), "Library/LaunchAgents/com.nami.helper.plist");
      const helperScript = fileURLToPath(import.meta.url);
      const envNode = "/usr/bin/env";
      const plist = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
        `<plist version="1.0"><dict>\n` +
        `<key>Label</key><string>com.nami.helper</string>\n` +
        `<key>ProgramArguments</key><array>\n` +
        `<string>${envNode}</string><string>node</string><string>${helperScript}</string>\n` +
        `</array>\n` +
        `<key>RunAtLoad</key><true/>\n` +
        `<key>KeepAlive</key><true/>\n` +
        `<key>StandardOutPath</key><string>/tmp/namihelper.out</string>\n` +
        `<key>StandardErrorPath</key><string>/tmp/namihelper.err</string>\n` +
        `</dict></plist>\n`;
      fs.writeFileSync(plistPath, plist);
      try { exec(`launchctl unload "${plistPath}" || true`); } catch {}
      await new Promise((resolve) => exec(`launchctl load "${plistPath}"`, () => resolve()));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }
  if (req.method === "POST" && req.url === "/launch") {
    const r = await openNami();
    res.writeHead(r.ok ? 200 : 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
    return;
  }
  if (req.method === "POST" && req.url === "/update") {
    const r = await updateNami();
    res.writeHead(r.ok ? 200 : 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`[NamiHelper] Listening on http://127.0.0.1:${PORT}`);
});
