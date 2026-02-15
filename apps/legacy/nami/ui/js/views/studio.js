import { socialRegistry } from '../social/socialRegistry.js';
import { capabilityMatrix, getCapabilityStatus } from '../social/capabilityMatrix.js';
import { exportPresets, getExportPreset } from '../social/exportPresets.js';

document.addEventListener("DOMContentLoaded", () => {
    // Selectors
    const netSelect = document.getElementById('studio-network-select');
    const typeSelect = document.getElementById('studio-type-select');
    const canvas = document.getElementById('studio-canvas');
    const canvasPlaceholder = document.getElementById('canvas-placeholder');
    const safeZone = document.getElementById('safe-zone');
    const dimsLabel = document.getElementById('canvas-dims');
    const ratioLabel = document.getElementById('canvas-ratio');
    const specsCard = document.getElementById('studio-specs');
    const capsCard = document.getElementById('studio-caps');
    const btnPublish = document.getElementById('btn-publish');
    const btnSchedule = document.getElementById('btn-schedule');
    const btnExport = document.getElementById('btn-export');

    // Populate Network Select
    for (const [key, net] of Object.entries(socialRegistry)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${net.icon} ${net.name}`;
        netSelect.appendChild(opt);
    }

    // Handle Network Change
    netSelect.addEventListener('change', () => {
        const netKey = netSelect.value;
        typeSelect.innerHTML = '<option value="">-- Choose Type --</option>';
        typeSelect.disabled = !netKey;
        
        // Reset View
        resetView();

        if (netKey) {
            const net = socialRegistry[netKey];
            for (const [typeKey, type] of Object.entries(net.types)) {
                const opt = document.createElement('option');
                opt.value = typeKey;
                opt.textContent = type.label;
                typeSelect.appendChild(opt);
            }
        }
    });

    // Handle Type Change
    typeSelect.addEventListener('change', () => {
        const netKey = netSelect.value;
        const typeKey = typeSelect.value;
        
        if (netKey && typeKey) {
            const typeData = socialRegistry[netKey].types[typeKey];
            updateCanvas(typeData);
            updateSpecs(typeData);
            updateCaps(netKey);
            
            // Enable Actions
            const canPublish = getCapabilityStatus(netKey, 'publish_post') !== 'not_supported';
            btnPublish.disabled = !canPublish;
            btnSchedule.disabled = !canPublish;
            btnExport.disabled = false;
        } else {
            resetView();
        }
    });

    // Action Handlers
    btnPublish.addEventListener('click', () => {
        const net = netSelect.value;
        const type = typeSelect.value;
        const aiOpt = document.getElementById('chk-ai-opt').checked;
        const crossPost = document.getElementById('chk-cross-post').checked;
        
        const msg = `Publishing to ${net} (${type})...`;
        if (window.log) window.log(msg, 'INFO', 'Studio');
        if (window.Toast) window.Toast.show('Publishing', `Starting upload to ${net}...`, 'info');
        
        // Simulate Process
        setTimeout(() => {
            if (window.Toast) window.Toast.show('Success', 'Content published successfully!', 'success');
            if (window.log) window.log(`Published to ${net} successfully.`, 'INFO', 'Studio');
        }, 2000);
    });

    btnSchedule.addEventListener('click', async () => {
        const net = netSelect.value;
        const type = typeSelect.value;
        if (!net || !type) return Toast.show('Error', 'Please select network and type', 'error');

        // Create a dummy scheduled post
        const post = {
            network: net,
            type: type,
            content: `Scheduled content for ${net}`,
            scheduledTime: Date.now() + 3600000, // +1 hour
            status: 'pending'
        };

        if (window.nami) {
            try {
                await window.nami.addScheduledPost(post);
                if (window.Toast) window.Toast.show('Scheduler', 'Schedule added to queue.', 'success');
                if (window.log) window.log(`Content scheduled for ${net}`, 'INFO', 'Scheduler');
            } catch (e) {
                if (window.Toast) window.Toast.show('Error', 'Failed to schedule post', 'error');
            }
        } else {
             if (window.Toast) window.Toast.show('Scheduler', 'Schedule added (Mock)', 'success');
        }
    });

    btnExport.addEventListener('click', () => {
        const net = netSelect.value;
        const type = typeSelect.value;
        const preset = getExportPreset(net, type);
        
        if (window.Toast) window.Toast.show('Export', `Exporting with ${preset.video.codec}...`, 'info');
        if (window.log) window.log(`Export preset generated: ${JSON.stringify(preset)}`, 'DEBUG', 'Export');
    });

    function resetView() {
        canvas.style.width = '300px';
        canvas.style.height = '300px';
        canvasPlaceholder.style.display = 'block';
        safeZone.style.display = 'none';
        dimsLabel.textContent = '0x0';
        ratioLabel.textContent = '1:1';
        specsCard.style.display = 'none';
        capsCard.style.display = 'none';
        btnPublish.disabled = true;
        btnSchedule.disabled = true;
        btnExport.disabled = true;
    }

    function updateCanvas(type) {
        // Parse resolution
        let width = 1080; 
        let height = 1080;
        
        if (type.resolution) {
            const parts = type.resolution.split('x');
            if (parts.length === 2) {
                width = parseInt(parts[0]);
                height = parseInt(parts[1]);
            }
        }
        
        // Calculate display size (max 400px height or width)
        const MAX_SIZE = 400;
        let displayW, displayH;
        
        if (width > height) {
            displayW = MAX_SIZE;
            displayH = (height / width) * MAX_SIZE;
        } else {
            displayH = MAX_SIZE;
            displayW = (width / height) * MAX_SIZE;
        }
        
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        canvasPlaceholder.style.display = 'none';
        
        dimsLabel.textContent = type.resolution || 'Flexible';
        ratioLabel.textContent = type.ratio || 'Flexible';
        
        // Safe Zones
        if (type.safe_zones) {
            safeZone.style.display = 'flex';
            safeZone.style.top = (type.safe_zones.top || 0) + '%';
            safeZone.style.bottom = (type.safe_zones.bottom || 0) + '%';
            safeZone.style.left = (type.safe_zones.left || 0) + '%';
            safeZone.style.right = (type.safe_zones.right || 0) + '%';
        } else {
            safeZone.style.display = 'none';
        }
    }

    function updateSpecs(type) {
        specsCard.style.display = 'block';
        let html = `<strong>Specs Recommandées:</strong><br>`;
        if (type.duration) html += `⏱ Durée: ${type.duration.label}<br>`;
        if (type.format) html += `🎞 Format: ${type.format}<br>`;
        if (type.resolution) html += `📐 Res: ${type.resolution}<br>`;
        specsCard.innerHTML = html;
    }

    function updateCaps(netKey) {
        capsCard.style.display = 'block';
        const pub = getCapabilityStatus(netKey, 'publish_post');
        const analytics = getCapabilityStatus(netKey, 'analytics_fetch');
        
        let html = `<strong>Capacités API:</strong><br>`;
        html += `Publication: ${getBadge(pub)}<br>`;
        html += `Analytics: ${getBadge(analytics)}<br>`;
        capsCard.innerHTML = html;
    }

    function getBadge(status) {
        if (status === 'official') return '<span class="cap-badge cap-official">Officiel</span>';
        if (status === 'limited') return '<span class="cap-badge cap-limited">Limité</span>';
        return '<span class="cap-badge cap-manual">Manuel</span>';
    }
});
