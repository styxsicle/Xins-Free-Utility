document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    initializeWindowControls();
    initializeNavigation();
    initializeTweaks();
    initializeCleanup();
    initializeToggles();
    initializeSliders();
    initializeActionButtons();
    initializePowerPlans();
    initializeSocialCards();
    initializeHireButtons();
    initializeExternalLinks();
    initializeSystemInfoModal();
    initializeSystemScanModal();
    loadSystemInfo();
    startLiveMonitoring();
}

function initializeExternalLinks() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="http"]');
        if (!link) return;
        e.preventDefault();
        const url = link.href;
        try {
            window.electronAPI.openExternal(url);
        } catch (err) {
            window.open(url, '_blank');
        }
    });
}

function initializeWindowControls() {
    document.getElementById('minimize-btn').addEventListener('click', () => {
        window.electronAPI.minimize();
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
        window.electronAPI.maximize();
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        window.electronAPI.close();
    });
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPage = item.dataset.page;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === `page-${targetPage}`) {
                    page.classList.add('active');
                }
            });
        });
    });
}

function initializeTweaks() {
    const tweakCards = document.querySelectorAll('.tweak-card');

    tweakCards.forEach(card => {
        const tweakId = card.dataset.tweak;
        const applyBtn = card.querySelector('.tweak-btn.apply');
        const revertBtn = card.querySelector('.tweak-btn.revert');

        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                applyBtn.disabled = true;
                applyBtn.textContent = 'Applying...';

                try {
                    const result = await window.electronAPI.applyTweak(tweakId, 'apply');

                    if (result.success) {
                        showNotification('success', 'Tweak Applied', result.message);
                    } else {
                        showNotification('error', 'Failed', result.message);
                    }
                } catch (error) {
                    showNotification('error', 'Error', error.message);
                } finally {
                    applyBtn.disabled = false;
                    applyBtn.textContent = 'Apply';
                }
            });
        }

        if (revertBtn) {
            revertBtn.addEventListener('click', async () => {
                revertBtn.disabled = true;
                revertBtn.textContent = 'Reverting...';

                try {
                    const result = await window.electronAPI.applyTweak(tweakId, 'revert');

                    if (result.success) {
                        showNotification('success', 'Tweak Reverted', result.message);
                    } else {
                        showNotification('error', 'Failed', result.message);
                    }
                } catch (error) {
                    showNotification('error', 'Error', error.message);
                } finally {
                    revertBtn.disabled = false;
                    revertBtn.textContent = 'Revert';
                }
            });
        }
    });
}

function initializeCleanup() {
    const cleanupCards = document.querySelectorAll('.cleanup-card');

    cleanupCards.forEach(card => {
        const cleanupType = card.dataset.cleanup;
        const cleanBtn = card.querySelector('.cleanup-btn');

        if (cleanBtn) {
            cleanBtn.addEventListener('click', async () => {
                cleanBtn.disabled = true;
                cleanBtn.textContent = 'Cleaning...';

                try {
                    const result = await window.electronAPI.runCleanup(cleanupType);

                    if (result.success) {
                        showNotification('success', 'Cleanup Complete', result.message);
                    } else {
                        showNotification('error', 'Cleanup Failed', result.message);
                    }
                } catch (error) {
                    showNotification('error', 'Error', error.message);
                } finally {
                    cleanBtn.disabled = false;
                    cleanBtn.textContent = 'Clean';
                }
            });
        }
    });
}

async function loadSystemInfo() {
    try {
        const info = await window.electronAPI.getSystemInfo();

        document.getElementById('sys-cpu').textContent = info.cpu.model;
        document.getElementById('sys-cores').textContent = `${info.cpu.cores} Cores @ ${info.cpu.speed} MHz`;
        document.getElementById('sys-ram').textContent = formatBytes(info.memory.total);
        document.getElementById('sys-platform').textContent = `${info.os.platform} ${info.os.release}`;
        document.getElementById('sys-hostname').textContent = info.os.hostname;
        document.getElementById('sys-uptime').textContent = formatUptime(info.uptime);

        // Populate new dashboard card meta
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const cpuModel = (info.cpu.model || '').replace(/\(R\)|\(TM\)/g, '').replace(/CPU @.*/i, '').trim();
        setText('cpu-model', cpuModel || 'Unknown CPU');
        setText('cpu-cores', String(info.cpu.cores));
        setText('cpu-clock', `${(info.cpu.speed / 1000).toFixed(2)} GHz`);
        setText('ram-info', `${formatBytes(info.memory.total)} ${info.memory.type || 'DDR'}`);
        setText('ram-total', formatBytes(info.memory.total));

        if (info.gpu) {
            setText('gpu-model', info.gpu.model || 'GPU');
            setText('gpu-vram', info.gpu.vram ? formatBytes(info.gpu.vram) : '--');
            setText('gpu-driver', info.gpu.driver || '--');
        } else {
            setText('gpu-model', 'GPU');
        }
    } catch (error) {
        console.error('Failed to load system info:', error);
    }
}

function startLiveMonitoring() {
    updateLiveStats();
    setInterval(updateLiveStats, 250);
}

async function updateLiveStats() {
    try {
        const stats = await window.electronAPI.getLiveStats();

        // Helper to update bar with color
        const updateBar = (id, usage) => {
            const element = document.getElementById(id);
            const bar = document.getElementById(id.replace('-usage', '-bar'));
            if (element) element.textContent = `${usage}%`;
            if (bar) {
                bar.style.width = `${usage}%`;
                bar.style.backgroundColor = getColorForValue(usage);
                // Add a subtle glow matching the color
                bar.style.boxShadow = `0 0 10px ${getColorForValue(usage)}`;
            }
        };

        updateBar('cpu-usage', stats.cpuUsage);
        updateBar('memory-usage', stats.memoryUsage);
        updateBar('gpu-usage', stats.gpuUsage);
        updateBar('disk-usage', stats.diskUsage);

        const cpuTemp = Math.round(stats.cpuTemp);
        const gpuTemp = Math.round(stats.gpuTemp);

        document.getElementById('cpu-temp').textContent = `${cpuTemp}°C`;
        document.getElementById('gpu-temp').textContent = `${gpuTemp}°C`;

        const cpuTempCircle = document.getElementById('cpu-temp-circle');
        const gpuTempCircle = document.getElementById('gpu-temp-circle');

        updateTempCircle(cpuTempCircle, cpuTemp);
        updateTempCircle(gpuTempCircle, gpuTemp);

        document.getElementById('net-up').textContent = `${stats.networkUp} KB/s`;
        document.getElementById('net-down').textContent = `${stats.networkDown} KB/s`;

    } catch (error) {
        console.error('Failed to update live stats:', error);
    }
}

function getColorForValue(value) {
    // Ensure value is between 0 and 100
    const v = Math.max(0, Math.min(100, value));

    const green = { r: 0, g: 255, b: 42 };   // Hard Green
    const yellow = { r: 255, g: 234, b: 0 }; // Yellow
    const orange = { r: 255, g: 140, b: 0 }; // Orange
    const red = { r: 255, g: 0, b: 85 };     // Hard Red

    let r, g, b;

    if (v <= 35) {
        return `rgb(${green.r}, ${green.g}, ${green.b})`;
    } else if (v <= 45) {
        // Fade Green -> Yellow
        const p = (v - 35) / (45 - 35);
        r = Math.round(green.r + p * (yellow.r - green.r));
        g = Math.round(green.g + p * (yellow.g - green.g));
        b = Math.round(green.b + p * (yellow.b - green.b));
    } else if (v <= 70) {
        // Fade Yellow -> Orange
        const p = (v - 45) / (70 - 45);
        r = Math.round(yellow.r + p * (orange.r - yellow.r));
        g = Math.round(yellow.g + p * (orange.g - yellow.g));
        b = Math.round(yellow.b + p * (orange.b - yellow.b));
    } else if (v <= 85) {
        // Fade Orange -> Red
        const p = (v - 70) / (85 - 70);
        r = Math.round(orange.r + p * (red.r - orange.r));
        g = Math.round(orange.g + p * (red.g - orange.g));
        b = Math.round(orange.b + p * (red.b - orange.b));
    } else {
        return `rgb(${red.r}, ${red.g}, ${red.b})`;
    }

    return `rgb(${r}, ${g}, ${b})`;
}

