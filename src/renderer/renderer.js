let aiWelcomeShownThisSession = false;

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
    const sysInfoApi = initializeSystemInfoModal();
    initializeSystemScanModal(sysInfoApi);
    loadSystemInfo();
    startLiveMonitoring();
    initializeGpuPage();
    initializeAiTweaker();
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

            if (targetPage === 'ai-tweaker') {
                document.body.classList.add('ai-tweaker-active');
                // Re-run entrance animation on every visit
                const aiPage = document.getElementById('page-ai-tweaker');
                if (aiPage) {
                    aiPage.classList.remove('ai-entered');
                    void aiPage.offsetWidth;
                    aiPage.classList.add('ai-entered');
                }
                if (!aiWelcomeShownThisSession && !localStorage.getItem('xtweaks-ai-welcome-seen')) {
                    aiWelcomeShownThisSession = true;
                    setTimeout(() => {
                        const ov = document.getElementById('ai-welcome-overlay');
                        if (ov) { ov.classList.remove('is-closing'); ov.classList.add('is-open'); }
                    }, 60);
                }
            } else {
                document.body.classList.remove('ai-tweaker-active');
            }
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

            setTimeout(() => closeOverlay(true), 1000);
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

    // Fast-path open: skip the scan overlay, render with already-fetched data
    const openDirect = (result) => {
        openModal();
        renderSystemInfo(result.info || {});
        if (result.status === 'success') {
            showContent();
        } else if (result.status === 'partial') {
            showPartial(result.message);
        } else {
            showError(result.message);
        }
        loadingState.hidden = true;
    };

    return { openDirect };
}

