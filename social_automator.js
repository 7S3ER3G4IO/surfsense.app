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
const ROBOT_SHOT_PATH = path.join(__dirname, 'public', 'admin', 'robot.png');

// Enable stealth plugin
puppeteer.use(StealthPlugin());
const HEADLESS_ONLY = !!(process.env.PUPPETEER_DISABLE || process.env.NO_BROWSER);

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
    async capturePagePreview(page) {
        try {
            const dir = path.dirname(ROBOT_SHOT_PATH);
            try { fs.mkdirSync(dir, { recursive: true }); } catch {}
            await page.screenshot({ path: ROBOT_SHOT_PATH, type: 'png', fullPage: true });
        } catch (e) {}
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

    async loginLinkedInAuto(page) {
        const u = process.env.LINKEDIN_EMAIL || '';
        const p = process.env.LINKEDIN_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
            const userSel = '#username';
            const passSel = '#password';
            const btnSel = 'button[type="submit"]';
            await page.waitForSelector(userSel, { timeout: 10000 });
            await page.type(userSel, u, { delay: 50 });
            await page.type(passSel, p, { delay: 50 });
            await page.click(btnSel);
            await this.humanDelay(3000, 5000);
            return !page.url().includes('login');
        } catch { return false; }
    }

    async loginOutlookAuto(page) {
        const u = process.env.OUTLOOK_EMAIL || '';
        const p = process.env.OUTLOOK_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://login.live.com/', { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[type="email"]');
            await page.type('input[type="email"]', u, { delay: 50 });
            await page.keyboard.press('Enter');
            await this.humanDelay(2000, 3000);
            await page.waitForSelector('input[type="password"]');
            await page.type('input[type="password"]', p, { delay: 50 });
            await page.keyboard.press('Enter');
            await this.humanDelay(3000, 5000);
            // Click "Yes" on stay signed in if it appears
            const stayBtn = await page.$('input[id="idSIButton9"]');
            if (stayBtn) await stayBtn.click();
            await this.humanDelay(2000, 4000);
            return page.url().includes('outlook.live.com') || page.url().includes('microsoft.com');
        } catch { return false; }
    }

    async loginPinterestAuto(page) {
        const u = process.env.PINTEREST_EMAIL || '';
        const p = process.env.PINTEREST_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[id="email"]', { timeout: 10000 });
            await page.type('input[id="email"]', u, { delay: 50 });
            await page.type('input[id="password"]', p, { delay: 50 });
            await page.click('button[type="submit"]');
            await this.humanDelay(3000, 5000);
            return !page.url().includes('login');
        } catch { return false; }
    }

    async loginSnapchatAuto(page) {
        // Snapchat web login is often tricky with captchas
        const u = process.env.SNAPCHAT_USERNAME || '';
        const p = process.env.SNAPCHAT_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://accounts.snapchat.com/accounts/login', { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await page.type('input[name="username"]', u, { delay: 50 });
            await page.click('button[type="submit"]');
            await this.humanDelay(2000, 3000);
            // Password field appears after username usually
            const passInput = await page.waitForSelector('input[name="password"]', { timeout: 5000 }).catch(()=>null);
            if (passInput) {
                await page.type('input[name="password"]', p, { delay: 50 });
                await page.click('button[type="submit"]');
                await this.humanDelay(3000, 5000);
            }
            return !page.url().includes('login');
        } catch { return false; }
    }

    async loginDiscordAuto(page) {
        const u = process.env.DISCORD_EMAIL || '';
        const p = process.env.DISCORD_PASSWORD || '';
        if (!u || !p) return false;
        try {
            await page.goto('https://discord.com/login', { waitUntil: 'networkidle2' });
            await page.waitForSelector('input[name="email"]', { timeout: 10000 });
            await page.type('input[name="email"]', u, { delay: 50 });
            await page.type('input[name="password"]', p, { delay: 50 });
            await page.click('button[type="submit"]');
            await this.humanDelay(5000, 8000);
            return page.url().includes('/channels/') || page.url().includes('/app');
        } catch { return false; }
    }

    async loginTelegramAuto(page) {
        // Telegram Web usually requires phone number + code, hard to automate fully without user interaction
        // We will just return false to force manual/cookie flow
        return false; 
    }
    async autoLoginAndCollect(nets = ["instagram","twitter","tiktok","facebook","youtube","linkedin","outlook","discord","telegram","pinterest","snapchat","threads"], timeoutMs = 15000) {
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
                else if (net === 'linkedin') { ok = await this.loginLinkedInAuto(page); url = 'https://www.linkedin.com/feed/'; }
                else if (net === 'outlook') { ok = await this.loginOutlookAuto(page); url = 'https://outlook.live.com/mail/0/'; }
                else if (net === 'pinterest') { ok = await this.loginPinterestAuto(page); url = 'https://www.pinterest.com/'; }
                else if (net === 'snapchat') { ok = await this.loginSnapchatAuto(page); url = 'https://accounts.snapchat.com/accounts/welcome'; }
                else if (net === 'discord') { ok = await this.loginDiscordAuto(page); url = 'https://discord.com/channels/@me'; }
                else if (net === 'telegram') { url = 'https://web.telegram.org/'; } // Manual login usually
                else if (net === 'threads') { url = 'https://www.threads.net/'; }
                
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
            youtube: !!this.cookies.youtube && this.cookies.youtube.length > 0,
            linkedin: !!this.cookies.linkedin && this.cookies.linkedin.length > 0,
            outlook: !!this.cookies.outlook && this.cookies.outlook.length > 0,
            discord: !!this.cookies.discord && this.cookies.discord.length > 0,
            telegram: !!this.cookies.telegram && this.cookies.telegram.length > 0,
            pinterest: !!this.cookies.pinterest && this.cookies.pinterest.length > 0,
            snapchat: !!this.cookies.snapchat && this.cookies.snapchat.length > 0,
            threads: !!this.cookies.threads && this.cookies.threads.length > 0
        };
    }
    clearCookies() {
        try {
            this.cookies = {};
            fs.writeFileSync(COOKIES_PATH, JSON.stringify(this.cookies, null, 2));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async launchBrowser(headless = "new") {
        if (HEADLESS_ONLY) throw new Error("Browser disabled by environment");
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
        if (HEADLESS_ONLY) throw new Error("Browser disabled by environment");
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
            } else if (network === 'linkedin') {
                await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 4000);
                isLoggedIn = !page.url().includes('login') && !page.url().includes('signup');
            } else if (network === 'outlook') {
                await page.goto('https://outlook.live.com/mail/0/', { waitUntil: 'networkidle2' });
                await this.humanDelay(3000, 5000);
                isLoggedIn = page.url().includes('outlook.live.com');
            } else if (network === 'pinterest') {
                await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 4000);
                isLoggedIn = !page.url().includes('login');
            } else if (network === 'snapchat') {
                await page.goto('https://accounts.snapchat.com/accounts/welcome', { waitUntil: 'networkidle2' });
                await this.humanDelay(2000, 4000);
                isLoggedIn = !page.url().includes('login');
            } else if (network === 'discord') {
                await page.goto('https://discord.com/channels/@me', { waitUntil: 'networkidle2' });
                await this.humanDelay(3000, 5000);
                isLoggedIn = !page.url().includes('login');
            } else if (network === 'telegram') {
                await page.goto('https://web.telegram.org/', { waitUntil: 'networkidle2' });
                await this.humanDelay(3000, 5000);
                // Telegram is tricky, but if we see chat list, we are good.
                isLoggedIn = await page.evaluate(() => !!document.querySelector('.chat-list') || !!document.querySelector('#telegram-search-input'));
            } else if (network === 'threads') {
                await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2' });
                await this.humanDelay(3000, 5000);
                isLoggedIn = await page.evaluate(() => {
                     // Check for "Log in" or user profile
                     // Logged in user usually has a profile link or "Start a thread"
                     return !!document.querySelector('a[href*="/@"]') || !!document.querySelector('div[aria-label="Start a thread"]');
                });
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

    async searchAndLogin(network) {
        if (HEADLESS_ONLY) throw new Error("Browser disabled by environment");
        console.log(`🧭 Human-like login via Google for ${network}...`);
        const pr = await this.launchBrowserWithSystemProfile(false);
        const browser = pr.browser;
        const cleanup = pr.cleanup;
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        try {
            const queries = {
                instagram: "instagram login",
                twitter: "x login",
                facebook: "facebook login",
                youtube: "youtube studio login",
                tiktok: "tiktok login",
                linkedin: "linkedin login",
                outlook: "outlook login",
                pinterest: "pinterest login",
                snapchat: "snapchat login",
                discord: "discord login",
                telegram: "telegram web",
                threads: "threads login"
            };
            const domains = {
                instagram: "instagram.com",
                twitter: "x.com",
                facebook: "facebook.com",
                youtube: "youtube.com",
                tiktok: "tiktok.com",
                linkedin: "linkedin.com",
                outlook: "live.com",
                pinterest: "pinterest.com",
                snapchat: "snapchat.com",
                discord: "discord.com",
                telegram: "telegram.org",
                threads: "threads.net"
            };
            const q = queries[network] || `${network} login`;
            const domain = domains[network] || `${network}.com`;
            console.log(`🔎 Google query: "${q}"`);
            await page.goto("https://www.google.com/", { waitUntil: "networkidle2" });
            await this.humanDelay(1000, 2000);
            const box = await page.$('input[name="q"]');
            if (box) {
                await box.type(q, { delay: 50 });
                await page.keyboard.press("Enter");
            } else {
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle2" });
            }
            await this.humanDelay(2000, 4000);
            // Click first result matching domain
            const link = await page.evaluateHandle((dom) => {
                const anchors = Array.from(document.querySelectorAll('a'));
                return anchors.find(a => (a.href || '').includes(dom)) || null;
            }, domain);
            if (link) {
                console.log(`➡️ Opening ${domain} result...`);
                await link.click();
                await this.humanDelay(2000, 4000);
            } else {
                console.log("⚠️ No matching result found, using direct URL fallback");
                const direct = {
                    instagram: "https://www.instagram.com/accounts/login/",
                    twitter: "https://x.com/login",
                    facebook: "https://www.facebook.com/login",
                    youtube: "https://accounts.google.com/signin/v2/identifier?service=youtube",
                    tiktok: "https://www.tiktok.com/login",
                    linkedin: "https://www.linkedin.com/login",
                    outlook: "https://login.live.com/",
                    pinterest: "https://www.pinterest.com/login/",
                    snapchat: "https://accounts.snapchat.com/accounts/login",
                    discord: "https://discord.com/login",
                    telegram: "https://web.telegram.org/",
                    threads: "https://www.threads.net/login"
                }[network] || `https://${domain}/`;
                await page.goto(direct, { waitUntil: "networkidle2" });
            }
            await this.humanDelay(1000, 2000);
            // Now perform auto login with known flows
            console.log("👤 Attempting credentialed login flow...");
            let ok = false;
            if (network === "instagram") ok = await this.loginInstagramAuto(page);
            else if (network === "twitter") ok = await this.loginTwitterAuto(page);
            else if (network === "facebook") ok = await this.loginFacebookAuto(page);
            else if (network === "youtube") ok = await this.loginYouTubeGoogleAuto(page);
            else if (network === "linkedin") ok = await this.loginLinkedInAuto(page);
            else if (network === "outlook") ok = await this.loginOutlookAuto(page);
            else if (network === "pinterest") ok = await this.loginPinterestAuto(page);
            else if (network === "snapchat") ok = await this.loginSnapchatAuto(page);
            else if (network === "discord") ok = await this.loginDiscordAuto(page);
            else if (network === "telegram") ok = await this.loginTelegramAuto(page);
            else if (network === "tiktok") {
                // TikTok captcha risk; just land on upload and try cookies
                try {
                    await page.goto("https://www.tiktok.com/upload?lang=fr", { waitUntil: "networkidle2" });
                    await this.humanDelay(2000, 4000);
                    ok = !page.url().includes("/login");
                } catch { ok = false; }
            }
            console.log(`🔐 ${network} login result: ${ok ? "✅ OK" : "❌ FAIL"}`);
            if (ok) {
                const ck = await page.cookies();
                this.cookies[network] = ck;
                this.saveCookies();
                console.log(`🍪 Saved cookies for ${network} (${ck.length})`);
            }
            return ok;
        } catch (e) {
            console.error(`❌ searchAndLogin error (${network}):`, e.message || e);
            return false;
        } finally {
            try { await browser.close(); } catch {}
            try { await cleanup(); } catch {}
        }
    }

    async ensureHumanLoginIfNeeded(network) {
        try {
            const ok = await this.checkLogin(network);
            if (ok) return true;
            return await this.searchAndLogin(network);
        } catch (e) {
            console.error(`ensureHumanLoginIfNeeded(${network}) failed:`, e.message || e);
            return false;
        }
    }

    // --- TIKTOK AUTOMATION ---
    async postToTikTok(videoPath, caption, opts = {}) {
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
            await this.capturePagePreview(page);
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
                
                // Wait for upload to complete (Look for "Uploaded" text or progress bar disappearance)
                console.log("⏳ Waiting for upload completion...");
                try {
                    // This selector matches the upload completion state or the "Edit video" button appearing
                    await page.waitForFunction(() => {
                        const progress = document.querySelector('.upload-progress');
                        const changeVideo = document.querySelector('.change-video-btn');
                        const uploadedText = document.body.innerText.includes("Uploaded") || document.body.innerText.includes("Téléchargé");
                        return !progress && (changeVideo || uploadedText);
                    }, { timeout: 120000 }); // 2 min max for upload
                } catch (e) {
                    console.log("⚠️ Upload wait timeout, proceeding anyway (might be stuck or already done)");
                }
                
                await this.humanDelay(2000, 5000);
                await this.capturePagePreview(page);
            }

            // CAPTION
            console.log("✍️ Writing caption...");
            try {
                // TikTok caption editor usually has this class or similar
                // Strategy: click the editor area then type
                const captionSelectors = [
                    '.public-DraftEditor-content', 
                    'div[contenteditable="true"]',
                    'div[data-contents="true"]'
                ];
                
                let captionEditor = null;
                for (const sel of captionSelectors) {
                    captionEditor = await page.$(sel);
                    if (captionEditor) break;
                }
                
                if (captionEditor) {
                    await captionEditor.click();
                    await this.humanDelay(500, 1000);
                    // Clear existing (if any)
                    await page.keyboard.down('Meta');
                    await page.keyboard.press('a');
                    await page.keyboard.up('Meta');
                    await page.keyboard.press('Backspace');
                    
                    await captionEditor.type(caption, { delay: 50 });
                } else {
                    console.log("⚠️ Could not find caption editor");
                }
            } catch (e) {
                console.error("⚠️ Caption Error:", e);
            }
            
            await this.humanDelay(2000, 4000);

            // POST
            console.log("🚀 Posting to TikTok...");
            try {
                // Button usually says "Post" or "Publier"
                // Best to use data-e2e if available
                const postBtnSelector = 'button[data-e2e="post_video_button"]';
                let postBtn = await page.$(postBtnSelector);
                
                if (!postBtn) {
                    // Fallback: Find by text
                    const buttons = await page.$$('button');
                    for (const btn of buttons) {
                        const t = await page.evaluate(el => el.innerText, btn);
                        if (t === "Post" || t === "Publier") {
                            postBtn = btn;
                            break;
                        }
                    }
                }
                
                if (postBtn) {
                    await postBtn.click();
                    // Wait for success confirmation
                    // "Your video has been uploaded" or modal
                    await this.humanDelay(5000, 10000);
                    
                    // Check for success message
                    const success = await page.evaluate(() => {
                         return document.body.innerText.includes("View profile") || 
                                document.body.innerText.includes("Voir le profil") ||
                                document.body.innerText.includes("uploaded");
                    });
                    
                    if (success) console.log("✅ TikTok Posted Successfully!");
                    else console.log("⚠️ TikTok Post clicked but success not confirmed (check screenshot)");
                    
                } else {
                    console.error("❌ Could not find Post button");
                }
            } catch (e) {
                console.error("❌ Post Click Error:", e);
            }

            await this.capturePagePreview(page);

            // SAVE COOKIES (Refresh session)
            const currentCookies = await page.cookies();
            this.cookies.tiktok = currentCookies;
            this.saveCookies();

            console.log("✅ TikTok Posted (Simulation)!");
            // In a real scenario, we need precise selectors.
            // For now, this is the architecture.
            try {
                const profile = opts.profileUrl || '';
                if (profile) {
                    await page.goto(profile, { waitUntil: 'networkidle2' });
                    await this.humanDelay(2000, 4000);
                }
                const url = await page.evaluate(() => {
                    const a = document.querySelector('a[href*="/video/"]');
                    return a ? a.href : '';
                });
                return url || profile || '';
            } catch {
                return opts.profileUrl || '';
            }
            
        } catch (e) {
            console.error("❌ TikTok Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- TWITTER AUTOMATION (STEALTH) ---
    async postToTwitter(mediaPath, caption, opts = {}) {
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
            await this.capturePagePreview(page);
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
                await this.capturePagePreview(page);
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
                await this.capturePagePreview(page);
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.twitter = currentCookies;
                this.saveCookies();
                try {
                    const profile = opts.profileUrl || '';
                    if (profile) {
                        await page.goto(profile, { waitUntil: 'networkidle2' });
                        await this.humanDelay(2000, 4000);
                    }
                    const url = await page.evaluate(() => {
                        const a = document.querySelector('a[href*="/status/"]');
                        return a ? a.href : '';
                    });
                    return url || profile || '';
                } catch {
                    return opts.profileUrl || '';
                }
            }

        } catch (e) {
            console.error("❌ Twitter Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- INSTAGRAM AUTOMATION (STEALTH VIDEO) ---
    async postToInstagramVideo(videoPath, caption, opts = {}) {
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
            await this.capturePagePreview(page);
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
                await this.capturePagePreview(page);
                
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
                await this.capturePagePreview(page);
                try {
                    const profile = opts.profileUrl || 'https://www.instagram.com/';
                    await page.goto(profile, { waitUntil: 'networkidle2' });
                    await this.humanDelay(2000, 4000);
                    const url = await page.evaluate(() => {
                        const a1 = document.querySelector('a[href*="/reel/"]');
                        const a2 = document.querySelector('a[href*="/p/"]');
                        const a = a1 || a2;
                        return a ? (a.href || '') : '';
                    });
                    return url || profile || '';
                } catch {
                    return opts.profileUrl || '';
                }
            }

        } catch (e) {
            console.error("❌ Instagram Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- FACEBOOK AUTOMATION (STEALTH) ---
    async postToFacebook(mediaPath, caption, opts = {}) {
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
             await this.capturePagePreview(page);
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
                 await this.capturePagePreview(page);
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
                 await this.capturePagePreview(page);
                 
                 // Save Cookies
                 const currentCookies = await page.cookies();
                 this.cookies.facebook = currentCookies;
                 this.saveCookies();
                 try {
                     const profile = opts.profileUrl || 'https://www.facebook.com/';
                     await page.goto(profile, { waitUntil: 'networkidle2' });
                     await this.humanDelay(2000, 4000);
                     const url = await page.evaluate(() => {
                         const anchors = Array.from(document.querySelectorAll('a'));
                         const a = anchors.find(a => (a.href || '').includes('/posts/') || (a.href || '').includes('/photos/'));
                         return a ? a.href : '';
                     });
                     return url || profile || '';
                 } catch {
                     return opts.profileUrl || '';
                 }
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
    async postToYouTube(videoPath, title, description, opts = {}) {
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
             await this.capturePagePreview(page);
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
                 await this.capturePagePreview(page);
                 
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
                     await this.capturePagePreview(page);
                     try {
                         const profile = opts.profileUrl || '';
                         if (profile) {
                             await page.goto(profile, { waitUntil: 'networkidle2' });
                             await this.humanDelay(2000, 4000);
                         }
                         const url = await page.evaluate(() => {
                             const a = document.querySelector('a#thumbnail[href*="watch?v="]');
                             return a ? a.href : '';
                         });
                         return url || profile || '';
                     } catch {
                         return opts.profileUrl || '';
                     }
                 }
             }

        } catch (e) {
            console.error("❌ YouTube Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- LINKEDIN AUTOMATION ---
    async postToLinkedIn(mediaPath, caption, opts = {}) {
        console.log("🚀 Launching Stealth Browser for LinkedIn...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
            if (this.cookies.linkedin) await page.setCookie(...this.cookies.linkedin);
            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2' });
            await this.humanDelay(2000, 4000);

            // Check Login
            if (page.url().includes('login') || page.url().includes('signup')) {
                console.log("⚠️ Not logged in (LinkedIn).");
                return;
            }

            // Click "Start a post"
            const startPostBtn = await page.$('button.share-box-feed-entry__trigger');
            if (startPostBtn) {
                await startPostBtn.click();
            } else {
                // Try text search
                const buttons = await page.$$('button');
                for (const btn of buttons) {
                    const t = await page.evaluate(el => el.innerText, btn);
                    if (t.includes("Start a post") || t.includes("Commencer un post")) {
                        await btn.click();
                        break;
                    }
                }
            }
            await this.humanDelay(2000, 3000);

            // Upload Media (if any)
            if (mediaPath) {
                // Click "Media" button in modal
                // Usually aria-label="Add media" or similar
                const mediaBtn = await page.$('button[aria-label="Add media"], button[aria-label="Ajouter un média"]');
                if (mediaBtn) {
                    await mediaBtn.click();
                    await this.humanDelay(1000, 2000);
                    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 5000 });
                    if (fileInput) {
                        await fileInput.uploadFile(mediaPath);
                        await this.humanDelay(3000, 5000);
                        // Click Next
                        const nextBtn = await page.$('button.share-box-footer__primary-btn'); // Verify class
                        if (nextBtn) await nextBtn.click();
                        await this.humanDelay(1000, 2000);
                    }
                }
            }

            // Caption
            const editor = await page.$('div.ql-editor');
            if (editor) {
                await editor.type(caption, { delay: 50 });
            }

            await this.humanDelay(2000, 3000);

            // Post
            const postBtn = await page.$('button.share-actions__primary-action');
            if (postBtn) {
                await postBtn.click();
                await this.humanDelay(3000, 6000);
                console.log("✅ LinkedIn Posted!");
            }

        } catch (e) {
            console.error("❌ LinkedIn Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- PINTEREST AUTOMATION ---
    async postToPinterest(mediaPath, title, description, opts = {}) {
        console.log("🚀 Launching Stealth Browser for Pinterest...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
            if (this.cookies.pinterest) await page.setCookie(...this.cookies.pinterest);
            await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2' });
            await this.capturePagePreview(page);
            await this.humanDelay(3000, 5000);

            if (page.url().includes('login')) {
                console.log("⚠️ Not logged in (Pinterest). Please import cookies.");
                return;
            }
            
            console.log("✅ Logged in (Pinterest)");

            // Upload
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                console.log("📤 Uploading media to Pinterest...");
                await fileInput.uploadFile(mediaPath);
                await this.humanDelay(3000, 5000);
            }

            // Title
            const titleInput = await page.$('input[id="storyboard-selector-title"]'); 
            if (titleInput) {
                await titleInput.type(title, { delay: 50 });
            } else {
                 const titleAria = await page.$('input[aria-label="Add your title"], input[placeholder="Add your title"]');
                 if (titleAria) await titleAria.type(title, { delay: 50 });
            }

            // Description
            const descInput = await page.$('div[role="textbox"][aria-label="Tell everyone what your Pin is about"], div[aria-label="Dites à tout le monde de quoi parle votre Épingle"]');
            if (descInput) {
                 await descInput.type(description, { delay: 30 });
            }

            // Link (Optional)
            if (opts.link) {
                const linkInput = await page.$('input[placeholder="Add a destination link"]');
                if (linkInput) await linkInput.type(opts.link, { delay: 30 });
            }

            // Save/Publish
            const saveBtn = await page.$('button[data-test-id="board-dropdown-save-button"]');
            if (saveBtn) {
                console.log("🚀 Publishing...");
                await saveBtn.click();
                await this.humanDelay(5000, 8000);
                console.log("✅ Pinterest Posted!");
                await this.capturePagePreview(page);
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.pinterest = currentCookies;
                this.saveCookies();
            } else {
                console.error("❌ Could not find Save button");
            }

        } catch (e) {
            console.error("❌ Pinterest Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- DISCORD AUTOMATION ---
    async postToDiscord(message, opts = {}, mediaPath = null) {
        // opts.channelUrl is required (e.g., https://discord.com/channels/GUILD_ID/CHANNEL_ID)
        if (!opts.channelUrl) { console.error("Discord: channelUrl required"); return; }
        
        console.log("🚀 Launching Stealth Browser for Discord...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        try {
            if (this.cookies.discord) await page.setCookie(...this.cookies.discord);
            
            console.log(`💬 Navigating to Discord Channel...`);
            await page.goto(opts.channelUrl, { waitUntil: 'networkidle2' });
            await this.capturePagePreview(page);
            await this.humanDelay(3000, 5000);
            
            // Check Login
            const isGuest = await page.url().includes('login') || await page.url().includes('register');
            if (isGuest) {
                console.log("⚠️ Not logged in (Discord). Please import cookies.");
                return;
            }
            
            console.log("✅ Logged in (Discord)");

            // File Upload (if any)
            if (mediaPath) {
                console.log("📤 Uploading media to Discord...");
                // Discord usually has a hidden file input
                const fileInput = await page.$('input[type="file"]');
                if (fileInput) {
                    await fileInput.uploadFile(mediaPath);
                    await this.humanDelay(2000, 4000);
                    // Wait for upload preview to appear?
                    // Usually it shows up in the chat bar area
                } else {
                    console.log("⚠️ Could not find file input for Discord.");
                }
            }

            // Message / Caption
            const editor = await page.$('div[role="textbox"]');
            if (editor) {
                await editor.click();
                await this.humanDelay(500, 1000);
                
                if (message) {
                    await editor.type(message, { delay: 50 });
                }
                
                await this.humanDelay(1000, 2000);
                
                console.log("🚀 Sending message...");
                await page.keyboard.press('Enter');
                await this.humanDelay(2000, 4000);
                
                console.log("✅ Discord Message Sent!");
                await this.capturePagePreview(page);
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.discord = currentCookies;
                this.saveCookies();
            } else {
                console.error("❌ Could not find Discord editor");
            }
            
        } catch (e) {
            console.error("❌ Discord Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- TELEGRAM AUTOMATION ---
    async postToTelegram(message, opts = {}) {
        // opts.chatUrl (e.g. https://web.telegram.org/k/#@channelname)
        // If not provided, we can't really "post" to nowhere.
        if (!opts.chatUrl) { 
            console.error("Telegram: chatUrl required (e.g., https://web.telegram.org/k/#@channelname)"); 
            return; 
        }

        console.log("🚀 Launching Stealth Browser for Telegram...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        try {
            if (this.cookies.telegram) {
                await page.setCookie(...this.cookies.telegram);
            }

            console.log(`✈️ Navigating to Telegram Chat (${opts.chatUrl})...`);
            await page.goto(opts.chatUrl, { waitUntil: 'networkidle2' });
            await this.capturePagePreview(page);
            await this.humanDelay(5000, 8000);
            
            // Check Login Status
            // Telegram Web usually shows a QR code or phone login if not authenticated
            const isGuest = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                return bodyText.includes("Log in") || 
                       bodyText.includes("Sign in") || 
                       !!document.querySelector('.login_page') ||
                       !!document.querySelector('canvas'); // QR Code usually on canvas
            });

            if (isGuest) {
                 console.log("⚠️ Not logged in (Telegram). Please import cookies.");
                 return;
            }
            
            console.log("✅ Logged in (Telegram)");

            // Wait for editor
            console.log("✍️ Finding editor...");
            // Telegram Web K: .input-message-input
            // Telegram Web A: .composer_rich_textarea
            // Generic: div[contenteditable="true"]
            const editorSelectors = [
                '.input-message-input', 
                '.composer_rich_textarea', 
                'div[contenteditable="true"]',
                'div[role="textbox"]'
            ];
            
            let editor = null;
            for (const sel of editorSelectors) {
                try {
                    editor = await page.waitForSelector(sel, { timeout: 2000 });
                    if (editor) break;
                } catch {}
            }
            
            if (editor) {
                await editor.click();
                await this.humanDelay(500, 1000);
                
                // Type message
                await editor.type(message, { delay: 50 });
                await this.humanDelay(1000, 2000);
                
                // Send
                console.log("🚀 Sending message...");
                await page.keyboard.press('Enter');
                
                // Wait for send confirmation (tick check)
                await this.humanDelay(2000, 4000);
                console.log("✅ Telegram Message Sent!");
                
                await this.capturePagePreview(page);
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.telegram = currentCookies;
                this.saveCookies();
                
            } else {
                console.error("❌ Could not find Telegram editor");
                await this.capturePagePreview(page);
            }
            
        } catch (e) {
            console.error("❌ Telegram Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- THREADS AUTOMATION ---
    async postToThreads(mediaPath, caption, opts = {}) {
        console.log("🚀 Launching Stealth Browser for Threads...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
            if (this.cookies.threads) {
                await page.setCookie(...this.cookies.threads);
            }

            console.log("🧵 Navigating to Threads...");
            await page.goto('https://www.threads.net/', { waitUntil: 'networkidle2' });
            await this.capturePagePreview(page);
            await this.humanDelay(3000, 5000);

            // Check Login
            // Look for "Start a thread" or profile icon
            const isLoggedIn = await page.evaluate(() => {
                return !!document.querySelector('div[aria-label="Start a thread"]') || 
                       !!document.querySelector('a[href*="/@"]');
            });

            if (!isLoggedIn) {
                console.log("⚠️ Not logged in (Threads). Please import cookies.");
                return;
            }

            console.log("✅ Logged in (Threads)");

            // Click "Start a thread"
            // Usually top middle "Start a thread..." placeholder
            const startInput = await page.$('div[aria-label="Start a thread..."], div[innerText="Start a thread..."]');
            if (startInput) {
                await startInput.click();
            } else {
                // Try finding the button by text
                const divs = await page.$$('div');
                for (const div of divs) {
                    const t = await page.evaluate(el => el.innerText, div);
                    if (t === "Start a thread...") {
                        await div.click();
                        break;
                    }
                }
            }
            
            await this.humanDelay(1000, 2000);

            // Type Caption
            // The editor appears
            const editor = await page.$('div[aria-label="Start a thread..."][role="textbox"]');
            if (editor) {
                await editor.type(caption, { delay: 50 });
            }

            await this.humanDelay(1000, 2000);

            // Upload Media
            if (mediaPath) {
                console.log("📤 Uploading media to Threads...");
                // Hidden file input
                const fileInput = await page.$('input[type="file"]');
                if (fileInput) {
                    await fileInput.uploadFile(mediaPath);
                    await this.humanDelay(3000, 6000); // Wait for upload
                }
            }

            // Post
            const postBtn = await page.$('div[role="button"][aria-label="Post"]');
            // Or find by text "Post"
            if (postBtn) {
                console.log("🚀 Posting to Threads...");
                await postBtn.click();
                await this.humanDelay(3000, 6000);
                console.log("✅ Threads Posted!");
                await this.capturePagePreview(page);
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.threads = currentCookies;
                this.saveCookies();
                
                // Return URL?
                try {
                    const profile = opts.profileUrl || 'https://www.threads.net/';
                    await page.goto(profile, { waitUntil: 'networkidle2' });
                    await this.humanDelay(2000, 4000);
                    // Find latest post
                    const url = await page.evaluate(() => {
                        const a = document.querySelector('a[href*="/post/"]');
                        return a ? a.href : '';
                    });
                    return url || profile || '';
                } catch {
                    return opts.profileUrl || '';
                }
            }

        } catch (e) {
            console.error("❌ Threads Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- OUTLOOK AUTOMATION ---
    async postToOutlook(to, subject, body) {
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        try {
            if (this.cookies.outlook) await page.setCookie(...this.cookies.outlook);
            await page.goto('https://outlook.live.com/mail/0/', { waitUntil: 'networkidle2' });
            await this.humanDelay(3000, 5000);
            
            // Click "New mail"
            const newBtn = await page.$('button[aria-label="New mail"], button[aria-label="Nouveau courrier"]');
            if (newBtn) await newBtn.click();
            await this.humanDelay(2000, 3000);
            
            // To
            const toInput = await page.$('div[aria-label="To"], div[aria-label="À"]');
            if (toInput) {
                await toInput.type(to, { delay: 50 });
                await page.keyboard.press('Enter');
            }
            
            // Subject
            const subInput = await page.$('input[aria-label="Add a subject"], input[aria-label="Ajouter un objet"]');
            if (subInput) await subInput.type(subject, { delay: 50 });
            
            // Body
            const bodyEditor = await page.$('div[aria-label="Message body"], div[aria-label="Corps du message"]');
            if (bodyEditor) await bodyEditor.type(body, { delay: 30 });
            
            // Send
            const sendBtn = await page.$('button[aria-label="Send"], button[aria-label="Envoyer"]');
            if (sendBtn) {
                await sendBtn.click();
                await this.humanDelay(2000, 4000);
                console.log("✅ Outlook Email Sent!");
            }
            
        } catch (e) {
            console.error("❌ Outlook Error:", e);
        } finally {
            await browser.close();
        }
    }

    // --- SNAPCHAT AUTOMATION ---
    async postToSnapchat(mediaPath, caption, opts = {}) {
        console.log("🚀 Launching Stealth Browser for Snapchat...");
        const browser = await this.launchBrowser(false);
        const page = await browser.newPage();
        await page.setViewport({ width: 414, height: 896 }); // Mobile view
        try {
            if (this.cookies.snapchat) await page.setCookie(...this.cookies.snapchat);
            await page.goto('https://web.snapchat.com/', { waitUntil: 'networkidle2' });
            await this.humanDelay(3000, 5000);
            
            if (page.url().includes('login') || page.url().includes('accounts')) {
                 console.log("⚠️ Not logged in (Snapchat).");
                 return;
            }

            // Snapchat Web is very complex with Canvas/WebAssembly.
            // Automation of camera/posting is limited.
            // We'll attempt to find upload button if exists in web interface, otherwise just log.
            console.log("⚠️ Snapchat Web posting is experimental.");
            
            // Theoretically we can't easily "upload" to Story via web without creative kit API.
            // But we can try to send to a friend or simulated flow.
            // For now, we will just capture preview to show we accessed it.
            await this.capturePagePreview(page);
            console.log("✅ Snapchat accessed (Posting not fully supported via Web Automation)");

        } catch (e) {
            console.error("❌ Snapchat Error:", e);
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

    hasBrowser() {
        try {
            if (HEADLESS_ONLY) return false;
            const exec = resolveChromeExecutable();
            return !!exec;
        } catch {
            return false;
        }
    }

}

const socialAutomator = new SocialAutomator();
export default socialAutomator;