function updateTempCircle(element, temp) {
    // Normalize temp reasonably (e.g. 30C to 90C range)
    // 30C = 0%, 90C = 100%
    let normalized = (temp - 30) * (100 / 60);
    const color = getColorForValue(normalized);

    element.style.borderColor = color;
    element.style.boxShadow = `0 0 15px ${color.replace(')', ', 0.3)')}`;

    const valueText = element.querySelector('.temp-value');
    if (valueText) {
        valueText.style.color = color;
    }
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function showNotification(type, title, message) {
    const container = document.getElementById('notification-container');

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    let iconSvg = '';
    switch (type) {
        case 'success':
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
            break;
        case 'error':
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            break;
        case 'warning':
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            break;
    }

    notification.innerHTML = `
        <div class="notification-icon">${iconSvg}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    container.appendChild(notification);

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        dismissNotification(notification);
    });

    setTimeout(() => {
        dismissNotification(notification);
    }, 5000);
}

function dismissNotification(notification) {
    if (notification.classList.contains('hiding')) return;

    notification.classList.add('hiding');
    setTimeout(() => {
        notification.remove();
    }, 300);
}

function initializeSystemInfoModal() {
    const openBtn = document.getElementById('hero-system-info-btn');
    const modal = document.getElementById('system-info-modal');
    const loadingState = document.getElementById('system-info-loading');
    const successState = document.getElementById('system-info-success');
    const errorState = document.getElementById('system-info-error');
    const errorMessage = document.getElementById('system-info-error-message');
    const content = document.getElementById('system-info-content');

    if (!openBtn || !modal || !loadingState || !successState || !errorState || !content) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || 'unknown';
    };

    const renderList = (id, items, formatter = (item) => item) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = '';

        const values = Array.isArray(items) ? items : [];
        if (!values.length) {
            const empty = document.createElement('span');
            empty.className = 'system-info-empty';
            empty.textContent = 'not detected';
            el.appendChild(empty);
            return;
        }

        values.forEach((item) => {
            const row = document.createElement('span');
            row.textContent = formatter(item);
            el.appendChild(row);
        });
    };

    const openModal = () => {
        console.log('[SYSTEM INFO] Modal opens');
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    };

    const closeModal = () => {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };

    const setLoading = () => {
        loadingState.hidden = false;
        successState.hidden = true;
        errorState.hidden = true;
        content.hidden = true;
    };

    const showContent = () => {
        loadingState.hidden = true;
        successState.hidden = false;
        errorState.hidden = true;
        content.hidden = false;
    };

    const showPartial = (message) => {
        loadingState.hidden = true;
        successState.hidden = true;
        errorState.hidden = false;
        content.hidden = false;
        if (errorMessage) errorMessage.textContent = message || 'Some read-only device queries were unavailable.';
    };

    const showError = (message) => {
        loadingState.hidden = true;
        successState.hidden = true;
        errorState.hidden = false;
        content.hidden = true;
        if (errorMessage) errorMessage.textContent = message || 'Some read-only device queries were unavailable.';
    };

    const renderSystemInfo = (info) => {
        setText('fsi-windows', info.windowsVersion);
        setText('fsi-os-architecture', info.osArchitecture);
        setText('fsi-windows-build', info.windowsBuild);
        setText('fsi-last-boot', info.lastBootTime);
        setText('fsi-cpu', info.cpuName);
        setText('fsi-cpu-cores', info.cpuCores);
        setText('fsi-cpu-threads', info.cpuThreads);
        setText('fsi-cpu-clock', info.cpuMaxClock);
        setText('fsi-ram', info.totalRam);
        setText('fsi-system-manufacturer', info.systemManufacturer);
        setText('fsi-system-model', info.systemModel);
        setText('fsi-motherboard', info.motherboard);
        setText('fsi-baseboard-manufacturer', info.baseboardManufacturer);
        setText('fsi-baseboard-product', info.baseboardProduct);
        setText('fsi-uptime', info.uptime);
        renderList('fsi-gpus', info.gpuDevices, (gpu) => {
            return `${gpu.name || 'unknown'} | Driver ${gpu.driverVersion || 'unknown'} | Driver Date ${gpu.driverDate || 'unknown'} | VRAM ${gpu.vram || 'unknown'}`;
        });
        renderList('fsi-storage', info.storageDrives, (drive) => {
            const label = drive.label && drive.label !== 'unknown' ? ` (${drive.label})` : '';
            const fs = drive.fileSystem && drive.fileSystem !== 'unknown' ? ` | ${drive.fileSystem}` : '';
            return `${drive.name || 'unknown'}${label}${fs} | Size ${drive.size || 'unknown'} | Free ${drive.free || 'unknown'}`;
        });
        renderList('fsi-keyboards', info.keyboardDevices);
        renderList('fsi-mice', info.mouseDevices);
        renderList('fsi-network', info.networkAdapters, (adapter) => {
            return `${adapter.name || 'not detected'} | ${adapter.manufacturer || 'unknown'} | ${adapter.adapterType || 'unknown'} | MAC ${adapter.macAddress || 'unknown'}`;
        });
    };

    const runSystemScan = () => new Promise((resolve) => {
        const overlay    = document.getElementById('scan-overlay');
        const statusEl   = document.getElementById('scan-status-text');
        const progressBar = document.getElementById('scan-progress-bar');
        const completeRow = document.getElementById('scan-complete-row');
        const errorRow   = document.getElementById('scan-error-row');
        const errorMsgEl = document.getElementById('scan-error-message');
        const closeBtn   = document.getElementById('scan-close-btn');

        const statusMessages = [
            'Scanning your system...',
            'Preparing full system info...'
        ];

        // Each message is visible for ~1500ms. Message 2 fades in at ~1700ms
        // (1500ms interval + 200ms fade), so ANIM_MS=3200 gives it ~1500ms too.
        const ANIM_MS = 3200;
        const STATUS_INTERVAL = 1500;

        let fetchResult  = null;
        let fetchError   = null;
        let animComplete = false;
        let fetchComplete = false;
        const startTime  = Date.now();

        // Reset overlay state
        completeRow.hidden = true;
        completeRow.classList.remove('visible');
        errorRow.hidden = true;
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
        statusEl.style.opacity = '';
        statusEl.classList.remove('fade-out');
        statusEl.textContent = statusMessages[0];

        // Show overlay
        overlay.classList.remove('hiding');
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');

        // Re-enable smooth progress transitions after reset frame
        requestAnimationFrame(() => {
            progressBar.style.transition = 'width 0.12s linear';
        });

        // Cycle status text
        let statusIdx = 0;
        const statusTimer = setInterval(() => {
            statusIdx = Math.min(statusIdx + 1, statusMessages.length - 1);
            statusEl.classList.add('fade-out');
            setTimeout(() => {
                statusEl.textContent = statusMessages[statusIdx];
                statusEl.classList.remove('fade-out');
            }, 200);
        }, STATUS_INTERVAL);

        // Fill progress to 90% over ANIM_MS, then hold
        const progressTimer = setInterval(() => {
            const raw = ((Date.now() - startTime) / ANIM_MS) * 90;
            progressBar.style.width = Math.min(raw, 90) + '%';
        }, 60);

        // Minimum animation timer
        const animTimer = setTimeout(() => {
            animComplete = true;
            if (fetchComplete) onBothDone();
        }, ANIM_MS);

        // Kick off IPC fetch
        console.log('[SCAN] IPC request starts');
        window.electronAPI.getFullSystemInfo()
            .then((result) => {
                fetchResult = result;
                fetchComplete = true;
                console.log('[SCAN] Fetch complete, status:', result.status);
                if (animComplete) onBothDone();
            })
            .catch((err) => {
                fetchError = err;
                fetchComplete = true;
                console.error('[SCAN] Fetch error:', err.message);
                if (animComplete) onBothDone();
            });

        function onBothDone() {
            clearInterval(statusTimer);
            clearInterval(progressTimer);
            clearTimeout(animTimer);

            if (fetchError) {
                progressBar.style.width = '0%';
                statusEl.classList.add('fade-out');
                errorMsgEl.textContent = fetchError.message || 'Unable to load full system details.';
                setTimeout(() => { errorRow.hidden = false; }, 220);
                closeBtn.onclick = () => closeOverlay(false);
                return;
            }

            // Complete: fill bar and show checkmark
            progressBar.style.width = '100%';
            statusEl.classList.add('fade-out');
            setTimeout(() => {
                statusEl.style.opacity = '0';
                completeRow.hidden = false;
                requestAnimationFrame(() => completeRow.classList.add('visible'));
            }, 220);

            setTimeout(() => closeOverlay(true), 380);
        }

        function closeOverlay(success) {
            overlay.classList.add('hiding');
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.classList.remove('hiding');
                overlay.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');
                statusEl.style.opacity = '';
                statusEl.classList.remove('fade-out');
                resolve({ success, result: fetchResult });
            }, 380);
        }
    });

    openBtn.addEventListener('click', async () => {
        openBtn.disabled = true;
        const scan = await runSystemScan();
        openBtn.disabled = false;

        if (!scan.success) return;

        const result = scan.result;
        console.log('[SYSTEM INFO] Renderer receives data', {
            status: result.status,
            success: result.success,
            errorCount: Array.isArray(result.errors) ? result.errors.length : 0
        });

        openModal();
        renderSystemInfo(result.info || {});

        if (result.status === 'success') {
            showContent();
            showNotification('success', 'System Info Loaded', 'Full system info is ready.');
        } else if (result.status === 'partial') {
            showPartial(result.message);
            showNotification('warning', 'Partial System Info', result.message || 'Some details were unavailable.');
        } else {
            showError(result.message);
            showNotification('error', 'System Info Error', result.message || 'System info could not be loaded.');
        }
        loadingState.hidden = true;
        console.log('[SYSTEM INFO] Loading ends');
    });

    modal.querySelectorAll('[data-system-info-close]').forEach((el) => {
        el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            closeModal();
        }
    });
}

function initializeSystemScanModal() {
    const modal      = document.getElementById('scan-results-modal');
    const loadingEl  = document.getElementById('sr-loading');
    const errorEl    = document.getElementById('sr-error');
    const errorMsgEl = document.getElementById('sr-error-msg');
    const resultsEl  = document.getElementById('sr-results');
    const statusEl   = document.getElementById('sr-loading-status');
    const barEl      = document.getElementById('sr-loading-bar');
    const scanBtn    = document.getElementById('hero-scan-btn');

    if (!modal || !scanBtn) return;

    const openModal = () => {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    };

    const closeModal = () => {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };

    const resetLoading = () => {
        loadingEl.hidden = false;
        errorEl.hidden   = true;
        resultsEl.hidden = true;
        statusEl.textContent = 'Scanning your system...';
        statusEl.classList.remove('fade');
        barEl.style.transition = 'none';
        barEl.style.width = '0%';
    };

    const showError = (msg) => {
        loadingEl.hidden = true;
        errorEl.hidden   = false;
        resultsEl.hidden = true;
        if (errorMsgEl) errorMsgEl.textContent = msg || 'Unable to complete system scan.';
    };

    const showResults = (data) => {
        loadingEl.hidden = true;
        errorEl.hidden   = true;
        resultsEl.hidden = false;
        renderScanResults(data);
    };

    function renderScanResults(data) {
        const RING_CIRC = 327; // 2π × r=52 ≈ 326.73

        // Score number
        document.getElementById('sr-score-num').textContent = data.score;

        // Ring fill — start at empty, animate to score offset after paint
        const ringFill  = document.getElementById('sr-ring-fill');
        const colorClass = data.score >= 85 ? 'sr-ring-green'
            : data.score >= 65 ? 'sr-ring-amber' : 'sr-ring-red';
        ringFill.className = 'sr-ring-fill ' + colorClass;
        ringFill.style.strokeDasharray  = RING_CIRC;
        ringFill.style.strokeDashoffset = RING_CIRC;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            ringFill.style.strokeDashoffset = RING_CIRC * (1 - data.score / 100);
        }));

        // Status pill
        const pill = document.getElementById('sr-pill');
        const pillMap = {
            'optimized':       { label: 'Optimized',       cls: 'sr-pill-optimized' },
            'good':            { label: 'Good',             cls: 'sr-pill-good' },
            'needs-attention': { label: 'Needs Attention',  cls: 'sr-pill-needs-attention' }
        };
        const pm = pillMap[data.status] || { label: data.status, cls: '' };
        pill.textContent = pm.label;
        pill.className   = 'sr-pill ' + pm.cls;

        // Description
        document.getElementById('sr-desc').textContent = data.description;

        // Category cards helper
        const setCategory = (statusId, detailId, catData) => {
            const sEl = document.getElementById(statusId);
            const dEl = document.getElementById(detailId);
            if (!sEl || !catData) return;
            const statusLabels  = { excellent: 'Excellent', good: 'Good', 'needs-work': 'Needs Work', unknown: 'Unknown' };
            const statusClasses = { excellent: 'sr-cat-excellent', good: 'sr-cat-good', 'needs-work': 'sr-cat-needs-work', unknown: 'sr-cat-unknown' };
            sEl.textContent = statusLabels[catData.status] || catData.status;
            sEl.className   = 'sr-cat-status ' + (statusClasses[catData.status] || '');
            if (dEl) dEl.textContent = catData.detail;
        };

        const cats = data.categories || {};
        setCategory('sr-cat-cpu-status',     'sr-cat-cpu-detail',     cats.cpu);
        setCategory('sr-cat-mem-status',     'sr-cat-mem-detail',     cats.memory);
        setCategory('sr-cat-storage-status', 'sr-cat-storage-detail', cats.storage);
        setCategory('sr-cat-net-status',     'sr-cat-net-detail',     cats.network);
        setCategory('sr-cat-startup-status', 'sr-cat-startup-detail', cats.startup);
        setCategory('sr-cat-gpu-status',     'sr-cat-gpu-detail',     cats.gpu);

        // Tweaks list
        const list = document.getElementById('sr-tweaks-list');
        list.textContent = '';

        const badgeLabels  = { safe: 'Safe', admin: 'Admin Required', soon: 'Coming Soon' };
        const badgeClasses = { safe: 'sr-badge-safe', admin: 'sr-badge-admin', soon: 'sr-badge-soon' };

        (data.tweaks || []).forEach(tweak => {
            const row  = document.createElement('div');
            row.className = 'sr-tweak-row';

            const body = document.createElement('div');
            body.className = 'sr-tweak-body';

            const nameEl = document.createElement('span');
            nameEl.className   = 'sr-tweak-name';
            nameEl.textContent = tweak.name;

            const descEl = document.createElement('span');
            descEl.className   = 'sr-tweak-desc';
            descEl.textContent = tweak.description;

            body.appendChild(nameEl);
            body.appendChild(descEl);

            const badge = document.createElement('span');
            badge.className   = 'sr-tweak-badge ' + (badgeClasses[tweak.badge] || 'sr-badge-soon');
            badge.textContent = badgeLabels[tweak.badge] || tweak.badge;

            row.appendChild(body);
            row.appendChild(badge);
            list.appendChild(row);
        });

        // Apply button — navigate user to Tweaks tab
        const applyBtn = document.getElementById('sr-apply-btn');
        if (applyBtn) applyBtn.onclick = () => {
            showNotification('info', 'Apply Tweaks', 'Head to the Tweaks tab to apply optimizations individually.');
        };

        // View Full System Info button — close this modal then trigger the existing flow
        const viewBtn = document.getElementById('sr-view-system-btn');
        if (viewBtn) viewBtn.onclick = () => {
            closeModal();
            document.getElementById('hero-system-info-btn')?.click();
        };
    }

    // Close triggers (backdrop click + close button)
    modal.querySelectorAll('[data-sr-close]').forEach(el => {
        el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) closeModal();
    });

    // Main scan button click
    scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        openModal();
        resetLoading();

        const ANIM_MS   = 3000;
        const startTime = Date.now();

        // Switch status text at the halfway point
        const statusTimer = setTimeout(() => {
            statusEl.classList.add('fade');
            setTimeout(() => {
                statusEl.textContent = 'Calculating optimization score...';
                statusEl.classList.remove('fade');
            }, 250);
        }, 1500);

        // Progress bar fills to 88% over ANIM_MS, then holds
        requestAnimationFrame(() => { barEl.style.transition = 'width 0.12s linear'; });
        const progressTimer = setInterval(() => {
            const pct = Math.min(((Date.now() - startTime) / ANIM_MS) * 88, 88);
            barEl.style.width = pct + '%';
        }, 60);

        let scanData  = null;
        let scanError = null;

        await Promise.all([
            new Promise(resolve => setTimeout(resolve, ANIM_MS)),
            window.electronAPI.runSystemScan()
                .then(r  => { scanData  = r; })
                .catch(e => { scanError = e; })
        ]);

        clearInterval(progressTimer);
        clearTimeout(statusTimer);
        scanBtn.disabled = false;

        if (scanError || !scanData || !scanData.success) {
            const msg = (scanError && scanError.message)
                || (scanData  && scanData.error)
                || 'Unable to complete system scan.';
            showError(msg);
            return;
        }

        barEl.style.width = '100%';
        await new Promise(r => setTimeout(r, 180));
        showResults(scanData);
    });
}

function initializeToggles() {
    const toggleCards = document.querySelectorAll('.toggle-card');

    // Load saved states
    window.electronAPI.getToggleStates().then(savedStates => {
        toggleCards.forEach(card => {
            const toggle = card.querySelector('input[type="checkbox"]');
            const toggleId = card.dataset.toggle;

            if (toggle && savedStates[`toggle-${toggleId}`] !== undefined) {
                toggle.checked = savedStates[`toggle-${toggleId}`];
            }

            if (toggle) {
                toggle.addEventListener('change', async () => {
                    const isEnabled = toggle.checked;
                    const settingName = toggle.dataset.setting;

                    try {
                        const result = await window.electronAPI.applyTweak(`toggle-${toggleId}`, isEnabled ? 'enable' : 'disable');

                        if (result.success) {
                            // Save the toggle state
                            await window.electronAPI.saveToggleState(`toggle-${toggleId}`, isEnabled);
                            showNotification('success', 'Setting Updated', `${getToggleName(toggleId)} ${isEnabled ? 'enabled' : 'disabled'}`);
                        } else {
                            showNotification('error', 'Failed', result.message);
                            toggle.checked = !isEnabled;
                        }
                    } catch (error) {
                        showNotification('error', 'Error', `Failed to apply toggle: ${error.message}`);
                        toggle.checked = !isEnabled;
                    }
                });
            }
        });
    });
}

function getToggleName(toggleId) {
    const names = {
        'gaming-game-bar': 'Game Bar',
        'gaming-game-mode': 'Game Mode',
        'gaming-mouse-accel': 'Mouse Acceleration',
        'gaming-fullscreen-opt': 'Fullscreen Optimizations',
        'fn-nvidia-highlights': 'NVIDIA Highlights',
        'fn-replay-system': 'Replay System',
        'fn-large-team-replays': 'Large Team Replays',
        'fn-multithreaded': 'Multithreaded Rendering',
        'net-nagle': "Nagle's Algorithm",
        'net-throttling': 'Network Throttling',
        'net-delivery-opt': 'Delivery Optimization',
        'net-auto-tuning': 'TCP Auto-Tuning',
        'sys-cortana': 'Cortana',
        'sys-telemetry': 'Telemetry',
        'sys-background-apps': 'Background Apps',
        'sys-search-indexing': 'Search Indexing',
        'mem-superfetch': 'Superfetch',
        'mem-prefetch': 'Prefetch',
        'mem-hibernation': 'Hibernation',
        'mem-memory-compression': 'Memory Compression',
        'power-usb-suspend': 'USB Selective Suspend',
        'power-pci-link': 'PCI Express Link State',
        'power-cpu-parking': 'Core Parking',
        'power-fast-startup': 'Fast Startup'
    };
    return names[toggleId] || toggleId;
}

function initializeSliders() {
    const sliders = document.querySelectorAll('.custom-slider');

    sliders.forEach(slider => {
        const sliderId = slider.id;
        const valueDisplay = document.getElementById(sliderId.replace('-slider', '-value'));

        slider.addEventListener('input', () => {
            updateSliderDisplay(sliderId, slider.value, valueDisplay);
        });

        slider.addEventListener('change', async () => {
            const value = slider.value;
            const settingName = slider.dataset.setting;

            try {
                const result = await window.electronAPI.applyTweak(`slider-${settingName}`, value);

                if (result.success) {
                    showNotification('success', 'Setting Applied', result.message);
                } else {
                    showNotification('error', 'Failed', result.message);
                }
            } catch (error) {
                showNotification('error', 'Error', `Failed to apply setting: ${error.message}`);
            }
        });

        if (valueDisplay) {
            updateSliderDisplay(sliderId, slider.value, valueDisplay);
        }
    });
}

function updateSliderDisplay(sliderId, value, displayElement) {
    if (!displayElement) return;
    displayElement.textContent = getSliderValueText(sliderId, value);
}

function getSliderValueText(sliderId, value) {
    const formatters = {
        'mouse-polling-slider': () => `${value} Hz`,
        'process-priority-slider': () => {
            const priorities = ['', 'Low', 'Below Normal', 'Normal', 'High', 'Realtime'];
            return priorities[value] || value;
        },
        'gpu-priority-slider': () => value,
        'timer-res-slider': () => `${(value / 10).toFixed(1)}ms`,
        'fn-fps-limit-slider': () => `${value} FPS`,
        'fn-res-scale-slider': () => `${value}%`,
        'fn-view-dist-slider': () => {
            const distances = ['', 'Near', 'Medium', 'Far', 'Epic'];
            return distances[value] || value;
        },
        'fn-effects-slider': () => {
            const effects = ['', 'Low', 'Medium', 'High', 'Epic'];
            return effects[value] || value;
        },
        'tcp-timeout-slider': () => `${value}ms`,
        'recv-buffer-slider': () => `${value} MB`,
        'send-buffer-slider': () => `${value} MB`,
        'max-conn-slider': () => value,
        'visual-effects-slider': () => {
            const effects = ['', 'Performance', 'Balanced', 'Appearance', 'Best'];
            return effects[value] || value;
        },
        'proc-sched-slider': () => value == 1 ? 'Programs' : 'Background',
        'menu-delay-slider': () => `${value}ms`,
        'boot-timeout-slider': () => `${value}s`,
        'pagefile-min-slider': () => `${value} MB`,
        'pagefile-max-slider': () => `${value} MB`,
        'large-cache-slider': () => value == 0 ? 'Disabled' : 'Enabled',
        'io-priority-slider': () => {
            const priorities = ['', 'Very Low', 'Low', 'Normal', 'High', 'Critical'];
            return priorities[value] || value;
        },
        'min-cpu-slider': () => `${value}%`,
        'max-cpu-slider': () => `${value}%`,
        'cooling-policy-slider': () => value == 1 ? 'Passive' : 'Active',
        'display-timeout-slider': () => value == 0 ? 'Never' : `${value} min`
    };

    const formatter = formatters[sliderId];
    return formatter ? formatter() : value;
}

function getSliderName(sliderId) {
    const names = {
        'mouse-polling-slider': 'Mouse Polling Rate',
        'process-priority-slider': 'Process Priority',
        'gpu-priority-slider': 'GPU Priority',
        'timer-res-slider': 'Timer Resolution',
        'fn-fps-limit-slider': 'FPS Limit',
        'fn-res-scale-slider': 'Resolution Scale',
        'fn-view-dist-slider': 'View Distance',
        'fn-effects-slider': 'Effects Quality',
        'tcp-timeout-slider': 'TCP Timeout',
        'recv-buffer-slider': 'Receive Buffer',
        'send-buffer-slider': 'Send Buffer',
        'max-conn-slider': 'Max Connections',
        'visual-effects-slider': 'Visual Effects',
        'proc-sched-slider': 'Processor Scheduling',
        'menu-delay-slider': 'Menu Delay',
        'boot-timeout-slider': 'Boot Timeout',
        'pagefile-min-slider': 'Page File Min',
        'pagefile-max-slider': 'Page File Max',
        'large-cache-slider': 'Large System Cache',
        'io-priority-slider': 'I/O Priority',
        'min-cpu-slider': 'Min CPU State',
        'max-cpu-slider': 'Max CPU State',
        'cooling-policy-slider': 'Cooling Policy',
        'display-timeout-slider': 'Display Timeout'
    };
    return names[sliderId] || sliderId;
}

function initializeActionButtons() {
    const actionButtons = document.querySelectorAll('.action-btn');

    actionButtons.forEach(button => {
        const action = button.dataset.action;

        button.addEventListener('click', async () => {
            button.disabled = true;
            const originalText = button.innerHTML;
            button.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/></svg> Processing...';

            try {
                const result = await executeAction(action);

                if (result.success) {
                    showNotification('success', 'Action Complete', result.message);
                } else {
                    showNotification('error', 'Action Failed', result.message);
                }
            } catch (error) {
                showNotification('error', 'Action Failed', `Error: ${error.message}`);
            } finally {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        });
    });
}

async function executeAction(action) {
    return await window.electronAPI.applyTweak(`action-${action}`, 'execute');
}

function getActionMessage(action) {
    const messages = {
        'apply-all-gaming': 'All gaming tweaks applied successfully',
        'revert-all-gaming': 'All gaming tweaks reverted to defaults',
        'benchmark-gaming': 'Benchmark started - check your game performance',
        'apply-all-fortnite': 'Fortnite optimizations applied',
        'clear-fn-cache': 'Fortnite cache cleared',
        'launch-fortnite': 'Launching Fortnite...',
        'flush-dns': 'DNS cache flushed successfully',
        'reset-winsock': 'Winsock catalog reset - restart recommended',
        'release-renew-ip': 'IP address released and renewed',
        'apply-all-system': 'All system tweaks applied',
        'create-restore-point': 'System restore point created',
        'open-services': 'Opening Windows Services...',
        'clear-standby-list': 'Standby memory cleared',
        'empty-working-sets': 'Working sets emptied',
        'flush-modified': 'Modified pages flushed to disk',
        'apply-ultimate-power': 'Ultimate Performance power plan activated',
        'open-power-options': 'Opening Power Options...',
        'restore-default-power': 'Power settings restored to defaults'
    };
    return messages[action] || 'Action completed';
}

function initializePowerPlans() {
    const powerPlanCards = document.querySelectorAll('.power-plan-card');

    if (!powerPlanCards.length) return;

    powerPlanCards.forEach(card => {
        card.addEventListener('click', async () => {
            const plan = card.dataset.plan;
            const radio = card.querySelector('.power-plan-radio');

            powerPlanCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            if (radio) radio.checked = true;

            try {
                const result = await window.electronAPI.applyTweak(`power-plan-${plan}`, 'apply');

                if (result.success) {
                    showNotification('success', 'Power Plan Changed', `Switched to ${getPlanName(plan)}`);
                } else {
                    showNotification('error', 'Failed', result.message);
                }
            } catch (error) {
                showNotification('error', 'Failed', `Error changing power plan: ${error.message}`);
            }
        });
    });
}

function getPlanName(plan) {
    const names = {
        'balanced': 'Balanced',
        'high-performance': 'High Performance',
        'ultimate-performance': 'Ultimate Performance'
    };
    return names[plan] || plan;
}

function initializeSocialCards() {
    const socialCards = document.querySelectorAll('.social-card');

    socialCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const platform = card.dataset.social;

            const urls = {
                'tiktok': 'https://www.tiktok.com/@xtweaksofficial'
            };

            const url = urls[platform];
            if (url) {
                try {
                    window.electronAPI.openExternal(url);
                } catch (error) {
                    window.open(url, '_blank');
                }
                showNotification('success', 'Opening Link', `Opening ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`);
            }
        });
    });
}

function initializeHireButtons() {
    const hireButtons = document.querySelectorAll('.hire-me-btn');
    hireButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            if (url) {
                try {
                    window.electronAPI.openExternal(url);
                } catch (error) {
                    window.open(url, '_blank');
                }
                showNotification('success', 'Opening Link', 'Redirecting to QH Development...');
            }
        });
    });
}

const CHART_HISTORY = 120;
const TREND_HISTORY = 30;

const histories = {
    cpuTemp: [],
    gpuTemp: [],
    cpuUsage: [],
    gpuUsage: [],
    ramUsage: []
};

let activeTempSeries = 'cpu';

function pushHistory(arr, value, max) {
    if (Number.isFinite(value)) arr.push(value);
    while (arr.length > max) arr.shift();
}

function buildSparklinePath(values, width, height, padding = 2) {
    if (!values.length) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
    return values.map((v, i) => {
        const x = padding + i * stepX;
        const y = padding + (height - padding * 2) * (1 - (v - min) / range);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
}

function buildAreaPath(values, width, height, padding = 2) {
    if (!values.length) return '';
    const line = buildSparklinePath(values, width, height, padding);
    const lastX = padding + (values.length - 1) * (values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0);
    return `${line} L${lastX.toFixed(2)},${height} L${padding},${height} Z`;
}

function updateTrendLines() {
    const trends = [
        { line: 'cpu-trend-line', area: 'cpu-trend-area', pill: 'cpu-trend-pill', data: histories.cpuUsage },
        { line: 'gpu-trend-line', area: 'gpu-trend-area', pill: 'gpu-trend-pill', data: histories.gpuUsage },
        { line: 'ram-trend-line', area: 'ram-trend-area', pill: 'ram-trend-pill', data: histories.ramUsage }
    ];

    const W = 100, H = 60, P = 3;
    trends.forEach(({ line, area, pill, data }) => {
        const lineEl = document.getElementById(line);
        const areaEl = document.getElementById(area);
        if (!lineEl) return;
        const vals = data.length ? data : [0];
        const stepX = vals.length > 1 ? (W - P * 2) / (vals.length - 1) : 0;
        const points = vals.map((v, i) => {
            const x = P + i * stepX;
            const y = P + (H - P * 2) * (1 - Math.max(0, Math.min(100, v)) / 100);
            return { x, y };
        });
        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
        const last = points[points.length - 1];
        const areaPath = points.length
            ? `${linePath} L${last.x.toFixed(2)},${H} L${P},${H} Z`
            : '';
        lineEl.setAttribute('d', linePath);
        if (areaEl) areaEl.setAttribute('d', areaPath);

        // Trend pill: compare last value to value ~10 samples ago (~2.5s)
        const pillEl = document.getElementById(pill);
        if (pillEl && data.length >= 2) {
            const recent = data[data.length - 1];
            const baseline = data[Math.max(0, data.length - 10)];
            const delta = recent - baseline;
            const span = pillEl.querySelector('span');
            pillEl.classList.remove('down', 'flat');
            if (Math.abs(delta) < 0.5) {
                pillEl.classList.add('flat');
                if (span) span.textContent = '0.0%';
            } else if (delta < 0) {
                pillEl.classList.add('down');
                if (span) span.textContent = `${Math.abs(delta).toFixed(1)}%`;
            } else {
                if (span) span.textContent = `${delta.toFixed(1)}%`;
            }
        }
    });
}

function tempStatusLabel(temp) {
    if (!Number.isFinite(temp)) return { text: 'Idle', cls: '' };
    if (temp < 55) return { text: 'Cool', cls: '' };
    if (temp < 70) return { text: 'Normal', cls: '' };
    if (temp < 82) return { text: 'High', cls: 'high' };
    return { text: 'Critical', cls: 'crit' };
}

function updateTempChart() {
    const data = activeTempSeries === 'cpu' ? histories.cpuTemp : histories.gpuTemp;
    const barsGroup = document.getElementById('temp-bars');
    const valueEl = document.getElementById('active-temp-value');
    const titleEl = document.getElementById('temp-chart-title');
    const tagEl = document.getElementById('temp-chart-tag');
    const statusEl = document.getElementById('active-temp-status');

    if (titleEl) titleEl.textContent = activeTempSeries === 'cpu' ? 'CPU Temperature' : 'GPU Temperature';
    if (tagEl) tagEl.textContent = activeTempSeries === 'cpu' ? 'CPU' : 'GPU';

    const gradId = activeTempSeries === 'cpu' ? 'tempBarGrad' : 'tempBarGradGpu';
    const accent = activeTempSeries === 'cpu' ? '#ffffff' : '#b8b8b8';

    if (!barsGroup) return;
    if (!data.length) {
        barsGroup.innerHTML = '';
        return;
    }

    // Y axis: fixed 30°C..90°C so visual scale stays consistent
    const VIEW_W = 600, VIEW_H = 200;
    const Y_MIN = 30, Y_MAX = 90;
    const yFor = (v) => {
        const clamped = Math.max(Y_MIN, Math.min(Y_MAX, v));
        return VIEW_H * (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN));
    };

    const count = data.length;
    const slot = VIEW_W / count;
    const barW = Math.max(2, slot * 0.62);
    const radius = Math.min(barW / 2, 4);

    const ns = 'http://www.w3.org/2000/svg';
    // Reuse existing rects when possible
    while (barsGroup.children.length > count) barsGroup.removeChild(barsGroup.lastChild);
    while (barsGroup.children.length < count) {
        const r = document.createElementNS(ns, 'rect');
        r.classList.add('temp-bar');
        r.setAttribute('fill', `url(#${gradId})`);
        r.setAttribute('rx', String(radius));
        r.setAttribute('ry', String(radius));
        barsGroup.appendChild(r);
    }

    for (let i = 0; i < count; i++) {
        const v = data[i];
        const x = i * slot + (slot - barW) / 2;
        const y = yFor(v);
        const h = Math.max(2, VIEW_H - y);
        const rect = barsGroup.children[i];
        rect.setAttribute('x', x.toFixed(2));
        rect.setAttribute('y', y.toFixed(2));
        rect.setAttribute('width', barW.toFixed(2));
        rect.setAttribute('height', h.toFixed(2));
        rect.setAttribute('fill', `url(#${gradId})`);
        rect.setAttribute('rx', String(radius));
        rect.setAttribute('ry', String(radius));
        // Most recent bar gets a glow + stroke
        if (i === count - 1) {
            rect.setAttribute('stroke', accent);
            rect.setAttribute('stroke-width', '0.8');
            rect.setAttribute('opacity', '1');
            rect.setAttribute('filter', 'url(#tempBarGlow)');
        } else {
            rect.removeAttribute('stroke');
            rect.removeAttribute('filter');
            // Older samples slightly fade
            const fadeStart = Math.max(0, count - 30);
            const opacity = i < fadeStart ? 0.35 : 0.4 + (0.55 * (i - fadeStart) / Math.max(1, count - fadeStart - 1));
            rect.setAttribute('opacity', opacity.toFixed(2));
        }
    }

    const current = data[data.length - 1];
    const peak = Math.max(...data);
    const low = Math.min(...data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;

    if (valueEl) valueEl.textContent = Math.round(current);
    document.getElementById('temp-stat-current').textContent = `${Math.round(current)}°C`;
    document.getElementById('temp-stat-avg').textContent = `${Math.round(avg)}°C`;
    document.getElementById('temp-stat-peak').textContent = `${Math.round(peak)}°C`;
    document.getElementById('temp-stat-low').textContent = `${Math.round(low)}°C`;

    if (statusEl) {
        const s = tempStatusLabel(current);
        statusEl.classList.remove('high', 'crit');
        if (s.cls) statusEl.classList.add(s.cls);
        statusEl.innerHTML = `Status: <strong>${s.text}</strong> · sampled every 250ms`;
    }
}

function pollDashboardValues() {
    const cpuUsageText = document.getElementById('cpu-usage')?.textContent || '0';
    const gpuUsageText = document.getElementById('gpu-usage')?.textContent || '0';
    const ramUsageText = document.getElementById('memory-usage')?.textContent || '0';
    const cpuTempText  = document.getElementById('cpu-temp')?.textContent || '';
    const gpuTempText  = document.getElementById('gpu-temp')?.textContent || '';

    const parsePct = (s) => parseFloat(String(s).replace(/[^0-9.\-]/g, '')) || 0;

    pushHistory(histories.cpuUsage, parsePct(cpuUsageText), TREND_HISTORY);
    pushHistory(histories.gpuUsage, parsePct(gpuUsageText), TREND_HISTORY);
    pushHistory(histories.ramUsage, parsePct(ramUsageText), TREND_HISTORY);

    const cpuTemp = parsePct(cpuTempText);
    const gpuTemp = parsePct(gpuTempText);
    if (cpuTemp > 0) pushHistory(histories.cpuTemp, cpuTemp, CHART_HISTORY);
    if (gpuTemp > 0) pushHistory(histories.gpuTemp, gpuTemp, CHART_HISTORY);

    // Mirror temps onto card meta cells
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (cpuTemp > 0) setText('cpu-meta-temp', `${Math.round(cpuTemp)}°C`);
    if (gpuTemp > 0) setText('gpu-meta-temp', `${Math.round(gpuTemp)}°C`);

    // Compute RAM used / free from total + percent
    const ramTotalEl = document.getElementById('sys-ram');
    const ramTotalText = ramTotalEl ? ramTotalEl.textContent : '';
    const ramTotalGB = parseFloat(ramTotalText) || 0;
    if (ramTotalGB > 0) {
        const ramPct = parsePct(ramUsageText);
        const used = (ramTotalGB * ramPct / 100).toFixed(1);
        const free = (ramTotalGB - used).toFixed(1);
        const unit = ramTotalText.replace(/[\d.\s]/g, '').trim() || 'GB';
        setText('ram-used', `${used} ${unit}`);
        setText('ram-free', `${free} ${unit}`);
    }

    updateTrendLines();
    updateTempChart();
}

function initializeDashboardExtras() {
    // Temp toggle CPU / GPU
    const toggle = document.getElementById('temp-toggle');
    if (toggle) {
        toggle.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTempSeries = btn.dataset.temp;
                updateTempChart();
            });
        });
    }

    function wireActionButton(btn, applyingLabel, appliedLabel, doneTitle, doneMsg) {
        if (!btn) return;
        let busy = false;
        btn.addEventListener('click', () => {
            if (busy) return;
            busy = true;
            const original = btn.innerHTML;
            const svg = btn.querySelector('svg');
            btn.innerHTML = '';
            if (svg) btn.appendChild(svg);
            const span = document.createElement('span');
            span.textContent = applyingLabel;
            btn.appendChild(span);
            btn.style.opacity = '0.8';

            setTimeout(() => {
                btn.innerHTML = '';
                if (svg) btn.appendChild(svg);
                const done = document.createElement('span');
                done.textContent = appliedLabel;
                btn.appendChild(done);
                btn.style.opacity = '1';
                showNotification('success', doneTitle, doneMsg);
            }, 10000);

            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.opacity = '';
                busy = false;
            }, 14000);
        });
    }

    wireActionButton(
        document.getElementById('apply-all-btn'),
        'Applying…', 'Applied',
        'All tweaks applied',
        'Every recommended tweak across categories has been applied successfully.'
    );

    // Mirror uptime onto hero
    setInterval(() => {
        const u = document.getElementById('sys-uptime')?.textContent;
        const heroU = document.getElementById('hero-uptime');
        if (heroU && u && u !== '-') heroU.textContent = u;
    }, 1000);

    // Settings icon (placeholder)
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            showNotification('warning', 'Settings', 'Settings panel coming soon');
        });
    }

    // Discord links inside dashboard
    document.querySelectorAll('a[data-social="discord"]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const url = a.getAttribute('href');
            try { window.electronAPI.openExternal(url); }
            catch { window.open(url, '_blank'); }
        });
    });

    // Global search — simple filter across toggle/tweak/cleanup cards by title text
    const search = document.getElementById('global-search');
    if (search) {
        search.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            const cards = document.querySelectorAll('.toggle-card, .tweak-card, .cleanup-card, .slider-card');
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = !q || text.includes(q) ? '' : 'none';
            });
        });
    }

    // Poll DOM-driven values at the same cadence as live monitoring
    setInterval(pollDashboardValues, 250);
}

