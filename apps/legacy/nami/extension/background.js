chrome.action.onClicked.addListener(async () => {
  try { await chrome.runtime.openOptionsPage(); }
  catch (e) { const url = chrome.runtime.getURL('dashboard.html'); try { await chrome.tabs.create({ url, active: true }); } catch {} }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg && msg.type === 'NAVIGATE_PROFILE') {
      const m = {
        instagram: 'https://www.instagram.com/',
        facebook: 'https://www.facebook.com/',
        tiktok: 'https://www.tiktok.com/',
        threads: 'https://www.threads.net/',
        youtube: 'https://www.youtube.com/',
        twitter: 'https://twitter.com/',
        telegram: 'https://telegram.org/',
        discord: 'https://discord.com/app',
        linkedin: 'https://www.linkedin.com/',
        pinterest: 'https://www.pinterest.com/'
      };
      const url = m[msg.net] || 'https://www.google.com/';
      (async () => {
        try { const tab = await chrome.tabs.create({ url, active: true }); sendResponse({ ok: true, tabId: tab.id }); } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'CHECK_COOKIES') {
      (async () => {
        try {
          const map = {
            instagram: ['instagram.com'],
            facebook: ['facebook.com'],
            threads: ['threads.net','instagram.com'],
            tiktok: ['tiktok.com'],
            twitter: ['twitter.com','x.com'],
            youtube: ['youtube.com','google.com'],
            telegram: ['telegram.org'],
            discord: ['discord.com'],
            linkedin: ['linkedin.com'],
            pinterest: ['pinterest.com']
          };
          const domains = map[msg.net] || [];
          const cookieNames = {
            instagram: ['ds_user_id','sessionid','csrftoken','mid'],
            facebook: ['c_user','xs','fr'],
            threads: ['ds_user_id','sessionid'],
            tiktok: ['sid_tt','sessionid','tt_csrf_token'],
            twitter: ['auth_token','ct0'],
            youtube: ['SID','SAPISID','APISID','HSID','SSID'],
            telegram: ['stel_token','tg_session'],
            discord: ['__dcfduid','__sdcfduid'],
            linkedin: ['li_at','liap'],
            pinterest: ['_pinterest_sess','csrftoken']
          };
          let all = [];
          for (const d of domains) {
            const arr = await chrome.cookies.getAll({ domain: d });
            if (arr && arr.length) all = all.concat(arr);
          }
          const names = cookieNames[msg.net] || [];
          const matched = all.filter(c => names.includes(c.name)).map(c => c.name);
          const hasAuth = matched.length > 0 || all.length > 2;
          sendResponse({ ok: true, hasAuth, count: all.length, matched });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }
    if (msg && msg.type === 'NAVIGATE_PUBLISH') {
      const m = {
        instagram: 'https://www.instagram.com/',
        facebook: 'https://www.facebook.com/',
        tiktok: 'https://www.tiktok.com/upload',
        threads: 'https://www.threads.net/',
        youtube: 'https://studio.youtube.com/',
        twitter: 'https://twitter.com/compose/tweet',
        telegram: 'https://web.telegram.org/',
        discord: 'https://discord.com/channels/@me',
        linkedin: 'https://www.linkedin.com/feed/',
        pinterest: 'https://www.pinterest.com/'
      };
      const url = m[msg.net] || 'https://www.google.com/';
      (async () => {
        try { const tab = await chrome.tabs.create({ url, active: true }); sendResponse({ ok: true, tabId: tab.id }); } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'GET_STATUS') {
      const now = new Date().toISOString();
      sendResponse({ ok: true, status: 'ready', time: now });
      return true;
    }
    if (msg && msg.type === 'FORCE_MONITOR') {
      (async () => {
        try { await monitorOnce(); sendResponse({ ok: true }); }
        catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'GET_STORED_PROFILE') {
      (async () => {
        try {
          const key = `robot:profile:${msg.net}`;
          const it = await new Promise(r => chrome.storage.local.get([key], r));
          const val = it && it[key] ? it[key] : {};
          sendResponse({ ok: true, profile: val });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'SAVE_PROFILE_URL') {
      (async () => {
        try {
          const key = `robot:profileUrl:${msg.net}`;
          const url = String(msg.url || '').trim();
          await new Promise(r => chrome.storage.local.set({ [key]: url }, r));
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'GET_PROFILE_URL') {
      (async () => {
        try {
          const key = `robot:profileUrl:${msg.net}`;
          const it = await new Promise(r => chrome.storage.local.get([key], r));
          const url = it && it[key] ? it[key] : '';
          sendResponse({ ok: true, url });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'GET_COOKIES') {
      (async () => {
        try {
          const map = {
            instagram: ['instagram.com'],
            facebook: ['facebook.com'],
            threads: ['threads.net','instagram.com'],
            tiktok: ['tiktok.com'],
            twitter: ['twitter.com','x.com'],
            youtube: ['youtube.com','google.com'],
            telegram: ['telegram.org'],
            discord: ['discord.com'],
            linkedin: ['linkedin.com'],
            pinterest: ['pinterest.com']
          };
          const domains = map[msg.net] || [];
          let all = [];
          for (const d of domains) {
            const arr = await chrome.cookies.getAll({ domain: d });
            if (arr && arr.length) all = all.concat(arr);
          }
          sendResponse({ ok: true, cookies: all });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'SAVE_COOKIES') {
      (async () => {
        try {
          const key = `netCookies:${msg.net}`;
          const cookies = Array.isArray(msg.cookies) ? msg.cookies : [];
          await new Promise(r => chrome.storage.local.set({ [key]: cookies }, r));
          sendResponse({ ok: true, count: cookies.length });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'LOAD_COOKIES') {
      (async () => {
        try {
          const key = `netCookies:${msg.net}`;
          const it = await new Promise(r => chrome.storage.local.get([key], r));
          const arr = it && it[key] ? it[key] : [];
          sendResponse({ ok: true, cookies: arr, count: arr.length });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'APPLY_COOKIES') {
      (async () => {
        try {
          const key = `netCookies:${msg.net}`;
          const it = await new Promise(r => chrome.storage.local.get([key], r));
          const arr = it && it[key] ? it[key] : [];
          let applied = 0;
          for (const c of arr) {
            const dom = String(c.domain || '').replace(/^\./,'');
            const path = c.path || '/';
            const url = `https://${dom}${path}`;
            try {
              await chrome.cookies.set({
                url,
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
                secure: !!c.secure,
                httpOnly: !!c.httpOnly,
                sameSite: c.sameSite,
                expirationDate: c.expirationDate
              });
              applied++;
            } catch {}
          }
          sendResponse({ ok: true, applied, total: arr.length });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'NAMI:SEARCH') {
      (async () => {
        try {
          const src = String(msg.source||'').toLowerCase();
          const type = String(msg.mediaType||'image').toLowerCase();
          const q = encodeURIComponent(String(msg.query||'surf'));
          const limit = Math.max(1, Math.min(50, parseInt(msg.limit||'12',10)));
          if (type === 'effect') {
            const items = [
              { type:'effect', name:'Glitch', source:'builtin' },
              { type:'effect', name:'Vignette', source:'builtin' },
              { type:'effect', name:'Woosh', source:'builtin' },
              { type:'effect', name:'Zoom In', source:'builtin' }
            ];
            sendResponse({ ok: true, items });
            return;
          }
          let url = '';
          if (src === 'unsplash') {
            url = `https://unsplash.com/s/photos/${q}`;
          } else if (src === 'pexels') {
            url = type === 'video' ? `https://www.pexels.com/search/videos/${q}/` : `https://www.pexels.com/search/${q}/`;
          } else if (src === 'pixabay') {
            if (type === 'video') url = `https://pixabay.com/videos/search/${q}/`;
            else if (type === 'audio') url = `https://pixabay.com/sound-effects/search/${q}/`;
            else url = `https://pixabay.com/images/search/${q}/`;
          }
          if (!url) { sendResponse({ ok: true, items: [] }); return; }
          const tab = await chrome.tabs.create({ url, active: false });
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              args: [src, type, limit],
              func: (srcArg, typeArg, lim) => {
                function take(arr, n) { return arr.slice(0, n); }
                try {
                  let items = [];
                  if (srcArg === 'unsplash' && typeArg === 'image') {
                    const imgs = Array.from(document.querySelectorAll('img[srcset], img[src]')).filter(i => (i.src||'').includes('images.unsplash.com'));
                    items = take(imgs.map(i => ({ type:'image', url: i.src || (i.getAttribute('srcset')||'').split(' ')[0], thumb: i.src, title: i.alt || 'Unsplash', source: 'unsplash' })), lim);
                  } else if (srcArg === 'pexels' && typeArg === 'image') {
                    const imgs = Array.from(document.querySelectorAll('img[src]')).filter(i => (i.src||'').includes('images.pexels.com'));
                    items = take(imgs.map(i => ({ type:'image', url: i.src, thumb: i.src, title: i.alt || 'Pexels', source: 'pexels' })), lim);
                  } else if (srcArg === 'pexels' && typeArg === 'video') {
                    const vids = Array.from(document.querySelectorAll('video source[src], video[src]'));
                    const mapped = vids.map(v => {
                      const src = v.src || v.getAttribute('src') || '';
                      if (!src) return null;
                      let poster = '';
                      const parent = v.closest('article, figure, .video-item, .js-photo-page__main') || v.parentElement;
                      if (parent) {
                        const img = parent.querySelector('img[src]');
                        if (img && img.src) poster = img.src;
                      }
                      return { type:'video', url: src, thumb: poster, title: 'Pexels Video', source: 'pexels' };
                    }).filter(Boolean);
                    items = take(mapped, lim);
                  } else if (srcArg === 'pixabay' && typeArg === 'image') {
                    const imgs = Array.from(document.querySelectorAll('img[src]')).filter(i => (i.src||'').includes('cdn.pixabay.com'));
                    items = take(imgs.map(i => ({ type:'image', url: i.src, thumb: i.src, title: i.alt || 'Pixabay', source: 'pixabay' })), lim);
                  } else if (srcArg === 'pixabay' && typeArg === 'video') {
                    const sources = Array.from(document.querySelectorAll('video source[src]'));
                    const mapped = sources.map(s => {
                      const src = s.src || s.getAttribute('src') || '';
                      if (!src) return null;
                      let poster = '';
                      const parent = s.closest('article, figure, .item, .search-results') || s.parentElement;
                      if (parent) {
                        const img = parent.querySelector('img[src]');
                        if (img && img.src) poster = img.src;
                      }
                      return { type:'video', url: src, thumb: poster, title: 'Pixabay Video', source: 'pixabay' };
                    }).filter(Boolean);
                    items = take(mapped, lim);
                  } else if (srcArg === 'pixabay' && typeArg === 'audio') {
                    const auds = Array.from(document.querySelectorAll('audio source[src], a[href$=".mp3"]'));
                    items = take(auds.map(a => ({ type:'audio', url: (a.src||a.href), title: 'Pixabay Sound', source: 'pixabay' })), lim);
                  }
                  return items;
                } catch (e) { return []; }
              }
            });
            const items = (results && results[0] && Array.isArray(results[0].result)) ? results[0].result : [];
            sendResponse({ ok: true, items });
          } catch (e) {
            sendResponse({ ok: false, error: e.message });
          } finally {
            try { await chrome.tabs.remove(tab.id); } catch {}
          }
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'PIPELINE:PUBLISH') {
      (async () => {
        try {
          const nets = Array.isArray(msg.networks) ? msg.networks : [];
          const media = String(msg.media||'');
          const published = [];
          for (const net of nets) {
            const m = {
              instagram: 'https://www.instagram.com/',
              facebook: 'https://www.facebook.com/',
              tiktok: 'https://www.tiktok.com/upload',
              youtube: 'https://studio.youtube.com/',
              twitter: 'https://twitter.com/compose/tweet'
            };
            const url = m[net] || 'https://www.google.com/';
            try {
              const tab = await chrome.tabs.create({ url, active: true });
              published.push({ net, tabId: tab.id });
            } catch {}
          }
          try { await new Promise(r => chrome.storage.local.set({ lastPublishedMedia: media, lastPublishedNets: nets, lastPublishedAt: Date.now() }, r)); } catch {}
          sendResponse({ ok: true, published });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'QUEUE:ADD') {
      (async () => {
        try {
          const key = 'postQueue';
        const it = await new Promise(r => chrome.storage.local.get([key], r));
        const arr = Array.isArray(it && it[key]) ? it[key] : [];
          const item = Object.assign({}, msg.item || {}, { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, status: 'ready', createdAt: Date.now() });
        arr.push(item);
        await new Promise(r => chrome.storage.local.set({ [key]: arr }, r));
          sendResponse({ ok: true, count: arr.length });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'QUEUE:GET') {
      (async () => {
        try {
          const key = 'postQueue';
          const it = await new Promise(r => chrome.storage.local.get([key], r));
          const arr = Array.isArray(it && it[key]) ? it[key] : [];
          sendResponse({ ok: true, items: arr });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'QUEUE:CLEAR') {
      (async () => {
        try {
          const key = 'postQueue';
          await new Promise(r => chrome.storage.local.set({ [key]: [] }, r));
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'QUEUE:START') {
      (async () => {
        try {
          const cfgKey = 'postScheduler';
          const nets = Array.isArray(msg.networks) ? msg.networks : [];
          const interval = Math.max(1, parseInt(msg.interval||'15', 10));
          await new Promise(r => chrome.storage.local.set({ [cfgKey]: { running: true, interval, networks: nets } }, r));
          try { chrome.alarms.create('post_scheduler', { periodInMinutes: interval }); } catch {}
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'QUEUE:STOP') {
      (async () => {
        try {
          const cfgKey = 'postScheduler';
          await new Promise(r => chrome.storage.local.set({ [cfgKey]: { running: false } }, r));
          try { chrome.alarms.clear('post_scheduler', ()=>{}); } catch {}
          sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
    if (msg && msg.type === 'QUEUE:PUBLISH_NEXT') {
      (async () => {
        try {
        const key = 'postQueue';
        const histKey = 'postHistory';
        const store = await new Promise(r => chrome.storage.local.get([key, histKey, 'postScheduler'], r));
        const arr = Array.isArray(store && store[key]) ? store[key] : [];
        const history = Array.isArray(store && store[histKey]) ? store[histKey] : [];
        const sched = store && store.postScheduler ? store.postScheduler : {};
          const nextIdx = arr.findIndex(x => x.status === 'ready');
          if (nextIdx < 0) { sendResponse({ ok: true, done: true }); return; }
          const item = arr[nextIdx];
          const nets = Array.isArray(item.networks) ? item.networks : [];
          const published = [];
          for (const net of nets) {
            const m = {
              instagram: 'https://www.instagram.com/',
              facebook: 'https://www.facebook.com/',
              tiktok: 'https://www.tiktok.com/upload',
              youtube: 'https://studio.youtube.com/',
              twitter: 'https://twitter.com/compose/tweet'
            };
            const url = m[net] || 'https://www.google.com/';
            try {
              const tab = await chrome.tabs.create({ url, active: true });
              published.push({ net, tabId: tab.id });
          } catch {}
          }
        const ts = Date.now();
        arr[nextIdx] = Object.assign({}, item, { status: 'posted', postedAt: ts });
        history.unshift({ id: item.id, networks: nets, postedAt: ts });
        if (history.length > 50) history.length = 50;
        const newSched = Object.assign({}, sched, { lastRunAt: ts });
        await new Promise(r => chrome.storage.local.set({ [key]: arr, [histKey]: history, postScheduler: newSched }, r));
        sendResponse({ ok: true, published, remaining: arr.filter(x=>x.status==='ready').length });
        } catch (e) { sendResponse({ ok: false, error: e.message }); }
      })();
      return true;
    }
  if (msg && msg.type === 'QUEUE:HISTORY') {
    (async () => {
      try {
        const histKey = 'postHistory';
        const store = await new Promise(r => chrome.storage.local.get([histKey], r));
        const history = Array.isArray(store && store[histKey]) ? store[histKey] : [];
        sendResponse({ ok: true, items: history });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }
  if (msg && msg.type === 'QUEUE:STATUS') {
    (async () => {
      try {
        const store = await new Promise(r => chrome.storage.local.get(['postScheduler', 'postQueue'], r));
        const sched = store && store.postScheduler ? store.postScheduler : {};
        const arr = Array.isArray(store && store.postQueue) ? store.postQueue : [];
        const ready = arr.filter(x => x.status === 'ready').length;
        const interval = parseInt(sched.interval || 0, 10) || 0;
        const running = !!sched.running;
        const lastRunAt = sched.lastRunAt || 0;
        let nextRunAt = 0;
        if (running && interval > 0 && lastRunAt) nextRunAt = lastRunAt + interval*60000;
        sendResponse({ ok: true, running, interval, ready, nextRunAt });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }
    sendResponse({ ok: false, error: 'Unknown' });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
  return true;
});

async function monitorOnce() {
  try {
    const map = {
      instagram: ['instagram.com'],
      facebook: ['facebook.com'],
      threads: ['threads.net','instagram.com'],
      tiktok: ['tiktok.com'],
      twitter: ['twitter.com','x.com'],
      youtube: ['youtube.com'],
      telegram: ['telegram.org'],
      discord: ['discord.com'],
      linkedin: ['linkedin.com'],
      pinterest: ['pinterest.com']
    };
    const nets = Object.keys(map);
    async function saveProfile(net, data) {
      const key = `robot:profile:${net}`;
      const prevObj = await new Promise(res => chrome.storage.local.get([key], res));
      const prev = prevObj && prevObj[key] ? prevObj[key] : {};
      const merged = {
        avatar: data.avatar || prev.avatar || '',
        name: data.name || prev.name || '',
        bio: data.bio || prev.bio || '',
        url: data.url || prev.url || '',
        ts: Date.now()
      };
      await new Promise(rp => chrome.storage.local.set({ [key]: merged }, rp));
      chrome.runtime.sendMessage({ type: 'ROBOT_UPDATE', net, profile: merged });
    }
    function parseHTMLProfile(html) {
      const ogImg = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
      const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
      const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
      return { avatar: ogImg, name: ogTitle, bio: ogDesc };
    }
    async function fallbackFetch(net, domains) {
      try {
        const key = `robot:profile:${net}`;
        const prevObj = await new Promise(res => chrome.storage.local.get([key], res));
        const prev = prevObj && prevObj[key] ? prevObj[key] : {};
        const urlKey = `robot:profileUrl:${net}`;
        const urlStore = await new Promise(r => chrome.storage.local.get([urlKey], r));
        const explicitUrl = urlStore && urlStore[urlKey] ? urlStore[urlKey] : '';
        const url = explicitUrl || prev.url || `https://${domains[0]}/`;
        const resp = await fetch(url, { credentials: 'include', mode: 'cors' });
        const txt = await resp.text();
        const parsed = parseHTMLProfile(txt);
        if (parsed.avatar || parsed.name || parsed.bio) {
          await saveProfile(net, { ...parsed, url });
          return true;
        }
      } catch {}
      return false;
    }
    for (const net of nets) {
      const domains = map[net];
      let connected = false;
      for (const d of domains) {
        const arr = await chrome.cookies.getAll({ domain: d });
        if (arr && arr.length) { connected = true; break; }
      }
      if (!connected) continue;
      const queryPatterns = domains.map(d => `https://*.${d}/*`);
      const tabs = await chrome.tabs.query({ url: queryPatterns });
      for (const tab of tabs) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [net],
            func: (netArg) => {
              try {
                const ogImg = document.querySelector('meta[property="og:image"]')?.content || '';
                const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
                const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
                let avatar = '';
                let name = '';
                let bio = '';
                if (netArg === 'twitter') {
                  const av = document.querySelector('div[data-testid="UserAvatar"] img');
                  const nm = document.querySelector('div[data-testid="UserName"] span');
                  const bd = document.querySelector('div[data-testid="UserDescription"]');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && nm.textContent.trim()) || ogTitle || '';
                  bio = (bd && bd.textContent.trim()) || ogDesc || '';
                } else if (netArg === 'youtube') {
                  const av = document.querySelector('ytd-channel-header-renderer #avatar img') || document.querySelector('ytd-topbar-menu-button-renderer img#img');
                  const nm = document.querySelector('ytd-channel-name div#text-container yt-formatted-string') || document.querySelector('meta[itemprop="name"]');
                  const bd = document.querySelector('yt-formatted-string#description') || document.querySelector('meta[name="description"]');
                  avatar = (av && (av.src || av.getAttribute('src'))) || ogImg || '';
                  name = (nm && (nm.textContent||nm.getAttribute('content')||'').trim()) || ogTitle || '';
                  bio = (bd && (bd.textContent||bd.getAttribute('content')||'').trim()) || ogDesc || '';
                } else if (netArg === 'instagram' || netArg === 'threads') {
                  const av = document.querySelector('header img[alt][src*="scontent"]') || document.querySelector('img[alt*="profile"], img[alt*="avatar"]');
                  const nm = document.querySelector('header h2, header h1') || document.querySelector('meta[property="og:title"]');
                  const bd = document.querySelector('header ~ div span') || document.querySelector('meta[property="og:description"]');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && (nm.textContent||nm.getAttribute('content')||'').trim()) || ogTitle || '';
                  bio = (bd && (bd.textContent||bd.getAttribute('content')||'').trim()) || ogDesc || '';
                } else if (netArg === 'facebook') {
                  const av = document.querySelector('image[aria-label*="profile"], img[alt*="profile"]') || document.querySelector('image[role="img"]');
                  const nm = document.querySelector('h1') || document.querySelector('meta[property="og:title"]');
                  const bd = document.querySelector('[data-pagelet*="ProfileTilesAbout"]') || document.querySelector('meta[property="og:description"]');
                  avatar = (av && (av.href || av.src)) || ogImg || '';
                  name = (nm && (nm.textContent||nm.getAttribute('content')||'')) || ogTitle || '';
                  bio = (bd && bd.textContent.trim()) || ogDesc || '';
                } else if (netArg === 'linkedin') {
                  const av = document.querySelector('img.pv-top-card-profile-picture__image') || document.querySelector('img.profile-photo-edit__preview');
                  const nm = document.querySelector('h1.text-heading-xlarge') || document.querySelector('meta[property="og:title"]');
                  const bd = document.querySelector('.pv-about__summary-text') || document.querySelector('meta[name="description"]');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && (nm.textContent||nm.getAttribute('content')||'').trim()) || ogTitle || '';
                  bio = (bd && bd.textContent.trim()) || ogDesc || '';
                } else if (netArg === 'discord') {
                  const av = document.querySelector('img[alt*="avatar"]');
                  const nm = document.querySelector('div[class*="username"]');
                  const bd = document.querySelector('div[class*="bio"]');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && nm.textContent.trim()) || ogTitle || '';
                  bio = (bd && bd.textContent.trim()) || ogDesc || '';
                } else if (netArg === 'telegram') {
                  const av = document.querySelector('img[alt*="avatar"]');
                  const nm = document.querySelector('div[data-testid*="chat-info-title"]') || document.querySelector('h1');
                  const bd = document.querySelector('div[data-testid*="bio"]') || document.querySelector('p');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && nm.textContent.trim()) || ogTitle || '';
                  bio = (bd && bd.textContent.trim()) || ogDesc || '';
                } else if (netArg === 'tiktok') {
                  const av = document.querySelector('img[class*="avatar"]');
                  const nm = document.querySelector('h1[class*="user-title"]') || document.querySelector('h2');
                  const bd = document.querySelector('h2[class*="share-desc"]') || document.querySelector('p');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && nm.textContent.trim()) || ogTitle || '';
                  bio = (bd && bd.textContent.trim()) || ogDesc || '';
                } else if (netArg === 'pinterest') {
                  const av = document.querySelector('img[alt*="avatar"], img[alt*="profile"]');
                  const nm = document.querySelector('h1') || document.querySelector('meta[property="og:title"]');
                  const bd = document.querySelector('div[data-test-id="profile-bio"]') || document.querySelector('meta[property="og:description"]');
                  avatar = (av && av.src) || ogImg || '';
                  name = (nm && (nm.textContent||nm.getAttribute('content')||'').trim()) || ogTitle || '';
                  bio = (bd && (bd.textContent||bd.getAttribute('content')||'').trim()) || ogDesc || '';
                } else {
                  const avatarSel = document.querySelector('img[alt*="profile"], img[alt*="avatar"], img[aria-label*="profile"], img[aria-label*="avatar"]');
                  const headerImg = document.querySelector('header img');
                  avatar = (avatarSel && avatarSel.src) || (headerImg && headerImg.src) || ogImg || '';
                  const nameSel = document.querySelector('[data-testid="UserName"], [data-testid="ProfileName"], h1, h2');
                  name = (nameSel && (nameSel.textContent||'').trim()) || ogTitle || '';
                  const bioSel = document.querySelector('[data-testid="UserDescription"], [data-testid="ProfileDescription"]');
                  bio = (bioSel && (bioSel.textContent||'').trim()) || ogDesc || '';
                }
                return { avatar, name, bio, url: location.href };
              } catch (e) { return { error: e.message }; }
            }
          });
          const r = results && results[0] && results[0].result;
          if (r && (r.avatar || r.name || r.bio)) {
            await saveProfile(net, r);
            break;
          }
        } catch {}
      }
      // Fallback fetch si rien trouvé via onglets ouverts
      await fallbackFetch(net, domains);
    }
  } catch {}
}

chrome.runtime.onStartup.addListener(() => {
  try { chrome.alarms.create('robot_monitor', { periodInMinutes: 2 }); } catch {}
  monitorOnce();
});
chrome.runtime.onInstalled.addListener(() => {
  try { chrome.alarms.create('robot_monitor', { periodInMinutes: 2 }); } catch {}
  monitorOnce();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (!a) return;
  if (a.name === 'robot_monitor') monitorOnce();
  if (a.name === 'post_scheduler') {
    chrome.runtime.sendMessage({ type: 'QUEUE:PUBLISH_NEXT' }, () => {});
  }
});
