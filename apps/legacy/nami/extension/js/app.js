(function(){
  const Toasts = {
    show(text, type) {
      const c = document.getElementById('toasts'); if (!c) return;
      const el = document.createElement('div');
      el.className = `toast ${type||'info'}`;
      el.textContent = text || '';
      c.appendChild(el);
      setTimeout(()=> { try { el.remove(); } catch {} }, 2600);
    }
  };
  window.Toasts = Toasts;
  function show(id) {
    ['view-overview','view-montage','view-projects','view-nami','view-settings','view-platform'].forEach(v=>{
      const el = document.getElementById(v);
      if (el) el.style.display = (v===id) ? '' : 'none';
    });
  }
  function setActive(hash) {
    document.querySelectorAll('.nav .nav-item').forEach(a=>{
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === hash);
    });
  }
  function applyTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('ss_theme', t || 'dark'); } catch {}
    const tv = document.querySelector('#view-settings .metrics .metric .val');
    if (tv) tv.textContent = t === 'light' ? 'Light' : 'Dark';
  }
  function initTheme() {
    let t = 'dark';
    try { t = localStorage.getItem('ss_theme') || 'dark'; } catch {}
    applyTheme(t);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.onclick = () => {
      const now = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(now);
    };
  }
  function route() {
    const h = location.hash || '#overview';
    if (h === '#overview') { show('view-overview'); setActive('#overview'); return; }
    if (h === '#montage') {
      show('view-montage'); setActive('#montage');
      const drop = document.getElementById('mg-drop');
      const input = document.getElementById('mg-input');
      const audioIn = document.getElementById('mg-audio');
      const tl = document.getElementById('mg-timeline');
      const canvas = document.getElementById('mg-canvas');
      const videoOut = document.getElementById('mg-video');
      const btnAuto = document.getElementById('mg-auto');
      const btnRender = document.getElementById('mg-render');
      const btnFrame = document.getElementById('mg-export-frame');
      const widthEl = document.getElementById('mg-width');
      const heightEl = document.getElementById('mg-height');
      const fpsEl = document.getElementById('mg-fps');
      const durEl = document.getElementById('mg-duration');
      const ctx = canvas ? canvas.getContext('2d') : null;
      const MontageRobot = {
        assets: [],
        audio: null,
        addFiles(files) {
          const arr = Array.from(files||[]);
          arr.forEach(f=>{
            const fr = new FileReader();
            fr.onload = ()=> {
              const src = fr.result;
              const type = (f.type||'').startsWith('video') ? 'video' : 'image';
              MontageRobot.assets.push({ type, src, duration: parseFloat(durEl && durEl.value || '3') || 3 });
              MontageRobot.renderTimeline();
            };
            fr.readAsDataURL(f);
          });
        },
        renderTimeline() {
          if (!tl) return;
          tl.innerHTML = '';
          MontageRobot.assets.forEach((a,i)=>{
            const item = document.createElement('div'); item.className = 'mg-item';
            const th = document.createElement('div'); th.className = 'mg-thumb';
            if (a.type === 'image') { const img = document.createElement('img'); img.src = a.src; th.appendChild(img); }
            else { const v = document.createElement('video'); v.src = a.src; th.appendChild(v); }
            const lab = document.createElement('div'); lab.className = 'mg-label'; lab.textContent = `${a.type.toUpperCase()} • #${i+1}`;
            const dur = document.createElement('input'); dur.className = 'pf-input mg-duration'; dur.value = String(a.duration||3); dur.onchange = ()=> { a.duration = parseFloat(dur.value||'3')||3; };
            const rm = document.createElement('button'); rm.className = 'btn'; rm.textContent = 'X'; rm.onclick = ()=> { MontageRobot.assets.splice(i,1); MontageRobot.renderTimeline(); };
            item.appendChild(th); item.appendChild(lab); item.appendChild(dur); item.appendChild(rm);
            tl.appendChild(item);
          });
        },
        autoCompose() {
          MontageRobot.assets.forEach(a=> { a.duration = parseFloat(durEl && durEl.value || '3') || 3; });
          MontageRobot.renderTimeline();
        },
        async render() {
          if (!canvas || !ctx || MontageRobot.assets.length === 0) return;
          const tplSel = document.getElementById('mg-template');
          const transSel = document.getElementById('mg-transition');
          const overlayTextEl = document.getElementById('mg-overlay-text');
          const overlayPosEl = document.getElementById('mg-overlay-pos');
          const overlaySizeEl = document.getElementById('mg-overlay-size');
          let tplVal;
          let transitionVal;
          let ovTextVal;
          let ovPosVal;
          let ovSizeVal;
          try {
            const pc = localStorage.getItem('pipelineActive') || '';
            const cfg = pc ? JSON.parse(pc) : null;
            if (cfg) {
              const templates = ['720x1280','1080x1920','1080x1080'];
              const transitions = ['none','crossfade','slide'];
              const overlays = ['Swell incoming','Perfect swell','Surf report','Swellsync'];
              tplVal = templates[Math.floor(Math.random()*templates.length)];
              transitionVal = transitions[Math.floor(Math.random()*transitions.length)];
              ovTextVal = overlays[Math.floor(Math.random()*overlays.length)];
              ovPosVal = Math.random() < 0.5 ? 'top' : 'bottom';
              ovSizeVal = 22 + Math.floor(Math.random()*12);
              if (tplSel) tplSel.value = tplVal;
              if (transSel) transSel.value = transitionVal;
              if (overlayTextEl) overlayTextEl.value = ovTextVal;
              if (overlayPosEl) overlayPosEl.value = ovPosVal;
              if (overlaySizeEl) overlaySizeEl.value = String(ovSizeVal);
            }
          } catch {}
          const tpl = tplVal || (tplSel && tplSel.value) || `${parseInt(widthEl && widthEl.value || canvas.width,10)}x${parseInt(heightEl && heightEl.value || canvas.height,10)}`;
          const wh = tpl.split('x'); const W = parseInt(wh[0]||canvas.width,10), H=parseInt(wh[1]||canvas.height,10);
          const FPS = parseInt(fpsEl && fpsEl.value || '30', 10) || 30;
          const transition = transitionVal || (transSel && transSel.value) || 'none';
          const ovText = ovTextVal !== undefined ? ovTextVal : ((overlayTextEl && overlayTextEl.value) || '');
          const ovPos = ovPosVal || (overlayPosEl && overlayPosEl.value) || 'bottom';
          const ovSize = ovSizeVal || parseInt((overlaySizeEl && overlaySizeEl.value) || '28', 10) || 28;
          canvas.width = W; canvas.height = H;
          const stream = canvas.captureStream(FPS);
          const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
          const chunks = [];
          rec.ondataavailable = (e)=> { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = ()=> {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            if (videoOut) { videoOut.src = url; videoOut.play(); }
            try {
              const fr = new FileReader();
              fr.onload = () => {
                try {
                  const data = String(fr.result||'');
                  const pc = localStorage.getItem('pipelineActive') || '';
                  const cfg = pc ? JSON.parse(pc) : null;
                  if (cfg && Array.isArray(cfg.networks) && cfg.networks.length) {
                    if (cfg.autopost) {
                      try {
                        chrome.runtime.sendMessage(
                          { type: 'PIPELINE:PUBLISH', networks: cfg.networks, media: data },
                          (res) => {
                            const ok = res && res.ok;
                            Toasts.show(
                              ok ? `Publication lancée (${cfg.networks.join(', ')})` : 'Erreur publication',
                              ok ? 'success' : 'error'
                            );
                          }
                        );
                      } catch {
                        Toasts.show(`Publication lancée (${cfg.networks.join(', ')})`, 'success');
                      }
                    } else {
                      const firstAsset = (MontageRobot.assets && MontageRobot.assets[0]) ? MontageRobot.assets[0] : null;
                      const localItem = {
                        id: `demo-${Date.now()}`,
                        type: 'video',
                        media: data,
                        thumb: firstAsset && firstAsset.src ? firstAsset.src : '',
                        networks: cfg.networks,
                        status: 'ready',
                        createdAt: Date.now()
                      };
                      try {
                        const raw = localStorage.getItem('demoQueue') || '[]';
                        const arr = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
                        arr.unshift(localItem);
                        localStorage.setItem('demoQueue', JSON.stringify(arr));
                      } catch {}
                      try {
                        chrome.runtime.sendMessage(
                          { type: 'QUEUE:ADD', item: localItem },
                          () => { Toasts.show('Ajouté à la file', 'info'); }
                        );
                      } catch {
                        Toasts.show('Ajouté à la file', 'info');
                      }
                    }
                  }
                  const bs = localStorage.getItem('batchSources') || '';
                  const bArr = bs ? JSON.parse(bs) : null;
                  if (bArr && Array.isArray(bArr) && bArr.length) {
                    const next = bArr.shift();
                    localStorage.setItem('batchSources', JSON.stringify(bArr));
                    (async ()=>{
                      const r = await fetch(next.url); const bb = await r.blob();
                      const du = await new Promise((res)=> { const fr2 = new FileReader(); fr2.onload = ()=> res(fr2.result); fr2.readAsDataURL(bb); });
                      MontageRobot.assets = [{ type: next.type, src: du, duration: parseFloat(durEl && durEl.value || '3') || 3 }];
                      MontageRobot.renderTimeline();
                      btnRender && btnRender.click();
                    })();
                  } else {
                    localStorage.removeItem('pipelineActive');
                    Toasts.show('Préparation terminée', 'success');
                    location.hash = '#reseaux';
                  }
                } catch {}
              };
              fr.readAsDataURL(blob);
            } catch {}
            Toasts.show('Rendu terminé', 'success');
          };
          rec.start();
          for (let i=0; i<MontageRobot.assets.length; i++) {
            const a = MontageRobot.assets[i];
            if (a.type === 'image') {
              await (function(){
                return new Promise((resolve)=>{
                  const img = new Image();
                  img.onload = ()=> {
                    const dur = a.duration || 3;
                    const total = Math.max(1, Math.floor(dur*FPS));
                    for (let f=0; f<total; f++) {
                      const t = f/total;
                      const scale = 1 + 0.08*t;
                      const x = (img.width*scale - W)/2 * (0.5 - t);
                      const y = (img.height*scale - H)/2 * (0.5 - t);
                      ctx.clearRect(0,0,W,H);
                      ctx.save();
                      ctx.scale(scale, scale);
                      ctx.drawImage(img, -x/scale, -y/scale, img.width, img.height);
                      ctx.restore();
                      if (ovText) {
                        ctx.save();
                        ctx.font = `bold ${ovSize}px system-ui`;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        const pad = 12, hgt = ovSize + pad*2;
                        const tw = ctx.measureText(ovText).width + pad*2;
                        const ox = (W - tw)/2;
                        const oy = ovPos === 'top' ? pad : (H - hgt - pad);
                        ctx.fillRect(ox, oy, tw, hgt);
                        ctx.fillStyle = '#fff';
                        ctx.fillText(ovText, ox+pad, oy + ovSize - 6);
                        ctx.restore();
                      }
                    }
                    resolve();
                  };
                  img.src = a.src;
                });
              })();
            } else {
              await (function(){
                return new Promise((resolve)=>{
                  const v = document.createElement('video'); v.src = a.src; v.muted = true; v.playsInline = true;
                  v.onloadeddata = async ()=> {
                    try { await v.play(); } catch {}
                    const dur = a.duration || Math.min(3, Math.floor(v.duration)||3);
                    const total = Math.max(1, Math.floor(dur*FPS));
                    const step = (v.duration || dur)/total;
                    for (let f=0; f<total; f++) {
                      ctx.clearRect(0,0,W,H);
                      ctx.drawImage(v, 0, 0, W, H);
                      v.currentTime = Math.min((v.currentTime||0)+step, v.duration||dur);
                      if (ovText) {
                        ctx.save();
                        ctx.font = `bold ${ovSize}px system-ui`;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)';
                        const pad = 12, hgt = ovSize + pad*2;
                        const tw = ctx.measureText(ovText).width + pad*2;
                        const ox = (W - tw)/2;
                        const oy = ovPos === 'top' ? pad : (H - hgt - pad);
                        ctx.fillRect(ox, oy, tw, hgt);
                        ctx.fillStyle = '#fff';
                        ctx.fillText(ovText, ox+pad, oy + ovSize - 6);
                        ctx.restore();
                      }
                    }
                    v.pause();
                    resolve();
                  };
                });
              })();
            }
            const next = MontageRobot.assets[i+1];
            if (next) {
              const T = 0.5; const frames = Math.max(1, Math.floor(T*FPS));
              if (transition === 'crossfade') {
                const imgA = new Image(); const imgB = new Image();
                imgA.src = a.type==='image' ? a.src : ''; imgB.src = next.type==='image' ? next.src : '';
                for (let f=0; f<frames; f++) {
                  const t = f/frames;
                  ctx.clearRect(0,0,W,H);
                  if (imgA.src) { ctx.globalAlpha = 1-t; ctx.drawImage(imgA, 0, 0, W, H); }
                  if (imgB.src) { ctx.globalAlpha = t; ctx.drawImage(imgB, 0, 0, W, H); }
                  ctx.globalAlpha = 1;
                  if (ovText) {
                    ctx.save();
                    ctx.font = `bold ${ovSize}px system-ui`;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    const pad = 12, hgt = ovSize + pad*2;
                    const tw = ctx.measureText(ovText).width + pad*2;
                    const ox = (W - tw)/2;
                    const oy = ovPos === 'top' ? pad : (H - hgt - pad);
                    ctx.fillRect(ox, oy, tw, hgt);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(ovText, ox+pad, oy + ovSize - 6);
                    ctx.restore();
                  }
                }
              } else if (transition === 'slide') {
                const imgA = new Image(); const imgB = new Image();
                imgA.src = a.type==='image' ? a.src : ''; imgB.src = next.type==='image' ? next.src : '';
                for (let f=0; f<frames; f++) {
                  const t = f/frames;
                  ctx.clearRect(0,0,W,H);
                  if (imgA.src) ctx.drawImage(imgA, -t*W, 0, W, H);
                  if (imgB.src) ctx.drawImage(imgB, (1-t)*W, 0, W, H);
                  if (ovText) {
                    ctx.save();
                    ctx.font = `bold ${ovSize}px system-ui`;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    const pad = 12, hgt = ovSize + pad*2;
                    const tw = ctx.measureText(ovText).width + pad*2;
                    const ox = (W - tw)/2;
                    const oy = ovPos === 'top' ? pad : (H - hgt - pad);
                    ctx.fillRect(ox, oy, tw, hgt);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(ovText, ox+pad, oy + ovSize - 6);
                    ctx.restore();
                  }
                }
              } else {
                for (let f=0; f<frames; f++) {
                  const t = f/frames;
                  ctx.fillStyle = `rgba(0,0,0,${0.6*(1-t)})`;
                  ctx.fillRect(0,0,W,H);
                }
              }
            }
          }
          rec.stop();
        },
        playImage(a, ctx, W, H, FPS) {
          return new Promise((resolve)=>{
            const img = new Image();
            img.onload = ()=> {
              const dur = a.duration || 3;
              const total = Math.max(1, Math.floor(dur*FPS));
              for (let f=0; f<total; f++) {
                const t = f/total;
                const scale = 1 + 0.08*t;
                const x = (img.width*scale - W)/2 * (0.5 - t);
                const y = (img.height*scale - H)/2 * (0.5 - t);
                ctx.clearRect(0,0,W,H);
                ctx.save();
                ctx.scale(scale, scale);
                ctx.drawImage(img, -x/scale, -y/scale, img.width, img.height);
                ctx.restore();
              }
              resolve();
            };
            img.src = a.src;
          });
        },
        playVideo(a, ctx, W, H, FPS) {
          return new Promise((resolve)=>{
            const v = document.createElement('video'); v.src = a.src; v.muted = true; v.playsInline = true;
            v.onloadeddata = async ()=> {
              try { await v.play(); } catch {}
              const dur = a.duration || Math.min(3, Math.floor(v.duration)||3);
              const total = Math.max(1, Math.floor(dur*FPS));
              const step = (v.duration || dur)/total;
              let tAcc = 0;
              for (let f=0; f<total; f++) {
                ctx.clearRect(0,0,W,H);
                ctx.drawImage(v, 0, 0, W, H);
                v.currentTime = Math.min((v.currentTime||0)+step, v.duration||dur);
                tAcc += 1/FPS;
              }
              v.pause();
              resolve();
            };
          });
        }
      };
      if (drop) {
        drop.addEventListener('dragover', (e)=> { e.preventDefault(); drop.classList.add('drag'); });
        drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
        drop.addEventListener('drop', (e)=> { e.preventDefault(); drop.classList.remove('drag'); MontageRobot.addFiles(e.dataTransfer.files); });
      }
      let pipelineCfg = null;
      try {
        const q = localStorage.getItem('montageQueue') || '[]';
        const arr = JSON.parse(q);
        if (Array.isArray(arr) && arr.length) {
          arr.forEach(a => {
            if (a.type === 'effect') return;
            MontageRobot.assets.push({ type: a.type, src: a.src, duration: parseFloat(durEl && durEl.value || '3') || 3 });
          });
          MontageRobot.renderTimeline();
          localStorage.removeItem('montageQueue');
          Toasts.show(`Import Nami: ${arr.length} élément(s)`, 'info');
        }
        const pc = localStorage.getItem('pipelineActive') || '';
        if (pc) pipelineCfg = JSON.parse(pc);
        const bs = localStorage.getItem('batchSources') || '';
        const bArr = bs ? JSON.parse(bs) : null;
        if (bArr && Array.isArray(bArr) && bArr.length) {
          const first = bArr.shift();
          localStorage.setItem('batchSources', JSON.stringify(bArr));
          (async ()=> {
            let dataUrl = '';
            try {
              if (first && first.url && /^https?:/i.test(first.url)) {
                const r = await fetch(first.url);
                const b = await r.blob();
                dataUrl = await new Promise((res)=> {
                  const fr = new FileReader();
                  fr.onload = ()=> res(fr.result);
                  fr.readAsDataURL(b);
                });
              }
            } catch {}
            if (!dataUrl) {
              const wDemo = parseInt(widthEl && widthEl.value || '720', 10) || 720;
              const hDemo = parseInt(heightEl && heightEl.value || '1280', 10) || 1280;
              const cDemo = document.createElement('canvas');
              cDemo.width = wDemo;
              cDemo.height = hDemo;
              const ctxDemo = cDemo.getContext('2d');
              if (ctxDemo) {
                const grad = ctxDemo.createLinearGradient(0, 0, wDemo, hDemo);
                grad.addColorStop(0, '#2b5876');
                grad.addColorStop(1, '#4e4376');
                ctxDemo.fillStyle = grad;
                ctxDemo.fillRect(0, 0, wDemo, hDemo);
                ctxDemo.fillStyle = '#ffffff';
                ctxDemo.font = '48px system-ui,sans-serif';
                ctxDemo.textAlign = 'center';
                ctxDemo.textBaseline = 'middle';
                ctxDemo.fillText('SwellSync Demo', wDemo/2, hDemo/2);
              }
              dataUrl = cDemo.toDataURL('image/png');
            }
            MontageRobot.assets = [{
              type: (first && first.type) || 'image',
              src: dataUrl,
              duration: parseFloat(durEl && durEl.value || '3') || 3
            }];
            MontageRobot.renderTimeline();
            if (btnRender) btnRender.click();
          })();
        }
      } catch {}
      if (pipelineCfg && (!localStorage.getItem('batchSources'))) {
        if (btnAuto) btnAuto.click();
        if (btnRender && pipelineCfg.autopost) btnRender.click();
      }
      if (input) input.onchange = ()=> MontageRobot.addFiles(input.files);
      if (audioIn) audioIn.onchange = ()=> {
        const f = audioIn.files && audioIn.files[0]; if (!f) return;
        const fr = new FileReader(); fr.onload = ()=> { MontageRobot.audio = fr.result; Toasts.show('Audio chargé', 'info'); }; fr.readAsDataURL(f);
      };
      if (btnAuto) btnAuto.onclick = ()=> MontageRobot.autoCompose();
      if (btnRender) btnRender.onclick = ()=> MontageRobot.render();
      if (btnFrame) btnFrame.onclick = ()=> {
        if (!canvas) return;
        canvas.toBlob((blob)=> { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'frame.png'; a.click(); }, 'image/png');
      };
      const tplSel2 = document.getElementById('mg-template');
      if (tplSel2) tplSel2.onchange = ()=> {
        const val = tplSel2.value || '720x1280';
        const wh = val.split('x'); const w = parseInt(wh[0]||'720',10), h = parseInt(wh[1]||'1280',10);
        if (widthEl) widthEl.value = String(w);
        if (heightEl) heightEl.value = String(h);
        if (canvas) { canvas.width = w; canvas.height = h; }
      };
      return;
    }
    if (h === '#projects') { show('view-projects'); setActive('#reseaux'); refreshConnections(); refreshProjectSyncDots(); return; }
    if (h === '#reseaux') {
      Toasts.show('Route: Réseaux', 'info');
      show('view-projects'); setActive('#reseaux'); refreshConnections(); refreshProjectSyncDots();
      const qEl = document.getElementById('rx-query');
      const tEl = document.getElementById('rx-type');
      const btn = document.getElementById('rx-start');
      const btnGo = document.getElementById('rx-go');
      const btnStop = document.getElementById('rx-stop');
      const btnClear = document.getElementById('rx-clear-queue');
      const btnRefresh = document.getElementById('rx-refresh-queue');
      const queueEl = document.getElementById('rx-queue');
      const queueCountEl = document.getElementById('rx-queue-count');
      const nextEl = document.getElementById('rx-next');
      const histEl = document.getElementById('rx-history');
      const srcs = {
        pexels: document.getElementById('rx-src-pexels'),
        unsplash: document.getElementById('rx-src-unsplash'),
        pixabay: document.getElementById('rx-src-pixabay'),
      };
      const nets = {
        instagram: document.getElementById('rx-net-instagram'),
        facebook: document.getElementById('rx-net-facebook'),
        tiktok: document.getElementById('rx-net-tiktok'),
        youtube: document.getElementById('rx-net-youtube'),
        twitter: document.getElementById('rx-net-twitter'),
      };
      const autopostEl = document.getElementById('rx-autopost');
      const intervalEl = document.getElementById('rx-interval');
      if (!Object.keys(srcs).some(k => srcs[k] && srcs[k].checked)) {
        if (srcs.pexels) srcs.pexels.checked = true;
        if (srcs.unsplash) srcs.unsplash.checked = true;
      }
      function selectedSources() {
        return Object.keys(srcs).filter(k => srcs[k] && srcs[k].checked);
      }
      function selectedNetworks() {
        return Object.keys(nets).filter(k => nets[k] && nets[k].checked);
      }
      async function toDataUrl(url) {
        const r = await fetch(url); const b = await r.blob();
        return await new Promise((res)=> { const fr = new FileReader(); fr.onload = ()=> res(fr.result); fr.readAsDataURL(b); });
      }
      function autoKeyword() {
        const topics = [
          'surf',
          'vague',
          'swell',
          'ocean',
          'surf report',
          'sunset surf',
          'big wave',
          'longboard',
          'shortboard'
        ];
        const idx = Math.floor(Math.random()*topics.length);
        return topics[idx] || 'surf';
      }
      async function startPipeline() {
        try {
          let query = String(qEl && qEl.value || '').trim();
          if (!query) {
            query = autoKeyword();
            if (qEl) qEl.value = query;
          }
          const mtype = String(tEl && tEl.value || 'image');
          const sources = selectedSources();
          let networks = selectedNetworks();
          if (!networks.length) {
            if (nets.instagram) nets.instagram.checked = true;
            if (nets.tiktok) nets.tiktok.checked = true;
            networks = selectedNetworks();
          }
          const autopost = !!(autopostEl && autopostEl.checked);
          const interval = parseInt(intervalEl && intervalEl.value || '15', 10) || 15;
          const limit = 6;
          const jobs = sources.map(src => new Promise((resolve) => {
            try {
              chrome.runtime.sendMessage(
                { type: 'NAMI:SEARCH', source: src, mediaType: mtype, query: query, limit },
                (res) => {
                  if (res && res.ok && Array.isArray(res.items)) resolve(res.items);
                  else resolve([]);
                }
              );
            } catch {
              resolve([]);
            }
          }));
          let items = [];
          try {
            const arrays = await Promise.all(jobs);
            items = arrays.flat().slice(0, limit);
          } catch {}
          if (!items.length) {
            if (mtype === 'video') {
              items = [
                { type:'video', url:'https://player.vimeo.com/external/209315864.sd.mp4?s=fd166e3a902be65a34d08ec4c596cb8f5e50c4ee&profile_id=164&oauth2_token_id=57447761' }
              ];
            } else {
              items = [
                { type:'image', url:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e' },
                { type:'image', url:'https://images.unsplash.com/photo-1500375592092-40eb2168fd21' }
              ];
            }
          }
          const batchSources = [];
          for (const it of items) {
            if (!it) continue;
            if (mtype === 'video') {
              const src = it.url || it.mp4 || it.preview;
              if (src) batchSources.push({ type: 'video', url: src });
            } else {
              const src = it.url || it.thumb;
              if (src) batchSources.push({ type: 'image', url: src });
            }
          }
          localStorage.setItem('batchSources', JSON.stringify(batchSources));
          localStorage.setItem('pipelineActive', JSON.stringify({ networks, autopost, interval, mtype }));
          location.hash = '#montage';
          Toasts.show(`Préparation lot ${mtype === 'video' ? 'vidéos' : 'images'} (${batchSources.length} sources)`, 'info');
        } catch (e) {
          try { Toasts.show('Erreur pipeline: ' + (e && e.message || e), 'error'); } catch {}
        }
      }
      if (btn) btn.onclick = startPipeline;
      function renderQueue(items) {
        if (queueCountEl) queueCountEl.textContent = `${items.filter(i=>i.status==='ready').length} en attente`;
        if (!queueEl) return;
        queueEl.innerHTML = '';
        items.forEach((it) => {
          const card = document.createElement('div'); card.className = 'nm-card';
          const thumbSrc = it.thumb || it.media || '';
          const img = document.createElement('img');
          img.src = thumbSrc;
          img.style.objectFit = 'cover';
          img.style.width = '100%';
          img.style.height = '100%';
          card.appendChild(img);
          if (it.type === 'video') {
            card.onclick = () => {
              try {
                const src = thumbSrc;
                if (!src) return;
                const w = window.open('', '_blank');
                if (!w) return;
                const doc = w.document;
                doc.title = 'Prévisualisation SwellSync';
                doc.body.style.margin = '0';
                const canvas = doc.createElement('canvas');
                const W = 720, H = 1280;
                canvas.width = W;
                canvas.height = H;
                canvas.style.width = '100%';
                canvas.style.display = 'block';
                doc.body.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                const im = new Image();
                im.onload = () => {
                  let start = null;
                  function loop(ts) {
                    if (!ctx) return;
                    if (!start) start = ts;
                    const elapsed = (ts - start) % 6000;
                    const p = elapsed / 6000;
                    const scale = 1 + 0.15 * p;
                    const x = (im.width * scale - W) / 2 * (0.5 - p);
                    const y = (im.height * scale - H) / 2 * (0.5 - p);
                    ctx.clearRect(0, 0, W, H);
                    ctx.save();
                    ctx.scale(scale, scale);
                    ctx.drawImage(im, -x / scale, -y / scale, im.width, im.height);
                    ctx.restore();
                    if (!w.closed) w.requestAnimationFrame(loop);
                  }
                  w.requestAnimationFrame(loop);
                };
                im.src = src;
              } catch {}
            };
          }
          const t = document.createElement('div'); t.className = 'nm-title';
          const nets = Array.isArray(it.networks) ? it.networks.join(', ') : '';
          t.textContent = `${it.type} • ${it.status}${nets ? ' • ' + nets : ''}`;
          card.appendChild(t);
          queueEl.appendChild(card);
        });
      }
      function renderHistory(items) {
        if (!histEl) return;
        histEl.innerHTML = '';
        items.forEach(it => {
          const row = document.createElement('div'); row.className = 'rx-item';
          const meta = document.createElement('div'); meta.className = 'rx-meta';
          const d = new Date(it.postedAt || Date.now());
          meta.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
          const netsBox = document.createElement('div'); netsBox.className = 'rx-nets';
          const nets = Array.isArray(it.networks) ? it.networks : [];
          nets.forEach(n => {
            const pill = document.createElement('div'); pill.className = 'rx-pill posted'; pill.textContent = n;
            netsBox.appendChild(pill);
          });
          row.appendChild(meta); row.appendChild(netsBox);
          histEl.appendChild(row);
        });
      }
      function renderStatus(obj) {
        if (!nextEl || !obj) return;
        if (!obj.running || !obj.interval || !obj.nextRunAt) {
          nextEl.textContent = 'Prochain: -';
          return;
        }
        const diff = obj.nextRunAt - Date.now();
        if (diff <= 0) {
          nextEl.textContent = 'Prochain: imminent';
          return;
        }
        const mins = Math.round(diff / 60000);
        nextEl.textContent = `Prochain: dans ${mins} min`;
      }
      async function refreshQueue() {
        try {
          let items = [];
          try {
            chrome.runtime.sendMessage({ type: 'QUEUE:GET' }, (res) => {
              if (res && res.ok && Array.isArray(res.items)) items = res.items || [];
              try {
                const raw = localStorage.getItem('demoQueue') || '[]';
                const demo = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
                renderQueue(demo.concat(items));
              } catch {
                renderQueue(items);
              }
            });
          } catch {
            try {
              const raw = localStorage.getItem('demoQueue') || '[]';
              const demo = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
              renderQueue(demo);
            } catch {}
          }
          try { chrome.runtime.sendMessage({ type: 'QUEUE:HISTORY' }, (res) => { if (res && res.ok) renderHistory(res.items || []); }); } catch {}
          try { chrome.runtime.sendMessage({ type: 'QUEUE:STATUS' }, (res) => { if (res && res.ok) renderStatus(res); }); } catch {}
        } catch {}
      }
      if (btnRefresh) btnRefresh.onclick = refreshQueue;
      if (btnClear) btnClear.onclick = () => { try { chrome.runtime.sendMessage({ type: 'QUEUE:CLEAR' }, (res) => { Toasts.show(res && res.ok ? 'File vidée' : 'Erreur', res && res.ok ? 'info' : 'error'); refreshQueue(); }); } catch {} };
      if (btnGo) btnGo.onclick = () => {
        const interval = parseInt(intervalEl && intervalEl.value || '15', 10) || 15;
        const networks = selectedNetworks();
        try { chrome.runtime.sendMessage({ type: 'QUEUE:START', networks, interval }, (res) => { Toasts.show(res && res.ok ? 'Publication démarrée' : 'Erreur', res && res.ok ? 'success' : 'error'); refreshQueue(); }); } catch {}
      };
      if (btnStop) btnStop.onclick = () => { try { chrome.runtime.sendMessage({ type: 'QUEUE:STOP' }, (res) => { Toasts.show(res && res.ok ? 'Publication stoppée' : 'Erreur', res && res.ok ? 'info' : 'error'); }); } catch {} };
      refreshQueue();
      return;
    }
    if (h === '#nami') {
      show('view-nami'); setActive('#nami');
      const queryEl = document.getElementById('nm-query');
      const typeEl = document.getElementById('nm-type');
      const resEl = document.getElementById('nm-results');
      const btnSearch = document.getElementById('nm-search');
      const btnAuto = document.getElementById('nm-autosource');
      const btnAdd = document.getElementById('nm-add-montage');
      const importEl = document.getElementById('nm-import');
      const srcPexels = document.getElementById('nm-src-pexels');
      const srcUnsplash = document.getElementById('nm-src-unsplash');
      const srcPixabay = document.getElementById('nm-src-pixabay');
      function sources() {
        const arr = [];
        if (srcPexels && srcPexels.checked) arr.push('pexels');
        if (srcUnsplash && srcUnsplash.checked) arr.push('unsplash');
        if (srcPixabay && srcPixabay.checked) arr.push('pixabay');
        return arr;
      }
      function renderResults(items) {
        if (!resEl) return;
        resEl.innerHTML = '';
        items.forEach((it, idx) => {
          const card = document.createElement('div'); card.className = 'nm-card';
          const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'nm-check'; chk.dataset.idx = String(idx);
          card.appendChild(chk);
          if (it.type === 'image') {
            const img = document.createElement('img'); img.src = it.url || it.thumb; card.appendChild(img);
          } else if (it.type === 'video') {
            const vid = document.createElement('video'); vid.src = it.preview || ''; vid.muted = true; vid.loop = true; try { vid.play(); } catch {} card.appendChild(vid);
          } else if (it.type === 'audio') {
            const aud = document.createElement('audio'); aud.src = it.url || ''; aud.controls = true; card.appendChild(aud);
          } else if (it.type === 'effect') {
            const box = document.createElement('div'); box.style.padding = '24px'; box.textContent = it.name || 'Effet'; card.appendChild(box);
          }
          const t = document.createElement('div'); t.className = 'nm-title'; t.textContent = it.title || `${it.type} • ${it.source || ''}`; card.appendChild(t);
          resEl.appendChild(card);
        });
      }
      let current = [];
      async function runSearch(q, t, srcs) {
        current = [];
        const limit = 12;
        if (t === 'effect') {
          current = [
            { type:'effect', name:'Glitch', source:'builtin' },
            { type:'effect', name:'Vignette', source:'builtin' },
            { type:'effect', name:'Woosh', source:'builtin' },
            { type:'effect', name:'Zoom In', source:'builtin' }
          ];
          renderResults(current);
          return;
        }
        const jobs = srcs.map(src => new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage({ type: 'NAMI:SEARCH', source: src, mediaType: t, query: q, limit }, (res) => {
              if (res && res.ok && Array.isArray(res.items)) resolve(res.items);
              else resolve([]);
            });
          } catch { resolve([]); }
        }));
        const arrays = await Promise.all(jobs);
        current = arrays.flat();
        renderResults(current);
      }
      if (btnSearch) btnSearch.onclick = ()=> runSearch(String(queryEl && queryEl.value || 'surf'), String(typeEl && typeEl.value || 'image'), sources());
      if (btnAuto) btnAuto.onclick = ()=> {
        const t = String(typeEl && typeEl.value || 'image');
        const q = String(queryEl && queryEl.value || 'surf');
        runSearch(q, t, sources());
      };
      if (importEl) importEl.onchange = ()=> {
        const files = Array.from(importEl.files||[]);
        current = current.concat(files.map(f => ({ type: (f.type||'').startsWith('video') ? 'video' : (f.type||'').startsWith('audio') ? 'audio' : 'image', file: f, title: f.name, source: 'local' })));
        renderResults(current);
      };
      if (btnAdd) btnAdd.onclick = async ()=> {
        const selected = [];
        document.querySelectorAll('.nm-check').forEach(ch => {
          const idx = parseInt(ch.dataset.idx||'-1',10);
          if ((ch).checked && current[idx]) selected.push(current[idx]);
        });
        const queue = [];
        async function toDataUrl(url) {
          const r = await fetch(url); const b = await r.blob();
          return await new Promise((res)=> { const fr = new FileReader(); fr.onload = ()=> res(fr.result); fr.readAsDataURL(b); });
        }
        for (const it of selected) {
          if (it.file) {
            const dataUrl = await new Promise((res)=> { const fr = new FileReader(); fr.onload = ()=> res(fr.result); fr.readAsDataURL(it.file); });
            queue.push({ type: it.type, src: dataUrl });
          } else if (it.type === 'image' && it.url) {
            queue.push({ type:'image', src: await toDataUrl(it.url) });
          } else if (it.type === 'audio' && it.url) {
            queue.push({ type:'audio', src: await toDataUrl(it.url) });
          } else if (it.type === 'video') {
            const src = it.mp4 || it.url || it.preview;
            if (src) queue.push({ type:'video', src: await toDataUrl(src) });
          } else if (it.type === 'effect') {
            queue.push({ type:'effect', name: it.name });
          }
        }
        try { localStorage.setItem('montageQueue', JSON.stringify(queue)); } catch {}
        location.hash = '#montage';
        Toasts.show(`Ajouté ${queue.length} élément(s)`, 'success');
      };
      return;
    }
    if (h === '#settings') { show('view-settings'); setActive('#settings'); return; }
    if (h.startsWith('#platform/')) {
      const net = h.split('/')[1] || '';
      const names = { instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', threads:'Threads', youtube:'YouTube', twitter:'Twitter', telegram:'Telegram', discord:'Discord', linkedin:'LinkedIn', pinterest:'Pinterest' };
      const label = names[net] || net || 'Réseau';
      const title = document.getElementById('platform-title');
      const sub = document.getElementById('platform-sub');
      const pill = document.getElementById('platform-pill');
      if (title) title.textContent = label;
      if (sub) sub.textContent = `Actions et statut ${label}`;
      if (pill) pill.textContent = label;
      document.querySelectorAll('.social-icon[data-net]').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-net') === net);
      });
      show('view-platform'); setActive('');
      const connect = document.getElementById('pf-connect');
      const publish = document.getElementById('pf-publish');
      const status = document.getElementById('pf-status');
      const cookieBtn = document.getElementById('pf-cookies');
      const forceSync = document.getElementById('pf-force-sync');
      const saveLocal = document.getElementById('pf-save-local');
      const loadLocal = document.getElementById('pf-load-local');
      const applyCookies = document.getElementById('pf-apply-cookies');
      const importJson = document.getElementById('pf-import-json');
      const jsonBox = document.getElementById('pf-cookies-json');
      const out = document.getElementById('platform-output');
      const syncBadge = document.getElementById('pf-sync-badge');
      try { chrome.runtime.sendMessage({ type: 'GET_STORED_PROFILE', net }, (res) => {
        if (res && res.ok && res.profile) {
          const p = res.profile;
          const avatar = document.getElementById('pf-avatar');
          const ppAvatar = document.getElementById('pp-avatar');
          const usernameEl = document.getElementById('pf-username');
          const ppUser = document.getElementById('pp-username');
          const bioEl = document.getElementById('pf-bio');
          if (p.avatar) { if (avatar) avatar.src = p.avatar; if (ppAvatar) ppAvatar.src = p.avatar; }
          if (p.name) { if (usernameEl) usernameEl.value = p.name; if (ppUser) ppUser.textContent = p.name; }
          if (p.bio) { if (bioEl) bioEl.value = p.bio; }
        }
      }); } catch {}
      if (connect) connect.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'NAVIGATE_PROFILE', net }, (res) => { if (res && res.ok) Toasts.show(`Ouverture profil ${label}`, 'success'); else Toasts.show('Erreur', 'error'); if (out) out.textContent = res && res.ok ? `Ouverture profil ${label}` : `Erreur`; }); } catch {}
      };
      if (publish) publish.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'NAVIGATE_PUBLISH', net }, (res) => { if (res && res.ok) Toasts.show(`Ouverture publication ${label}`, 'success'); else Toasts.show('Erreur', 'error'); if (out) out.textContent = res && res.ok ? `Ouverture publication ${label}` : `Erreur`; }); } catch {}
      };
      if (status) status.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => { if (res && res.ok) Toasts.show(`Statut: ${res.status}`, 'info'); else Toasts.show('Erreur', 'error'); if (out) out.textContent = res && res.ok ? `Statut: ${res.status} • ${res.time}` : `Erreur`; }); } catch {}
      };
      if (cookieBtn) cookieBtn.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'CHECK_COOKIES', net }, (res) => { 
          const ok = res && res.ok && (!!res.hasAuth || (res.matched && res.matched.length>0)); 
          Toasts.show(ok ? `Connecté via cookies (${label})` : `Non connecté`, ok ? 'success' : 'error');
          if (out) out.textContent = res && res.ok ? `Cookies: ${res.count} • match: ${(res.matched||[]).join(', ') || 'aucun'} • ${ok ? 'connecté' : 'non connecté'}` : 'Erreur';
          document.querySelectorAll('.social-icon[data-net]').forEach(el => {
            const isThis = el.getAttribute('data-net') === net;
            el.classList.toggle('connected', ok && isThis);
          });
        }); } catch {}
      };
      function renderSyncBadge(ts) {
        if (!syncBadge) return;
        const now = Date.now();
        const age = ts ? Math.floor((now - ts) / 60000) : null;
        const fresh = ts && age !== null && age <= 10;
        syncBadge.classList.remove('ok','stale');
        if (fresh) { syncBadge.classList.add('ok'); syncBadge.textContent = `Sync OK • ${age} min`; }
        else if (ts) { syncBadge.classList.add('stale'); syncBadge.textContent = `Sync outdated • ${age} min`; }
        else { syncBadge.textContent = 'Sync'; }
      }
      if (forceSync) forceSync.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'FORCE_MONITOR' }, (res) => {
          Toasts.show(res && res.ok ? 'Sync forcée' : 'Erreur sync', res && res.ok ? 'info' : 'error');
          try { chrome.runtime.sendMessage({ type: 'GET_STORED_PROFILE', net }, (r2) => { if (r2 && r2.ok && r2.profile) renderSyncBadge(r2.profile.ts); }); } catch {}
        }); } catch {}
      };
      try { chrome.runtime.sendMessage({ type: 'CHECK_COOKIES', net }, (res) => { 
        const ok = res && res.ok && (!!res.hasAuth || (res.matched && res.matched.length>0));
        document.querySelectorAll('.social-icon[data-net]').forEach(el => {
          const isThis = el.getAttribute('data-net') === net;
          el.classList.toggle('connected', ok && isThis);
        });
      }); } catch {}
      try { chrome.runtime.sendMessage({ type: 'GET_STORED_PROFILE', net }, (res) => { if (res && res.ok && res.profile) renderSyncBadge(res.profile.ts); }); } catch {}
      if (saveLocal) saveLocal.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'GET_COOKIES', net }, (res) => {
          if (res && res.ok && Array.isArray(res.cookies)) {
            chrome.runtime.sendMessage({ type: 'SAVE_COOKIES', net, cookies: res.cookies }, (r2) => {
              Toasts.show(r2 && r2.ok ? `Cookies sauvegardés (${r2.count})` : 'Erreur sauvegarde', r2 && r2.ok ? 'success' : 'error');
            });
          }
        }); } catch {}
      };
      if (loadLocal) loadLocal.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'LOAD_COOKIES', net }, (res) => {
          const ok = res && res.ok && res.count > 0;
          Toasts.show(ok ? `Cookies chargés (${res.count})` : 'Aucun cookie', ok ? 'success' : 'error');
          if (jsonBox) jsonBox.value = ok ? JSON.stringify(res.cookies || [], null, 2) : '';
        }); } catch {}
      };
      if (applyCookies) applyCookies.onclick = () => {
        try { chrome.runtime.sendMessage({ type: 'APPLY_COOKIES', net }, (res) => {
          Toasts.show(res && res.ok ? `Cookies appliqués (${res.applied}/${res.total})` : 'Erreur application', res && res.ok ? 'success' : 'error');
        }); } catch {}
      };
      if (importJson) importJson.onclick = () => {
        const text = String(jsonBox && jsonBox.value || '').trim();
        if (!text) { Toasts.show('JSON requis', 'error'); return; }
        let arr = [];
        try { arr = JSON.parse(text); } catch { Toasts.show('JSON invalide', 'error'); return; }
        try { chrome.runtime.sendMessage({ type: 'SAVE_COOKIES', net, cookies: arr }, (r2) => {
          Toasts.show(r2 && r2.ok ? `Importé (${r2.count})` : 'Erreur import', r2 && r2.ok ? 'success' : 'error');
        }); } catch {}
      };
      const avatar = document.getElementById('pf-avatar');
      const avatarInput = document.getElementById('pf-avatar-input');
      const profileUrl = document.getElementById('pf-profile-url');
      const username = document.getElementById('pf-username');
      const bio = document.getElementById('pf-bio');
      const saveProfile = document.getElementById('pf-save-profile');
      const modesEl = document.getElementById('pf-modes');
      const caption = document.getElementById('pf-caption');
      const hashtags = document.getElementById('pf-hashtags');
      const drop = document.getElementById('pf-media-drop');
      const mediaInput = document.getElementById('pf-media-input');
      const saveDraft = document.getElementById('pf-save-draft');
      const previewBtn = document.getElementById('pf-preview');
      const ppAvatar = document.getElementById('pp-avatar');
      const ppUser = document.getElementById('pp-username');
      const ppMode = document.getElementById('pp-mode');
      const ppCaption = document.getElementById('pp-caption');
      const ppMedia = document.getElementById('pp-media');
      const netModes = {
        instagram: ['Post','Story','Reel'],
        facebook: ['Post','Story','Reel'],
        tiktok: ['Video'],
        threads: ['Post'],
        youtube: ['Video','Short','Community'],
        twitter: ['Tweet','Thread'],
        linkedin: ['Post'],
        telegram: ['Message'],
        discord: ['Message'],
        pinterest: ['Pin']
      };
      let currentMode = (netModes[net] || [])[0] || 'Post';
      function storageKey(s) { return `net:${net}:${s}` }
      function setTabs() {
        if (!modesEl) return;
        modesEl.innerHTML = '';
        const arr = netModes[net] || [currentMode];
        arr.forEach(m => {
          const b = document.createElement('div');
          b.className = 'pf-tab' + (m===currentMode ? ' active' : '');
          b.textContent = m;
          b.addEventListener('click', () => {
            currentMode = m;
            setTabs();
            try { localStorage.setItem(storageKey('mode'), m); } catch {}
            restoreDraft();
          });
          modesEl.appendChild(b);
        });
        if (ppMode) ppMode.textContent = currentMode;
      }
      function readFileTo(el, cb) {
        const file = el && el.files && el.files[0];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => cb(fr.result);
        fr.readAsDataURL(file);
      }
      function restoreProfile() {
        try {
          const a = localStorage.getItem(storageKey('avatar')) || '';
          const u = localStorage.getItem(storageKey('username')) || '';
          const b = localStorage.getItem(storageKey('bio')) || '';
          if (a && avatar) { avatar.src = a; if (ppAvatar) ppAvatar.src = a; }
          if (username) { username.value = u || ''; }
          if (ppUser) ppUser.textContent = u || label;
          if (bio) bio.value = b || '';
          const m = localStorage.getItem(storageKey('mode'));
          if (m) currentMode = m;
        } catch {}
        try { chrome.runtime.sendMessage({ type: 'GET_PROFILE_URL', net }, (res) => { if (res && res.ok && profileUrl) profileUrl.value = res.url || ''; }); } catch {}
      }
      function restoreDraft() {
        try {
          const c = localStorage.getItem(storageKey(`caption:${currentMode}`)) || '';
          const h = localStorage.getItem(storageKey(`hashtags:${currentMode}`)) || '';
          const md = localStorage.getItem(storageKey(`media:${currentMode}`)) || '';
          if (caption) caption.value = c;
          if (hashtags) hashtags.value = h;
          if (ppMedia) {
            ppMedia.innerHTML = '';
            if (md) {
              if (md.startsWith('data:video')) {
                const v = document.createElement('video'); v.src = md; v.controls = true;
                ppMedia.appendChild(v);
              } else {
                const img = document.createElement('img'); img.src = md;
                ppMedia.appendChild(img);
              }
            }
          }
          if (ppCaption) ppCaption.textContent = c;
        } catch {}
      }
      function saveProfileData() {
        try {
          if (username) localStorage.setItem(storageKey('username'), String(username.value||'').trim());
          if (bio) localStorage.setItem(storageKey('bio'), String(bio.value||'').trim());
          if (profileUrl) { try { chrome.runtime.sendMessage({ type: 'SAVE_PROFILE_URL', net, url: String(profileUrl.value||'').trim() }, ()=>{}); } catch {} }
          Toasts.show('Profil sauvegardé', 'success');
        } catch { Toasts.show('Erreur profil', 'error'); }
      }
      function saveDraftData() {
        try {
          if (caption) localStorage.setItem(storageKey(`caption:${currentMode}`), String(caption.value||'').trim());
          if (hashtags) localStorage.setItem(storageKey(`hashtags:${currentMode}`), String(hashtags.value||'').trim());
          Toasts.show('Brouillon sauvegardé', 'success');
        } catch { Toasts.show('Erreur brouillon', 'error'); }
      }
      function preview() {
        if (ppUser) ppUser.textContent = String((username && username.value)||label);
        if (ppCaption) ppCaption.textContent = String((caption && caption.value)||'');
        if (ppMode) ppMode.textContent = currentMode;
      }
      restoreProfile();
      setTabs();
      restoreDraft();
      if (avatarInput) avatarInput.onchange = () => {
        readFileTo(avatarInput, (d)=> {
          if (avatar) avatar.src = d; if (ppAvatar) ppAvatar.src = d; try { localStorage.setItem(storageKey('avatar'), d); } catch {}
        });
      };
      if (username) username.oninput = preview;
      if (bio) bio.oninput = ()=> { try { localStorage.setItem(storageKey('bio'), String(bio.value||'').trim()); } catch {} };
      if (profileUrl) profileUrl.onchange = ()=> { try { chrome.runtime.sendMessage({ type: 'SAVE_PROFILE_URL', net, url: String(profileUrl.value||'').trim() }, ()=>{}); } catch {} };
      if (saveProfile) saveProfile.onclick = saveProfileData;
      if (caption) caption.oninput = preview;
      if (hashtags) hashtags.oninput = ()=> { try { localStorage.setItem(storageKey(`hashtags:${currentMode}`), String(hashtags.value||'').trim()); } catch {} };
      if (saveDraft) saveDraft.onclick = saveDraftData;
      if (previewBtn) previewBtn.onclick = preview;
      if (mediaInput) mediaInput.onchange = () => {
        readFileTo(mediaInput, (d)=> {
          if (ppMedia) {
            ppMedia.innerHTML = '';
            if (d.startsWith('data:video')) {
              const v = document.createElement('video'); v.src = d; v.controls = true;
              ppMedia.appendChild(v);
            } else {
              const img = document.createElement('img'); img.src = d;
              ppMedia.appendChild(img);
            }
          }
          try { localStorage.setItem(storageKey(`media:${currentMode}`), d); } catch {}
        });
      };
      if (drop) {
        drop.addEventListener('dragover', (e)=> { e.preventDefault(); drop.classList.add('drag'); });
        drop.addEventListener('dragleave', ()=> drop.classList.remove('drag'));
        drop.addEventListener('drop', (e)=> {
          e.preventDefault(); drop.classList.remove('drag');
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (!f) return;
          const fr = new FileReader();
          fr.onload = ()=> {
            const d = fr.result;
            if (ppMedia) {
              ppMedia.innerHTML = '';
              if (String(d).startsWith('data:video')) {
                const v = document.createElement('video'); v.src = d; v.controls = true;
                ppMedia.appendChild(v);
              } else {
                const img = document.createElement('img'); img.src = d;
                ppMedia.appendChild(img);
              }
            }
            try { localStorage.setItem(storageKey(`media:${currentMode}`), d); } catch {}
          };
          fr.readAsDataURL(f);
        });
      }
      return;
    }
    show('view-overview'); setActive('#overview');
  }
  window.addEventListener('hashchange', route);
  route();
  initTheme();
  setTimeout(()=> {
    try {
      const h = location.hash || '#overview';
      if (h === '#reseaux') {
        const btn = document.getElementById('rx-start');
        if (btn) {
          btn.click();
          Toasts.show('Préparation auto du lot', 'info');
        }
      }
    } catch {}
  }, 1200);
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'ROBOT_UPDATE') {
        const { net, profile } = msg;
        const current = (location.hash || '').split('/')[1];
        if (current && current === net) {
          const avatar = document.getElementById('pf-avatar');
          const ppAvatar = document.getElementById('pp-avatar');
          const usernameEl = document.getElementById('pf-username');
          const ppUser = document.getElementById('pp-username');
          const bioEl = document.getElementById('pf-bio');
          if (profile.avatar) { if (avatar) avatar.src = profile.avatar; if (ppAvatar) ppAvatar.src = profile.avatar; }
          if (profile.name) { if (usernameEl) usernameEl.value = profile.name; if (ppUser) ppUser.textContent = profile.name; }
          if (profile.bio) { if (bioEl) bioEl.value = profile.bio; }
          Toasts.show('Profil mis à jour automatiquement', 'info');
          const syncBadge = document.getElementById('pf-sync-badge');
          if (syncBadge) {
            syncBadge.classList.remove('ok','stale');
            syncBadge.classList.add('ok');
            syncBadge.textContent = 'Sync OK • 0 min';
          }
        }
        const dot = document.querySelector(`.social-icon[data-net="${net}"] .net-dot`);
        if (dot) {
          dot.classList.remove('ok','stale');
          dot.classList.add('ok');
          dot.title = 'Sync OK • 0 min';
        }
      }
    });
  } catch {}
  document.querySelectorAll('.social-icon[data-net]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const net = el.getAttribute('data-net') || '';
      if (net) location.hash = `#platform/${net}`;
    });
    if (!el.querySelector('.net-dot')) {
      const dot = document.createElement('span'); dot.className = 'net-dot'; dot.title = 'Sync';
      el.appendChild(dot);
    }
  });
  window.addEventListener('keydown', (e)=>{
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    const k = e.key;
    if (k === '1') { location.hash = '#overview'; Toasts.show('Overview', 'info'); }
    else if (k === '2') { location.hash = '#montage'; Toasts.show('Montage', 'info'); }
    else if (k === '3') { location.hash = '#projects'; Toasts.show('Projects', 'info'); }
    else if (k === '4') { location.hash = '#messages'; Toasts.show('Messages', 'info'); }
    else if (k === '5') { location.hash = '#settings'; Toasts.show('Settings', 'info'); }
  });
  function refreshConnections() {
    document.querySelectorAll('.social-icon[data-net]').forEach(el=>{
      const net = el.getAttribute('data-net') || '';
      try { chrome.runtime.sendMessage({ type: 'CHECK_COOKIES', net }, (res) => {
        const ok = res && res.ok && (!!res.hasAuth || (res.matched && res.matched.length>0));
        el.classList.toggle('connected', ok);
      }); } catch {}
    });
  }
  function refreshProjectSyncDots() {
    document.querySelectorAll('.social-icon[data-net]').forEach(el=>{
      const net = el.getAttribute('data-net') || '';
      const dot = el.querySelector('.net-dot');
      if (!net || !dot) return;
      try { chrome.runtime.sendMessage({ type: 'GET_STORED_PROFILE', net }, (res) => {
        const ts = res && res.ok && res.profile ? res.profile.ts : null;
        const now = Date.now();
        const age = ts ? Math.floor((now - ts) / 60000) : null;
        const fresh = ts && age !== null && age <= 10;
        dot.classList.remove('ok','stale');
        if (fresh) { dot.classList.add('ok'); dot.title = `Sync OK • ${age} min`; }
        else if (ts) { dot.classList.add('stale'); dot.title = `Sync outdated • ${age} min`; }
        else { dot.title = 'Sync'; }
      }); } catch {}
    });
  }
  // initial connection check
  refreshConnections();
  refreshProjectSyncDots();
})();