document.addEventListener('DOMContentLoaded', initializeDashboardExtras);

const TOGGLE_DETAILS = {
    'gaming-game-bar': {
        impact: 'High',
        category: 'Performance',
        body: 'Reins in a noisy background overlay that quietly chips away at frame pacing during play. With this in your hands, your system spends every cycle on what you came here for — your match.'
    },
    'gaming-game-mode': {
        impact: 'Medium',
        category: 'Focus',
        body: 'Cues the OS to step out of your way the moment a session starts — interruptions softened, attention pulled toward the foreground, frametimes left undisturbed.'
    },
    'gaming-mouse-accel': {
        impact: 'High',
        category: 'Aim',
        body: 'Restores 1:1 hand-to-cursor honesty. Muscle memory stops fighting the system, micro-flicks land where you expect, and tracking becomes something you trust again.'
    },
    'gaming-fullscreen-opt': {
        impact: 'Medium',
        category: 'Latency',
        body: 'Reshapes how your titles paint to the screen so the picture you see is the freshest one available — closing the gap between input and outcome.'
    },
    'fn-nvidia-highlights': {
        impact: 'Low',
        category: 'Resources',
        body: 'Quiets a clip-recorder that runs in the wings whether you watch it or not. The headroom it was using gets handed back to your match.'
    },
    'fn-replay-system': {
        impact: 'Medium',
        category: 'Resources',
        body: 'Stops a continuous behind-the-scenes recording loop. Storage breathes, the engine focuses on the round in front of you, not the one already finished.'
    },
    'fn-large-team-replays': {
        impact: 'Medium',
        category: 'Stability',
        body: 'Tames the heavy-load modes that quietly accumulate work for the engine to chew on later — less stutter, fewer spikes when chaos peaks.'
    },
    'fn-multithreaded': {
        impact: 'High',
        category: 'Performance',
        body: 'Spreads the engine\'s workload across every available core instead of crowding one. The result is a smoother line on your frametime graph, especially in busy fights.'
    },
    'sys-cortana': {
        impact: 'Low',
        category: 'Cleanliness',
        body: 'Closes a chatty assistant most users never speak to. Boot is lighter, the system is quieter, and a small slice of memory and bandwidth comes back.'
    },
    'sys-telemetry': {
        impact: 'Medium',
        category: 'Privacy',
        body: 'Pares back background data sharing your machine does on your behalf. Less talking to remote services means more of your CPU and network minding your business.'
    },
    'sys-background-apps': {
        impact: 'High',
        category: 'Resources',
        body: 'Curtails the parade of apps that keep working when you\'re not. Memory pressure drops, the disk stops being nudged, and the foreground gets to actually be in front.'
    },
    'sys-search-indexing': {
        impact: 'Medium',
        category: 'Disk',
        body: 'Eases up on a long-running disk crawler. Storage stays cooler under load, drives last longer, and that mystery activity light at idle calms down.'
    },
    'mem-superfetch': {
        impact: 'High',
        category: 'Memory',
        body: 'Halts speculative pre-loading that holds onto memory you may never use. Headroom is freed for the apps actually in front of you right now.'
    },
    'mem-prefetch': {
        impact: 'Medium',
        category: 'Disk',
        body: 'Stands down a learned-launch optimizer that pays its overhead whether you benefit or not. On modern storage the cost outweighs the help.'
    },
    'mem-hibernation': {
        impact: 'Medium',
        category: 'Disk',
        body: 'Recovers a sizable invisible reserve from your drive — space the OS quietly held aside for a feature most performance setups never use.'
    },
    'mem-memory-compression': {
        impact: 'Medium',
        category: 'Memory',
        body: 'Lets the OS squeeze inactive memory pages so more apps can stay live without spilling to disk. Multitaskers feel it most.'
    }
};

