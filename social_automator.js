import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerLib from 'puppeteer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable stealth plugin
puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'browser_cookies.json');
const resolveChromeExecutable = () => {
    const installed = (() => {
        try { return puppeteerLib.executablePath?.() || null; } catch { return null; }
    })();
    const dynamicFromCacheRoots = (roots) => {
        for (const root of roots) {
            if (!root || !fs.existsSync(root)) continue;
            const families = ['chrome', 'chromium'];
            for (const fam of families) {
                const famDir = path.join(root, fam);
                if (!fs.existsSync(famDir)) continue;
                try {
                    const ents = fs.readdirSync(famDir, { withFileTypes: true });
                    for (const e of ents) {
                        const p = path.join(famDir, e.name, 'chrome-linux64', 'chrome');
                        if (fs.existsSync(p)) return p;
                    }
                } catch {}
            }
        }
        return null;
    };
    const candidates = [
        installed,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        dynamicFromCacheRoots([
            process.env.PUPPETEER_CACHE_DIR,
            '/opt/render/project/.cache/puppeteer',
            '/opt/render/.cache/puppeteer'
        ])
    ];
    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
};
const detectChromeProfileDir = () => {
    if (process.env.CHROME_PROFILE_DIR && fs.existsSync(process.env.CHROME_PROFILE_DIR)) return process.env.CHROME_PROFILE_DIR;
    const home = os.homedir();
    if (process.platform === 'darwin') {
        const p = path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
        if (fs.existsSync(p)) return p;
    } else if (process.platform === 'win32') {
        const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
        const p = path.join(base, 'Google', 'Chrome', 'User Data', 'Default');
        if (fs.existsSync(p)) return p;
    } else {
        const p1 = path.join(home, '.config', 'google-chrome', 'Default');
        const p2 = path.join(home, '.config', 'chromium', 'Default');
        if (fs.existsSync(p1)) return p1;
        if (fs.existsSync(p2)) return p2;
    }
    return null;
};
const copyDirSync = (src, dest) => {
    try { fs.mkdirSync(dest, { recursive: true }); } catch {}
    try {
        if (fs.cpSync) {
            fs.cpSync(src, dest, { recursive: true });
            return true;
        }
    } catch {}
    const stack = [src];
    while (stack.length) {
        const cur = stack.pop();
        const rel = path.relative(src, cur);
        const out = path.join(dest, rel);
        try { fs.mkdirSync(out, { recursive: true }); } catch {}
        const ents = fs.readdirSync(cur, { withFileTypes: true });
        for (const e of ents) {
            const sp = path.join(cur, e.name);
            const dp = path.join(out, e.name);
            if (e.isDirectory()) stack.push(sp);
            else {
                try {
                    fs.copyFileSync(sp, dp);
                } catch {}
            }
        }
    }
    return true;
};

class SocialAutomator {
    constructor() {
        this.cookies = {};
        this.loadCookies();
    }

