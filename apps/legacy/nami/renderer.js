// Router Logic
document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll(".nav-item");
    const pages = document.querySelectorAll(".page-view");
    const pageTitle = document.querySelector(".header-title"); // Changed ID to class in new HTML? No, kept structure.
    
    // Page switching
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetPage = item.getAttribute("data-page");
            if (!targetPage) return;
            
            // Update Nav
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            
            // Update View
            pages.forEach(p => p.classList.remove("active"));
            const targetEl = document.getElementById(`page-${targetPage}`);
            if (targetEl) targetEl.classList.add("active");
            
            // Update Title
            if (pageTitle) pageTitle.textContent = item.innerText.trim();
            
            renderActionsFor(targetPage);
        });
    });
    
    // Status Polling
    const extBadge = document.getElementById("ext-status-badge");
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    
    if (extBadge && statusDot && statusText) {
        setInterval(async () => {
            if (!window.nami) return;
            try {
                const status = await window.nami.extStatus();
                if (status && status.connected) {
                    extBadge.classList.add("connected");
                    statusDot.style.color = "#10b981";
                    statusText.textContent = "Extension: Connected";
                } else {
                    extBadge.classList.remove("connected");
                    statusDot.style.color = "#ef4444";
                    statusText.textContent = "Extension: Disconnected";
                }
            } catch (e) {
                console.error("Poll error", e);
            }
        }, 2000);
    }

    // Helper status UI
    const helperBadge = document.getElementById("helper-status-badge");
    const helperDot = document.getElementById("helper-dot");
    const helperText = document.getElementById("helper-text");
    if (window.nami && helperBadge && helperDot && helperText) {
        window.nami.on('helper-status', (info) => {
            const on = info && info.ok;
            if (on) {
                helperBadge.classList.add("connected");
                helperDot.style.color = "#10b981";
                helperText.textContent = "Helper: ON";
            } else {
                helperBadge.classList.remove("connected");
                helperDot.style.color = "#ef4444";
                helperText.textContent = "Helper: OFF";
            }
        });
    }

    // --- TOAST NOTIFICATION SYSTEM ---
    class Toast {
        static show(title, message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            let icon = 'ℹ️';
            if (type === 'success') icon = '✅';
            if (type === 'error') icon = '❌';
            if (type === 'warning') icon = '⚠️';
            
            toast.innerHTML = `
                <div class="toast-icon">${icon}</div>
                <div class="toast-content">
                    <div class="toast-title">${title}</div>
                    <div class="toast-message">${message}</div>
                </div>
            `;
            
            container.appendChild(toast);
            
            // Auto remove after animation
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 5000);
        }
    }
    window.Toast = Toast; // Expose globally

    // --- LIVE LOGGING SYSTEM ---
    const logContainer = document.getElementById('live-log-container');
    const clearBtn = document.getElementById('clear-logs');
    
    // Global Log Function
    window.log = (message, level = 'INFO', context = 'System') => {
        if (!logContainer) return;
        const row = document.createElement('div');
        row.className = 'log-entry';
        row.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-level ${level}">${level}</span>
            <span class="log-msg">[${context}] ${message}</span>
        `;
        logContainer.prepend(row);
        if (logContainer.children.length > 200) logContainer.lastElementChild.remove();
    };

    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (logContainer) logContainer.innerHTML = '';
        Toast.show('System', 'Logs cleared locally', 'info');
    });

    if (window.nami) {
        // Listen for Logs
        window.nami.on('log', (entry) => {
            window.log(entry.message, entry.level, entry.context);
        });
        
        // Listen for Task Results (Toasts)
        window.nami.on('task-result', (result) => {
            if (result.success) {
                Toast.show('Task Success', `Task executed successfully!`, 'success');
            } else {
                Toast.show('Task Failed', result.error || 'Unknown error', 'error');
            }
            
            // Also log to diagnostics if present
            const logBox = document.getElementById("diagnostics-log");
            if (logBox) {
                const line = document.createElement("div");
                line.textContent = `> [${new Date().toLocaleTimeString()}] Task ${result.success ? "OK" : "FAIL"}: ${JSON.stringify(result)}`;
                logBox.prepend(line);
            }
            const tId = result.taskId || (result.task && result.task.taskId) || null;
            if (tId && fetchMap.has(tId) && result.success && result.data) {
                const { base, type } = fetchMap.get(tId);
                fetchMap.delete(tId);
                if (type === 'boards' && Array.isArray(result.data.boards)) {
                    try { localStorage.setItem('boards:pinterest', JSON.stringify(result.data.boards)); } catch {}
                    const el = document.getElementById(`${base}-board`);
                    if (el) {
                        const sel = document.createElement('select');
                        sel.id = `${base}-board`;
                        sel.className = 'studio-select';
                        sel.style.width = '100%';
                        result.data.boards.forEach(b => {
                            const opt = document.createElement('option');
                            opt.value = b.id || b.name || b;
                            opt.textContent = b.name || b.title || String(b);
                            sel.appendChild(opt);
                        });
                        el.parentNode.replaceChild(sel, el);
                        Toast.show('Succès', 'Boards chargés.', 'success');
                    }
                }
                if ((type === 'channels' || type === 'chats') && Array.isArray(result.data.channels)) {
                    const idName = type === 'chats' ? 'chatId' : 'channelId';
                    try {
                        const keyStore = idName === 'chatId' ? 'chats:telegram' : 'channels:discord';
                        localStorage.setItem(keyStore, JSON.stringify(result.data.channels));
                    } catch {}
                    const el = document.getElementById(`${base}-${idName}`);
                    if (el) {
                        const sel = document.createElement('select');
                        sel.id = `${base}-${idName}`;
                        sel.className = 'studio-select';
                        sel.style.width = '100%';
                        result.data.channels.forEach(c => {
                            const opt = document.createElement('option');
                            opt.value = c.id || c.name || c;
                            opt.textContent = c.name || c.title || String(c);
                            sel.appendChild(opt);
                        });
                        el.parentNode.replaceChild(sel, el);
                        Toast.show('Succès', 'Canaux chargés.', 'success');
                    }
                }
            }
        });
        
        // Listen for Extension Status
        window.nami.on('ext-status-change', (status) => {
            if (status.connected) {
                Toast.show('Extension Connected', 'Communication bridge established.', 'success');
            } else {
                Toast.show('Extension Disconnected', 'Communication bridge lost.', 'warning');
            }
        });
    }

    // --- NETWORK STATUS & MANAGEMENT ---
    const updateNetworkStatus = async () => {
        if (!window.nami) return;
        try {
            const res = await window.nami.getNetworks();
            if (res.ok && res.data) {
                const networks = Object.keys(res.data);
                networks.forEach(net => {
                    const isConnected = res.data[net];
                    
                    // Update Header Badge
                    const badge = document.getElementById(`status-badge-${net}`);
                    if (badge) {
                        badge.className = `status-badge ${isConnected ? 'connected' : 'disconnected'}`;
                        badge.querySelector('.status-text').textContent = isConnected ? 'Connected' : 'Disconnected';
                    }

                    // Update Sidebar Dot
                    const navDot = document.getElementById(`nav-dot-${net}`);
                    if (navDot) {
                        navDot.className = `nav-status-dot ${isConnected ? 'connected' : 'disconnected'}`;
                    }

                    // Update Dashboard Mini Widget
                    const dashWidget = document.getElementById(`dash-status-${net}`);
                    if (dashWidget) {
                        dashWidget.className = `net-status-mini ${isConnected ? 'connected' : ''}`;
                        const stateText = dashWidget.querySelector('.net-state');
                        if (stateText) stateText.textContent = isConnected ? 'OK' : 'OFF';
                    }
                    
                    // Update Page Content
                    const title = document.getElementById(`${net}-status-title`);
                    const desc = document.getElementById(`${net}-status-desc`);
                    
                    if (title) title.textContent = isConnected ? `Connected` : 'Not Connected';
                    if (desc) desc.textContent = isConnected ? 
                        'System is ready to automate content for this network.' : 
                        'Connect account to enable automation features.';
                        
                    // Update Button Text if needed (Handle Multiple Buttons for same network, e.g. Accounts page + Detail page)
                    const buttons = document.querySelectorAll(`button[data-network="${net}"]`);
                    buttons.forEach(btn => {
                        btn.textContent = isConnected ? 'Reconnect / Switch Account' : `Connect ${net.charAt(0).toUpperCase() + net.slice(1)}`;
                        btn.className = isConnected ? 'btn btn-secondary nav-btn' : 'btn btn-primary nav-btn';
                    });
                });
            }
        } catch (e) {
            console.error("Network status error", e);
        }
    };

    // Initial check
    setTimeout(updateNetworkStatus, 1000);
    // Poll every 5 seconds
    setInterval(updateNetworkStatus, 5000);
    
    // Listen for updates from main
    if (window.nami) {
        window.nami.on('networks-updated', (data) => {
            updateNetworkStatus();
        });
    }

    // Connect Buttons
    document.querySelectorAll('.nav-btn[data-network]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const net = btn.getAttribute('data-network');
            if (window.nami) {
                Toast.show('System', `Opening login window for ${net}...`, 'info');
                await window.nami.loginOpen(net);
            }
        });
    });

    const networkActions = {
        instagram: [
            { key: 'edit_profile', label: 'Modifier le Profil', inputs: [{name:'bio',type:'text'},{name:'location',type:'text'}] },
            { key: 'post', label: 'Publier Post', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'},{name:'first_comment',type:'text'}] },
            { key: 'story', label: 'Publier Story', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] },
            { key: 'reel', label: 'Publier Reel', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'cover',type:'file'},{name:'hashtags',type:'text'}] }
        ],
        tiktok: [
            { key: 'video_feed', label: 'Publier Vidéo', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'},{name:'privacy',type:'select',options:['public','friends','private']}] },
            { key: 'story', label: 'Publier Story', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] }
        ],
        youtube: [
            { key: 'video', label: 'Uploader Vidéo', inputs: [{name:'title',type:'text'},{name:'description',type:'text'},{name:'media',type:'file'},{name:'thumbnail',type:'file'},{name:'tags',type:'text'},{name:'visibility',type:'select',options:['public','unlisted','private']},{name:'channelId',type:'text'}] },
            { key: 'short', label: 'Uploader Shorts', inputs: [{name:'title',type:'text'},{name:'description',type:'text'},{name:'media',type:'file'},{name:'thumbnail',type:'file'},{name:'tags',type:'text'},{name:'visibility',type:'select',options:['public','unlisted','private']},{name:'channelId',type:'text'}] }
        ],
        threads: [
            { key: 'post_text', label: 'Publier Texte', inputs: [{name:'text',type:'text'},{name:'hashtags',type:'text'}] },
            { key: 'post_image', label: 'Publier Image/Carousel', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] },
            { key: 'post_video', label: 'Publier Vidéo', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] }
        ],
        facebook: [
            { key: 'feed', label: 'Publier Post', inputs: [{name:'message',type:'text'},{name:'media',type:'file'},{name:'link',type:'text'}] },
            { key: 'reel', label: 'Publier Reel', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] },
            { key: 'story', label: 'Publier Story', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'}] }
        ],
        twitter: [
            { key: 'tweet_image', label: 'Publier Image', inputs: [{name:'text',type:'text'},{name:'media',type:'file'},{name:'replyTo',type:'text'},{name:'hashtags',type:'text'}] },
            { key: 'tweet_video', label: 'Publier Vidéo', inputs: [{name:'text',type:'text'},{name:'media',type:'file'},{name:'replyTo',type:'text'},{name:'hashtags',type:'text'}] }
        ],
        linkedin: [
            { key: 'post_image', label: 'Publier Image', inputs: [{name:'text',type:'text'},{name:'media',type:'file'},{name:'organizationUrn',type:'text'},{name:'hashtags',type:'text'}] },
            { key: 'post_video', label: 'Publier Vidéo', inputs: [{name:'text',type:'text'},{name:'media',type:'file'},{name:'organizationUrn',type:'text'},{name:'hashtags',type:'text'}] },
            { key: 'document', label: 'Publier Document', inputs: [{name:'text',type:'text'},{name:'file',type:'file'},{name:'organizationUrn',type:'text'}] }
        ],
        pinterest: [
            { key: 'pin_standard', label: 'Publier Pin', inputs: [{name:'title',type:'text'},{name:'description',type:'text'},{name:'media',type:'file'},{name:'link',type:'text'},{name:'board',type:'text'}] },
            { key: 'idea_pin', label: 'Publier Idea Pin', inputs: [{name:'title',type:'text'},{name:'description',type:'text'},{name:'media',type:'file'},{name:'board',type:'text'}] }
        ],
        snapchat: [
            { key: 'story', label: 'Publier Story', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] },
            { key: 'spotlight', label: 'Publier Spotlight', inputs: [{name:'caption',type:'text'},{name:'media',type:'file'},{name:'hashtags',type:'text'}] }
        ],
        discord: [
            { key: 'message', label: 'Envoyer Message', inputs: [{name:'text',type:'text'},{name:'channelId',type:'text'}] },
            { key: 'media', label: 'Envoyer Média', inputs: [{name:'text',type:'text'},{name:'media',type:'file'},{name:'channelId',type:'text'}] }
        ],
        telegram: [
            { key: 'message', label: 'Envoyer Message', inputs: [{name:'text',type:'text'},{name:'chatId',type:'text'}] }
        ],
        outlook: [
            { key: 'email', label: 'Envoyer Email', inputs: [{name:'to',type:'text'},{name:'cc',type:'text'},{name:'bcc',type:'text'},{name:'subject',type:'text'},{name:'text',type:'text'}] }
        ]
    };

    const renderActionsFor = (net) => {
        const container = document.getElementById(`actions-${net}`);
        if (!container || !networkActions[net]) return;
        const items = networkActions[net];
        container.innerHTML = items.map((it, idx) => {
            const idBase = `${net}-${it.key}-${idx}`;
            const inputsHtml = it.inputs.map(d => {
                if (d.type === 'file') return `<input type="file" id="${idBase}-${d.name}" class="studio-select" style="width:100%;">`;
                if (d.type === 'select') {
                    const opts = (d.options||[]).map(o => `<option value="${o}">${o}</option>`).join('');
                    return `<select id="${idBase}-${d.name}" class="studio-select" style="width:100%;">${opts}</select>`;
                }
                return `<input type="text" id="${idBase}-${d.name}" placeholder="${d.name}" class="studio-select" style="width:100%;">`;
            }).join('');
            return `
                <div class="card" style="padding:12px;">
                    <div class="card-title">${it.label}</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">${inputsHtml}</div>
                    <div style="display:flex; gap:8px; margin-top:8px; align-items:center;">
                        <input type="text" id="${idBase}-ai-topic" placeholder="Sujet (IA)" class="studio-select" style="flex:1;">
                        <button class="btn btn-secondary act-ai" data-net="${net}" data-key="${it.key}" data-base="${idBase}">🧠 Préremplir</button>
                        <button class="btn btn-secondary act-template" data-net="${net}" data-key="${it.key}" data-base="${idBase}">🧩 Modèle Réseau</button>
                        ${net==='pinterest' ? `<button class="btn btn-secondary act-load-boards" data-net="${net}" data-key="${it.key}" data-base="${idBase}">🔄 Charger boards</button>` : ``}
                        ${net==='discord' ? `<button class="btn btn-secondary act-load-channels" data-net="${net}" data-key="${it.key}" data-base="${idBase}">🔄 Charger channels</button>` : ``}
                        ${net==='telegram' ? `<button class="btn btn-secondary act-load-channels" data-net="${net}" data-key="${it.key}" data-base="${idBase}">🔄 Charger chats</button>` : ``}
                        <span id="${idBase}-compliance" class="status-badge" style="margin-left:auto;"></span>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button class="btn btn-primary act-publish" data-net="${net}" data-key="${it.key}" data-base="${idBase}">Publier</button>
                        <button class="btn btn-secondary act-schedule" data-net="${net}" data-key="${it.key}" data-base="${idBase}">Planifier</button>
                    </div>
                </div>
            `;
        }).join('');
        try {
            const boardsCache = JSON.parse(localStorage.getItem('boards:pinterest') || '[]');
            const discordChannelsCache = JSON.parse(localStorage.getItem('channels:discord') || '[]');
            const telegramChatsCache = JSON.parse(localStorage.getItem('chats:telegram') || '[]');
            items.forEach((it, idx) => {
                const idBase = `${net}-${it.key}-${idx}`;
                const mediaEl = document.getElementById(`${idBase}-media`);
                if (mediaEl) {
                    mediaEl.addEventListener('change', async () => {
                        const p = mediaEl.files && mediaEl.files[0] ? mediaEl.files[0].path : '';
                        const spec = requiredSpecs[net] && requiredSpecs[net][it.key] ? requiredSpecs[net][it.key] : null;
                        const badge = document.getElementById(`${idBase}-compliance`);
                        if (!p || !spec || !badge) return;
                        const meta = await getMediaMeta(p);
                        let ok = true;
                        let msg = '';
                        if (spec.ratio && !approxRatio(meta.width, meta.height, spec.ratio)) { ok = false; msg = `Ratio ${spec.ratio}`; }
                        if (ok && spec.maxDuration && meta.isVideo && meta.duration && meta.duration > spec.maxDuration) { ok = false; msg = `Durée ≤ ${spec.maxDuration}s`; }
                        badge.className = `status-badge ${ok ? 'connected' : 'disconnected'}`;
                        badge.querySelector('.status-dot') ? badge.querySelector('.status-dot').textContent = '●' : null;
                        const t = badge.querySelector('.status-text');
                        if (t) t.textContent = ok ? 'Conforme' : `À corriger: ${msg}`;
                        else badge.textContent = ok ? 'Conforme' : `À corriger: ${msg}`;
                    });
                }
                if (net === 'pinterest' && boardsCache.length) {
                    const el = document.getElementById(`${idBase}-board`);
                    if (el) {
                        const sel = document.createElement('select');
                        sel.id = `${idBase}-board`;
                        sel.className = 'studio-select';
                        sel.style.width = '100%';
                        boardsCache.forEach(b => {
                            const opt = document.createElement('option');
                            opt.value = b.id || b.name || b;
                            opt.textContent = b.name || b.title || String(b);
                            sel.appendChild(opt);
                        });
                        el.parentNode.replaceChild(sel, el);
                    }
                }
                if (net === 'discord' && discordChannelsCache.length) {
                    const el = document.getElementById(`${idBase}-channelId`);
                    if (el) {
                        const sel = document.createElement('select');
                        sel.id = `${idBase}-channelId`;
                        sel.className = 'studio-select';
                        sel.style.width = '100%';
                        discordChannelsCache.forEach(c => {
                            const opt = document.createElement('option');
                            opt.value = c.id || c.name || c;
                            opt.textContent = c.name || c.title || String(c);
                            sel.appendChild(opt);
                        });
                        el.parentNode.replaceChild(sel, el);
                    }
                }
                if (net === 'telegram' && telegramChatsCache.length) {
                    const el = document.getElementById(`${idBase}-chatId`);
                    if (el) {
                        const sel = document.createElement('select');
                        sel.id = `${idBase}-chatId`;
                        sel.className = 'studio-select';
                        sel.style.width = '100%';
                        telegramChatsCache.forEach(c => {
                            const opt = document.createElement('option');
                            opt.value = c.id || c.name || c;
                            opt.textContent = c.name || c.title || String(c);
                            sel.appendChild(opt);
                        });
                        el.parentNode.replaceChild(sel, el);
                    }
                }
            });
        } catch {}
    };

    const fetchMap = new Map();
    const getMediaMeta = (p) => new Promise((resolve) => {
        const lower = String(p || '').toLowerCase();
        if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.src = `file://${p}`;
            v.onloadedmetadata = () => resolve({ isVideo: true, width: v.videoWidth, height: v.videoHeight, duration: v.duration || 0 });
            v.onerror = () => resolve({ isVideo: true, error: true });
        } else {
            const img = new Image();
            img.onload = () => resolve({ isVideo: false, width: img.width, height: img.height, duration: 0 });
            img.onerror = () => resolve({ isVideo: false, error: true });
            img.src = `file://${p}`;
        }
    });
    const approxRatio = (w, h, target) => {
        if (!w || !h) return true;
        const map = { '9:16': 9/16, '16:9': 16/9, '1:1': 1, '4:5': 4/5, '2:3': 2/3, '1.91:1': 1.91/1 };
        const t = map[target] || null;
        if (!t) return true;
        const r = w / h;
        return Math.abs(r - t) <= 0.06;
    };
    const requiredSpecs = {
        instagram: { reel: { ratio: '9:16', maxDuration: 90 }, story: { ratio: '9:16', maxDuration: 60 } },
        tiktok: { video_feed: { ratio: '9:16', maxDuration: 600 }, story: { ratio: '9:16', maxDuration: 60 } },
        youtube: { short: { ratio: '9:16', maxDuration: 60 }, video: { ratio: '16:9' } },
        pinterest: { idea_pin: { ratio: '9:16' } },
        snapchat: { story: { ratio: '9:16', maxDuration: 60 }, spotlight: { ratio: '9:16', maxDuration: 60 } }
    };

    document.body.addEventListener('click', async (e) => {
        const pub = e.target.closest('.act-publish');
        const sch = e.target.closest('.act-schedule');
        const ai = e.target.closest('.act-ai');
        const tpl = e.target.closest('.act-template');
        const loadBoards = e.target.closest('.act-load-boards');
        const loadChannels = e.target.closest('.act-load-channels');
        if (!pub && !sch && !ai && !tpl && !loadBoards && !loadChannels) return;
        const btn = pub || sch || ai || tpl || loadBoards || loadChannels;
        const net = btn.getAttribute('data-net');
        const key = btn.getAttribute('data-key');
        const base = btn.getAttribute('data-base');
        const inputs = Array.from(document.querySelectorAll(`[id^="${base}-"]`));
        const payload = {};
        for (const el of inputs) {
            const name = el.id.slice(base.length+1);
            if (el.type === 'file') {
                payload[name] = el.files && el.files.length ? el.files[0].path || '' : '';
            } else {
                payload[name] = el.value || '';
            }
        }
        if (ai) {
            try {
                const topic = payload['ai-topic'] || 'Marketing';
                const res = await window.nami.aiGenerateHook(topic);
                const text = (res.text || '').split('\n').filter(Boolean).slice(0, 3).join(' ');
                if (net === 'youtube') {
                    const tEl = document.getElementById(`${base}-title`);
                    const dEl = document.getElementById(`${base}-description`);
                    if (tEl) tEl.value = text.substring(0, 80);
                    if (dEl) dEl.value = text;
                } else if (net === 'instagram' || net === 'facebook' || net === 'threads' || net === 'tiktok' || net === 'snapchat' || net === 'linkedin' || net === 'pinterest') {
                    const cEl = document.getElementById(`${base}-caption`) || document.getElementById(`${base}-text`);
                    const hEl = document.getElementById(`${base}-hashtags`);
                    if (cEl) cEl.value = text;
                    if (hEl) hEl.value = '#surf #ocean #marketing #trend';
                } else if (net === 'twitter') {
                    const tEl = document.getElementById(`${base}-text`);
                    if (tEl) tEl.value = text.substring(0, 240);
                } else if (net === 'outlook') {
                    const sEl = document.getElementById(`${base}-subject`);
                    const bEl = document.getElementById(`${base}-text`);
                    if (sEl) sEl.value = text.substring(0, 80);
                    if (bEl) bEl.value = text;
                }
                Toast.show('Succès', 'Champs préremplis par IA.', 'success');
            } catch {
                Toast.show('Erreur', 'IA indisponible.', 'error');
            }
            return;
        }
        if (tpl) {
            try {
                if (net === 'youtube') {
                    const tEl = document.getElementById(`${base}-title`);
                    const dEl = document.getElementById(`${base}-description`);
                    if (tEl) tEl.value = 'Titre clair, mot-clé principal au début';
                    if (dEl) dEl.value = 'Résumé clé\nPoints/chapitres\nAppel à l’action\nLiens utiles\nHashtags';
                } else if (net === 'instagram') {
                    const cEl = document.getElementById(`${base}-caption`);
                    const hEl = document.getElementById(`${base}-hashtags`);
                    const fEl = document.getElementById(`${base}-first_comment`);
                    if (cEl) cEl.value = 'Phrase d’accroche\nQuestion engageante\nCTA';
                    if (hEl) hEl.value = '#marque #thème #ville';
                    if (fEl) fEl.value = '#hashtags';
                } else if (net === 'linkedin') {
                    const tEl = document.getElementById(`${base}-text`);
                    if (tEl) tEl.value = 'Contexte business\nProblème → Solution\nValeur ajoutée\nCTA';
                } else if (net === 'twitter') {
                    const tEl = document.getElementById(`${base}-text`);
                    if (tEl) tEl.value = 'Accroche courte + hashtag clé';
                } else if (net === 'threads' || net === 'facebook') {
                    const cEl = document.getElementById(`${base}-caption`) || document.getElementById(`${base}-text`);
                    if (cEl) cEl.value = 'Accroche\nMessage central\nCTA';
                } else if (net === 'pinterest') {
                    const tEl = document.getElementById(`${base}-title`);
                    const dEl = document.getElementById(`${base}-description`);
                    if (tEl) tEl.value = 'Titre orienté recherche';
                    if (dEl) dEl.value = 'Description inspirante + mots-clés';
                } else if (net === 'outlook') {
                    const sEl = document.getElementById(`${base}-subject`);
                    const bEl = document.getElementById(`${base}-text`);
                    if (sEl) sEl.value = 'Objet précis et actionnable';
                    if (bEl) bEl.value = 'Introduction\nDétails pertinents\nCTA';
                }
                Toast.show('Succès', 'Modèle appliqué.', 'success');
            } catch {
                Toast.show('Erreur', 'Impossible d’appliquer le modèle.', 'error');
            }
            return;
        }
        if (loadBoards) {
            const taskId = `${net}-${key}-boards-${Date.now()}`;
            fetchMap.set(taskId, { base, type: 'boards' });
            try {
                const res = await window.nami.extQueue({ type: 'TASK:EXECUTE', payload: { taskId, action: 'FETCH_BOARDS', network: 'pinterest' } });
                if (!res.ok) throw new Error();
                Toast.show('Info', 'Chargement des boards...', 'info');
            } catch {
                Toast.show('Erreur', 'Impossible de charger les boards.', 'error');
            }
            return;
        }
        if (loadChannels) {
            const taskId = `${net}-${key}-channels-${Date.now()}`;
            fetchMap.set(taskId, { base, type: net === 'telegram' ? 'chats' : 'channels' });
            try {
                const res = await window.nami.extQueue({ type: 'TASK:EXECUTE', payload: { taskId, action: 'FETCH_CHANNELS', network: net } });
                if (!res.ok) throw new Error();
                Toast.show('Info', 'Chargement des canaux...', 'info');
            } catch {
                Toast.show('Erreur', 'Impossible de charger les canaux.', 'error');
            }
            return;
        }
        const errs = [];
        if (pub) {
            if (['post','story','reel','video_feed','video','short','post_image','post_video','pin_standard','idea_pin','spotlight'].includes(key)) {
                if (!payload.media) errs.push('media');
            }
            if (net === 'youtube' && (!payload.title || payload.title.length < 3)) errs.push('title');
            if (net === 'outlook' && (!payload.to || !payload.subject || !payload.text)) errs.push('to/subject/text');
            if (net === 'pinterest' && (!payload.board || !payload.title)) errs.push('board/title');
            if (net === 'discord' && (!payload.channelId)) errs.push('channelId');
            if (net === 'telegram' && (!payload.chatId)) errs.push('chatId');
            if (!errs.length && payload.media) {
                const meta = await getMediaMeta(payload.media);
                const spec = requiredSpecs[net] && requiredSpecs[net][key] ? requiredSpecs[net][key] : null;
                if (spec) {
                    if (spec.ratio && !approxRatio(meta.width, meta.height, spec.ratio)) errs.push(`ratio ${spec.ratio}`);
                    if (spec.maxDuration && meta.isVideo && meta.duration && meta.duration > spec.maxDuration) errs.push(`durée ≤ ${spec.maxDuration}s`);
                }
            }
        }
        if (errs.length) {
            Toast.show('Erreur', `Champs manquants: ${errs.join(', ')}`, 'error');
            return;
        }
        if (pub) {
            try {
                const res = await window.nami.extQueue({
                    type: "TASK:EXECUTE",
                    payload: {
                        taskId: `${net}-${key}-${Date.now()}`,
                        action: "PUBLISH",
                        network: net,
                        contentType: key,
                        data: payload
                    }
                });
                if (res && res.ok) {
                    Toast.show('Succès', 'Tâche envoyée au système.', 'success');
                } else {
                    Toast.show('Erreur', 'Impossible d’envoyer la tâche.', 'error');
                }
            } catch {
                Toast.show('Erreur', 'Échec de la publication.', 'error');
            }
        } else if (sch) {
            try {
                const ok = await window.nami.addScheduledPost({
                    network: net,
                    type: key,
                    content: JSON.stringify(payload),
                    scheduledTime: Date.now() + 15 * 60 * 1000
                });
                if (ok) {
                    Toast.show('Planifié', 'Ajouté au planning (15 min).', 'success');
                } else {
                    Toast.show('Erreur', 'Planification impossible.', 'error');
                }
            } catch {
                Toast.show('Erreur', 'Échec de la planification.', 'error');
            }
        }
    });
    // --- AI TOOLS ---
    const btnHook = document.getElementById('btn-ai-hook');
    const btnScript = document.getElementById('btn-ai-script');

    if (btnHook) {
        btnHook.addEventListener('click', async () => {
            const topic = document.getElementById('ai-hook-topic').value;
            if (!topic) return Toast.show('Error', 'Please enter a topic first.', 'error');
            
            const out = document.getElementById('ai-hook-output');
            out.innerHTML = '<span class="blink-dot"></span> Generating...';
            btnHook.disabled = true;
            
            window.log(`Generating hooks for topic: ${topic}`, 'INFO', 'AI-Engine');

            try {
                const res = await window.nami.aiGenerateHook(topic);
                const hooks = (res.text || "").split('\n').filter(l => l.trim().length > 0);
                
                out.innerHTML = hooks.map(h => `<div style="padding:4px; border-bottom:1px solid #333; cursor:pointer;" onclick="navigator.clipboard.writeText(this.innerText); Toast.show('Copied', 'Hook copied to clipboard', 'success')">${h}</div>`).join('');
                Toast.show('Success', 'Hooks generated successfully!', 'success');
                window.log(`Generated ${hooks.length} hooks for ${topic}`, 'INFO', 'AI-Engine');
            } catch (e) {
                out.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
                Toast.show('Error', 'Failed to generate hooks', 'error');
            } finally {
                btnHook.disabled = false;
            }
        });
    }

    if (btnScript) {
        btnScript.addEventListener('click', async () => {
            const topic = document.getElementById('ai-script-topic').value;
            if (!topic) return Toast.show('Error', 'Please enter a topic first.', 'error');
            
            const out = document.getElementById('ai-script-output');
            out.innerHTML = '<span class="blink-dot"></span> Generating Script...';
            btnScript.disabled = true;

            window.log(`Generating script for topic: ${topic}`, 'INFO', 'AI-Engine');
            
            try {
                const res = await window.nami.aiGenerateScript(topic);
                out.innerHTML = `
                    <div style="font-family:monospace; font-size:11px; white-space:pre-wrap;">
${res.text || "No script generated."}
                    </div>
                `;
                Toast.show('Success', 'Script generated!', 'success');
                window.log(`Script generated for ${topic}`, 'INFO', 'AI-Engine');
            } catch (e) {
                out.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
                Toast.show('Error', 'Failed to generate script', 'error');
            } finally {
                btnScript.disabled = false;
            }
        });
    }
    
    const btnUpdateApp = document.getElementById('btn-update-app');
    if (btnUpdateApp && window.nami) {
        btnUpdateApp.addEventListener('click', async () => {
            Toast.show('Mise à jour', 'Téléchargement et remplacement...', 'info');
            try {
                const res = await window.nami.updateApp();
                if (res && res.ok) {
                    Toast.show('Mise à jour', 'Nami va redémarrer', 'success');
                } else {
                    Toast.show('Mise à jour', (res && res.error) ? res.error : 'Erreur inconnue', 'error');
                }
            } catch (e) {
                Toast.show('Mise à jour', e.message || 'Erreur inconnue', 'error');
            }
        });
    }
    
    // --- COOKIE MANUAL IMPORT ---
    const btnSaveCookies = document.getElementById('btn-save-cookies');
    if (btnSaveCookies) {
        btnSaveCookies.addEventListener('click', async () => {
            const jsonStr = document.getElementById('cookie-json-input').value;
            const netSelect = document.getElementById('cookie-network-select').value;
            
            if (!jsonStr || !netSelect) {
                return Toast.show('Error', 'Please select network and paste JSON', 'error');
            }
            
            try {
                const cookies = JSON.parse(jsonStr);
                const res = await window.nami.importCookies({ network: netSelect, cookies });
                
                if (res.success) {
                    Toast.show('Success', `Imported ${res.count} cookies for ${netSelect}`, 'success');
                    document.getElementById('cookie-json-input').value = '';
                    window.log(`Imported ${res.count} cookies for ${netSelect}`, 'INFO', 'Auth');
                } else {
                    throw new Error(res.error);
                }
            } catch (e) {
                Toast.show('Error', 'Import Failed: ' + e.message, 'error');
            }
        });
    }

    const bridgeOut = document.getElementById('bridge-output');
    const btnBridgeUpdate = document.getElementById('btn-bridge-update');
    const btnBridgeHelper = document.getElementById('btn-bridge-helper');
    const btnBridgePing = document.getElementById('btn-bridge-ping');
    const btnBridgeExt = document.getElementById('btn-bridge-ext');
    if (btnBridgeUpdate && window.nami) {
        btnBridgeUpdate.addEventListener('click', async () => {
            Toast.show('Mise à jour', 'Téléchargement et remplacement...', 'info');
            try {
                const res = await window.nami.updateApp();
                if (res && res.ok) {
                    Toast.show('Mise à jour', 'Nami va redémarrer', 'success');
                } else {
                    Toast.show('Mise à jour', (res && res.error) ? res.error : 'Erreur inconnue', 'error');
                }
            } catch (e) {
                Toast.show('Mise à jour', e.message || 'Erreur inconnue', 'error');
            }
        });
    }
    if (btnBridgeHelper) {
        btnBridgeHelper.addEventListener('click', async () => {
            try {
                const r = await fetch('http://127.0.0.1:4545/api/helper/install', { method: 'POST' });
                if (r.ok) {
                    Toast.show('Helper', 'Activé', 'success');
                    if (bridgeOut) bridgeOut.textContent = 'Helper activé';
                } else {
                    const t = await r.text().catch(()=> '');
                    Toast.show('Helper', t || 'Erreur', 'error');
                }
            } catch (e) {
                Toast.show('Helper', e.message || 'Erreur réseau', 'error');
            }
        });
    }
    if (btnBridgePing) {
        btnBridgePing.addEventListener('click', async () => {
            try {
                const r = await fetch('http://127.0.0.1:4547/health', { method: 'GET' });
                const ok = r.ok;
                Toast.show('Ping', ok ? 'Helper: ON' : 'Helper: OFF', ok ? 'success' : 'warning');
                if (bridgeOut) bridgeOut.textContent = ok ? 'Helper: ON' : 'Helper: OFF';
            } catch {
                Toast.show('Ping', 'OFF', 'warning');
                if (bridgeOut) bridgeOut.textContent = 'Helper: OFF';
            }
        });
    }
    if (btnBridgeExt && window.nami) {
        btnBridgeExt.addEventListener('click', async () => {
            try {
                const st = await window.nami.extStatus();
                const on = st && st.connected;
                Toast.show('Extension', on ? 'Connected' : 'Disconnected', on ? 'success' : 'warning');
                if (bridgeOut) bridgeOut.textContent = on ? 'Extension: Connected' : 'Extension: Disconnected';
            } catch {
                Toast.show('Extension', 'Unknown', 'warning');
            }
        });
    }
    // --- SCHEDULER POPULATION ---
    const updateScheduler = async () => {
        const queue = document.getElementById('scheduler-queue');
        if (!queue) return;
        
        try {
            const scheduled = window.nami ? await window.nami.getScheduledPosts() : [];
            
            if (scheduled.length > 0) {
                queue.innerHTML = scheduled.map(item => `
                    <div style="display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:6px; margin-bottom:8px; border-left: 3px solid #3b82f6;">
                        <div style="width:120px; font-weight:bold; font-family:monospace;">${new Date(item.scheduledTime).toLocaleString()}</div>
                        <div style="width:100px;">${item.network}</div>
                        <div style="flex:1;">${item.content.substring(0, 30)}${item.content.length > 30 ? '...' : ''} <span style="opacity:0.6; font-size:11px;">(${item.type})</span></div>
                        <div style="font-size:11px; padding:2px 6px; background:rgba(255,255,255,0.1); border-radius:4px;">${item.status}</div>
                    </div>
                `).join('');
            } else {
                queue.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No scheduled posts</div>';
            }
        } catch (e) {
            console.error("Scheduler error", e);
        }
    };
    
    // Call once
    updateScheduler();
    // Refresh scheduler every 10s
    setInterval(updateScheduler, 10000);

}); // End DOMContentLoaded
const btnCookies = document.getElementById("cmd-get-cookies");
if (btnCookies) {
    btnCookies.addEventListener("click", async () => {
        if (!window.nami) return;
        Toast.show('System', 'Sending Cookie Sync Command...', 'info');
        const res = await window.nami.extQueue({
            type: "TASK:EXECUTE",
            payload: {
                taskId: "cookie-sync-" + Date.now(),
                action: "GET_COOKIES",
                params: { domain: "youtube.com" } 
            }
        });
        if (!res.ok) Toast.show('Error', 'Failed to queue command', 'error');
    });
}
 