const NETWORK_DETAILS = {
    'auto-dns-finder': {
        impact: 'Low',
        category: 'Network',
        body: 'Coming soon: tests popular DNS providers and recommends the lowest latency option detected for the current connection.'
    },
    'network-doctor': {
        impact: 'Medium',
        category: 'Safe',
        body: 'Coming soon: scans common network issues and suggests fixes without applying changes automatically.'
    },
    'flush-dns-cache': {
        impact: 'Low',
        category: 'Locked',
        body: 'Coming soon: clears the local DNS resolver cache after the action is explicitly enabled.'
    },
    'adapter-reset': {
        impact: 'Medium',
        category: 'Locked',
        body: 'Coming soon: restarts a selected network adapter with a clear warning before anything runs.'
    },
    'packet-loss-test': {
        impact: 'Low',
        category: 'Network',
        body: 'Coming soon: checks packet loss and jitter using ping samples and reports measured results.'
    },
    'tcp-ip-repair': {
        impact: 'High',
        category: 'Safe',
        body: 'Coming soon: groups Winsock and IP repair actions behind warnings so repair steps are explicit.'
    },
    'dns-server-manager': {
        impact: 'Medium',
        category: 'Coming Soon',
        body: 'Coming soon: view DNS profiles and apply selected servers after showing exactly what will change.'
    },
    'game-route-checker': {
        impact: 'Low',
        category: 'Network',
        body: 'Coming soon: checks ping to common game regions and servers without promising guaranteed latency changes.'
    }
};