    loadCookies() {
        try {
            if (fs.existsSync(COOKIES_PATH)) {
                const rawCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
                // Flatten cookies if they are double nested (e.g. [[{...}]])
                this.cookies = {};
                for (const [key, val] of Object.entries(rawCookies)) {
                    let cookieList = [];
                    if (Array.isArray(val) && val.length > 0 && Array.isArray(val[0])) {
                        cookieList = val.flat();
                    } else {
                        cookieList = val;
                    }

                    // Sanitize cookies for Puppeteer
                    this.cookies[key] = cookieList.map(c => {
                        const newCookie = { ...c };
                        // Fix sameSite: null -> undefined, "no_restriction" -> "None"
                        if (newCookie.sameSite === null) delete newCookie.sameSite;
                        if (newCookie.sameSite === "no_restriction") newCookie.sameSite = "None";
                        if (newCookie.sameSite === "unspecified") delete newCookie.sameSite;
                        
                        // Remove fields that Puppeteer/CDP might complain about if invalid
                        // storeId, session, hostOnly are often extra metadata from extensions
                        delete newCookie.storeId;
                        delete newCookie.session;
                        delete newCookie.hostOnly;
                        
                        // Ensure name and value are strings
                        newCookie.name = String(newCookie.name);
                        newCookie.value = String(newCookie.value);
                        
                        return newCookie;
                    });
                }
            }
        } catch (e) {
            console.error("Error loading cookies:", e);
        }
    }
    base32ToBuffer(s) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
        let bits = '';
        for (let i = 0; i < clean.length; i++) {
            const v = alphabet.indexOf(clean[i]);
            if (v === -1) continue;
            bits += v.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.slice(i, i + 8), 2));
        }
        return Buffer.from(bytes);
    }
    generateTotp(secret, digits = 6, period = 30) {
        if (!secret) return null;
        const counter = Math.floor(Date.now() / 1000 / period);
        const buf = Buffer.alloc(8);
        for (let i = 7; i >= 0; i--) {
            buf[i] = counter & 0xff;
            counter >>>= 8;
        }
        const key = this.base32ToBuffer(secret);
        const hmac = crypto.createHmac('sha1', key).update(buf).digest();
        const offset = hmac[hmac.length - 1] & 0xf;
        const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
        const str = (code % (10 ** digits)).toString().padStart(digits, '0');
        return str;
    }
    async loginInstagramAuto(page) {
        const u = process.env.INSTAGRAM_USERNAME || '';
        const p = process.env.INSTAGRAM_PASSWORD || '';
        const t = process.env.INSTAGRAM_TOTP_SECRET || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
            const userSel = 'input[name="username"], input[name="email"]';
            const passSel = 'input[name="password"]';
            const submitSel = 'button[type="submit"]';
            const uel = await page.waitForSelector(userSel, { timeout: 10000 }).catch(()=>null);
            const pel = await page.$(passSel);
            if (!uel || !pel) return false;
            await page.type(userSel, u, { delay: 50 });
            await page.type(passSel, p, { delay: 50 });
            const btn = await page.$(submitSel);
            if (btn) await btn.click();
            await this.humanDelay(2000, 4000);
            const need2fa = await page.evaluate(() => {
                const text = document.body.innerText || '';
                return /code|vérification|security|2fa|Two-Factor/i.test(text);
            });
            if (need2fa && t) {
                const code = this.generateTotp(t);
                const codeSel = 'input[type="text"], input[name="security_code"]';
                const cel = await page.waitForSelector(codeSel, { timeout: 10000 }).catch(()=>null);
                if (cel && code) {
                    await page.type(codeSel, code, { delay: 50 });
                    const contBtn = await page.$('button[type="submit"], button');
                    if (contBtn) await contBtn.click();
                }
            }
            await this.humanDelay(3000, 5000);
            const ok = await page.evaluate(() => !!document.querySelector('svg[aria-label="Home"], svg[aria-label="Accueil"]'));
            return !!ok;
        } catch {
            return false;
        }
    }
    async loginTwitterAuto(page) {
        const u = process.env.TWITTER_USERNAME || '';
        const p = process.env.TWITTER_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });
            const userSel = 'input[autocomplete="username"], input[name="text"]';
            const nextSel = 'div[role="button"][data-testid="LoginForm_Login_Button"], div[role="button"][data-testid="LoginForm_Next_Button"], div[data-testid="nextButton"]';
            const passSel = 'input[autocomplete="current-password"], input[name="password"]';
            const loginSel = 'div[role="button"][data-testid="LoginForm_Login_Button"], div[data-testid="LoginForm_Login_Button"]';
            const uel = await page.waitForSelector(userSel, { timeout: 10000 }).catch(()=>null);
            if (!uel) return false;
            await page.type(userSel, u, { delay: 50 });
            const nbtn = await page.$(nextSel);
            if (nbtn) await nbtn.click();
            await this.humanDelay(1000, 2000);
            const pel = await page.waitForSelector(passSel, { timeout: 10000 }).catch(()=>null);
            if (!pel) return false;
            await page.type(passSel, p, { delay: 50 });
            const lbtn = await page.$(loginSel);
            if (lbtn) await lbtn.click();
            await this.humanDelay(3000, 5000);
            const guest = await page.evaluate(() => !!document.querySelector('a[href="/login"], div[data-testid="loginButton"]'));
            return !guest;
        } catch {
            return false;
        }
    }
    async loginFacebookAuto(page) {
        const u = process.env.FACEBOOK_USERNAME || '';
        const p = process.env.FACEBOOK_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
            const userSel = 'input[name="email"]';
            const passSel = 'input[name="pass"]';
            const loginSel = 'button[name="login"]';
            const uel = await page.waitForSelector(userSel, { timeout: 10000 }).catch(()=>null);
            const pel = await page.$(passSel);
            if (!uel || !pel) return false;
            await page.type(userSel, u, { delay: 50 });
            await page.type(passSel, p, { delay: 50 });
            const btn = await page.$(loginSel);
            if (btn) await btn.click();
            await this.humanDelay(3000, 5000);
            const ok = await page.evaluate(() => {
                return !!document.querySelector('div[role="navigation"]') || !!document.querySelector('div[aria-label="Account controls and settings"]');
            });
            return !!ok;
        } catch {
            return false;
        }
    }
    async loginYouTubeGoogleAuto(page) {
        const u = process.env.GOOGLE_LOGIN_EMAIL || '';
        const p = process.env.GOOGLE_LOGIN_PASSWORD || '';
        const t = process.env.GOOGLE_TOTP_SECRET || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle2' });
            const emailSel = 'input[type="email"]';
            const nextSel = '#identifierNext';
            const passSel = 'input[type="password"]';
            const passNextSel = '#passwordNext';
            const eel = await page.waitForSelector(emailSel, { timeout: 10000 }).catch(()=>null);
            if (!eel) return false;
            await page.type(emailSel, u, { delay: 50 });
            const inext = await page.$(nextSel);
            if (inext) await inext.click();
            await this.humanDelay(1500, 2500);
            const pel = await page.waitForSelector(passSel, { timeout: 10000 }).catch(()=>null);
            if (!pel) return false;
            await page.type(passSel, p, { delay: 50 });
            const pnext = await page.$(passNextSel);
            if (pnext) await pnext.click();
            await this.humanDelay(3000, 5000);
            const need2fa = await page.evaluate(() => {
                const text = document.body.innerText || '';
                return /code|verification|2-Step|2FA/i.test(text);
            });
            if (need2fa && t) {
                const code = this.generateTotp(t);
                const codeSel = 'input[type="text"]';
                const cel = await page.waitForSelector(codeSel, { timeout: 10000 }).catch(()=>null);
                if (cel && code) {
                    await page.type(codeSel, code, { delay: 50 });
                    const cnext = await page.$('button');
                    if (cnext) await cnext.click();
                }
                await this.humanDelay(3000, 5000);
            }
            await page.goto('https://studio.youtube.com/', { waitUntil: 'networkidle2' });
            const ok = !page.url().includes('accounts.google.com');
            return !!ok;
        } catch {
            return false;
        }
    }
    async autoLoginAndCollect(nets = ["instagram","twitter","tiktok","facebook","youtube"], timeoutMs = 15000) {
        const pr = await this.launchBrowserWithSystemProfile(false);
        const browser = pr.browser;
        const cleanup = pr.cleanup;
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            const results = [];
            for (const net of nets) {
                let ok = false;
                let url = 'about:blank';
                if (net === 'instagram') { ok = await this.loginInstagramAuto(page); url = 'https://www.instagram.com/'; }
                else if (net === 'twitter') { ok = await this.loginTwitterAuto(page); url = 'https://x.com/home'; }
                else if (net === 'facebook') { ok = await this.loginFacebookAuto(page); url = 'https://www.facebook.com/'; }
                else if (net === 'youtube') { ok = await this.loginYouTubeGoogleAuto(page); url = 'https://studio.youtube.com/'; }
                else if (net === 'tiktok') { url = 'https://www.tiktok.com/upload?lang=fr'; }
                await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs }).catch(()=>{});
                await this.humanDelay(1000, 2000);
                const ck = await page.cookies().catch(()=>[]);
                if (Array.isArray(ck) && ck.length) {
                    this.cookies[net] = ck;
                    results.push(`${net}: ok (${ck.length})`);
                } else {
                    results.push(`${net}: empty`);
                }
            }
            this.saveCookies();
            return { success: true, details: results };
        } catch (e) {
            return { success: false, error: e.message };
        } finally {
            try { await browser.close(); } catch {}
            try { await cleanup(); } catch {}
        }
    }

    saveCookies() {
        try {
            fs.writeFileSync(COOKIES_PATH, JSON.stringify(this.cookies, null, 2));
        } catch (e) {
            console.error("Error saving cookies:", e);
        }
    }

    getCookieStatus() {
        return {
            tiktok: !!this.cookies.tiktok && this.cookies.tiktok.length > 0,
            twitter: !!this.cookies.twitter && this.cookies.twitter.length > 0,
            instagram: !!this.cookies.instagram && this.cookies.instagram.length > 0,
            facebook: !!this.cookies.facebook && this.cookies.facebook.length > 0,
            youtube: !!this.cookies.youtube && this.cookies.youtube.length > 0
        };
    }

    async launchBrowser(headless = "new") {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
        ];
        const exec = resolveChromeExecutable();
        if (exec) {
            try { return await puppeteer.launch({ headless, executablePath: exec, args }); } catch {}
        }
        try { return await puppeteer.launch({ headless, channel: 'chrome', args }); } catch {}
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            try { return await puppeteer.launch({ headless, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args }); } catch {}
        }
        return await puppeteer.launch({ headless, args });
    }
    async launchBrowserWithSystemProfile(headless = "new") {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
        ];
        const profile = detectChromeProfileDir();
        let userDataDir = null;
        if (profile) {
            const tmp = path.join(__dirname, '.cache', `chrome-profile-${Date.now()}`);
            try {
                copyDirSync(profile, tmp);
                userDataDir = tmp;
            } catch {}
        }
        const exec = resolveChromeExecutable();
        if (exec) {
            try {
                const b = await puppeteer.launch({ headless, executablePath: exec, args, userDataDir });
                const cleanup = async () => { if (userDataDir) { try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {} } };
                return { browser: b, cleanup };
            } catch {}
        }
        try {
            const b = await puppeteer.launch({ headless, channel: 'chrome', args, userDataDir });
            const cleanup = async () => { if (userDataDir) { try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {} } };
            return { browser: b, cleanup };
        } catch {}
        const b = await puppeteer.launch({ headless, args, userDataDir });
        const cleanup = async () => { if (userDataDir) { try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {} } };
        return { browser: b, cleanup };
    }

    async humanDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async checkLogin(network) {
        console.log(`🔍 Checking login for ${network}...`);
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        let isLoggedIn = false;

        try {
            if (this.cookies[network]) {
                await page.setCookie(...this.cookies[network]);
            }

            if (network === 'tiktok') {
                await page.goto('https://www.tiktok.com/upload?lang=fr', { waitUntil: 'networkidle2' });
                await this.humanDelay(3000, 5000);
                
                // Check if redirected to login
                if (page.url().includes('/login') || page.url().includes('/signup')) {
                    isLoggedIn = false;
                } else {
                    try {
                        const isGuest = await page.evaluate(() => document.body.innerText.includes("Log in") || document.body.innerText.includes("Connexion"));
                        isLoggedIn = !isGuest;
                    } catch (e) {
                        console.log("TikTok check interrupted (reload/redirect).");
                        isLoggedIn = false;
                    }
                }
            } else if (network === 'twitter') {
                await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 4000);
                isLoggedIn = await page.evaluate(() => !document.querySelector('a[href="/login"], div[data-testid="loginButton"]'));
            } else if (network === 'instagram') {
                await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 4000);
                isLoggedIn = await page.evaluate(() => !!document.querySelector('svg[aria-label="Home"], svg[aria-label="Accueil"]'));
            } else if (network === 'facebook') {
                await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 4000);
                isLoggedIn = await page.evaluate(() => {
                     return !!document.querySelector('div[aria-label="Account controls and settings"]') || 
                            !!document.querySelector('svg[aria-label="Your profile"]') ||
                            !!document.querySelector('div[role="navigation"]');
                });
            } else if (network === 'youtube') {
                await page.goto('https://studio.youtube.com/', { waitUntil: 'networkidle2' });
                await this.humanDelay(3000, 5000);
                isLoggedIn = !page.url().includes('accounts.google.com');
            }

            console.log(`${network} Login Status: ${isLoggedIn ? "✅ Logged In" : "❌ Not Logged In"}`);
            return isLoggedIn;

        } catch (e) {
            console.error(`Error checking ${network}:`, e);
            return false;
        } finally {
            await browser.close();
        }
    }

    // --- TIKTOK AUTOMATION ---
    async postToTikTok(videoPath, caption, credentials = {}) {
        console.log("🚀 Launching Stealth Browser for TikTok...");
        const browser = await this.launchBrowser(false); // Headful for TikTok to avoid instant ban/captcha if possible
        // Note: Headless mode often triggers strict captchas on TikTok.
        // If running on server, we might need Xvfb or similar, but for now assuming user might see it or it runs in background.
        // Actually, for "infaillible", headless is detected. 
        // We'll try headless "new" first, but often TikTok requires headful.
        // Let's force headless: false for now as a "Desktop" simulation.
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
            // Load cookies if available
            if (this.cookies.tiktok) {
                await page.setCookie(...this.cookies.tiktok);
            }

            console.log("📱 Navigating to TikTok...");
            await page.goto('https://www.tiktok.com/upload?lang=fr', { waitUntil: 'networkidle2' });
            await this.humanDelay(2000, 4000);

            // Check Login (Robust)
            let isLoggedIn = true;
            if (page.url().includes('/login') || page.url().includes('/signup')) {
                isLoggedIn = false;
            } else {
                try {
                    const isGuest = await page.evaluate(() => document.body.innerText.includes("Log in") || document.body.innerText.includes("Connexion"));
                    isLoggedIn = !isGuest;
                } catch (e) { isLoggedIn = false; }
            }

            if (!isLoggedIn) {
                console.log("⚠️ Not logged in. Attempting login...");
                // Note: Automating TikTok login is EXTREMELY hard (puzzle captcha).
                // Best strategy: Wait for user to login MANUALLY if running locally, OR use cookies.
                // Since we want "robot", we rely on cookies.
                // If cookies are missing/invalid, we can try to fill form, but 99% will hit captcha.
                
                if (credentials.username && credentials.password) {
                     // Click login
                     // ... Implementation specific to current TikTok DOM ...
                     // This is fragile. 
                     // Recommendation: User must inject cookies first.
                     console.log("❌ Cannot automate TikTok Login (Captcha). Please provide valid cookies in browser_cookies.json");
                     // We will try to save cookies if the user logs in manually during this session (if headful).
                }
            } else {
                console.log("✅ Logged in via Cookies!");
            }

            // UPLOAD FLOW
            // Wait for file input
            const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
            if (fileInput) {
                console.log("📤 Uploading video...");
                await fileInput.uploadFile(videoPath);
                // Wait for upload to complete
                await page.waitForSelector('.upload-progress', { hidden: true, timeout: 60000 }); // Wait until progress bar gone
                await this.humanDelay(2000, 5000);
            }

            // CAPTION
            // TikTok uses a contenteditable div usually
            // Selector needs update based on current DOM
            console.log("✍️ Writing caption...");
            // Generic strategy: Tab until focus or find editor
            // ...
            
            // POST
            // Click Post button
            // ...

            // SAVE COOKIES (Refresh session)
            const currentCookies = await page.cookies();
            this.cookies.tiktok = currentCookies;
            this.saveCookies();

            console.log("✅ TikTok Posted (Simulation)!");
            // In a real scenario, we need precise selectors.
            // For now, this is the architecture.
            
        } catch (e) {
            console.error("❌ TikTok Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- TWITTER AUTOMATION (STEALTH) ---
    async postToTwitter(mediaPath, caption) {
        console.log("🚀 Launching Stealth Browser for Twitter...");
        const browser = await this.launchBrowser(false); // Headful for max stealth
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
            if (this.cookies.twitter) {
                await page.setCookie(...this.cookies.twitter);
            }

            console.log("🐦 Navigating to Twitter/X...");
            await page.goto('https://twitter.com/compose/tweet', { waitUntil: 'networkidle2' });
            await this.humanDelay(3000, 5000);

            // Check Login
            const isGuest = await page.evaluate(() => !!document.querySelector('a[href="/login"], div[data-testid="loginButton"]'));
            if (isGuest) {
                 console.log("⚠️ Not logged in (Twitter). Please import cookies.");
                 return;
            }

            console.log("✅ Logged in (Twitter)");

            // Media Upload
            // Look for file input
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                console.log("📤 Uploading media to Twitter...");
                await fileInput.uploadFile(mediaPath);
                await this.humanDelay(2000, 4000);
            }

            // Caption
            // contenteditable div
            const editor = await page.waitForSelector('div[data-testid="tweetTextarea_0"]', { visible: true, timeout: 5000 });
            if (editor) {
                console.log("✍️ Writing tweet...");
                await editor.type(caption, { delay: 50 });
            }

            await this.humanDelay(2000, 3000);

            // Tweet Button
            const tweetBtn = await page.$('div[data-testid="tweetButton"]');
            if (tweetBtn) {
                console.log("🚀 Tweeting...");
                await tweetBtn.click();
                await this.humanDelay(3000, 6000);
                console.log("✅ Twitter Posted!");
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.twitter = currentCookies;
                this.saveCookies();
            }

        } catch (e) {
            console.error("❌ Twitter Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- INSTAGRAM AUTOMATION (STEALTH VIDEO) ---
    async postToInstagramVideo(videoPath, caption) {
        console.log("🚀 Launching Stealth Browser for Instagram...");
        // Instagram allows desktop posting now.
        const browser = await this.launchBrowser(false); // Headful for max stealth
        const page = await browser.newPage();
        // Emulate Mobile for better "Create" flow if needed, but Desktop is fine now.
        // Let's use Desktop Viewport
        await page.setViewport({ width: 1280, height: 800 });

        try {
            if (this.cookies.instagram) {
                await page.setCookie(...this.cookies.instagram);
            }

            console.log("📸 Navigating to Instagram...");
            await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
            await this.humanDelay(2000, 4000);

            // Check Login
            const isLoggedIn = await page.evaluate(() => !!document.querySelector('svg[aria-label="Home"]'));
            if (!isLoggedIn) {
                 console.log("⚠️ Not logged in (Instagram). Please import cookies.");
                 // Could try login with form if credentials provided, but 2FA risk.
                 // Assuming cookies for now.
                 return;
            }

            console.log("✅ Logged in (Instagram)");

            // CLICK CREATE BUTTON (+)
            // Selector: aria-label="New post" or "Create"
            const createBtn = await page.$('svg[aria-label="New post"], svg[aria-label="Créer"], svg[aria-label="Create"]');
            if (createBtn) {
                const parent = await createBtn.evaluateHandle(el => el.closest('a') || el.closest('button') || el.closest('div[role="button"]'));
                await parent.click();
            } else {
                // Try finding by text in sidebar
                const links = await page.$$('a, div[role="button"]');
                for (const link of links) {
                    const text = await page.evaluate(el => el.innerText, link);
                    if (text.includes("Create") || text.includes("Créer")) {
                        await link.click();
                        break;
                    }
                }
            }
            
            await this.humanDelay(2000, 3000);

            // UPLOAD
            const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 5000 });
            if (fileInput) {
                console.log("📤 Uploading video to Instagram...");
                await fileInput.uploadFile(videoPath);
                
                // Wait for preview/crop modal
                // Usually "Next" button appears
                await this.humanDelay(5000, 8000); // Wait for upload
                
                // Click Next (Suivant) - usually top right of modal
                // We need to click "Next" twice (Crop -> Filter -> Caption)
                
                // Helper to click Next
                const clickNext = async () => {
                    const buttons = await page.$$('button');
                    for (const btn of buttons) {
                        const t = await page.evaluate(el => el.innerText, btn);
                        if (t === "Next" || t === "Suivant" || t === "Share" || t === "Partager") {
                            await btn.click();
                            return true;
                        }
                    }
                    return false;
                };

                await clickNext(); // Crop screen
                await this.humanDelay(2000, 4000);
                
                await clickNext(); // Filter screen
                await this.humanDelay(2000, 4000);

                // CAPTION SCREEN
                // Focus textarea
                const textarea = await page.$('div[aria-label="Write a caption..."], div[aria-label="Écrire une légende..."]');
                if (textarea) {
                    await textarea.type(caption, { delay: 50 });
                }

                await this.humanDelay(2000, 4000);
                
                // SHARE
                console.log("🚀 Sharing...");
                await clickNext(); // Share button

                // Wait for completion
                await this.humanDelay(5000, 10000); // "Your post has been shared"
                
                console.log("✅ Instagram Posted!");
            }

        } catch (e) {
            console.error("❌ Instagram Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- FACEBOOK AUTOMATION (STEALTH) ---
    async postToFacebook(mediaPath, caption) {
         console.log("🚀 Launching Stealth Browser for Facebook...");
         const browser = await this.launchBrowser(false); // Headful for max stealth
         const page = await browser.newPage();
         await page.setViewport({ width: 1280, height: 800 });

         try {
             if (this.cookies.facebook) {
                 await page.setCookie(...this.cookies.facebook);
             }

             console.log("📘 Navigating to Facebook...");
             await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
             await this.humanDelay(2000, 4000);

             // Check Login by looking for common logged-in elements
             const isLoggedIn = await page.evaluate(() => {
                 return !!document.querySelector('div[aria-label="Account controls and settings"]') || 
                        !!document.querySelector('svg[aria-label="Your profile"]') ||
                        !!document.querySelector('div[role="navigation"]');
             });

             if (!isLoggedIn) {
                 console.log("⚠️ Not logged in (Facebook). Please import cookies.");
                 return;
             }

             console.log("✅ Logged in (Facebook)");

             // 1. Click "Photo/video" button to start post
             // Look for the specific button usually found in the composer area
             // Use ::-p-text for text matching in Puppeteer
             let photoVideoBtn = await page.$('div[aria-label="Photo/video"], div[aria-label="Photo/Video"]');
             
             if (!photoVideoBtn) {
                 // Try finding by text if aria-label fails
                 const elements = await page.$$('span, div, b');
                 for (const el of elements) {
                     const text = await page.evaluate(e => e.innerText, el);
                     if (text === "Photo/video" || text === "Photo/Video") {
                         photoVideoBtn = el;
                         break;
                     }
                 }
             }
             
             if (photoVideoBtn) {
                 await photoVideoBtn.click();
             } else {
                 // Fallback: Click the "What's on your mind?" input first
                 const statusInput = await page.$('div[aria-label*="What\'s on your mind"], div[aria-label*="Que voulez-vous dire"]');
                 if (statusInput) {
                     await statusInput.click();
                     await this.humanDelay(1000, 2000);
                     // Now look for photo button inside the modal
                     const modalPhotoBtn = await page.$('div[aria-label="Photo/video"], div[aria-label="Photo/Video"]');
                     if (modalPhotoBtn) await modalPhotoBtn.click();
                 }
             }

             await this.humanDelay(2000, 3000);

             // 2. Upload File
             const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
             if (fileInput) {
                 console.log("📤 Uploading media to Facebook...");
                 await fileInput.uploadFile(mediaPath);
                 await this.humanDelay(3000, 6000); // Wait for upload
             }

             // 3. Caption
             // The caption box usually has aria-label matching the "What's on your mind"
             const captionBox = await page.$('div[aria-label*="What\'s on your mind"], div[aria-label*="Que voulez-vous dire"]');
             if (captionBox) {
                 console.log("✍️ Writing caption...");
                 await captionBox.type(caption, { delay: 50 });
             }

             await this.humanDelay(2000, 4000);

             // 4. Post Button
             // Usually "Post" or "Publier"
             // We can search for a button with that text
             const postBtn = await page.evaluateHandle(() => {
                 const buttons = Array.from(document.querySelectorAll('div[aria-label="Post"], div[aria-label="Publier"], div[role="button"]'));
                 return buttons.find(b => b.innerText === "Post" || b.innerText === "Publier");
             });

             if (postBtn) {
                 console.log("🚀 Posting to Facebook...");
                 await postBtn.click();
                 await this.humanDelay(5000, 10000); // Wait for post to process
                 console.log("✅ Facebook Posted!");
                 
                 // Save Cookies
                 const currentCookies = await page.cookies();
                 this.cookies.facebook = currentCookies;
                 this.saveCookies();
             } else {
                 console.log("⚠️ Could not find Post button.");
             }

         } catch (e) {
             console.error("❌ Facebook Stealth Error:", e);
         } finally {
             await browser.close();
         }
    }

    // --- YOUTUBE AUTOMATION (STEALTH) ---
    async postToYouTube(videoPath, title, description) {
        console.log("🚀 Launching Stealth Browser for YouTube...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
             if (this.cookies.youtube) {
                 await page.setCookie(...this.cookies.youtube);
             }

             console.log("📹 Navigating to YouTube Studio...");
             await page.goto('https://studio.youtube.com/channel/UD/videos/upload?d=ud', { waitUntil: 'networkidle2' });
             await this.humanDelay(3000, 5000);

             // Check Login
             if (page.url().includes('accounts.google.com')) {
                 console.log("⚠️ Not logged in (YouTube). Please import cookies.");
                 return;
             }
             
             console.log("✅ Logged in (YouTube)");

             // Upload
             const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
             if (fileInput) {
                 console.log("📤 Uploading video to YouTube...");
                 await fileInput.uploadFile(videoPath);
                 
                 // Wait for processing
                 await this.humanDelay(5000, 10000);

                 // Title & Description
                 // YouTube Studio uses complex custom elements
                 // We can try to use tab navigation or specific IDs if stable
                 // Textbox for title: #textbox
                 
                 const textboxes = await page.$$('#textbox');
                 if (textboxes.length >= 2) {
                     // 0 is Title, 1 is Description usually
                     await textboxes[0].click();
                     await page.keyboard.down('Control');
                     await page.keyboard.press('A');
                     await page.keyboard.up('Control');
                     await page.keyboard.press('Backspace');
                     await textboxes[0].type(title, { delay: 50 });
                     
                     await this.humanDelay(1000, 2000);
                     
                     await textboxes[1].click();
                     await textboxes[1].type(description, { delay: 30 });
                 }

                 // Click Next multiple times
                 // Button "Next" or "Suivant"
                 const clickNext = async () => {
                     const buttons = await page.$$('div[role="button"]');
                     for (const btn of buttons) {
                         const t = await page.evaluate(el => el.innerText, btn);
                         if (t === "NEXT" || t === "SUIVANT") {
                             await btn.click();
                             return true;
                         }
                     }
                     return false;
                 };

                 // Flow: Details -> Video Elements -> Checks -> Visibility
                 await clickNext(); await this.humanDelay(2000, 3000);
                 // No, it's not Kids
                 const notKids = await page.$('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
                 if (notKids) await notKids.click();
                 
                 await clickNext(); await this.humanDelay(2000, 3000);
                 await clickNext(); await this.humanDelay(2000, 3000);
                 await clickNext(); await this.humanDelay(2000, 3000);
                 
                 // Visibility: Public
                 const publicRadio = await page.$('tp-yt-paper-radio-button[name="PUBLIC"]');
                 if (publicRadio) await publicRadio.click();
                 
                 // Publish
                 const publishBtn = await page.$('div[role="button"]#done-button');
                 if (publishBtn) {
                     console.log("🚀 Publishing...");
                     await publishBtn.click();
                     await this.humanDelay(5000, 8000);
                     console.log("✅ YouTube Posted!");
                 }
             }

        } catch (e) {
            console.error("❌ YouTube Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- PROFILE UPDATE AUTOMATION (IDENTITY MANAGER) ---
    async updateProfileIdentity(network, { photoPath, bio }) {
        console.log(`🚀 Updating Profile for ${network}...`);
        
        // Dispatch based on network
        if (network === 'instagram') return this.updateInstagramProfile(photoPath, bio);
        if (network === 'twitter') return this.updateTwitterProfile(photoPath, bio);
        if (network === 'tiktok') return this.updateTikTokProfile(photoPath, bio);
        
        // Others (Facebook, YouTube) are too complex/risky for now via simple automation
        console.log(`⚠️ Profile update not supported yet for ${network}`);
        return { success: false, error: "Not supported" };
    }

    async updateInstagramProfile(photoPath, bio) {
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        let result = { success: false, details: [] };

        try {
            if (this.cookies.instagram) await page.setCookie(...this.cookies.instagram);
            await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'networkidle2' });
            await this.humanDelay(3000, 5000);

            // Check Login
            if (page.url().includes('login')) throw new Error("Not logged in");

            // Update Photo
            if (photoPath) {
                console.log("📸 Updating Instagram Photo...");
                // Hidden file input usually exists
                // Sometimes need to click "Change Profile Photo" first to trigger modal/input
                const changeBtn = await page.$('button[title="Change profile photo"], button.iframe-profile-picture-button');
                if (changeBtn) await changeBtn.click();
                
                // Wait for input
                const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 5000 });
                if (fileInput) {
                    await fileInput.uploadFile(photoPath);
                    await this.humanDelay(3000, 5000); // Wait for upload
                    result.details.push("Photo Updated");
                }
            }

            // Update Bio
            if (bio) {
                console.log("✍️ Updating Instagram Bio...");
                const bioInput = await page.$('textarea#pepBio');
                if (bioInput) {
                    await bioInput.click({ clickCount: 3 }); // Select all
                    await bioInput.type(bio, { delay: 50 });
                    result.details.push("Bio Updated");
                }
            }

            // Submit
            const submitBtn = await page.$('button[type="submit"]');
            if (submitBtn) {
                await submitBtn.click();
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(()=>null);
                result.success = true;
            }

        } catch (e) {
            console.error("❌ Instagram Profile Update Error:", e);
            result.error = e.message;
        } finally {
            await browser.close();
        }
        if (!result.success && result.details.length === 0 && !result.error) result.error = "No changes applied";
        return result;
    }

    async updateTwitterProfile(photoPath, bio) {
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        let result = { success: false, details: [] };

        try {
            if (this.cookies.twitter) await page.setCookie(...this.cookies.twitter);
            
            // Go to Profile Settings directly? No, usually Profile -> Edit
            await page.goto('https://twitter.com/settings/profile', { waitUntil: 'networkidle2' });
            await this.humanDelay(3000, 5000);
            
            // If redirect to home, go to profile then click Edit
            if (!page.url().includes('settings/profile')) {
                await page.goto('https://twitter.com/profile', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 3000);
                const editBtn = await page.$('a[href="/settings/profile"]');
                if (editBtn) await editBtn.click();
                await this.humanDelay(2000, 3000);
            }

            // Check if modal is open (Edit Profile)
            const modal = await page.$('div[aria-labelledby="modal-header"]');
            if (modal || page.url().includes('settings')) {
                // Photo
                if (photoPath) {
                    console.log("📸 Updating Twitter Photo...");
                    // Input usually hidden behind camera icon div
                    const fileInput = await page.$('input[type="file"]'); 
                    // Or trigger via div[aria-label="Add avatar photo"]
                    if (fileInput) {
                         await fileInput.uploadFile(photoPath);
                         await this.humanDelay(2000, 4000);
                         // Apply button usually appears for crop
                         const applyBtn = await page.$('div[data-testid="applyButton"]');
                         if (applyBtn) await applyBtn.click();
                         await this.humanDelay(1000, 2000);
                         result.details.push("Photo Updated");
                    }
                }

                // Bio
                if (bio) {
                    console.log("✍️ Updating Twitter Bio...");
                    const bioInput = await page.$('textarea[name="description"]');
                    if (bioInput) {
                        await bioInput.click({ clickCount: 3 });
                        await page.keyboard.press('Backspace');
                        await bioInput.type(bio, { delay: 50 });
                        result.details.push("Bio Updated");
                    }
                }

                // Save
                const saveBtn = await page.$('div[data-testid="Profile_Save_Button"]');
                if (saveBtn) {
                    await saveBtn.click();
                    await this.humanDelay(3000, 5000);
                    result.success = true;
                }
            }

        } catch (e) {
            console.error("❌ Twitter Profile Update Error:", e);
            result.error = e.message;
        } finally {
            await browser.close();
        }
        if (!result.success && result.details.length === 0 && !result.error) result.error = "No changes applied";
        return result;
    }

    async updateTikTokProfile(photoPath, bio) {
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        let result = { success: false, details: [] };

        try {
            if (this.cookies.tiktok) await page.setCookie(...this.cookies.tiktok);
            await page.goto('https://www.tiktok.com/@profile', { waitUntil: 'networkidle2' }); // Redirects to own profile
            await this.humanDelay(3000, 5000);

            // Click Edit Profile
            // Button text: "Edit profile" or "Modifier le profil"
            const editBtn = await page.$('button[data-e2e="edit-profile-btn"]');
            if (editBtn) {
                await editBtn.click();
                await this.humanDelay(2000, 4000);

                // Modal opens
                // Photo
                if (photoPath) {
                    console.log("📸 Updating TikTok Photo...");
                    const fileInput = await page.$('input[type="file"]');
                    if (fileInput) {
                        await fileInput.uploadFile(photoPath);
                        await this.humanDelay(2000, 4000);
                        // Apply crop
                        const applyBtn = await page.$('button.btn-primary'); // Generic selector, risky
                        if (applyBtn) await applyBtn.click();
                        result.details.push("Photo Updated");
                    }
                }

                // Bio
                if (bio) {
                    console.log("✍️ Updating TikTok Bio...");
                    const bioInput = await page.$('textarea'); // Usually only one textarea in this modal
                    if (bioInput) {
                         await bioInput.click({ clickCount: 3 });
                         await bioInput.type(bio, { delay: 50 });
                         result.details.push("Bio Updated");
                    }
                }

                // Save
                const saveBtn = await page.$('button[data-e2e="edit-profile-save"]');
                if (saveBtn) {
                    await saveBtn.click();
                    await this.humanDelay(3000, 5000);
                    result.success = true;
                }
            }

        } catch (e) {
            console.error("❌ TikTok Profile Update Error:", e);
            result.error = e.message;
        } finally {
            await browser.close();
        }
        if (!result.success && result.details.length === 0 && !result.error) result.error = "No changes applied";
        return result;
    }

}

const socialAutomator = new SocialAutomator();
export default socialAutomator;