function initializeSystemScanModal(sysInfoApi) {
    const modal      = document.getElementById('scan-results-modal');
    const loadingEl  = document.getElementById('sr-loading');
    const errorEl    = document.getElementById('sr-error');
    const errorMsgEl = document.getElementById('sr-error-msg');
    const resultsEl  = document.getElementById('sr-results');
    const statusEl   = document.getElementById('sr-loading-status');
    const barEl      = document.getElementById('sr-loading-bar');
    const scanBtn    = document.getElementById('hero-scan-btn');

    if (!modal || !scanBtn) return;

    // Cached prefetch promise for full system info — set after scan results render
    let _sysInfoPrefetch = null;

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

        // ── Apply results popup ──────────────────────────────────────
        const applyBtn      = document.getElementById('sr-apply-btn');
        const applyBtnLabel = document.getElementById('sr-apply-btn-label');
        const popup         = document.getElementById('sr-apply-popup');
        const popupList     = document.getElementById('sr-apply-popup-list');
        const popupSummary  = document.getElementById('sr-apply-popup-summary');
        const popupClose    = document.getElementById('sr-apply-popup-close');
        const popupDone     = document.getElementById('sr-apply-popup-done');
        const scanPanel     = modal.querySelector('.scan-results-panel');

        const closePopup = () => {
            popup.classList.remove('sr-popup-visible');
            setTimeout(() => { popup.hidden = true; }, 260);
        };
        if (popupClose) popupClose.onclick = closePopup;
        if (popupDone)  popupDone.onclick  = closePopup;

        if (applyBtn) applyBtn.onclick = async () => {
            const safeTweaks = (data.tweaks || []).filter(t => t.badge === 'safe');
            if (safeTweaks.length === 0) {
                showNotification('info', 'Nothing to Apply', 'No safe tweaks are available for this scan.');
                return;
            }

            applyBtn.disabled = true;
            if (applyBtnLabel) applyBtnLabel.textContent = 'Applying...';

            // Populate popup — ALL tweaks so user sees the full picture
            popupList.textContent = '';
            popupSummary.textContent = '';
            delete popupSummary.dataset.variant;

            const rowMap = {};
            (data.tweaks || []).forEach(tweak => {
                const row = document.createElement('div');
                row.className = 'sr-popup-row';

                const iconEl = document.createElement('div');
                iconEl.className = 'sr-popup-icon';

                const bodyEl = document.createElement('div');
                bodyEl.className = 'sr-popup-body';

                const nameEl = document.createElement('span');
                nameEl.className = 'sr-popup-name';
                nameEl.textContent = tweak.name;

                const reasonEl = document.createElement('span');
                reasonEl.className = 'sr-popup-reason';

                if (tweak.badge === 'admin') {
                    row.dataset.state = 'admin';
                    reasonEl.textContent = 'Requires Administrator';
                } else if (tweak.badge === 'soon') {
                    row.dataset.state = 'soon';
                    reasonEl.textContent = 'Coming Soon';
                } else {
                    row.dataset.state = 'pending';
                    reasonEl.textContent = 'Pending';
                    rowMap[tweak.id] = row;
                }

                bodyEl.appendChild(nameEl);
                bodyEl.appendChild(reasonEl);
                row.appendChild(iconEl);
                row.appendChild(bodyEl);
                popupList.appendChild(row);
            });

            // Reveal popup and scroll it into view
            popup.hidden = false;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                popup.classList.add('sr-popup-visible');
                if (scanPanel) scanPanel.scrollTo({ top: scanPanel.scrollHeight, behavior: 'smooth' });
            }));

            const progressText = { running: 'Applying...', done: 'Done', failed: 'Failed', skipped: 'Not Available' };
            const unsubscribe = window.electronAPI.onTweakProgress((progress) => {
                const row = rowMap[progress.id];
                if (!row) return;
                row.dataset.state = progress.status;
                const r = row.querySelector('.sr-popup-reason');
                if (r) r.textContent = progressText[progress.status] || progress.status;
            });

            try {
                const result = await window.electronAPI.applyRecommendedTweaks(safeTweaks.map(t => t.id));
                const succeeded = (result.results || []).filter(r => r.success).length;
                const failed    = (result.results || []).filter(r => !r.success).length;

                if (failed === 0) {
                    popupSummary.textContent = `${succeeded} safe tweak${succeeded !== 1 ? 's' : ''} applied successfully`;
                    popupSummary.dataset.variant = 'success';
                } else {
                    popupSummary.textContent = `${succeeded} applied · ${failed} could not be applied`;
                    popupSummary.dataset.variant = 'partial';
                }
                if (applyBtnLabel) applyBtnLabel.textContent = 'Applied';
            } catch (err) {
                popupSummary.textContent = 'Could not apply: ' + (err.message || 'Unknown error');
                popupSummary.dataset.variant = 'error';
                applyBtn.disabled = false;
                if (applyBtnLabel) applyBtnLabel.textContent = 'Apply Recommended Tweaks';
            } finally {
                unsubscribe();
            }
        };

        // ── View Full System Info — fast path via prefetch ────────────
        const viewBtn = document.getElementById('sr-view-system-btn');
        if (viewBtn) viewBtn.onclick = async () => {
            // Hide scan modal visually; keep body locked so there's no scroll jump
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');

            let opened = false;
            if (_sysInfoPrefetch && sysInfoApi) {
                try {
                    const result = await _sysInfoPrefetch;
                    if (result && (result.status === 'success' || result.status === 'partial')) {
                        sysInfoApi.openDirect(result);
                        opened = true;
                    }
                } catch (_) {}
            }
            if (!opened) {
                document.body.classList.remove('modal-open');
                document.getElementById('hero-system-info-btn')?.click();
            }
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
        _sysInfoPrefetch = null; // reset so we always get fresh data after a new scan
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

        // Prefetch full system info while the user reads results
        if (!_sysInfoPrefetch) {
            _sysInfoPrefetch = window.electronAPI.getFullSystemInfo().catch(() => null);
        }
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
    const isGpuCard = card.dataset.gpuCard === '1';
    const isNetworkPlaceholder = !!card.dataset.networkCard;

    let detail;
    if (isGpuCard) {
        const imp = card.dataset.impact || 'medium';
        detail = {
            impact: imp.charAt(0).toUpperCase() + imp.slice(1),
            category: card.dataset.category || 'GPU Tool',
            body: card.dataset.hoverBody || 'GPU optimization tool for your hardware.'
        };
    } else {
        detail = TOGGLE_DETAILS[id] || NETWORK_DETAILS[id] || { impact: 'Medium', category: 'Tweak', body: 'Refines a system behavior to favor responsiveness over background activity.' };
    }

    const title = isGpuCard
        ? (card.querySelector('.gpu-card-title')?.textContent || '')
        : (card.querySelector('.tc-titles h4')?.textContent || '');
    const isOn = card.classList.contains('on');

    tt.dataset.cat = category;
    tt.dataset.impact = detail.impact.toLowerCase();
    tt.querySelector('.tt-title').textContent = title;
    tt.querySelector('.tt-cat').textContent = detail.category;
    tt.querySelector('.tt-impact-text').textContent = `${detail.impact} impact`;
    tt.querySelector('.tt-body').textContent = detail.body;

    if (isGpuCard) {
        tt.querySelector('.tt-state-text').textContent = 'Coming soon';
        tt.querySelector('.tt-hint').textContent = 'Placeholder · not yet active';
        tt.classList.remove('is-on');
    } else {
        tt.querySelector('.tt-state-text').textContent = isNetworkPlaceholder ? 'Placeholder locked' : (isOn ? 'Currently active' : 'Currently inactive');
        tt.querySelector('.tt-hint').textContent = isNetworkPlaceholder ? 'Coming soon' : 'Toggle to apply';
        tt.classList.toggle('is-on', isOn);
    }

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

// ── GPU Page ──────────────────────────────────────────────────
function initializeGpuPage() {
    const gpuNavBtn      = document.querySelector('[data-page="gpu"]');
    const gpuScanState   = document.getElementById('gpu-scan-state');
    const gpuResultsState = document.getElementById('gpu-results-state');
    const gpuErrorState  = document.getElementById('gpu-error-state');
    const gpuScanBar     = document.getElementById('gpu-scan-bar');
    const gpuScanStatus  = document.getElementById('gpu-scan-status');
    const gpuResultsInfo = document.getElementById('gpu-results-info');
    const gpuVendorTabs  = document.getElementById('gpu-vendor-tabs');
    const gpuSections    = document.getElementById('gpu-vendor-sections');
    const gpuRetryBtn    = document.getElementById('gpu-retry-btn');
    const gpuErrorMsg    = document.getElementById('gpu-error-msg');

    if (!gpuNavBtn || !gpuScanState) return;

    let detectionDone  = false;
    let detectedGpus   = [];
    let gpuStatInterval = null;
    const gpuTempHist  = [];
    const gpuUsageHist = [];
    const GPU_SC_LEN   = 24;

    // ── Card definitions per vendor ───────────────────────────
    const GPU_CARDS = {
        nvidia: [
            { icon: 'zap',      title: 'Low Latency Mode',       desc: 'Configure NVIDIA Ultra-Low Latency mode for competitive play.',         badge: 'soon', impact: 'High',   category: 'Latency',     hoverBody: 'Queues frames just before the GPU needs them, cutting the gap between your input and the rendered frame. Most impactful at high frame rates on a high-refresh display.' },
            { icon: 'chart',    title: 'VRAM Monitor',           desc: 'Installed VRAM detected for your NVIDIA GPU.',                          badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Reads your card\'s installed video memory. Helps gauge texture quality headroom and determine whether VRAM pressure is contributing to stutters.' },
            { icon: 'trash',    title: 'Shader Cache Cleanup',   desc: 'Clear the NVIDIA shader cache to resolve stutter from stale entries.',  badge: 'soon', impact: 'Medium', category: 'Stability',   hoverBody: 'Clears stale compiled shader entries from disk. Outdated cache data causes stutters when a scene first loads — a clean rebuild with the current driver resolves persistent hitching.' },
            { icon: 'info',     title: 'Driver Info',            desc: 'Installed driver version and release date for your NVIDIA GPU.',        badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Displays your installed driver version and release date. Useful for confirming you\'re current or isolating regressions introduced by a specific driver update.' },
            { icon: 'sliders',  title: 'Performance Preference', desc: 'Set NVIDIA Power Management mode to Maximum Performance.',              badge: 'soon', impact: 'High',   category: 'Performance', hoverBody: 'Sets NVIDIA Power Management to Maximum Performance, preventing clock downscaling during the initial session ramp-up. Tightens frame-delivery consistency in variable workloads.' },
            { icon: 'activity', title: 'Reflex Ready Check',     desc: 'Verify your NVIDIA Reflex configuration in supported titles.',          badge: 'soon', impact: 'Medium', category: 'Latency',     hoverBody: 'Confirms whether NVIDIA Reflex Low Latency is active in supported titles. Reflex reduces the render queue depth to lower system latency between input and displayed frame.' },
            { icon: 'power',    title: 'GPU Power Mode',         desc: 'Inspect and configure GPU power delivery preferences.',                 badge: 'soon', impact: 'Medium', category: 'Performance', hoverBody: 'Reads and adjusts the GPU power limit. Higher sustained power allows the card to hold boost clocks longer — relevant during extended GPU-heavy sessions.' },
            { icon: 'settings', title: 'Profile Inspector',      desc: 'Advanced per-application NVIDIA profile controls.',                     badge: 'soon', impact: 'Medium', category: 'Advanced',    hoverBody: 'Exposes per-application driver profile settings not available in the standard Control Panel. Fine-tune anti-aliasing, texture filtering, and render flags on a per-game basis.' },
        ],
        amd: [
            { icon: 'zap',      title: 'Radeon Anti-Lag',        desc: 'Enable AMD Anti-Lag for reduced input latency in supported games.',     badge: 'soon', impact: 'High',   category: 'Latency',     hoverBody: 'Synchronizes CPU and GPU pacing to reduce the latency between input and rendered frame. Most impactful in CPU-bound scenarios at high frame rates.' },
            { icon: 'chart',    title: 'VRAM Monitor',           desc: 'Installed VRAM detected for your AMD GPU.',                            badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Reads your card\'s installed video memory. Helps gauge texture quality headroom and understand whether VRAM pressure is behind observed stuttering.' },
            { icon: 'trash',    title: 'Shader Cache Cleanup',   desc: 'Clear Radeon shader cache to fix stuttering from outdated entries.',   badge: 'soon', impact: 'Medium', category: 'Stability',   hoverBody: 'Clears stale Radeon shader cache entries. Outdated cache data causes microstutters when shaders first load — rebuilding from the current driver state fixes persistent hitching.' },
            { icon: 'info',     title: 'Driver Info',            desc: 'Installed driver version and release date for your AMD GPU.',          badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Displays your installed Adrenalin driver version and release date. Useful for confirming you\'re current or isolating regressions from a specific driver update.' },
            { icon: 'sliders',  title: 'Performance Mode',       desc: 'Configure Radeon Power Management for maximum performance output.',    badge: 'soon', impact: 'High',   category: 'Performance', hoverBody: 'Configures Radeon Power Management to Maximum Performance, preventing aggressive downclocking during brief load dips. Delivers more consistent frame delivery.' },
            { icon: 'activity', title: 'Anti-Lag Ready Check',   desc: 'Verify AMD Anti-Lag configuration in supported titles.',              badge: 'soon', impact: 'Medium', category: 'Latency',     hoverBody: 'Confirms whether Anti-Lag is active and properly configured in supported titles. Reports availability for the current game and installed driver version.' },
            { icon: 'power',    title: 'GPU Power Mode',         desc: 'Inspect and configure GPU power delivery preferences.',                badge: 'soon', impact: 'Medium', category: 'Performance', hoverBody: 'Reads and adjusts the GPU TDP limit. Sustaining higher power draw prevents thermal throttling during extended gaming sessions.' },
            { icon: 'settings', title: 'Adrenalin Profile',      desc: 'AMD Adrenalin software profile configuration.',                       badge: 'soon', impact: 'Medium', category: 'Advanced',    hoverBody: 'Accesses Radeon Software Adrenalin per-game profile settings. Enables per-title overrides for Anti-Lag, Enhanced Sync, and image sharpening without affecting global settings.' },
        ],
        intel: [
            { icon: 'info',     title: 'Arc Driver Info',        desc: 'Installed driver version and release date for your Intel GPU.',        badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Displays your installed Intel Arc driver version and date. Driver currency significantly affects performance on Arc hardware — confirming this is the first step in diagnosing issues.' },
            { icon: 'chart',    title: 'VRAM Monitor',           desc: 'Installed VRAM detected for your Intel GPU.',                          badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Reports installed VRAM on your Intel GPU. On Arc discrete cards, knowing available memory helps calibrate texture quality and workload sizing.' },
            { icon: 'sliders',  title: 'Power / Performance',    desc: 'Configure Intel GPU power preference for performance or efficiency.',  badge: 'soon', impact: 'High',   category: 'Performance', hoverBody: 'Adjusts the Intel GPU power preference profile between efficiency and full performance. Arc discrete cards benefit from the performance profile during gaming to avoid unnecessary power-state drops.' },
            { icon: 'trash',    title: 'Shader Cache Cleanup',   desc: 'Clear Intel GPU shader cache to resolve driver-related stutter.',      badge: 'soon', impact: 'Medium', category: 'Stability',   hoverBody: 'Clears the Intel GPU shader cache on disk. Driver-related stutters during shader compilation can be resolved by forcing a clean rebuild with the latest driver version.' },
            { icon: 'monitor',  title: 'Display Settings',       desc: 'Verify display configuration, refresh rate, and color settings.',     badge: 'soon', impact: 'Low',    category: 'Display',     hoverBody: 'Reads display configuration including refresh rate, resolution, and color depth. Confirms the display is operating at intended settings after driver or OS changes.' },
            { icon: 'power',    title: 'GPU Power Mode',         desc: 'Inspect and configure GPU power delivery preferences.',               badge: 'soon', impact: 'Medium', category: 'Performance', hoverBody: 'Configures Intel GPU power delivery settings. For Arc discrete GPUs, this affects sustained boost behavior during extended render workloads.' },
            { icon: 'cpu',      title: 'Integrated GPU Mode',    desc: 'Check active GPU routing for Intel integrated graphics.',              badge: 'soon', impact: 'Medium', category: 'Routing',     hoverBody: 'Checks which workloads are routed to integrated Intel graphics versus a discrete adapter. Misconfigured routing can cause games to run on the weaker iGPU unexpectedly.' },
            { icon: 'settings', title: 'Intel Command Center',   desc: 'Intel Arc Control software integration.',                             badge: 'soon', impact: 'Low',    category: 'Advanced',    hoverBody: 'Integration point for Intel Arc Control. Surfaces driver-level settings and performance overlays for Arc discrete and integrated GPUs.' },
        ],
        unknown: [
            { icon: 'info',     title: 'GPU Info',               desc: 'Basic GPU information from your system.',                             badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Displays available hardware information for the detected GPU. Driver data and VRAM capacity help identify the hardware and confirm the driver is properly installed.' },
            { icon: 'chart',    title: 'VRAM Monitor',           desc: 'Installed VRAM detected for your GPU.',                               badge: 'info', impact: 'Low',    category: 'Diagnostics', hoverBody: 'Reports installed video memory. Knowing available VRAM helps calibrate texture quality settings and diagnose memory-pressure stuttering.' },
            { icon: 'sliders',  title: 'Performance Settings',   desc: 'General GPU performance configuration options.',                      badge: 'soon', impact: 'Medium', category: 'Performance', hoverBody: 'Applies general GPU scheduling and power settings to favor sustained boost behavior during gaming sessions.' },
            { icon: 'trash',    title: 'Shader Cache Cleanup',   desc: 'Clear GPU shader cache to resolve stutter from stale entries.',       badge: 'soon', impact: 'Medium', category: 'Stability',   hoverBody: 'Clears GPU shader cache from disk. Stale compiled shaders cause microstutters on first load — a clean rebuild resolves hitching tied to outdated entries.' },
            { icon: 'monitor',  title: 'Display Settings',       desc: 'Verify display configuration and refresh rate settings.',             badge: 'soon', impact: 'Low',    category: 'Display',     hoverBody: 'Reads current display configuration including refresh rate, resolution, and color output. Confirms the display is operating at intended settings.' },
            { icon: 'power',    title: 'GPU Power Mode',         desc: 'Inspect and configure GPU power delivery preferences.',               badge: 'soon', impact: 'Medium', category: 'Performance', hoverBody: 'Configures GPU power delivery preferences. Higher power limits reduce throttling during sustained workloads and improve frame-delivery consistency.' },
            { icon: 'activity', title: 'Performance Profile',    desc: 'Hardware-specific GPU performance profile.',                          badge: 'soon', impact: 'Medium', category: 'Performance', hoverBody: 'Applies hardware-specific GPU scheduling and power preferences known to improve responsiveness in gaming workloads.' },
            { icon: 'settings', title: 'Advanced Settings',      desc: 'Advanced GPU configuration tools.',                                   badge: 'soon', impact: 'Low',    category: 'Advanced',    hoverBody: 'Advanced configuration panel exposing driver-level controls for render pipeline scheduling and power behavior.' },
        ],
    };

    const ICON_PATHS = {
        zap:      '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
        trash:    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>',
        info:     '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        sliders:  '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
        activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        monitor:  '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
        cpu:      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
        chart:    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
        power:    '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
    };

    const VENDOR_NAME = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel', unknown: 'Unknown' };
    const BADGE_LABEL = { soon: 'Coming Soon', info: 'Info', safe: 'Safe', admin: 'Admin Required' };
    const BADGE_CLASS = { soon: 'gpu-badge--soon', info: 'gpu-badge--info', safe: 'gpu-badge--safe', admin: 'gpu-badge--admin' };

    function iconSvg(name) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ICON_PATHS.info}</svg>`;
    }

    // ── GPU Stat Strip ────────────────────────────────────────
    function initGpuStatStrip(gpus) {
        const vendor = (gpus[0] || {}).vendor || 'unknown';

        // Apply vendor accent to all three stat cards
        ['gpu-sc-temp', 'gpu-sc-usage', 'gpu-sc-power'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.dataset.vendor = vendor;
        });

        // Clear any prior polling interval (e.g. retry after error)
        if (gpuStatInterval) { clearInterval(gpuStatInterval); gpuStatInterval = null; }
        gpuTempHist.length  = 0;
        gpuUsageHist.length = 0;

        function updateSparkline(lineId, fillId, hist) {
            if (hist.length < 2) return;
            const slice = hist.slice(-GPU_SC_LEN);
            document.getElementById(lineId)?.setAttribute('d', buildSparklinePath(slice, 80, 26, 2));
            document.getElementById(fillId)?.setAttribute('d', buildAreaPath(slice, 80, 26, 2));
        }

        async function tick() {
            // ── Temp + Power Plan + real GPU Load (backend-cached) ──
            try {
                const stats = await window.electronAPI.getGpuLiveStats();

                // GPU Load — only show when WMI returns a real value; N/A otherwise
                const usageValEl  = document.getElementById('gpu-sc-usage-val');
                const usageUnitEl = document.querySelector('#gpu-sc-usage .gpu-sc-unit');
                if (stats.usage !== null && stats.usage !== undefined) {
                    if (usageValEl)  usageValEl.textContent  = stats.usage;
                    if (usageUnitEl) usageUnitEl.textContent = '%';
                    gpuUsageHist.push(stats.usage);
                    while (gpuUsageHist.length > GPU_SC_LEN) gpuUsageHist.shift();
                    updateSparkline('gpu-sc-usage-line', 'gpu-sc-usage-fill', gpuUsageHist);
                } else {
                    if (usageValEl)  usageValEl.textContent  = 'N/A';
                    if (usageUnitEl) usageUnitEl.textContent = '';
                }

                const tempVal  = document.getElementById('gpu-sc-temp-val');
                const tempUnit = document.getElementById('gpu-sc-temp-unit');

                if (stats.temp !== null && stats.temp !== undefined) {
                    if (tempVal)  tempVal.textContent  = stats.temp;
                    if (tempUnit) tempUnit.textContent = '°C';
                    gpuTempHist.push(stats.temp);
                    while (gpuTempHist.length > GPU_SC_LEN) gpuTempHist.shift();
                    updateSparkline('gpu-sc-temp-line', 'gpu-sc-temp-fill', gpuTempHist);
                } else {
                    if (tempVal)  tempVal.textContent  = 'N/A';
                    if (tempUnit) tempUnit.textContent = '';
                }

                const powerVal  = document.getElementById('gpu-sc-power-val');
                const powerText = document.getElementById('gpu-sc-power-text');
                const powerDot  = document.getElementById('gpu-sc-power-dot');

                if (stats.powerPlan) {
                    if (powerVal)  powerVal.textContent  = stats.powerPlan;
                    if (powerText) powerText.textContent = 'Active';
                    if (powerDot)  powerDot.dataset.state = 'active';
                } else {
                    if (powerVal)  powerVal.textContent  = '--';
                    if (powerText) powerText.textContent = 'Unavailable';
                    if (powerDot)  delete powerDot.dataset.state;
                }
            } catch (_) { /* keep previous values on transient error */ }
        }

        tick();
        gpuStatInterval = setInterval(tick, 1000);
    }

    // ── Detection ─────────────────────────────────────────────
    async function runDetection() {
        // Reset to scan state
        gpuScanState.classList.remove('gpu-scan-fading');
        gpuScanState.hidden = false;
        gpuResultsState.hidden = true;
        gpuErrorState.hidden = true;
        gpuScanBar.style.transition = 'none';
        gpuScanBar.style.width = '0%';
        gpuScanStatus.textContent = 'Reading hardware info...';
        gpuScanStatus.classList.remove('fading');

        // Reset checklist rows
        const chkRows = [1,2,3,4].map(i => document.getElementById(`gpu-check-${i}`));
        chkRows.forEach(r => r?.classList.remove('visible', 'active', 'done'));
        const metaScanVal = document.getElementById('gpu-meta-scan-value');
        if (metaScanVal) metaScanVal.textContent = 'In Progress';

        requestAnimationFrame(() => { gpuScanBar.style.transition = 'width 0.12s linear'; });

        const ANIM_MS   = 2600;
        const startTime = Date.now();

        const progressTimer = setInterval(() => {
            const pct = Math.min(((Date.now() - startTime) / ANIM_MS) * 82, 82);
            gpuScanBar.style.width = pct + '%';
        }, 60);

        const statusMessages = ['Reading hardware info...', 'Identifying GPU vendor...', 'Filtering display adapters...'];
        let msgIdx = 0;
        const msgTimer = setInterval(() => {
            msgIdx = Math.min(msgIdx + 1, statusMessages.length - 1);
            gpuScanStatus.classList.add('fading');
            setTimeout(() => {
                gpuScanStatus.textContent = statusMessages[msgIdx];
                gpuScanStatus.classList.remove('fading');
            }, 200);
        }, 900);

        // Checklist step animations — timed across ANIM_MS
        const chkStep = (rowIdx, delay, prevIdx) => setTimeout(() => {
            if (prevIdx >= 0) {
                chkRows[prevIdx]?.classList.remove('active');
                chkRows[prevIdx]?.classList.add('done');
            }
            chkRows[rowIdx]?.classList.add('visible');
            if (rowIdx < 3) chkRows[rowIdx]?.classList.add('active'); // row 3 is a note, no pulse
        }, delay);

        const chkTimers = [
            chkStep(0, 360, -1),
            chkStep(1, 860, 0),
            chkStep(2, 1520, 1),
            chkStep(3, 2060, 2),
        ];

        let result = null;
        try {
            result = await window.electronAPI.getGpuInfo();
        } catch (err) {
            result = { success: false, error: err.message, gpus: [] };
        }

        const elapsed   = Date.now() - startTime;
        const remaining = Math.max(0, ANIM_MS - elapsed);
        await new Promise(r => setTimeout(r, remaining));

        clearInterval(progressTimer);
        clearInterval(msgTimer);
        chkTimers.forEach(clearTimeout);
        gpuScanBar.style.width = '100%';
        await new Promise(r => setTimeout(r, 260));

        if (!result || !result.success || !result.gpus || result.gpus.length === 0) {
            gpuScanState.hidden = true;
            gpuErrorState.hidden = false;
            gpuErrorMsg.textContent = (result && result.error) || 'No real GPU detected. Hardware info may be unavailable.';
            return;
        }

        // Mark all checklist rows done, update meta card
        chkRows.forEach(r => { r?.classList.remove('active'); r?.classList.add('visible', 'done'); });
        if (metaScanVal) metaScanVal.textContent = 'Complete';

        detectedGpus  = result.gpus;
        detectionDone = true;

        // Brief pause so user sees completed checklist
        await new Promise(r => setTimeout(r, 480));

        gpuScanState.classList.add('gpu-scan-fading');
        await new Promise(r => setTimeout(r, 300));
        gpuScanState.hidden = true;
        gpuScanState.classList.remove('gpu-scan-fading');
        renderGpuPage(detectedGpus);
        initGpuStatStrip(detectedGpus);
    }

    // ── Render GPU page ───────────────────────────────────────
    function renderGpuPage(gpus) {
        // Deduplicate by vendor
        const seen = new Set();
        const uniqueGpus = gpus.filter(g => { if (seen.has(g.vendor)) return false; seen.add(g.vendor); return true; });

        // Prefer NVIDIA > AMD > Intel > unknown when choosing the default tab
        const PRIORITY = ['nvidia', 'amd', 'intel', 'unknown'];
        const defaultVendor = PRIORITY.find(v => uniqueGpus.some(g => g.vendor === v)) || uniqueGpus[0].vendor;

        // ── Results info card ────────────────────────────────
        const primaryGpu = uniqueGpus.find(g => g.vendor === defaultVendor) || uniqueGpus[0];
        const gpuResultsHeader = document.getElementById('gpu-results-header');

        function buildInfoHtml(gpu) {
            return `
                <div class="gpu-ri-vendor-row">
                    <span class="gpu-ri-dot gpu-ri-dot--${gpu.vendor}"></span>
                    <span class="gpu-ri-vendor-name">${VENDOR_NAME[gpu.vendor]}</span>
                </div>
                <span class="gpu-ri-name">${gpu.name}</span>
                <div class="gpu-ri-pills">
                    ${gpu.driverVersion ? `<span class="gpu-ri-pill">Driver ${gpu.driverVersion}</span>` : ''}
                    ${gpu.vram ? `<span class="gpu-ri-pill">${gpu.vram} VRAM</span>` : ''}
                </div>
            `;
        }

        gpuResultsInfo.innerHTML = buildInfoHtml(primaryGpu);
        if (gpuResultsHeader) gpuResultsHeader.className = `gpu-results-header gpu-results-header--${primaryGpu.vendor}`;

        // ── Vendor tabs (only if multiple vendors) ────────────
        gpuVendorTabs.textContent = '';
        if (uniqueGpus.length > 1) {
            uniqueGpus.forEach(gpu => {
                const btn = document.createElement('button');
                btn.className = 'gpu-vendor-tab' + (gpu.vendor === defaultVendor ? ' active' : '');
                btn.dataset.vendor = gpu.vendor;
                btn.textContent = VENDOR_NAME[gpu.vendor];
                btn.addEventListener('click', () => {
                    gpuVendorTabs.querySelectorAll('.gpu-vendor-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    gpuSections.querySelectorAll('.gpu-vendor-section').forEach(s => {
                        s.hidden = s.dataset.vendor !== gpu.vendor;
                    });
                    const g = uniqueGpus.find(x => x.vendor === gpu.vendor);
                    if (g) {
                        gpuResultsInfo.innerHTML = buildInfoHtml(g);
                        if (gpuResultsHeader) gpuResultsHeader.className = `gpu-results-header gpu-results-header--${g.vendor}`;
                    }
                });
                gpuVendorTabs.appendChild(btn);
            });
        }

        // ── Build vendor sections ─────────────────────────────
        gpuSections.textContent = '';
        uniqueGpus.forEach((gpu, idx) => {
            const section = buildVendorSection(gpu, idx);
            section.dataset.vendor = gpu.vendor;
            if (uniqueGpus.length > 1 && gpu.vendor !== defaultVendor) {
                section.hidden = true;
            }
            gpuSections.appendChild(section);
        });

        gpuResultsState.hidden = false;
    }

    function buildVendorSection(gpu, idx) {
        const v     = gpu.vendor;
        const cards = GPU_CARDS[v] || GPU_CARDS.unknown;

        const section = document.createElement('div');
        section.className = `gpu-vendor-section gpu-vendor-section--${v}`;
        section.style.animationDelay = `${idx * 0.08}s`;

        // Thin section label
        const label = document.createElement('div');
        label.className = `gpu-section-label gpu-section-label--${v}`;
        label.innerHTML = `<span class="gpu-section-label-dot"></span>${VENDOR_NAME[v]} Tools`;
        section.appendChild(label);

        // Card grid
        const grid = document.createElement('div');
        grid.className = 'gpu-card-grid';

        cards.forEach(c => {
            const card = document.createElement('div');
            card.className = `gpu-card gpu-card--${v}`;

            // Tooltip data attributes
            card.dataset.gpuCard = '1';
            card.dataset.cat = `gpu-${v}`;
            card.dataset.impact = (c.impact || 'medium').toLowerCase();
            card.dataset.category = c.category || 'GPU Tool';
            card.dataset.hoverBody = c.hoverBody || c.desc;

            const impactLower = (c.impact || 'medium').toLowerCase();
            const btnText = c.badge === 'info' ? 'Read Only' : 'Coming Soon';

            card.innerHTML = `
                <div class="gpu-card-aurora" aria-hidden="true"></div>
                <div class="gpu-card-top">
                    <div class="gpu-card-icon gpu-card-icon--${v}">${iconSvg(c.icon)}</div>
                    <div class="gpu-card-body">
                        <h4 class="gpu-card-title">${c.title}</h4>
                        <p class="gpu-card-desc">${c.desc}</p>
                    </div>
                </div>
                <div class="gpu-card-foot">
                    <div class="gpu-card-foot-left">
                        <span class="gpu-card-badge ${BADGE_CLASS[c.badge] || 'gpu-badge--soon'}"><span class="gpu-badge-dot" aria-hidden="true"></span>${BADGE_LABEL[c.badge] || 'Coming Soon'}</span>
                        <span class="gpu-card-impact gpu-impact--${impactLower}">${c.impact || 'Medium'} Impact</span>
                    </div>
                    <button class="gpu-card-btn" disabled>${btnText}</button>
                </div>
            `;

            // Pointer-tracking aurora
            card.addEventListener('pointermove', e => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
                card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
            });

            // Hover tooltip (220ms dwell, same as toggle-card)
            let gpuShowTimer;
            card.addEventListener('mouseenter', () => {
                clearTimeout(gpuShowTimer);
                gpuShowTimer = setTimeout(() => showTooltipFor(card), 220);
            });
            card.addEventListener('mouseleave', () => {
                clearTimeout(gpuShowTimer);
                hideTooltip();
            });

            grid.appendChild(card);
        });

        section.appendChild(grid);
        return section;
    }

    // ── Event wiring ──────────────────────────────────────────
    gpuRetryBtn?.addEventListener('click', () => {
        detectionDone = false;
        runDetection();
    });

    gpuNavBtn.addEventListener('click', () => {
        if (!detectionDone) {
            setTimeout(runDetection, 60);
        }
    });
}

function initializeAiTweaker() {
    const { XTWEAKS_AI_MODEL, XTWEAKS_AI_SYSTEM_PROMPT } = window.XTweaksAI || {
        XTWEAKS_AI_MODEL: 'llama3.2',
        XTWEAKS_AI_SYSTEM_PROMPT:
            'You are AI Tweaker inside XTweaks Premium Utility. ' +
            'Use the provided PC specs, running apps, startup apps, and service context to give specific, practical advice. ' +
            'Help with gaming performance, input delay, background app cleanup, startup optimization, Windows services, ' +
            'Fortnite optimization, CPU/GPU/RAM usage, network issues, and safe system tuning. ' +
            'When recommending background apps to close or startup items to disable, be specific — name the apps, ' +
            'explain why they affect performance, and give a risk level (Safe / Review). ' +
            'Do not recommend disabling critical Windows services (audio, network, security, RPC, WMI, etc.). ' +
            'Do not recommend closing security software. ' +
            'If something is already optimized, say so rather than inventing improvements. ' +
            'Always say XTweaks will handle the action — never claim you directly closed or disabled anything. ' +
            'Always let the user confirm before any changes are made. ' +
            'Never recommend closing or disabling XTweaks itself, the XTweaks AI Engine, or any process required for AI Tweaker to function. ' +
            'If you do not see relevant background apps in the context, say the scan may need a refresh.'
    };

    const AI_ALLOWED_TWEAKS = {
        'disable-game-bar':            { title: 'Disable Game Bar',            reason: 'Removes overlay that causes FPS stutters & recording lag',    risk: 'safe'   },
        'gpu-scheduling':              { title: 'Hardware GPU Scheduling',      reason: 'Reduces GPU latency and improves frame pacing',               risk: 'safe'   },
        'game-priority':               { title: 'Boost Game Process Priority',  reason: 'Ensures games get CPU priority over background processes',    risk: 'safe'   },
        'optimize-visual-effects':     { title: 'Optimize Visual Effects',      reason: 'Frees CPU from rendering Windows animations',                 risk: 'safe'   },
        'disable-xbox-services':       { title: 'Disable Xbox Services',        reason: 'Stops background Xbox processes consuming CPU & RAM',         risk: 'safe'   },
        'optimize-power-plan':         { title: 'High Performance Power Plan',  reason: 'Maximizes CPU/GPU clocks for consistent frame rates',         risk: 'safe'   },
        'disable-power-throttling':    { title: 'Disable Power Throttling',     reason: 'Prevents Windows from throttling CPU-intensive apps',         risk: 'safe'   },
        'optimize-network-throttling': { title: 'Remove Network Throttling',    reason: 'Removes artificial network delay limits for lower ping',      risk: 'safe'   },
        'disable-nagle':               { title: 'Disable Nagle Algorithm',      reason: 'Reduces TCP latency for lower ping in online games',          risk: 'safe'   },
        'disable-mouse-accel':         { title: 'Disable Mouse Acceleration',   reason: 'Ensures raw 1:1 mouse movement for aim accuracy',            risk: 'safe'   },
        'disable-background-apps':     { title: 'Disable Background Apps',      reason: 'Prevents background UWP apps from consuming resources',      risk: 'safe'   },
        'clean-temp':                  { title: 'Clean Temporary Files',        reason: 'Frees disk space and removes leftover junk files',           risk: 'safe'   },
        'fortnite-priority':           { title: 'Fortnite Process Priority',    reason: 'Gives Fortnite high CPU scheduling priority',                risk: 'safe'   },
        'fortnite-clear-cache':        { title: 'Clear Fortnite Shader Cache',  reason: 'Fixes stutters caused by stale shader & asset cache',        risk: 'safe'   },
        'timer-resolution':            { title: 'Optimize Timer Resolution',    reason: 'Improves input timing precision — may need restart',          risk: 'review' },
        'disable-superfetch':          { title: 'Disable SysMain / Superfetch', reason: 'Reduces background disk & RAM usage on gaming PCs',          risk: 'review' },
        'disable-telemetry':           { title: 'Disable Windows Telemetry',    reason: 'Stops background data collection from using resources',       risk: 'review' },
        'bcdedit-tweaks':              { title: 'Boot & Kernel Optimizations',  reason: 'Applies low-level Windows kernel timing tweaks',              risk: 'review' },
    };

    const AI_INTENT_PATTERNS = [
        {
            patterns: ['fortnite', 'fn fps', 'fortnite fps', 'fortnite tweak', 'fn optimize'],
            tweakIds: ['disable-game-bar', 'fortnite-priority', 'fortnite-clear-cache', 'optimize-power-plan', 'optimize-visual-effects', 'disable-xbox-services'],
            label: 'Fortnite Optimization'
        },
        {
            patterns: ['input delay', 'input latency', 'click delay', 'mouse delay', 'response time', 'click latency', 'reduce latency'],
            tweakIds: ['disable-mouse-accel', 'timer-resolution', 'disable-power-throttling', 'disable-nagle', 'gpu-scheduling', 'optimize-power-plan'],
            label: 'Input Latency Reduction'
        },
        {
            patterns: ['network', 'ping', 'lag', 'packet loss', 'lower ping', 'reduce ping', 'internet lag', 'online gaming'],
            tweakIds: ['optimize-network-throttling', 'disable-nagle', 'disable-background-apps'],
            label: 'Network Optimization'
        },
        {
            patterns: ['clean', 'cleanup', 'junk', 'temp files', 'slow pc', 'bloat', 'disk space', 'clean up'],
            tweakIds: ['clean-temp', 'disable-superfetch', 'disable-background-apps'],
            label: 'System Cleanup'
        },
        {
            patterns: ['gaming', 'fps', 'frame rate', 'game performance', 'stutter', 'frame drop', 'boost fps', 'optimize', 'performance', 'speed up', 'faster', 'best tweaks'],
            tweakIds: ['disable-game-bar', 'gpu-scheduling', 'game-priority', 'optimize-visual-effects', 'optimize-power-plan', 'disable-xbox-services'],
            label: 'Gaming Performance'
        }
    ];

    const AI_BG_INTENT_PATTERNS = [
        'background app', 'background apps', 'what should i close', 'what can i close',
        'unnecessary app', 'unnecessary apps', 'what is running', 'what apps are running',
        'close background', 'startup app', 'startup apps', 'disable startup', 'boot time',
        'what services', 'services can i disable', 'services disable', 'background process',
        'background processes', 'apps using ram', 'apps using cpu', 'reduce ram',
        'free up ram', 'free up memory', 'why is my pc slow', 'why is my computer slow',
        'what is slowing', 'optimize gaming', 'optimize my pc', 'kill background', 'check my background',
        'overlays', 'overlay apps', 'rgb software',
        // Optimization status queries — also trigger bg context for full picture
        'how optimized', 'optimization score', 'optimization readiness', 'how good is my pc',
        'what have i tweaked', 'what tweaks did i', 'what have i applied', 'is my pc optimized',
        'what settings are on', 'what is applied', 'what are my tweaks', 'my optimization',
        'what should i still do', 'what is left to optim', 'how much have i done',
    ];

    const PC_CONTEXT_KEYWORDS = [
        'spec', 'slow', 'optim', 'fortnite', 'background app', 'startup',
        'temp', 'gpu', 'ram', 'cpu', 'latency', 'input delay', 'fps',
        'performance', 'lag', 'ping', 'usage', 'memory', 'apps', 'services',
        'processor', 'graphics', 'hardware', 'running',
        'tweak', 'applied', 'settings', 'build', 'driver', 'score', 'ready',
        'how good', 'how optimized', 'already', 'profile', 'windows', 'my pc',
        'bandwidth', 'what do i have', 'my setup', 'what is left', 'what should',
    ];

    function detectIntent(text) {
        const lower = text.toLowerCase();
        if (AI_BG_INTENT_PATTERNS.some(p => lower.includes(p))) {
            return { type: 'background', label: 'Background Optimization Review' };
        }
        for (const intent of AI_INTENT_PATTERNS) {
            if (intent.patterns.some(p => lower.includes(p))) return { type: 'tweaks', ...intent };
        }
        return null;
    }

    let chatHistory   = [];
    let aiReady       = false;
    let pcContext     = null;
    let pcContextTime = null;
    let tweakStates   = {};
    let pullProgressUnsubscribe = null;
    let aiSetupInProgress = false;
    let pcContextInFlight = null;
    let bgContext         = null;
    let bgContextTime     = 0;
    const BG_CONTEXT_TTL  = 60000;
    let pcContextFetchedAt = 0;
    const PC_CONTEXT_TTL   = 90000;

    /* ── AI Preferences — local learning ── */
    const AI_PREFS_KEY = 'xtweaks-ai-prefs';
    function loadAIPrefs() {
        try { return JSON.parse(localStorage.getItem(AI_PREFS_KEY) || '{}'); } catch { return {}; }
    }
    function saveAIPrefs(prefs) {
        try { localStorage.setItem(AI_PREFS_KEY, JSON.stringify(prefs)); } catch {}
    }
    function updateAIPref(key, value) {
        const p = loadAIPrefs(); p[key] = value; saveAIPrefs(p);
    }

    /* ── App name normalizer (dedup + display) ── */
    const APP_NAME_MAP = {
        'onedrive': 'OneDrive', 'onedrivesetup': 'OneDrive', 'onedriveupdater': 'OneDrive',
        'epicgameslauncher': 'Epic Games Launcher', 'epicwebhelper': 'Epic Games Launcher',
        'epiconlineservices': 'Epic Games Launcher',
        'googleupdater': 'Google Updater', 'googleupdatertaskuser': 'Google Updater',
        'googledrivesync': 'Google Drive', 'googledrive': 'Google Drive',
        'chrome': 'Google Chrome', 'googlechrome': 'Google Chrome',
        'steam': 'Steam', 'steamwebhelper': 'Steam', 'steamservice': 'Steam',
        'nvcontainer': 'NVIDIA Services', 'nvtelemetrycontainer': 'NVIDIA Services',
        'riotclientservices': 'Riot Client', 'riotclientux': 'Riot Client',
        'eadesktop': 'EA App', 'eabackgroundservice': 'EA App', 'easteam': 'EA App',
        'battlenet': 'Battle.net',
        'discord': 'Discord', 'discordptb': 'Discord', 'discordcanary': 'Discord',
        'teams': 'Microsoft Teams',
    };
    function normalizeAppName(raw) {
        if (!raw) return raw || '';
        const key = raw.toLowerCase().replace(/[\s._\-]+/g, '');
        return APP_NAME_MAP[key] || raw;
    }

    /* ── Optimization score — 5-category, confidence-aware ── */
    function computeOptimizationScore(states, bgCtx) {
        // Unknown ≠ bad. true=full, false=0, undefined/null=55% neutral (benefit of the doubt).
        function pts(id, full) {
            const s = states[id];
            if (s === true)  return full;
            if (s === false) return 0;
            return Math.round(full * 0.55);
        }
        function isKnown(id) { return states[id] === true || states[id] === false; }

        // ── Category 1: Core Gaming Tweaks (35 pts) ──────────────────────
        const CORE_W = {
            'optimize-power-plan': 14, 'disable-game-bar': 12,
            'disable-xbox-services': 5, 'optimize-visual-effects': 4,
        };
        let coreScore = 0;
        for (const [id, w] of Object.entries(CORE_W)) coreScore += pts(id, w);
        coreScore = Math.round(coreScore);

        // ── Category 2: Latency / Input (20 pts) ────────────────────────
        const LATENCY_W = {
            'disable-mouse-accel': 5, 'disable-power-throttling': 4,
            'optimize-network-throttling': 4, 'disable-nagle': 3,
            'game-priority': 2, 'timer-resolution': 2,
        };
        let latencyScore = 0;
        for (const [id, w] of Object.entries(LATENCY_W)) latencyScore += pts(id, w);
        latencyScore = Math.round(latencyScore);
        const latencyAllUnknown = Object.keys(LATENCY_W).every(id => !isKnown(id));

        // ── Category 3: Background / Startup Cleanliness (20 pts) ───────
        const BG_PENALTY = {
            'Overlay': 3, 'Recording/Capture': 3, 'Cloud Sync': 3,
            'Game Launcher': 2, 'Browser': 2, 'Desktop App': 2,
            'Updater': 1, 'RGB/Peripheral': 1, 'Chat/Voice': 1,
        };
        let cleanScore = 20;
        if (bgCtx) {
            let bgPenalty = 0;
            (bgCtx.processes || []).forEach(p => {
                if (p.safeToClose) bgPenalty += BG_PENALTY[p.category] ?? 1;
            });
            const extraStartups = Math.max(0, (bgCtx.startups || []).length - 3);
            cleanScore = Math.max(12, 20 - Math.min(bgPenalty, 8) - Math.min(extraStartups * 1.5, 5));
        }

        // ── Category 4: GPU / Driver Readiness (15 pts) ─────────────────
        let gpuScore = 0;
        if (states._gpuDetected)    gpuScore += 8;
        if (states._driverDetected) gpuScore += 4;
        // HAGS: true=+3, false=0, unknown=neutral +2
        gpuScore += states['gpu-scheduling'] === true ? 3 : states['gpu-scheduling'] === false ? 0 : 2;

        // ── Category 5: Detection Confidence (10 pts) ───────────────────
        const TRACKED = [...Object.keys(CORE_W), ...Object.keys(LATENCY_W), 'gpu-scheduling'];
        const knownCount = TRACKED.filter(id => isKnown(id)).length;
        const unknownCount = TRACKED.length - knownCount;
        // HW detection boosts base confidence
        const hwBonus = (states._gpuDetected ? 1 : 0) + (states._driverDetected ? 1 : 0);
        const confidenceScore = Math.max(5, Math.round((knownCount / TRACKED.length) * 10) + hwBonus);

        // ── Total ─────────────────────────────────────────────────────────
        const raw = coreScore + latencyScore + cleanScore + gpuScore + confidenceScore;
        const coreApplied = states['optimize-power-plan'] === true || states['disable-game-bar'] === true;
        const score = Math.max(coreApplied ? 40 : 20, Math.min(100, raw));

        // ── Strengths / Gaps / Unknowns (for context) ─────────────────────
        const TOP = ['optimize-power-plan', 'disable-game-bar', 'gpu-scheduling', 'disable-mouse-accel', 'disable-xbox-services'];
        const strengths = [], gaps = [], unknowns = [];
        for (const id of TOP) {
            const t = AI_ALLOWED_TWEAKS[id];
            if (!t) continue;
            if (states[id] === true)       strengths.push(t.title);
            else if (states[id] === false) gaps.push(t.title);
            else                           unknowns.push(t.title);
        }
        if (bgCtx) {
            const opt = (bgCtx.processes || []).filter(p => p.safeToClose).length;
            const st  = (bgCtx.startups  || []).length;
            if (opt > 0) gaps.push(`${opt} background app${opt > 1 ? 's' : ''} running`);
            if (st  > 3) gaps.push(`${st} startup apps configured`);
        }
        return { score, coreScore, latencyScore, cleanScore, gpuScore,
                 strengths, gaps, unknowns, latencyAllUnknown, unknownCount };
    }

    const statusDot           = document.getElementById('ai-status-dot');
    const statusText          = document.getElementById('ai-status-text');
    const recheckBtn          = document.getElementById('ai-recheck-btn');
    const pullCard            = document.getElementById('ai-pull-card');
    const chatHistEl          = document.getElementById('ai-chat-history');
    const welcomeEl           = document.getElementById('ai-chat-welcome');
    const chatInput           = document.getElementById('ai-chat-input');
    const sendBtn             = document.getElementById('ai-send-btn');
    const inputBar            = chatInput && chatInput.closest('.ai-input-bar');
    const pullBtn             = document.getElementById('ai-pull-model-btn');
    const pullProgress        = document.getElementById('ai-pull-progress');
    const quickPrompts        = document.getElementById('ai-quick-prompts');
    const infoStatusVal       = document.getElementById('ai-info-status-val');
    const footerDot           = document.getElementById('ai-footer-dot');
    const footerStatusText    = document.getElementById('ai-footer-status-text');
    const notRunningNotice    = document.getElementById('ai-not-running-notice');
    const notRunningTitle     = document.getElementById('ai-not-running-title');
    const notRunningSub       = document.getElementById('ai-not-running-sub');
    const notRunningPrimaryBtn = document.getElementById('ai-nrn-primary-btn');
    const nrnBtnLabel         = notRunningPrimaryBtn && notRunningPrimaryBtn.querySelector('.ai-nrn-btn-label');
    const noticeProgress      = document.getElementById('ai-nrn-progress');

    if (!statusDot) return;

    function setStatus(type, shortLabel) {
        statusDot.className = `ai-online-dot ${type}`;
        if (statusText)       statusText.textContent       = shortLabel.toUpperCase();
        if (footerDot)        footerDot.className          = `ai-footer-dot ${type}`;
        if (footerStatusText) footerStatusText.textContent = `Status: ${shortLabel}`;
    }

    function setInfoStatus(cssClass, text) {
        if (!infoStatusVal) return;
        infoStatusVal.className   = `ai-info-val ${cssClass}`;
        infoStatusVal.textContent = text;
    }

    function setNoticeProgress(visible) {
        if (noticeProgress) noticeProgress.style.display = visible ? 'block' : 'none';
    }

    function showNotice(title, sub, mode, state) {
        if (!notRunningNotice) return;
        if (notRunningTitle) notRunningTitle.textContent = title;
        if (notRunningSub)   notRunningSub.textContent   = sub;
        if (notRunningPrimaryBtn) {
            const labels = { install: 'Set Up AI Engine', start: 'Start AI Engine', retry: 'Retry' };
            if (nrnBtnLabel) nrnBtnLabel.textContent = labels[mode] || 'Set Up AI Engine';
            notRunningPrimaryBtn.disabled          = false;
            notRunningPrimaryBtn.style.display     = '';
            notRunningPrimaryBtn.dataset.setupMode = (mode === 'retry') ? 'install' : (mode || 'install');
        }
        notRunningNotice.className     = 'ai-not-running-notice' + (state === 'error' ? ' error' : '');
        notRunningNotice.style.display = 'flex';
        setNoticeProgress(false);
    }

    function showNoticeProgress(title, sub) {
        if (!notRunningNotice) return;
        if (notRunningTitle) notRunningTitle.textContent = title;
        if (notRunningSub)   notRunningSub.textContent   = sub;
        if (notRunningPrimaryBtn) { notRunningPrimaryBtn.disabled = true; notRunningPrimaryBtn.style.display = 'none'; }
        notRunningNotice.className     = 'ai-not-running-notice';
        notRunningNotice.style.display = 'flex';
        setNoticeProgress(true);
    }

    function hideNotice() {
        if (notRunningNotice) notRunningNotice.style.display = 'none';
        setNoticeProgress(false);
    }

    function setInputEnabled(enabled) {
        if (chatInput) {
            chatInput.disabled    = !enabled;
            chatInput.placeholder = enabled ? 'Ask AI Tweaker anything…' : 'Set up AI Engine to chat…';
        }
        if (sendBtn) sendBtn.disabled = !enabled;
        if (quickPrompts) {
            quickPrompts.querySelectorAll('.ai-chip').forEach(c => { c.disabled = !enabled; });
        }
    }

    async function runEngineSetup() {
        if (aiSetupInProgress) return;
        aiSetupInProgress = true;

        if (notRunningPrimaryBtn) {
            notRunningPrimaryBtn.disabled = true;
            if (nrnBtnLabel) nrnBtnLabel.textContent = 'Setting up…';
        }
        if (notRunningTitle) notRunningTitle.textContent = 'Setting up AI Tweaker';
        if (notRunningSub)   notRunningSub.textContent   = 'Preparing AI Engine…';
        if (notRunningNotice) notRunningNotice.className = 'ai-not-running-notice';
        setNoticeProgress(true);
        setStatus('preparing', 'Preparing');
        setInfoStatus('', 'Preparing');

        let progUnsub;
        try {
            progUnsub = window.electronAPI.onAiEngineProgress((data) => {
                if (data.message && notRunningSub) notRunningSub.textContent = data.message;
            });
        } catch (_) { progUnsub = null; }

        let result;
        try { result = await window.electronAPI.aiEngineSetup(); }
        catch (e) { result = { success: false, error: e.message }; }

        if (progUnsub) progUnsub();
        aiSetupInProgress = false;
        setNoticeProgress(false);

        if (!result.success) {
            if (notRunningPrimaryBtn) {
                notRunningPrimaryBtn.style.display = '';
                notRunningPrimaryBtn.disabled = false;
            }
            showNotice('AI Engine setup failed', 'Restart XTweaks and try again.', 'retry', 'error');
            setStatus('preparing', 'Setup Needed');
            setInfoStatus('', 'Setup Needed');
            return;
        }

        if (notRunningSub) notRunningSub.textContent = 'AI Tweaker is ready.';
        setTimeout(checkOllama, 600);
    }

    async function checkOllama() {
        if (aiSetupInProgress) return;

        setStatus('preparing', 'Checking');
        setInfoStatus('', 'Checking');
        pullCard.style.display = 'none';
        hideNotice();
        setInputEnabled(false);
        aiReady = false;

        let result;
        try {
            result = await window.electronAPI.aiDetect();
        } catch (e) {
            result = { installed: false, running: false, models: [] };
        }

        const { installed = false, running = false, models = [] } = result;

        if (!installed) {
            setStatus('preparing', 'Setup Needed');
            setInfoStatus('', 'Setup Needed');
            showNotice(
                'Set up AI Tweaker',
                'Enable the Premium AI Engine to start chatting.',
                'install'
            );
            return;
        }

        if (!running) {
            setStatus('preparing', 'Setup Needed');
            setInfoStatus('', 'Setup Needed');
            showNotice(
                'Set up AI Tweaker',
                'Enable the Premium AI Engine to start chatting.',
                'start'
            );
            return;
        }

        const modelReady = (models || []).some(m => m.name && m.name.startsWith('llama3.2'));

        if (!modelReady) {
            setStatus('preparing', 'Setup Needed');
            setInfoStatus('', 'Setup Needed');
            pullCard.style.display = 'block';
            return;
        }

        setStatus('connected', 'Ready');
        setInfoStatus('ai-info-accent', 'Ready');
        aiReady = true;
        hideNotice();
        setInputEnabled(true);
        if (footerStatusText) footerStatusText.textContent = 'Status: Ready';
    }

    recheckBtn.addEventListener('click', () => { if (!aiSetupInProgress) checkOllama(); });

    /* ── Recommendation card helpers ── */
    function setTweakRowStatus(card, tweakId, status) {
        const row = card.querySelector(`.ai-tweak-row[data-tweak-id="${tweakId}"]`);
        if (!row) return;
        const statusEl = row.querySelector('.ai-tweak-status');
        const textEl   = row.querySelector('.ai-tweak-status-text');
        if (!statusEl || !textEl) return;
        statusEl.className = `ai-tweak-status ${status}`;
        const labels = { idle: 'Ready', pending: 'Queued', running: 'Applying…', done: 'Applied ✓', failed: 'Failed', skipped: 'Skipped' };
        textEl.textContent = labels[status] || status;
    }

    async function applyTweaksFromCard(card, tweakIds) {
        const actionsEl  = card.querySelector('.ai-apply-actions');
        const confirmEl  = card.querySelector('.ai-confirm-inline');
        if (actionsEl) actionsEl.style.display = 'none';
        if (confirmEl) confirmEl.style.display = 'none';

        const toApply   = tweakIds.filter(id => tweakStates[id] !== true);
        const alreadyOn = tweakIds.filter(id => tweakStates[id] === true);

        toApply.forEach(id => setTweakRowStatus(card, id, 'pending'));

        if (toApply.length === 0) {
            const summary = document.createElement('div');
            summary.className = 'ai-rec-summary';
            summary.innerHTML = `<span class="ai-sum-info">All ${alreadyOn.length} tweak${alreadyOn.length !== 1 ? 's' : ''} already applied</span>`;
            card.appendChild(summary);
            return;
        }

        const progressUnsub = window.electronAPI.onTweakProgress
            ? window.electronAPI.onTweakProgress(data => {
                if (!data || !data.id) return;
                const s = data.status;
                if (s === 'running' || s === 'done' || s === 'failed' || s === 'skipped')
                    setTweakRowStatus(card, data.id, s);
            })
            : null;

        let results = [];
        try {
            const res = await window.electronAPI.applyRecommendedTweaks(toApply);
            results = res.results || [];
        } catch (e) {
            results = toApply.map(id => ({ id, success: false, message: 'Connection error' }));
        }

        if (progressUnsub) progressUnsub();
        results.forEach(r => setTweakRowStatus(card, r.id, r.success ? 'done' : 'failed'));

        const applied = results.filter(r => r.success).length;
        const failed  = results.filter(r => !r.success).length;
        const summary = document.createElement('div');
        summary.className = 'ai-rec-summary';
        const parts = [];
        if (applied > 0)      parts.push(`<span class="ai-sum-good">${applied} applied</span>`);
        if (failed  > 0)      parts.push(`<span class="ai-sum-bad">${failed} failed</span>`);
        if (alreadyOn.length) parts.push(`<span class="ai-sum-info">${alreadyOn.length} already on</span>`);
        if (parts.length) { summary.innerHTML = parts.join(' \xb7 '); card.appendChild(summary); }
    }

    function buildRecommendationCard(intent) {
        const prefs      = loadAIPrefs();
        const rejected   = prefs.rejectedTweaks || [];
        const allIds     = (intent.tweakIds || []).filter(id => AI_ALLOWED_TWEAKS[id]);
        if (allIds.length === 0) return null;

        // Separate into: pending (not applied, not rejected), applied
        const appliedIds = allIds.filter(id => tweakStates[id] === true);
        const pendingIds = allIds.filter(id => tweakStates[id] !== true && !rejected.includes(id));
        if (pendingIds.length === 0 && appliedIds.length === 0) return null;

        // Persist preferred game when Fortnite intent fires
        if (intent.label === 'Fortnite Optimization' && !prefs.preferredGame) {
            updateAIPref('preferredGame', 'Fortnite');
        }

        // Build subtitle
        const safeCount   = pendingIds.filter(id => AI_ALLOWED_TWEAKS[id].risk === 'safe').length;
        const reviewCount = pendingIds.filter(id => AI_ALLOWED_TWEAKS[id].risk === 'review').length;
        const subtitleParts = [];
        if (safeCount   > 0)             subtitleParts.push(`${safeCount} safe`);
        if (reviewCount > 0)             subtitleParts.push(`${reviewCount} review`);
        if (appliedIds.length > 0)       subtitleParts.push(`${appliedIds.length} already optimized`);
        if (pendingIds.length > 0)       subtitleParts.push('confirm before applying');

        const card = document.createElement('div');
        card.className = 'ai-recommendation-card';

        const hdr = document.createElement('div');
        hdr.className = 'ai-rec-header';
        hdr.innerHTML =
            '<div class="ai-rec-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg></div>' +
            '<div class="ai-rec-header-text">' +
            `<div class="ai-rec-title">Recommended: ${escapeAiHtml(intent.label)}</div>` +
            `<div class="ai-rec-subtitle">${subtitleParts.join(' \xb7 ')}</div>` +
            '</div>';
        card.appendChild(hdr);

        // ── Pending tweaks (not yet applied) ──
        if (pendingIds.length > 0) {
            const list = document.createElement('div');
            list.className = 'ai-rec-tweak-list';
            pendingIds.forEach((id, i) => {
                const t = AI_ALLOWED_TWEAKS[id];
                const row = document.createElement('div');
                row.className = 'ai-tweak-row';
                row.dataset.tweakId = id;
                row.style.animationDelay = `${0.06 + i * 0.055}s`;
                row.innerHTML =
                    '<div class="ai-tweak-row-info">' +
                    `<span class="ai-tweak-row-name">${escapeAiHtml(t.title)}</span>` +
                    `<span class="ai-tweak-row-reason">${escapeAiHtml(t.reason)}</span>` +
                    '</div>' +
                    `<span class="ai-risk-badge ${t.risk}">${t.risk === 'safe' ? 'Safe' : 'Review'}</span>` +
                    '<div class="ai-tweak-status idle"><span class="ai-tweak-status-dot"></span><span class="ai-tweak-status-text">Ready</span></div>' +
                    `<button class="ai-tweak-dismiss-btn" title="Don’t suggest again">×</button>`;
                row.querySelector('.ai-tweak-dismiss-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const p = loadAIPrefs();
                    p.rejectedTweaks = [...new Set([...(p.rejectedTweaks || []), id])];
                    saveAIPrefs(p);
                    row.style.transition = 'opacity 200ms';
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 220);
                });
                list.appendChild(row);
            });
            card.appendChild(list);
        } else {
            const allDone = document.createElement('div');
            allDone.className = 'ai-rec-all-done';
            allDone.textContent = appliedIds.length > 0
                ? 'All recommended tweaks are already applied.'
                : 'No new tweaks to suggest for this category.';
            card.appendChild(allDone);
        }

        // ── Already Optimized collapsible section ──
        if (appliedIds.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'ai-rec-already-section';
            const toggle = document.createElement('button');
            toggle.className = 'ai-rec-already-toggle';
            toggle.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>' +
                ` Already Optimized (${appliedIds.length})`;
            const alreadyList = document.createElement('div');
            alreadyList.className = 'ai-rec-already-list';
            alreadyList.hidden = true;
            appliedIds.forEach(id => {
                const t = AI_ALLOWED_TWEAKS[id];
                const row = document.createElement('div');
                row.className = 'ai-tweak-row already-applied';
                row.dataset.tweakId = id;
                row.innerHTML =
                    '<div class="ai-tweak-row-info">' +
                    `<span class="ai-tweak-row-name">${escapeAiHtml(t.title)}</span>` +
                    `<span class="ai-tweak-row-reason">${escapeAiHtml(t.reason)}</span>` +
                    '</div>' +
                    '<div class="ai-tweak-status already-applied"><span class="ai-tweak-status-dot"></span><span class="ai-tweak-status-text">Already On</span></div>';
                alreadyList.appendChild(row);
            });
            toggle.addEventListener('click', () => {
                alreadyList.hidden = !alreadyList.hidden;
                toggle.classList.toggle('open', !alreadyList.hidden);
            });
            sec.appendChild(toggle);
            sec.appendChild(alreadyList);
            card.appendChild(sec);
        }

        // ── Actions ──
        if (pendingIds.length > 0) {
            const actions = document.createElement('div');
            actions.className = 'ai-apply-actions';
            actions.innerHTML =
                '<button class="ai-rec-apply-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Apply Recommended</button>' +
                '<button class="ai-rec-review-btn">Review First</button>' +
                '<button class="ai-rec-cancel-btn">Skip</button>';
            card.appendChild(actions);

            const confirm = document.createElement('div');
            confirm.className = 'ai-confirm-inline';
            confirm.style.display = 'none';
            confirm.innerHTML =
                `<p class="ai-confirm-text">Apply ${pendingIds.length} tweak${pendingIds.length !== 1 ? 's' : ''} now?` +
                (reviewCount > 0 ? ' Some may need a restart.' : '') + '</p>' +
                '<div class="ai-confirm-buttons"><button class="ai-confirm-apply-btn">Apply Now</button><button class="ai-confirm-cancel-btn">Cancel</button></div>';
            card.appendChild(confirm);

            actions.querySelector('.ai-rec-apply-btn').addEventListener('click', () => {
                actions.style.display = 'none'; confirm.style.display = 'flex';
            });
            actions.querySelector('.ai-rec-review-btn').addEventListener('click', () => openReviewModal(pendingIds));
            actions.querySelector('.ai-rec-cancel-btn').addEventListener('click', () => {
                card.classList.add('ai-rec-dismissed');
                setTimeout(() => { if (card.parentNode) card.parentNode.removeChild(card); }, 320);
            });
            confirm.querySelector('.ai-confirm-apply-btn').addEventListener('click', () => applyTweaksFromCard(card, pendingIds));
            confirm.querySelector('.ai-confirm-cancel-btn').addEventListener('click', () => {
                confirm.style.display = 'none'; actions.style.display = 'flex';
            });
        } else {
            const skip = document.createElement('div');
            skip.className = 'ai-apply-actions';
            skip.innerHTML = '<button class="ai-rec-cancel-btn">Dismiss</button>';
            card.appendChild(skip);
            skip.querySelector('.ai-rec-cancel-btn').addEventListener('click', () => {
                card.classList.add('ai-rec-dismissed');
                setTimeout(() => { if (card.parentNode) card.parentNode.removeChild(card); }, 320);
            });
        }

        return card;
    }

    /* ── Review First modal ── */
    function openReviewModal(tweakIds) {
        const validIds = tweakIds.filter(id => AI_ALLOWED_TWEAKS[id]);
        if (!validIds.length) return;

        const TWEAK_EXTRA = {
            'disable-game-bar':            { category: 'Gaming',   detail: 'Game Bar runs background recording and overlay processes that cause FPS stutters and input lag spikes even when not actively recording. Disabling it is safe for all gaming setups — OBS and Discord capture still work fine.' },
            'gpu-scheduling':              { category: 'Gaming',   detail: 'Hardware-Accelerated GPU Scheduling moves frame queue management from the CPU to the GPU itself, removing one hop of latency on the render pipeline. Works best on RTX 20xx+, RX 5xxx+, and Intel Arc GPUs.' },
            'game-priority':               { category: 'Gaming',   detail: 'Raises the game process priority in the Windows CPU scheduler so it gets first access to CPU time before background tasks, directly reducing micro-stutters during CPU-bound moments.' },
            'optimize-visual-effects':     { category: 'System',   detail: 'Disables Windows UI animations, transparency, and visual flair. Equivalent to "Adjust for best performance" in Visual Effects settings — frees measurable CPU and GPU headroom with zero functional loss.' },
            'disable-xbox-services':       { category: 'Gaming',   detail: 'Xbox Game Monitoring and Xbox Live Auth Manager run silently even without Xbox hardware, consuming CPU and RAM. Disabling them has no impact on non-Xbox PC gaming, Steam, or Epic Games titles.' },
            'optimize-power-plan':         { category: 'System',   detail: 'Switches to the High Performance power plan, preventing the CPU and GPU from downclocking during idle periods between frames. Keeps frequencies stable for consistent frame pacing and lower 1% lows.' },
            'disable-power-throttling':    { category: 'System',   detail: 'Windows power throttling can reduce CPU frequency for background tasks — and sometimes game processes get incorrectly flagged. Disabling it ensures the CPU always runs at full speed for your game.' },
            'optimize-network-throttling': { category: 'Network',  detail: 'Windows reserves up to 20% of bandwidth for system services via QoS. Disabling this releases all available bandwidth to your game connection, lowering baseline ping and reducing jitter.' },
            'disable-nagle':               { category: 'Network',  detail: 'Nagle\'s algorithm batches small TCP packets for efficiency, but adds 50–200ms of artificial latency per packet. Disabling it forces immediate packet delivery — essential for competitive real-time gaming.' },
            'disable-mouse-accel':         { category: 'Gaming',   detail: 'Enhance Pointer Precision adjusts cursor travel distance based on movement speed, creating inconsistent aim. Disabling it gives raw 1:1 mouse input, which is essential for muscle memory and precise aiming.' },
            'disable-background-apps':     { category: 'System',   detail: 'Windows Store / UWP apps silently run and update in the background. Disabling this prevents them from consuming CPU, RAM, and disk I/O during gameplay, especially during loading screens.' },
            'clean-temp':                  { category: 'Cleanup',  detail: 'Removes files from Windows Temp folders and application caches. Frees disk space and can improve load times on near-full drives. Fully reversible — Windows creates new temp files automatically.' },
            'fortnite-priority':           { category: 'Gaming',   detail: 'Sets the FortniteClient process to High CPU priority, giving it prioritized scheduling time. Works alongside Game Priority for best Fortnite-specific scheduling performance.' },
            'fortnite-clear-cache':        { category: 'Gaming',   detail: 'Deletes Fortnite\'s shader and DerivedDataCache files. Fortnite rebuilds them cleanly on the next launch, fixing stutters caused by corrupted or outdated cache entries accumulated through patches.' },
            'timer-resolution':            { category: 'System',   detail: 'Windows uses a 15.6ms system timer by default. Reducing this to 0.5ms sharpens sleep and wake cycles for game loops and input polling. A slight idle CPU usage increase is expected — recommended for competitive play.' },
            'disable-superfetch':          { category: 'System',   detail: 'SysMain preloads frequently used apps into RAM, but on gaming PCs this can cause disk thrashing and RAM spikes mid-game. Recommended for systems with 16 GB+ RAM and an SSD.' },
            'disable-telemetry':           { category: 'System',   detail: 'Disables Windows Diagnostic Data collection services that run background tasks using CPU, disk, and network. No Windows features, gaming functionality, or Windows Update behavior is affected.' },
            'bcdedit-tweaks':              { category: 'System',   detail: 'Applies Boot Configuration Data tweaks affecting kernel interrupt timing. Advanced low-level optimization — a full system restart is required before changes take effect.' },
        };
        const riskNotes = {
            safe:   'Fully reversible. No restart required.',
            review: 'Tested safe for most systems. A restart may be needed.',
            manual: 'Manual review recommended before applying.',
        };

        const checkedIds = new Set(validIds.filter(id => AI_ALLOWED_TWEAKS[id].risk === 'safe' && tweakStates[id] !== true));

        /* ── DOM ── */
        const overlay = document.createElement('div');
        overlay.className = 'ai-review-overlay';

        const modal = document.createElement('div');
        modal.className = 'ai-review-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        overlay.appendChild(modal);

        // Header
        const hdrEl = document.createElement('div');
        hdrEl.className = 'ai-review-header';
        hdrEl.innerHTML =
            '<div class="ai-review-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg></div>' +
            '<div class="ai-review-header-text"><h2 class="ai-review-title">Review Recommended Tweaks</h2>' +
            '<p class="ai-review-subtitle">Choose which tweaks you want to apply.</p></div>' +
            '<button class="ai-review-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        modal.appendChild(hdrEl);

        // Body
        const bodyEl = document.createElement('div');
        bodyEl.className = 'ai-review-body';

        // List (left)
        const listEl = document.createElement('div');
        listEl.className = 'ai-review-list';

        validIds.forEach((id, i) => {
            const t         = AI_ALLOWED_TWEAKS[id];
            const isApplied = tweakStates[id] === true;
            const riskLabel = t.risk === 'safe' ? 'Safe' : t.risk === 'review' ? 'Review' : 'Manual';
            const isChecked = checkedIds.has(id);

            const row = document.createElement('div');
            row.className = `ai-review-row${isChecked ? ' checked' : ''}${isApplied ? ' already-applied' : ''}`;
            row.dataset.tweakId = id;
            row.style.animationDelay = `${0.05 + i * 0.04}s`;

            const lbl = document.createElement('label');
            lbl.className = 'ai-review-row-label';

            const cb = document.createElement('input');
            cb.type     = 'checkbox';
            cb.className = 'ai-review-checkbox';
            cb.checked  = isChecked;
            if (isApplied) { cb.disabled = true; }

            const mark = document.createElement('span');
            mark.className = 'ai-review-checkmark';

            const info = document.createElement('div');
            info.className = 'ai-review-row-info';
            info.innerHTML =
                `<span class="ai-review-row-name">${escapeAiHtml(t.title)}</span>` +
                `<span class="ai-review-row-reason">${escapeAiHtml(t.reason)}</span>`;

            const badge = document.createElement('span');
            badge.className = `ai-review-risk-badge ${t.risk}`; badge.textContent = riskLabel;

            const statusEl = document.createElement('div');
            statusEl.className = isApplied ? 'ai-review-row-status already-applied' : 'ai-review-row-status';
            if (isApplied) statusEl.textContent = 'Already On';

            lbl.appendChild(cb); lbl.appendChild(mark); lbl.appendChild(info);
            lbl.appendChild(badge); lbl.appendChild(statusEl);
            row.appendChild(lbl);

            if (!isApplied) {
                cb.addEventListener('change', () => {
                    if (cb.checked) { checkedIds.add(id); row.classList.add('checked'); }
                    else { checkedIds.delete(id); row.classList.remove('checked'); }
                    updateApplyBtn();
                });
            }
            row.addEventListener('mouseenter', () => showDetail(id));
            row.addEventListener('focusin',    () => showDetail(id));
            listEl.appendChild(row);
        });

        bodyEl.appendChild(listEl);

        // Detail panel (right)
        const detailEl = document.createElement('div');
        detailEl.className = 'ai-review-detail';
        detailEl.innerHTML =
            '<div class="ai-review-detail-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">' +
            '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
            '<p>Hover a tweak<br>to see details</p></div>';
        bodyEl.appendChild(detailEl);
        modal.appendChild(bodyEl);

        // Footer
        const footerEl = document.createElement('div');
        footerEl.className = 'ai-review-footer';

        // Checklist footer
        const clFooter = document.createElement('div');
        clFooter.className = 'ai-review-checklist-footer';
        clFooter.innerHTML =
            '<div class="ai-review-footer-left">' +
            '<button class="ai-review-sel-safe-btn">Select All Safe</button>' +
            '<button class="ai-review-clear-sel-btn">Clear All</button>' +
            '</div>' +
            '<div class="ai-review-footer-right">' +
            '<button class="ai-review-cancel-btn">Cancel</button>' +
            '<button class="ai-review-apply-btn" disabled>Apply Selected</button>' +
            '</div>';
        footerEl.appendChild(clFooter);

        // Confirm footer (hidden initially)
        const cfFooter = document.createElement('div');
        cfFooter.className = 'ai-review-confirm-footer';
        cfFooter.style.display = 'none';

        const cfText = document.createElement('p');
        cfText.className = 'ai-review-confirm-text';

        const cfBtns = document.createElement('div');
        cfBtns.className = 'ai-review-footer-right';
        cfBtns.innerHTML =
            '<button class="ai-review-back-btn">← Back</button>' +
            '<button class="ai-review-cancel2-btn">Cancel</button>' +
            '<button class="ai-review-applynow-btn">Apply Now</button>';

        cfFooter.appendChild(cfText);
        cfFooter.appendChild(cfBtns);
        footerEl.appendChild(cfFooter);
        modal.appendChild(footerEl);

        /* ── Mount ── */
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('open'));

        /* ── Helpers ── */
        function showDetail(id) {
            const t     = AI_ALLOWED_TWEAKS[id];
            const extra = TWEAK_EXTRA[id] || { category: 'System', detail: t.reason };
            const riskLabel = t.risk === 'safe' ? 'Safe' : t.risk === 'review' ? 'Review' : 'Manual';
            detailEl.innerHTML =
                '<div class="ai-review-detail-content">' +
                `<div class="ai-review-detail-title">${escapeAiHtml(t.title)}</div>` +
                `<div class="ai-review-detail-meta"><span class="ai-review-risk-badge ${t.risk} large">${riskLabel}</span>` +
                `<span class="ai-review-detail-cat">${escapeAiHtml(extra.category)}</span></div>` +
                `<p class="ai-review-detail-desc">${escapeAiHtml(extra.detail)}</p>` +
                `<p class="ai-review-detail-risk-note">${escapeAiHtml(riskNotes[t.risk] || '')}</p>` +
                '</div>';
        }

        function updateApplyBtn() {
            const btn = clFooter.querySelector('.ai-review-apply-btn');
            const n   = checkedIds.size;
            btn.textContent = n > 0 ? `Apply Selected (${n})` : 'Apply Selected';
            btn.disabled    = n === 0;
        }

        function setRowStatus(id, status) {
            const row = listEl.querySelector(`.ai-review-row[data-tweak-id="${id}"]`);
            if (!row) return;
            const el = row.querySelector('.ai-review-row-status');
            if (!el) return;
            const labels = { pending: 'Queued', running: 'Applying…', done: 'Done ✓', failed: 'Failed', skipped: 'Skipped' };
            el.className   = `ai-review-row-status ${status}`;
            el.textContent = labels[status] || '';
        }

        async function applyChecked() {
            const ids     = [...checkedIds];
            const toApply = ids.filter(id => tweakStates[id] !== true);
            if (!toApply.length) return;

            cfFooter.style.display = 'none';
            modal.classList.add('applying');
            toApply.forEach(id => setRowStatus(id, 'pending'));

            const progressUnsub = window.electronAPI.onTweakProgress
                ? window.electronAPI.onTweakProgress(data => {
                    if (!data || !data.id) return;
                    if (['running','done','failed','skipped'].includes(data.status)) setRowStatus(data.id, data.status);
                }) : null;

            let results = [];
            try {
                const res = await window.electronAPI.applyRecommendedTweaks(toApply);
                results = res.results || [];
            } catch (e) {
                results = toApply.map(id => ({ id, success: false }));
            }

            if (progressUnsub) progressUnsub();
            results.forEach(r => setRowStatus(r.id, r.success ? 'done' : 'failed'));

            const applied = results.filter(r => r.success).length;
            const failed  = results.filter(r => !r.success).length;
            const parts   = [];
            if (applied > 0) parts.push(`<span class="ai-sum-good">${applied} applied</span>`);
            if (failed  > 0) parts.push(`<span class="ai-sum-bad">${failed} failed</span>`);

            const doneFooter = document.createElement('div');
            doneFooter.className = 'ai-review-done-footer';
            doneFooter.innerHTML = (parts.length ? `<span class="ai-review-done-summary">${parts.join(' \xb7 ')}</span>` : '<span></span>') +
                '<button class="ai-review-done-close-btn">Close</button>';
            footerEl.appendChild(doneFooter);
            doneFooter.querySelector('.ai-review-done-close-btn').addEventListener('click', closeModal);
        }

        function closeModal() {
            overlay.classList.remove('open');
            setTimeout(() => { overlay.remove(); document.removeEventListener('keydown', handleEsc); }, 220);
        }
        function handleEsc(e) { if (e.key === 'Escape') closeModal(); }
        document.addEventListener('keydown', handleEsc);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

        /* ── Wire buttons ── */
        hdrEl.querySelector('.ai-review-close').addEventListener('click', closeModal);

        clFooter.querySelector('.ai-review-sel-safe-btn').addEventListener('click', () => {
            validIds.forEach(id => {
                if (AI_ALLOWED_TWEAKS[id].risk === 'safe' && tweakStates[id] !== true) {
                    checkedIds.add(id);
                    const row = listEl.querySelector(`.ai-review-row[data-tweak-id="${id}"]`);
                    if (row) { const cb = row.querySelector('.ai-review-checkbox'); if (cb) cb.checked = true; row.classList.add('checked'); }
                }
            });
            updateApplyBtn();
        });

        clFooter.querySelector('.ai-review-clear-sel-btn').addEventListener('click', () => {
            checkedIds.clear();
            listEl.querySelectorAll('.ai-review-row').forEach(row => {
                const cb = row.querySelector('.ai-review-checkbox');
                if (cb) cb.checked = false;
                row.classList.remove('checked');
            });
            updateApplyBtn();
        });

        clFooter.querySelector('.ai-review-cancel-btn').addEventListener('click', closeModal);

        clFooter.querySelector('.ai-review-apply-btn').addEventListener('click', () => {
            if (!checkedIds.size) return;
            const n = checkedIds.size;
            const reviewCount = [...checkedIds].filter(id => AI_ALLOWED_TWEAKS[id].risk === 'review').length;
            cfText.innerHTML =
                `<strong>Apply ${n} tweak${n !== 1 ? 's' : ''} now?</strong>` +
                (reviewCount > 0 ? ` <span class="ai-review-confirm-note">${reviewCount} may need a restart.</span>` : '');
            clFooter.style.display = 'none';
            cfFooter.style.display = 'flex';
        });

        cfBtns.querySelector('.ai-review-back-btn').addEventListener('click', () => {
            cfFooter.style.display = 'none';
            clFooter.style.display = 'flex';
        });
        cfBtns.querySelector('.ai-review-cancel2-btn').addEventListener('click', closeModal);
        cfBtns.querySelector('.ai-review-applynow-btn').addEventListener('click', applyChecked);

        updateApplyBtn();
    }

    /* ── Background context helpers ── */
    function formatBgContextForAI(ctx) {
        if (!ctx) return '';
        const lines = [];

        // Impact labels by category
        const IMPACT = {
            'Overlay': 'HIGH', 'Recording/Capture': 'HIGH', 'Cloud Sync': 'HIGH',
            'Game Launcher': 'MEDIUM', 'Browser': 'MEDIUM', 'Desktop App': 'MEDIUM',
            'Updater': 'MEDIUM', 'RGB/Peripheral': 'LOW', 'Chat/Voice': 'LOW',
        };
        const CATEGORY_RANK = {
            'Overlay': 1, 'Recording/Capture': 1, 'Cloud Sync': 2,
            'Game Launcher': 2, 'Browser': 3, 'Desktop App': 3,
            'Updater': 3, 'RGB/Peripheral': 4, 'Chat/Voice': 5,
        };

        // Merge processes + startups by normalized name to deduplicate
        const seen = new Map();
        (ctx.processes || []).forEach(p => {
            const name = normalizeAppName(p.name);
            const key  = name.toLowerCase();
            const entry = seen.get(key) || { name, category: p.category };
            entry.process = p;
            seen.set(key, entry);
        });
        (ctx.startups || []).forEach(s => {
            const name = normalizeAppName(s.name);
            const key  = name.toLowerCase();
            const entry = seen.get(key) || { name, category: s.category || 'Unknown' };
            entry.startup = s;
            seen.set(key, entry);
        });

        if (seen.size > 0) {
            const sorted = [...seen.values()].sort((a, b) =>
                (CATEGORY_RANK[a.category] || 6) - (CATEGORY_RANK[b.category] || 6)
            );
            lines.push('Background Apps (sorted by gaming impact):');
            sorted.forEach(({ name, category, process: p, startup: s }) => {
                const impact   = IMPACT[category] || 'LOW';
                const ram      = p?.ramMB ? `, ${p.ramMB} MB RAM` : '';
                const states   = [p && 'Running', s && 'Startup Enabled'].filter(Boolean).join(' + ');
                const canClose = p?.safeToClose, canDisable = s?.safeToDisable;
                const action   = canClose && canDisable ? 'safe to close and disable from startup'
                               : canClose               ? 'safe to close'
                               : canDisable             ? 'safe to disable from startup'
                               : 'review only';
                lines.push(`- [${impact}] ${name} (${category}) — ${states}${ram} — ${action}`);
            });
        }

        if (ctx.services && ctx.services.length > 0) {
            lines.push('\nNotable Services (running):');
            ctx.services.forEach(sv => {
                const note = sv.critical
                    ? '— DO NOT DISABLE (critical Windows service)'
                    : `— ${sv.category} — review before disabling`;
                lines.push(`- ${sv.display} ${note}`);
            });
        }

        return lines.length > 0 ? lines.join('\n') : '';
    }

    /* ── Background Optimization Card ── */
    const BG_DETAIL_MAP = {
        'Browser':           { why: 'Open browsers consume significant RAM and can cause I/O spikes during disk-heavy operations like game loading.',       action: 'Close browser windows before gaming to free RAM and reduce disk activity.'       },
        'Game Launcher':     { why: 'Game launchers run background services for friends lists and auto-updates, consuming CPU cycles even when idle.',      action: 'Close launchers not currently in use. Re-open them when you need them.'         },
        'Chat/Voice':        { why: 'Chat apps run audio processing and network activity in the background, adding CPU and network overhead during gaming.', action: 'Close or minimize to free CPU. Discord can be used via browser if needed.'      },
        'Overlay':           { why: 'Overlays hook into the graphics pipeline and can add frame delivery latency, especially with multiple active at once.', action: 'Disable overlays not in use. Keep only one active overlay if needed.'          },
        'RGB/Peripheral':    { why: 'RGB and peripheral software run background USB polling loops that occasionally cause input spikes or DPC latency.',     action: 'Close RGB software while gaming. Lighting effects will pause — hardware stays on.'  },
        'Cloud Sync':        { why: 'Cloud sync apps continuously scan files and upload changes, causing disk I/O spikes and network usage during gameplay.', action: 'Pause or close cloud sync while gaming. Files sync again when you re-open.'     },
        'Updater':           { why: 'Auto-updaters wake up periodically to download updates, causing unexpected disk and network bursts during gaming.',      action: 'Disable from startup. Updates can be triggered manually when convenient.'      },
        'Recording/Capture': { why: 'Capture software reserves GPU encoder bandwidth even when not recording, reducing available GPU headroom for games.',   action: 'Close capture software when not streaming or recording.'                      },
        'Desktop App':       { why: 'Desktop apps like Wallpaper Engine use GPU continuously to animate backgrounds, competing with game rendering.',        action: 'Pause or close the app before gaming. Resume it afterwards.'                  },
        'Remote Access':     { why: 'Remote access apps keep network ports open and run background services that add CPU and network overhead.',             action: 'Close when not in use for remote sessions.'                                   },
        'Unknown':           { why: 'App running in the background — exact impact unknown.',                                                                action: 'Review manually if unsure. Close if you are not using it.'                    },
    };

    function buildBackgroundOptCard() {
        if (!bgContext) return null;

        // Impact rank for sorting (lower = higher priority in list)
        const ITEM_RANK = {
            'Overlay': 1, 'Recording/Capture': 1, 'Cloud Sync': 2,
            'Game Launcher': 2, 'Browser': 3, 'Desktop App': 3,
            'Updater': 3, 'RGB/Peripheral': 4, 'Chat/Voice': 5,
        };

        // Build process entries, normalized name
        const byName = new Map(); // normalizedKey → item
        (bgContext.processes || []).forEach((p, i) => {
            if (!p.safeToClose && !p.safeToDisableStartup) return;
            const isChatVoice = p.category === 'Chat/Voice';
            const dispName = normalizeAppName(p.name);
            const key      = dispName.toLowerCase();
            byName.set(key, {
                id:             `proc-${i}`,
                name:           dispName,
                category:       p.category,
                type:           'process',
                state:          'Running',
                ramMB:          p.ramMB,
                recommendation: p.safeToClose ? (isChatVoice ? 'optional' : 'close') : 'leave',
                risk:           p.safeToClose ? 'safe' : 'review',
                pid:            p.pid,
                processName:    p.processName,
            });
        });

        // Merge startup entries: same normalized name → upgrade existing process item
        (bgContext.startups || []).forEach((s, i) => {
            const dispName = normalizeAppName(s.name);
            const key      = dispName.toLowerCase();
            if (byName.has(key)) {
                const existing = byName.get(key);
                existing.state           = 'Running + Startup Enabled';
                existing.type            = 'both';
                existing.startupName     = s.name;
                existing.startupLocation = s.location;
                if (s.safeToDisable && existing.risk === 'safe') existing.hasStartup = true;
            } else {
                byName.set(key, {
                    id:              `startup-${i}`,
                    name:            dispName,
                    category:        s.category || 'Unknown',
                    type:            'startup',
                    state:           'Startup Enabled',
                    ramMB:           null,
                    recommendation:  s.safeToDisable ? 'disable-startup' : 'review',
                    risk:            s.safeToDisable ? 'safe' : 'review',
                    startupName:     s.name,
                    startupLocation: s.location,
                });
            }
        });

        const items = [...byName.values()];

        (bgContext.services || []).forEach((sv, i) => {
            if (sv.critical) return;
            items.push({
                id:             `svc-${i}`,
                name:           sv.display,
                category:       sv.category,
                type:           'service',
                state:          'Service Running',
                ramMB:          null,
                recommendation: 'review',
                risk:           'review',
            });
        });

        if (items.length === 0) return null;

        // Sort by gaming impact, cap at 8
        items.sort((a, b) => (ITEM_RANK[a.category] || 6) - (ITEM_RANK[b.category] || 6));
        const shown = items.slice(0, 8);

        const safeCount   = shown.filter(it => it.risk === 'safe').length;
        const reviewCount = shown.filter(it => it.risk === 'review').length;
        const subtitle    = [safeCount > 0 && `${safeCount} safe to change`, reviewCount > 0 && `${reviewCount} to review`].filter(Boolean).join(' · ');

        const card = document.createElement('div');
        card.className = 'ai-recommendation-card ai-bg-opt-card';

        // Header
        const hdr = document.createElement('div');
        hdr.className = 'ai-rec-header';
        hdr.innerHTML =
            '<div class="ai-rec-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>' +
            '<div><div class="ai-rec-title">Background Optimization Review</div>' +
            `<div class="ai-rec-subtitle">${escapeAiHtml(subtitle)}</div></div>`;
        card.appendChild(hdr);

        // Rows
        const list = document.createElement('div');
        list.className = 'ai-rec-tweak-list';

        shown.forEach((item, i) => {
            const row = document.createElement('div');
            row.className = 'ai-tweak-row ai-bg-row';
            row.style.animationDelay = `${0.04 + i * 0.045}s`;

            const actionLabels  = { close: 'Close App', optional: 'Optional', 'disable-startup': 'Disable Startup', review: 'Review', leave: 'Leave Alone' };
            const riskLabel     = item.risk === 'safe' ? 'Safe' : 'Review';
            const stateLabel    = item.state;
            const ram           = item.ramMB ? `${item.ramMB} MB` : '';

            row.innerHTML =
                `<div class="ai-tweak-row-info">` +
                `<span class="ai-tweak-row-name">${escapeAiHtml(item.name)}</span>` +
                `<span class="ai-tweak-row-reason ai-bg-cat">${escapeAiHtml(item.category)}</span>` +
                `</div>` +
                `<div class="ai-bg-row-meta">` +
                (ram ? `<span class="ai-bg-usage">${escapeAiHtml(ram)}</span>` : '') +
                `<span class="ai-bg-state">${escapeAiHtml(stateLabel)}</span>` +
                `<span class="ai-bg-action ${item.recommendation}">${escapeAiHtml(actionLabels[item.recommendation] || 'Review')}</span>` +
                `<span class="ai-review-risk-badge ${item.risk}">${riskLabel}</span>` +
                `</div>`;

            // "Keep open" for optional Chat/Voice items
            if (item.recommendation === 'optional' || item.recommendation === 'close') {
                const keptApps = (loadAIPrefs().keptApps || []);
                const alreadyKept = keptApps.includes(item.name);
                const keepBtn = document.createElement('button');
                keepBtn.className = 'ai-bg-keep-btn' + (alreadyKept ? ' ai-bg-keep-active' : '');
                keepBtn.textContent = alreadyKept ? 'Kept ✓' : 'Keep open';
                keepBtn.disabled = alreadyKept;
                keepBtn.title = 'Tell AI Tweaker never to suggest closing this app';
                keepBtn.addEventListener('click', () => {
                    const p = loadAIPrefs();
                    p.keptApps = [...new Set([...(p.keptApps || []), item.name])];
                    saveAIPrefs(p);
                    keepBtn.textContent = 'Kept ✓';
                    keepBtn.disabled = true;
                    keepBtn.classList.add('ai-bg-keep-active');
                });
                row.querySelector('.ai-bg-row-meta').appendChild(keepBtn);
            }

            list.appendChild(row);
        });
        card.appendChild(list);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'ai-apply-actions';
        const hasSafe = shown.some(it => it.risk === 'safe' && (it.recommendation === 'close' || it.recommendation === 'disable-startup'));
        actions.innerHTML =
            (hasSafe ? '<button class="ai-rec-apply-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Apply Safe Changes</button>' : '') +
            '<button class="ai-rec-review-btn">Review Changes</button>' +
            '<button class="ai-rec-cancel-btn">Skip</button>';
        card.appendChild(actions);

        if (hasSafe) {
            actions.querySelector('.ai-rec-apply-btn').addEventListener('click', () => {
                actions.style.display = 'none';
                const safeItems = shown.filter(it => it.risk === 'safe' && (it.recommendation === 'close' || it.recommendation === 'disable-startup'));
                applyBgChanges(card, safeItems);
            });
        }
        actions.querySelector('.ai-rec-review-btn').addEventListener('click', () => {
            openBgReviewModal(shown);
        });
        actions.querySelector('.ai-rec-cancel-btn').addEventListener('click', () => {
            card.classList.add('ai-rec-dismissed');
            setTimeout(() => { if (card.parentNode) card.parentNode.removeChild(card); }, 320);
        });

        return card;
    }

    async function applyBgChanges(card, items) {
        const progressEl = document.createElement('div');
        progressEl.className = 'ai-bg-apply-progress';
        progressEl.textContent = 'Applying changes…';
        card.appendChild(progressEl);

        let applied = 0, failed = 0;
        for (const item of items) {
            try {
                if (item.type === 'process' && typeof item.pid === 'number') {
                    const r = await window.electronAPI.closeProcess(item.pid, item.processName);
                    r.success ? applied++ : failed++;
                } else if (item.type === 'startup') {
                    const r = await window.electronAPI.disableStartupEntry(item.startupName, item.startupLocation);
                    r.success ? applied++ : failed++;
                } else {
                    failed++;
                }
            } catch { failed++; }
        }

        // Invalidate bg context so next query gets fresh data
        bgContext = null; bgContextTime = 0;

        const parts = [];
        if (applied) parts.push(`${applied} applied`);
        if (failed)  parts.push(`${failed} failed`);
        progressEl.textContent = parts.join(', ') || 'Done.';
    }

    /* ── Background Review Modal ── */
    function openBgReviewModal(items) {
        if (!items || !items.length) return;

        const actionLabels = { close: 'Close App', optional: 'Optional', 'disable-startup': 'Disable Startup', review: 'Review Only', leave: 'Leave Alone' };
        // Optional (Chat/Voice) items start unchecked — user may be in a call
        const checkedIds   = new Set(items.filter(it => it.risk === 'safe' && it.recommendation !== 'leave' && it.recommendation !== 'review' && it.recommendation !== 'optional').map(it => it.id));

        const overlay = document.createElement('div');
        overlay.className = 'ai-review-overlay';

        const modal = document.createElement('div');
        modal.className = 'ai-review-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        overlay.appendChild(modal);

        // Header
        const hdrEl = document.createElement('div');
        hdrEl.className = 'ai-review-header';
        hdrEl.innerHTML =
            '<div class="ai-review-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>' +
            '<div class="ai-review-header-text"><h2 class="ai-review-title">Background Optimization Review</h2>' +
            '<p class="ai-review-subtitle">Choose which apps and startup items to change.</p></div>' +
            '<button class="ai-review-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
        modal.appendChild(hdrEl);

        // Body
        const bodyEl = document.createElement('div');
        bodyEl.className = 'ai-review-body';

        const listEl = document.createElement('div');
        listEl.className = 'ai-review-list';

        items.forEach((item, i) => {
            const isReviewOnly = item.recommendation === 'review' || item.recommendation === 'leave';
            const isChecked    = checkedIds.has(item.id);

            const row = document.createElement('div');
            row.className = `ai-review-row${isChecked ? ' checked' : ''}${isReviewOnly ? ' already-applied' : ''}`;
            row.dataset.bgId = item.id;
            row.style.animationDelay = `${0.05 + i * 0.04}s`;

            const lbl = document.createElement('label');
            lbl.className = 'ai-review-row-label';

            const cb = document.createElement('input');
            cb.type    = 'checkbox';
            cb.className = 'ai-review-checkbox';
            cb.checked  = isChecked;
            if (isReviewOnly) cb.disabled = true;

            const mark = document.createElement('span');
            mark.className = 'ai-review-checkmark';

            const info = document.createElement('div');
            info.className = 'ai-review-row-info';
            const ramStr = item.ramMB ? ` · ${item.ramMB} MB` : '';
            info.innerHTML =
                `<span class="ai-review-row-name">${escapeAiHtml(item.name)}</span>` +
                `<span class="ai-review-row-reason">${escapeAiHtml(item.category)}${escapeAiHtml(ramStr)} · ${escapeAiHtml(actionLabels[item.recommendation] || 'Review')}</span>`;

            const badge = document.createElement('span');
            badge.className = `ai-review-risk-badge ${item.risk}`;
            badge.textContent = item.risk === 'safe' ? 'Safe' : 'Review';

            const statusEl = document.createElement('div');
            statusEl.className = isReviewOnly ? 'ai-review-row-status already-applied' : 'ai-review-row-status';
            if (isReviewOnly) statusEl.textContent = 'Review Only';

            lbl.appendChild(cb); lbl.appendChild(mark); lbl.appendChild(info);
            lbl.appendChild(badge); lbl.appendChild(statusEl);
            row.appendChild(lbl);

            if (!isReviewOnly) {
                cb.addEventListener('change', () => {
                    if (cb.checked) { checkedIds.add(item.id); row.classList.add('checked'); }
                    else { checkedIds.delete(item.id); row.classList.remove('checked'); }
                    updateApplyBtn();
                });
            }

            row.addEventListener('mouseenter', () => showDetail(item));
            row.addEventListener('focusin',    () => showDetail(item));
            listEl.appendChild(row);
        });

        bodyEl.appendChild(listEl);

        // Detail panel
        const detailEl = document.createElement('div');
        detailEl.className = 'ai-review-detail';
        detailEl.innerHTML =
            '<div class="ai-review-detail-empty">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">' +
            '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
            '<p>Hover an item<br>to see details</p></div>';
        bodyEl.appendChild(detailEl);
        modal.appendChild(bodyEl);

        // Footer
        const footerEl  = document.createElement('div');
        footerEl.className = 'ai-review-footer';
        const clFooter  = document.createElement('div');
        clFooter.className = 'ai-review-checklist-footer';
        clFooter.innerHTML =
            '<div class="ai-review-footer-left">' +
            '<button class="ai-review-sel-safe-btn">Select All Safe</button>' +
            '<button class="ai-review-clear-sel-btn">Clear All</button>' +
            '</div>' +
            '<div class="ai-review-footer-right">' +
            '<button class="ai-review-cancel-btn">Cancel</button>' +
            '<button class="ai-review-apply-btn" disabled>Apply Selected</button>' +
            '</div>';
        footerEl.appendChild(clFooter);
        modal.appendChild(footerEl);

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('open'));

        function showDetail(item) {
            const info = BG_DETAIL_MAP[item.category] || BG_DETAIL_MAP['Unknown'];
            const riskNote = item.risk === 'safe' ? 'Fully reversible. Re-open the app anytime.' : 'Review manually before applying.';
            detailEl.innerHTML =
                '<div class="ai-review-detail-content">' +
                `<div class="ai-review-detail-title">${escapeAiHtml(item.name)}</div>` +
                `<div class="ai-review-detail-meta">` +
                `<span class="ai-review-risk-badge ${item.risk} large">${item.risk === 'safe' ? 'Safe' : 'Review'}</span>` +
                `<span class="ai-review-detail-cat">${escapeAiHtml(item.category)}</span>` +
                `<span class="ai-review-detail-cat">${escapeAiHtml(item.state)}</span>` +
                `</div>` +
                `<p class="ai-review-detail-desc">${escapeAiHtml(info.why)}</p>` +
                `<p class="ai-review-detail-desc" style="margin-top:6px"><strong>Suggested action:</strong> ${escapeAiHtml(info.action)}</p>` +
                `<p class="ai-review-detail-risk-note">${escapeAiHtml(riskNote)}</p>` +
                '</div>';
        }

        function updateApplyBtn() {
            const btn = clFooter.querySelector('.ai-review-apply-btn');
            const n   = checkedIds.size;
            btn.textContent = n > 0 ? `Apply Selected (${n})` : 'Apply Selected';
            btn.disabled    = n === 0;
        }

        function setRowStatus(id, status) {
            const row = listEl.querySelector(`.ai-review-row[data-bg-id="${id}"]`);
            if (!row) return;
            const el = row.querySelector('.ai-review-row-status');
            if (!el) return;
            const labels = { pending: 'Queued', running: 'Applying…', done: 'Done ✓', failed: 'Failed' };
            el.className   = `ai-review-row-status ${status}`;
            el.textContent = labels[status] || '';
        }

        async function applyChecked() {
            const toApply = items.filter(it => checkedIds.has(it.id));
            if (!toApply.length) return;

            clFooter.style.display = 'none';

            const doneFooter = document.createElement('div');
            doneFooter.className = 'ai-review-done-footer';
            doneFooter.innerHTML = '<span class="ai-review-done-summary">Applying changes…</span>';
            footerEl.appendChild(doneFooter);

            toApply.forEach(it => setRowStatus(it.id, 'running'));

            let applied = 0, failed = 0;
            for (const item of toApply) {
                try {
                    let ok = false;
                    if (item.type === 'both') {
                        // Merged running process + startup — do both operations
                        let r1 = { success: false }, r2 = { success: false };
                        if (typeof item.pid === 'number') r1 = await window.electronAPI.closeProcess(item.pid, item.processName).catch(() => ({ success: false }));
                        if (item.startupName)             r2 = await window.electronAPI.disableStartupEntry(item.startupName, item.startupLocation).catch(() => ({ success: false }));
                        ok = r1.success || r2.success;
                    } else if (item.type === 'process' && typeof item.pid === 'number') {
                        const r = await window.electronAPI.closeProcess(item.pid, item.processName);
                        ok = r.success;
                    } else if (item.type === 'startup') {
                        const r = await window.electronAPI.disableStartupEntry(item.startupName, item.startupLocation);
                        ok = r.success;
                    }
                    setRowStatus(item.id, ok ? 'done' : 'failed');
                    ok ? applied++ : failed++;
                } catch {
                    setRowStatus(item.id, 'failed');
                    failed++;
                }
            }

            bgContext = null; bgContextTime = 0;

            const parts = [];
            if (applied) parts.push(`<span class="ai-sum-good">${applied} applied</span>`);
            if (failed)  parts.push(`<span class="ai-sum-bad">${failed} failed</span>`);
            doneFooter.innerHTML = (parts.length ? `<span class="ai-review-done-summary">${parts.join(' · ')}</span>` : '<span></span>') +
                '<button class="ai-review-done-close-btn">Close</button>';
            doneFooter.querySelector('.ai-review-done-close-btn').addEventListener('click', closeModal);
        }

        function closeModal() {
            overlay.classList.remove('open');
            setTimeout(() => { overlay.remove(); document.removeEventListener('keydown', handleEsc); }, 220);
        }
        function handleEsc(e) { if (e.key === 'Escape') closeModal(); }
        document.addEventListener('keydown', handleEsc);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

        hdrEl.querySelector('.ai-review-close').addEventListener('click', closeModal);
        clFooter.querySelector('.ai-review-sel-safe-btn').addEventListener('click', () => {
            items.forEach(it => {
                // optional = Chat/Voice; user must choose those individually
                if (it.risk === 'safe' && it.recommendation !== 'leave' && it.recommendation !== 'optional') {
                    checkedIds.add(it.id);
                    const row = listEl.querySelector(`.ai-review-row[data-bg-id="${it.id}"]`);
                    if (row) { const cb = row.querySelector('.ai-review-checkbox'); if (cb) cb.checked = true; row.classList.add('checked'); }
                }
            });
            updateApplyBtn();
        });
        clFooter.querySelector('.ai-review-clear-sel-btn').addEventListener('click', () => {
            checkedIds.clear();
            listEl.querySelectorAll('.ai-review-row').forEach(row => {
                const cb = row.querySelector('.ai-review-checkbox');
                if (cb) cb.checked = false;
                row.classList.remove('checked');
            });
            updateApplyBtn();
        });
        clFooter.querySelector('.ai-review-cancel-btn').addEventListener('click', closeModal);
        clFooter.querySelector('.ai-review-apply-btn').addEventListener('click', applyChecked);

        updateApplyBtn();
    }

    if (notRunningPrimaryBtn) {
        notRunningPrimaryBtn.addEventListener('click', () => {
            const mode = notRunningPrimaryBtn.dataset.setupMode || 'start';
            runEngineSetup(mode);
        });
    }

    if (pullBtn) {
        pullBtn.addEventListener('click', async () => {
            if (aiSetupInProgress) return;
            aiSetupInProgress = true;
            pullBtn.disabled     = true;
            pullBtn.textContent  = 'Downloading…';
            pullProgress.style.display = 'block';
            pullProgress.textContent   = 'Starting AI Model download…';

            if (pullProgressUnsubscribe) pullProgressUnsubscribe();
            pullProgressUnsubscribe = window.electronAPI.onAiModelPullProgress((data) => {
                if (!data.chunk) return;
                const text = data.chunk.trim().toLowerCase();
                if (text.includes('success')) {
                    pullProgress.textContent = 'AI Model ready!';
                } else if (text.includes('verif') || text.includes('writing manifest')) {
                    pullProgress.textContent = 'Verifying AI Model…';
                } else {
                    pullProgress.textContent = 'Downloading AI Model…';
                }
            });

            const result = await window.electronAPI.aiPullModel(XTWEAKS_AI_MODEL);

            if (pullProgressUnsubscribe) {
                pullProgressUnsubscribe();
                pullProgressUnsubscribe = null;
            }

            if (result.success) {
                pullProgress.textContent = 'AI Model downloaded successfully!';
                aiSetupInProgress = false;
                setTimeout(checkOllama, 800);
            } else if (result.pathError) {
                pullProgress.textContent = 'AI Engine could not be found. Try restarting XTweaks.';
                aiSetupInProgress = false;
                pullBtn.disabled    = false;
                pullBtn.textContent = 'Retry';
            } else {
                pullProgress.textContent = 'Download failed. Try restarting XTweaks.';
                aiSetupInProgress = false;
                pullBtn.disabled    = false;
                pullBtn.textContent = 'Retry';
            }
        });
    }

    async function sendMessage(text) {
        if (!aiReady || !text.trim()) return;

        const trimmed = text.trim();
        chatInput.value = '';
        chatInput.style.height = 'auto';
        if (quickPrompts) quickPrompts.style.display = 'none';
        if (welcomeEl)    welcomeEl.style.display    = 'none';

        chatHistory.push({ role: 'user', content: trimmed });
        renderMessage('user', trimmed);

        const typingEl = document.createElement('div');
        typingEl.className = 'ai-message assistant';
        typingEl.innerHTML =
            '<div class="ai-message-avatar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>' +
            '</svg></div>' +
            '<div class="ai-typing-dots"><span></span><span></span><span></span></div>';
        chatHistEl.appendChild(typingEl);
        chatHistEl.scrollTop = chatHistEl.scrollHeight;

        sendBtn.disabled = true;
        if (inputBar) inputBar.classList.add('is-thinking');

        await getPCContextForMessage(trimmed);

        let aiResponseText = null;
        try {
            const sysContent = XTWEAKS_AI_SYSTEM_PROMPT + (pcContext ? '\n\n' + pcContext : '');
            const messages   = [{ role: 'system', content: sysContent }, ...chatHistory];
            const result     = await window.electronAPI.aiChat(messages);
            typingEl.remove();

            if (result.success) {
                chatHistory.push({ role: 'assistant', content: result.message });
                renderMessage('assistant', result.message);
                aiResponseText = result.message;
            } else {
                renderMessage('assistant', 'Sorry, there was an error communicating with the AI engine. Please check that it is still running and try again.');
            }
        } catch (e) {
            typingEl.remove();
            renderMessage('assistant', 'Connection error. Make sure the AI engine is running, then start it again from the setup panel.');
        }

        sendBtn.disabled = false;
        if (inputBar) inputBar.classList.remove('is-thinking');
        chatHistEl.scrollTop = chatHistEl.scrollHeight;

        if (aiResponseText) {
            const intent = detectIntent(trimmed);
            if (intent) {
                if (intent.type === 'background') {
                    // Refresh bg context if stale, then show bg card
                    const needRefresh = !bgContext || (Date.now() - bgContextTime) > BG_CONTEXT_TTL;
                    (needRefresh
                        ? window.electronAPI.getBackgroundContext().then(d => { if (d) { bgContext = d; bgContextTime = Date.now(); } }).catch(() => {})
                        : Promise.resolve()
                    ).then(() => {
                        setTimeout(() => {
                            const bgCard = buildBackgroundOptCard();
                            if (bgCard) {
                                chatHistEl.appendChild(bgCard);
                                chatHistEl.scrollTop = chatHistEl.scrollHeight;
                            }
                        }, 440);
                    });
                } else {
                    setTimeout(() => {
                        const recCard = buildRecommendationCard(intent);
                        if (recCard) {
                            chatHistEl.appendChild(recCard);
                            chatHistEl.scrollTop = chatHistEl.scrollHeight;
                        }
                    }, 440);
                }
            }
        }
    }

    function renderMessage(role, content) {
        const el = document.createElement('div');
        el.className = `ai-message ${role}`;

        if (role === 'user') {
            el.innerHTML = `<div class="ai-message-bubble user">${escapeAiHtml(content)}</div>`;
        } else {
            el.innerHTML =
                '<div class="ai-message-avatar">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>' +
                '</svg></div>' +
                `<div class="ai-message-bubble assistant">${formatAiText(content)}</div>`;
        }

        chatHistEl.appendChild(el);
    }

    function escapeAiHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatAiText(text) {
        const lines = escapeAiHtml(text).split('\n');
        let html = '';
        let listType = null;

        const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i]
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');

            if (/^[\-\*•]\s+/.test(line)) {
                if (listType !== 'ul') { closeList(); html += '<ul class="ai-msg-list">'; listType = 'ul'; }
                html += '<li>' + line.replace(/^[\-\*•]\s+/, '') + '</li>';
            } else if (/^\d+\.\s+/.test(line)) {
                if (listType !== 'ol') { closeList(); html += '<ol class="ai-msg-list">'; listType = 'ol'; }
                html += '<li>' + line.replace(/^\d+\.\s+/, '') + '</li>';
            } else {
                closeList();
                html += line.trim() === '' ? '<br>' : line + (i < lines.length - 1 ? '<br>' : '');
            }
        }
        closeList();
        return html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    }

    sendBtn.addEventListener('click', () => sendMessage(chatInput.value));

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(chatInput.value);
        }
    });

    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    document.querySelectorAll('.ai-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.prompt && aiReady) sendMessage(btn.dataset.prompt);
        });
    });

    const aiNavItem = document.querySelector('[data-page="ai-tweaker"]');
    if (aiNavItem) {
        aiNavItem.addEventListener('click', () => {
            if (!aiReady) setTimeout(checkOllama, 80);
        });
    }

    function clearChat() {
        chatHistory = [];
        chatHistEl.querySelectorAll('.ai-message, .ai-recommendation-card, .ai-bg-opt-card').forEach(m => m.remove());
        if (welcomeEl)    welcomeEl.style.display    = '';
        if (quickPrompts) quickPrompts.style.display = '';
    }

    function buildPCContext() {
        if (pcContextInFlight) return pcContextInFlight;

        const ctxIndicator = document.getElementById('ai-ctx-indicator');
        const ctxDot       = document.getElementById('ai-ctx-dot');
        if (ctxIndicator) ctxIndicator.textContent = 'Reading PC context…';
        if (ctxDot)       ctxDot.className = 'ai-ctx-dot';

        const p = (async () => {
            try {
                const [raw, bgRaw] = await Promise.all([
                    window.electronAPI.getAISystemContext(),
                    window.electronAPI.getBackgroundContext().catch(() => null)
                ]);
                if (bgRaw) { bgContext = bgRaw; bgContextTime = Date.now(); }
                const lines = [];

                // CPU
                const cpuModel = raw.sys?.cpu?.model || '';
                const cpuCores = raw.sys?.cpu?.cores;
                if (cpuModel) lines.push(`CPU: ${cpuModel}${cpuCores ? ` (${cpuCores} cores)` : ''}`);

                const cpuPct   = raw.live?.cpuUsage;
                const cpuTemp  = raw.live?.cpuTemp;
                const cpuState = [cpuPct != null && `Usage ${Math.round(cpuPct)}%`, cpuTemp && `Temp ${Math.round(cpuTemp)}°C`].filter(Boolean).join(', ');
                if (cpuState) lines.push(`CPU State: ${cpuState}`);

                // RAM
                const memTotal = raw.sys?.memory?.total;
                const memPct   = raw.live?.memoryUsage;
                if (memTotal) {
                    const gb   = (memTotal / 1073741824).toFixed(0);
                    const used = memPct != null ? `, ${Math.round(memPct)}% used` : '';
                    lines.push(`RAM: ${gb} GB total${used}`);
                }

                // GPU
                const gpu0 = Array.isArray(raw.gpu?.gpus) ? raw.gpu.gpus[0] : null;
                if (gpu0?.name) {
                    const vram = gpu0.vram          ? ` | VRAM ${gpu0.vram}`            : '';
                    const drv  = gpu0.driverVersion ? ` | Driver ${gpu0.driverVersion}` : '';
                    lines.push(`GPU: ${gpu0.name}${vram}${drv}`);
                }

                const gpuPct   = raw.live?.gpuUsage ?? raw.gpuLive?.usage;
                const gpuTemp  = raw.live?.gpuTemp  ?? raw.gpuLive?.temp;
                const gpuState = [gpuPct != null && `Usage ${Math.round(gpuPct)}%`, gpuTemp && `Temp ${Math.round(gpuTemp)}°C`].filter(Boolean).join(', ');
                if (gpuState) lines.push(`GPU State: ${gpuState}`);

                // Power plan + Windows
                const powerPlan = raw.gpuLive?.powerPlan;
                if (powerPlan) lines.push(`Power Plan: ${powerPlan}`);

                const winVer = raw.sys?.os?.release;
                if (winVer) lines.push(`Windows: ${winVer}`);

                if (lines.length === 0) {
                    pcContext   = null;
                    tweakStates = {};
                    if (ctxIndicator) ctxIndicator.textContent = 'No PC context available';
                    return;
                }

                // Tweak states — from app toggle state; cross-ref power plan for accuracy
                tweakStates = Object.assign({}, raw.toggles || {});
                if (powerPlan && /high.?perf/i.test(powerPlan)) tweakStates['optimize-power-plan'] = true;
                // Hardware detection flags for score categories 4 & 5
                tweakStates._gpuDetected    = !!(gpu0?.name);
                tweakStates._driverDetected = !!(gpu0?.driverVersion);

                const tweakLines = Object.keys(AI_ALLOWED_TWEAKS).map(id => {
                    const s = tweakStates[id];
                    const label = s === true ? 'Already Applied' : s === false ? 'Not Applied' : 'Unknown';
                    return `${id}: ${label}`;
                });

                const time    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                pcContextTime      = time;
                pcContextFetchedAt = Date.now();

                // Compute score now that tweakStates and bgContext are ready
                const { score, coreScore, latencyScore, cleanScore, gpuScore,
                        strengths, gaps, unknowns, latencyAllUnknown, unknownCount }
                    = computeOptimizationScore(tweakStates, bgContext);

                // Build Notes: encode hardware-specific reasoning so AI doesn't guess wrong
                const buildNotes = [];
                const ramGB = memTotal ? Math.round(memTotal / 1073741824) : 0;
                if (/X3D/i.test(cpuModel)) buildNotes.push('X3D CPU: focus on background/overlay reduction, not CPU priority tweaks');
                if (gpu0?.name && /RTX/i.test(gpu0.name)) buildNotes.push('RTX GPU: HAGS and overlay health are high priority; do NOT associate HAGS with CPU brand');
                if (gpu0?.name && /\bRX\s*[67]/i.test(gpu0.name)) buildNotes.push('RX GPU: overlay conflicts and driver updates are key');
                if (ramGB >= 32) buildNotes.push(`${ramGB}GB RAM: Chrome/Discord are LOW PRIORITY unless RAM usage exceeds 85%`);
                else if (ramGB >= 16) buildNotes.push(`${ramGB}GB RAM: monitor background RAM usage during gaming`);
                if (powerPlan && /high.?perf/i.test(powerPlan)) buildNotes.push('Power plan: CONFIRMED High Performance — do NOT recommend applying power plan; it is already optimized');

                // Score breakdown label: flag latency as estimated when all unknown
                const latencyLabel = latencyAllUnknown ? `${latencyScore}/20 (unverified)` : `${latencyScore}/20`;

                pcContext = `Current Tuning Profile:\n${lines.join('\n')}`;
                if (buildNotes.length) pcContext += `\n\nBuild Notes:\n${buildNotes.map(n => `- ${n}`).join('\n')}`;
                pcContext += `\n\nEstimated Optimization Readiness: ${score}/100`;
                pcContext += `\nScore breakdown — Core: ${coreScore}/35 · Latency: ${latencyLabel} · Background: ${cleanScore}/20 · GPU: ${gpuScore}/15`;
                if (unknownCount > 0) pcContext += `\nDetection note: ${unknownCount} tweak states unverified — neutral estimates used. Settings applied outside XTweaks may not be detected.`;
                if (strengths.length) pcContext += `\nConfirmed optimized: ${strengths.slice(0, 4).join(' · ')}`;
                if (gaps.length)      pcContext += `\nConfirmed missing: ${gaps.slice(0, 3).join(' · ')}`;
                if (unknowns.length)  pcContext += `\nUnverified (unknown state): ${unknowns.slice(0, 4).join(' · ')}`;
                pcContext += `\n\nApplied XTweaks:\n${tweakLines.join('\n')}`;

                const bgStr = formatBgContextForAI(bgContext);
                if (bgStr) pcContext += '\n\n' + bgStr;

                // Attach saved preferences for AI context
                const prefs = loadAIPrefs();
                const prefLines = [];
                if (prefs.preferredGame)                     prefLines.push(`Preferred game: ${prefs.preferredGame}`);
                if (prefs.safeOnly)                          prefLines.push('Preference: Safe tweaks only');
                if (prefs.focusGoal)                         prefLines.push(`Focus goal: ${prefs.focusGoal}`);
                if (prefs.keptApps && prefs.keptApps.length) prefLines.push(`Always keep open: ${prefs.keptApps.join(', ')}`);
                if (prefLines.length) pcContext += `\n\nAI Preferences:\n${prefLines.join('\n')}`;

                if (ctxIndicator) ctxIndicator.textContent = `Optimization: ${score}/100 \xb7 Context updated (${time})`;
                if (ctxDot)       ctxDot.className = 'ai-ctx-dot loaded';
            } catch {
                pcContext   = null;
                tweakStates = {};
                if (ctxIndicator) ctxIndicator.textContent = 'PC context unavailable';
                if (ctxDot)       ctxDot.className = 'ai-ctx-dot';
            } finally {
                pcContextInFlight = null;
            }
        })();

        pcContextInFlight = p;
        return p;
    }

    async function getPCContextForMessage(text) {
        const lower = text.toLowerCase();
        if (!PC_CONTEXT_KEYWORDS.some(k => lower.includes(k))) return;
        if (pcContext && (Date.now() - pcContextFetchedAt) < PC_CONTEXT_TTL) return;
        await buildPCContext();
    }

    function wireSettingsGear() {
        const dropdown = document.getElementById('ai-settings-dropdown');
        const gearBtn  = document.getElementById('ai-settings-btn');
        if (!dropdown || !gearBtn) return;

        gearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== gearBtn) {
                dropdown.classList.remove('open');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') dropdown.classList.remove('open');
        });

        document.getElementById('ai-settings-clear-chat')?.addEventListener('click', () => {
            clearChat();
            dropdown.classList.remove('open');
        });

        document.getElementById('ai-settings-show-welcome')?.addEventListener('click', () => {
            localStorage.removeItem('xtweaks-ai-welcome-seen');
            aiWelcomeShownThisSession = true;
            dropdown.classList.remove('open');
            setTimeout(() => {
                const ov = document.getElementById('ai-welcome-overlay');
                if (ov) { ov.classList.remove('is-closing'); ov.classList.add('is-open'); }
            }, 60);
        });

        // Dynamically add "Reset AI Learning" option
        if (!document.getElementById('ai-settings-reset-learning')) {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'ai-settings-item';
            resetBtn.id = 'ai-settings-reset-learning';
            resetBtn.textContent = 'Reset AI Learning';
            dropdown.appendChild(resetBtn);
            resetBtn.addEventListener('click', () => {
                saveAIPrefs({});
                dropdown.classList.remove('open');
                renderMessage('assistant', 'AI learning reset. Rejected tweaks, kept apps, preferred game, and all saved preferences have been cleared.');
            });
        }
    }

    function initWelcomeModal() {
        const overlay = document.getElementById('ai-welcome-overlay');
        const continueBtn = document.getElementById('ai-welcome-continue-btn');
        const dismissCheck = document.getElementById('ai-welcome-dismiss-check');
        const modal = document.getElementById('ai-welcome-modal');
        if (!overlay || !continueBtn) return;

        function closeWelcome() {
            if (!overlay.classList.contains('is-open')) return; // already closing or closed
            if (dismissCheck?.checked) {
                localStorage.setItem('xtweaks-ai-welcome-seen', '1');
            }
            overlay.classList.remove('is-open');
            overlay.classList.add('is-closing');

            let done = false;
            function finish() {
                if (done) return;
                done = true;
                overlay.classList.remove('is-closing');
            }
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                finish();
            } else {
                modal?.addEventListener('animationend', finish, { once: true });
                setTimeout(finish, 400); // fallback if animationend doesn't fire
            }
        }

        continueBtn.addEventListener('click', closeWelcome);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeWelcome();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeWelcome();
        });

        // Floating symbol mouse parallax (gyroscope tilt)
        const floatSymbols = modal ? Array.from(modal.querySelectorAll('.ai-wf-symbol')) : [];
        if (floatSymbols.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            let rafId = null, tX = 0, tY = 0, cX = 0, cY = 0;

            function tickPx() {
                cX += (tX - cX) * 0.06;
                cY += (tY - cY) * 0.06;
                floatSymbols.forEach(s => {
                    const px = parseFloat(s.dataset.px || '-0.04');
                    const py = parseFloat(s.dataset.py || '-0.04');
                    s.style.transform = `translate(${(cX * px).toFixed(2)}px,${(cY * py).toFixed(2)}px)`;
                });
                rafId = requestAnimationFrame(tickPx);
            }

            function onMM(e) {
                const r = modal.getBoundingClientRect();
                tX = e.clientX - (r.left + r.width  / 2);
                tY = e.clientY - (r.top  + r.height / 2);
            }

            const mo = new MutationObserver(() => {
                if (overlay.classList.contains('is-open')) {
                    if (!rafId) rafId = requestAnimationFrame(tickPx);
                    modal.addEventListener('mousemove', onMM);
                } else {
                    cancelAnimationFrame(rafId); rafId = null;
                    modal.removeEventListener('mousemove', onMM);
                    tX = tY = cX = cY = 0;
                    floatSymbols.forEach(s => s.style.transform = '');
                }
            });
            mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
        }

        // Canvas background particles
        const wCanvas = document.getElementById('ai-welcome-canvas');
        if (wCanvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const wCtx = wCanvas.getContext('2d');
            let wRafId = null;
            let wParticles = [];

            function resizeWCanvas() {
                wCanvas.width  = overlay.offsetWidth  || 800;
                wCanvas.height = overlay.offsetHeight || 600;
            }

            function makeParticle(bright) {
                return {
                    x: Math.random() * (wCanvas.width  || 800),
                    y: Math.random() * (wCanvas.height || 600),
                    r:    bright ? Math.random() * 2.2 + 1.4 : Math.random() * 1.4 + 0.5,
                    vx:   (Math.random() - 0.5) * (bright ? 0.10 : 0.16),
                    vy:   (Math.random() - 0.5) * (bright ? 0.10 : 0.16),
                    alpha: bright ? Math.random() * 0.45 + 0.42 : Math.random() * 0.40 + 0.18,
                    twinkleSpeed: Math.random() * 0.014 + 0.005,
                    twinklePhase: Math.random() * Math.PI * 2,
                    bright,
                };
            }

            function initWParticles() {
                resizeWCanvas();
                wParticles = [
                    ...Array.from({ length: 50 }, () => makeParticle(false)),
                    ...Array.from({ length: 18 }, () => makeParticle(true)),
                ];
            }

            function tickWParticles() {
                wCtx.clearRect(0, 0, wCanvas.width, wCanvas.height);
                for (const p of wParticles) {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.twinklePhase += p.twinkleSpeed;
                    if (p.x < 0) p.x = wCanvas.width;
                    if (p.x > wCanvas.width) p.x = 0;
                    if (p.y < 0) p.y = wCanvas.height;
                    if (p.y > wCanvas.height) p.y = 0;
                    const alpha = p.alpha * (0.55 + 0.45 * Math.sin(p.twinklePhase));
                    if (p.bright) {
                        const g = wCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.5);
                        g.addColorStop(0, `rgba(255,255,255,${(alpha * 0.55).toFixed(3)})`);
                        g.addColorStop(1, 'rgba(255,255,255,0)');
                        wCtx.beginPath();
                        wCtx.arc(p.x, p.y, p.r * 4.5, 0, Math.PI * 2);
                        wCtx.fillStyle = g;
                        wCtx.fill();
                    }
                    wCtx.beginPath();
                    wCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    wCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                    wCtx.fill();
                }
                wRafId = requestAnimationFrame(tickWParticles);
            }

            const wObs = new MutationObserver(() => {
                if (overlay.classList.contains('is-open')) {
                    if (!wRafId) { initWParticles(); wRafId = requestAnimationFrame(tickWParticles); }
                } else {
                    cancelAnimationFrame(wRafId); wRafId = null;
                }
            });
            wObs.observe(overlay, { attributes: true, attributeFilter: ['class'] });

            window.addEventListener('resize', () => { if (wRafId) resizeWCanvas(); });
        }
    }

    // Focus mode
    (function wireFocusMode() {
        const focusBtn = document.getElementById('ai-focus-btn');
        const aiPage   = document.getElementById('page-ai-tweaker');
        const chatHist = document.getElementById('ai-chat-history');
        if (!focusBtn || !aiPage) return;

        function enterFocus() {
            const top = chatHist ? chatHist.scrollTop : 0;
            aiPage.classList.add('ai-focus-mode');
            focusBtn.title = 'Exit Focus Mode';
            if (chatHist) chatHist.scrollTop = top;
        }

        function exitFocus() {
            const top = chatHist ? chatHist.scrollTop : 0;
            aiPage.classList.remove('ai-focus-mode');
            focusBtn.title = 'Focus Mode';
            if (chatHist) chatHist.scrollTop = top;
        }

        focusBtn.addEventListener('click', () => {
            aiPage.classList.contains('ai-focus-mode') ? exitFocus() : enterFocus();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && aiPage.classList.contains('ai-focus-mode')) exitFocus();
        });
    })();

    wireSettingsGear();
    initWelcomeModal();
    document.getElementById('ai-ctx-refresh')?.addEventListener('click', buildPCContext);

    setInputEnabled(false);
    checkOllama();
}