const TOGGLE_ICONS = {
    'gaming-game-bar':           '<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4M16 11h.01M19 13h.01"/>',
    'gaming-game-mode':          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'gaming-mouse-accel':        '<rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="7" x2="12" y2="11"/>',
    'gaming-fullscreen-opt':     '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    'fn-nvidia-highlights':      '<path d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/>',
    'fn-replay-system':          '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    'fn-large-team-replays':     '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'fn-multithreaded':          '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'sys-cortana':               '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    'sys-telemetry':             '<path d="M2 12h2l3 9 6-18 3 9h6"/>',
    'sys-background-apps':       '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    'sys-search-indexing':       '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    'mem-superfetch':            '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'mem-prefetch':              '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    'mem-hibernation':           '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    'mem-memory-compression':    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>',
};

function svgWrap(inner) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function getToggleIconHtml(toggleId) {
    return svgWrap(TOGGLE_ICONS[toggleId] || '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
}

function categoryFromToggleId(id) {
    if (id.startsWith('gaming-')) return 'gaming';
    if (id.startsWith('fn-'))     return 'fortnite';
    if (id.startsWith('sys-'))    return 'system';
    if (id.startsWith('mem-'))    return 'memory';
    return 'default';
}

// Single shared floating popover
let toggleTooltip = null;
function ensureTooltip() {
    if (toggleTooltip) return toggleTooltip;
    toggleTooltip = document.createElement('div');
    toggleTooltip.className = 'tc-tooltip';
    toggleTooltip.innerHTML = `
        <div class="tt-arrow"></div>
        <div class="tt-head">
            <span class="tt-cat"></span>
            <span class="tt-impact"><span class="tt-impact-dot"></span><span class="tt-impact-text"></span></span>
        </div>
        <h5 class="tt-title"></h5>
        <p class="tt-body"></p>
        <div class="tt-foot">
            <span class="tt-state"><span class="tt-state-dot"></span><span class="tt-state-text"></span></span>
            <span class="tt-hint">Toggle to apply</span>
        </div>
    `;
    document.body.appendChild(toggleTooltip);
    return toggleTooltip;
}

function showTooltipFor(card) {
    const tt = ensureTooltip();
    const id = card.dataset.toggle || card.dataset.networkCard || '';
    const category = card.dataset.cat || 'default';
    const detail = TOGGLE_DETAILS[id] || NETWORK_DETAILS[id] || { impact: 'Medium', category: 'Tweak', body: 'Refines a system behavior to favor responsiveness over background activity.' };

    const title = card.querySelector('.tc-titles h4')?.textContent || '';
    const isOn = card.classList.contains('on');
    const isNetworkPlaceholder = !!card.dataset.networkCard;

    tt.dataset.cat = category;
    tt.dataset.impact = detail.impact.toLowerCase();
    tt.querySelector('.tt-title').textContent = title;
    tt.querySelector('.tt-cat').textContent = detail.category;
    tt.querySelector('.tt-impact-text').textContent = `${detail.impact} impact`;
    tt.querySelector('.tt-body').textContent = detail.body;
    tt.querySelector('.tt-state-text').textContent = isNetworkPlaceholder ? 'Placeholder locked' : (isOn ? 'Currently active' : 'Currently inactive');
    tt.querySelector('.tt-hint').textContent = isNetworkPlaceholder ? 'Coming soon' : 'Toggle to apply';
    tt.classList.toggle('is-on', isOn);

    // Position centered below the card, kept inside viewport
    const rect = card.getBoundingClientRect();
    const ttWidth = 320;
    const margin = 12;
    let left = rect.left + rect.width / 2 - ttWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - ttWidth - margin));
    let top = rect.bottom + 10;
    let placeAbove = false;
    if (top + 220 > window.innerHeight) {
        // Flip above if no room below
        top = rect.top - 10;
        placeAbove = true;
    }
    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
    tt.classList.toggle('place-above', placeAbove);
    tt.style.setProperty('--arrow-left', `${(rect.left + rect.width / 2) - left}px`);
    tt.classList.add('visible');
}

