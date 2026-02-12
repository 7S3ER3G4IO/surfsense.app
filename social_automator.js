import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable stealth plugin
puppeteer.use(StealthPlugin());

const COOKIES_PATH = path.join(__dirname, 'browser_cookies.json');

class SocialAutomator {
    constructor() {
        this.cookies = {};
        this.loadCookies();
    }

    loadCookies() {
        try {
            if (fs.existsSync(COOKIES_PATH)) {
                this.cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
            }
        } catch (e) {
            console.error("Error loading cookies:", e);
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
        return await puppeteer.launch({
            headless: headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"'
            ]
        });
    }

    async humanDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
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

            // Check if logged in
            const loginButton = await page.$('button[data-e2e="upload-login-button"]'); // Example selector, changes often
            const isGuest = await page.evaluate(() => document.body.innerText.includes("Log in") || document.body.innerText.includes("Connexion"));

            if (isGuest) {
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
        const browser = await this.launchBrowser(false); // Often needs headful for heavy Studio JS
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        try {
            if (this.cookies.youtube) {
                await page.setCookie(...this.cookies.youtube);
            }

            console.log("📺 Navigating to YouTube Studio...");
            await page.goto('https://studio.youtube.com/', { waitUntil: 'networkidle2' });
            await this.humanDelay(3000, 5000);

            // Check Login
            if (page.url().includes('accounts.google.com')) {
                console.log("⚠️ Not logged in (YouTube). Please import cookies.");
                return;
            }

            console.log("✅ Logged in (YouTube)");

            // 1. Click Create -> Upload Videos
            const createBtn = await page.waitForSelector('#create-icon', { timeout: 10000 });
            await createBtn.click();
            await this.humanDelay(500, 1000);

            const uploadOption = await page.evaluateHandle(() => {
                const items = Array.from(document.querySelectorAll('ytcp-text-menu-item'));
                return items.find(i => i.innerText.includes('Upload') || i.innerText.includes('Mettre en ligne'));
            });
            if (uploadOption) await uploadOption.click();

            // 2. Upload File
            const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 10000 });
            console.log("📤 Uploading video to YouTube...");
            await fileInput.uploadFile(videoPath);

            // Wait for upload processing to start (dialog appears)
            await page.waitForSelector('ytcp-uploads-dialog', { visible: true, timeout: 20000 });
            console.log("⏳ Waiting for upload/processing...");
            
            // 3. Fill Details (Title/Description)
            // Title is usually pre-filled with filename, but we can update it.
            // Description is in a textbox.
            // Simplified: Just wait for "Next" button to be active (processing might take time)
            
            // Wait loop for "Checks complete" or just click Next blindly after delay?
            // YouTube requires answering "Made for kids?"
            
            await this.humanDelay(3000, 5000);

            // Select "No, it's not made for kids"
            // name="audience" radio button
            const notForKids = await page.evaluateHandle(() => {
                const radios = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
                return radios.find(r => r.getAttribute('name') === 'VIDEO_MADE_FOR_KIDS_MFK' || r.innerText.includes('Not made for kids') || r.innerText.includes('Pas conçu pour les enfants'));
            });
            if (notForKids) await notForKids.click();
            
            await this.humanDelay(1000, 2000);

            // Click Next (Details -> Video Elements)
            const clickNext = async () => {
                const nextBtn = await page.$('#next-button-button');
                if (nextBtn) await nextBtn.click();
            };

            await clickNext(); // To Video Elements
            await this.humanDelay(1000, 2000);
            await clickNext(); // To Checks
            await this.humanDelay(1000, 2000);
            await clickNext(); // To Visibility
            await this.humanDelay(1000, 2000);

            // 4. Set Visibility to Public
            const publicRadio = await page.evaluateHandle(() => {
                const radios = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
                return radios.find(r => r.getAttribute('name') === 'PUBLIC' || r.innerText.includes('Public'));
            });
            if (publicRadio) await publicRadio.click();

            await this.humanDelay(1000, 2000);

            // 5. Publish
            const publishBtn = await page.$('#done-button');
            if (publishBtn) {
                console.log("🚀 Publishing...");
                await publishBtn.click();
                
                // Wait for "Video published" dialog
                await page.waitForSelector('ytcp-video-uploaded-dialog', { visible: true, timeout: 60000 });
                console.log("✅ YouTube Published!");
                
                // Save Cookies
                const currentCookies = await page.cookies();
                this.cookies.youtube = currentCookies;
                this.saveCookies();
            }

        } catch (e) {
            console.error("❌ YouTube Stealth Error:", e);
        } finally {
            await browser.close();
        }
    }
}

export default new SocialAutomator();