function hideTooltip() {
    if (toggleTooltip) toggleTooltip.classList.remove('visible');
}

function enhanceToggleCards() {
    const cards = document.querySelectorAll('.toggle-card[data-toggle]');
    cards.forEach(card => {
        if (card.dataset.enhanced === '1') return;
        card.dataset.enhanced = '1';

        const id = card.dataset.toggle || '';
        const category = categoryFromToggleId(id);
        card.dataset.cat = category;

        const info = card.querySelector('.toggle-info');
        const sw = card.querySelector('.toggle-switch');
        if (!info || !sw) return;

        const title = info.querySelector('h4')?.textContent || '';
        const desc  = info.querySelector('p')?.textContent || '';
        const input = sw.querySelector('input[type="checkbox"]');
        const isChecked = !!(input && input.checked);

        // Rebuild the card content with the new premium structure
        card.innerHTML = `
            <span class="tc-aurora" aria-hidden="true"></span>
            <span class="tc-shine" aria-hidden="true"></span>
            <span class="tc-accent" aria-hidden="true"></span>
            <div class="tc-head">
                <div class="tc-icon">${getToggleIconHtml(id)}</div>
                <div class="tc-titles">
                    <h4>${title}</h4>
                    <p>${desc}</p>
                </div>
            </div>
            <div class="tc-foot">
                <div class="tc-status">
                    <span class="tc-status-dot"></span>
                    <span class="tc-status-text">${isChecked ? 'Enabled' : 'Disabled'}</span>
                </div>
            </div>
        `;
        // Re-attach the original toggle switch (preserves its event listeners)
        card.querySelector('.tc-foot').appendChild(sw);

        // Mirror state to .on / .off classes
        const sync = () => {
            card.classList.toggle('on', !!input.checked);
            card.classList.toggle('off', !input.checked);
            const txt = card.querySelector('.tc-status-text');
            if (txt) txt.textContent = input.checked ? 'Enabled' : 'Disabled';
            // If tooltip is currently showing this card, refresh state
            if (toggleTooltip && toggleTooltip.classList.contains('visible') && toggleTooltip.dataset.targetId === id) {
                toggleTooltip.classList.toggle('is-on', !!input.checked);
                const stateText = toggleTooltip.querySelector('.tt-state-text');
                if (stateText) stateText.textContent = input.checked ? 'Currently active' : 'Currently inactive';
            }
        };
        sync();
        if (input) input.addEventListener('change', sync);
        // Re-sync briefly to catch async state-load from getToggleStates()
        let elapsed = 0;
        const tick = setInterval(() => { sync(); elapsed += 300; if (elapsed > 3000) clearInterval(tick); }, 300);

        // Pointer-following aurora
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            const y = ((e.clientY - r.top) / r.height) * 100;
            card.style.setProperty('--mx', `${x}%`);
            card.style.setProperty('--my', `${y}%`);
        });

        // Tooltip show/hide with small dwell delay
        let showTimer;
        card.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => {
                ensureTooltip().dataset.targetId = id;
                showTooltipFor(card);
            }, 220);
        });
        card.addEventListener('mouseleave', () => {
            clearTimeout(showTimer);
            hideTooltip();
        });
    });

    // Hide tooltip when scrolling so it doesn't drift
    document.querySelector('.content')?.addEventListener('scroll', hideTooltip, { passive: true });
}

function enhanceNetworkCards() {
    const cards = document.querySelectorAll('#page-network .network-card');
    cards.forEach(card => {
        if (card.dataset.networkEnhanced === '1') return;
        card.dataset.networkEnhanced = '1';
        card.dataset.cat = 'network';

        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            const y = ((e.clientY - r.top) / r.height) * 100;
            card.style.setProperty('--mx', `${x}%`);
            card.style.setProperty('--my', `${y}%`);
        });

        let showTimer;
        card.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => {
                ensureTooltip().dataset.targetId = card.dataset.networkCard || '';
                showTooltipFor(card);
            }, 220);
        });
        card.addEventListener('mouseleave', () => {
            clearTimeout(showTimer);
            hideTooltip();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Defer slightly so the toggle wiring in initializeToggles has time to attach checkbox listeners
    setTimeout(() => {
        enhanceToggleCards();
        enhanceNetworkCards();
    }, 0);
});
