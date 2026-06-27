// Input page temporarily hidden until controller visualizer is stable.
const INPUT_PAGE_ENABLED = false;

let aiWelcomeShownThisSession = false;
let aiWelcomePageEnterLastRun = 0;

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
    if (INPUT_PAGE_ENABLED) initializeInputTab();
    initializeAiTweaker();
    initializeGamingPage();
    initializeSystemPage();
    initializeMemoryPage();
    initializeProcessReducer();
    initializeGameTunePage();
    initializeNetworkCards();
    initializeDnsOptimizer();
    initializeSettingsPage();
    initializeAboutTilt();
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

function _integrateNetTopBar() {
    const bar = document.querySelector('.top-bar');
    const netPage = document.getElementById('page-network');
    const filterBar = netPage && netPage.querySelector('.net-filter-bar');
    if (!bar || !netPage || !filterBar || bar.parentElement === netPage) return;
    netPage.insertBefore(bar, filterBar);
    bar.classList.remove('gaming-integrated');
    bar.classList.add('net-integrated');
}

function _restoreNetTopBar() {
    const bar = document.querySelector('.top-bar');
    if (!bar || (!bar.classList.contains('net-integrated') && !bar.classList.contains('gaming-integrated'))) return;
    const main = document.querySelector('.content');
    const pageBody = document.querySelector('.page-body');
    if (!main || !pageBody) return;
    main.insertBefore(bar, pageBody);
    bar.classList.remove('net-integrated');
    bar.classList.remove('gaming-integrated');
}

function _integrateGamingTopBar() {
    const bar = document.querySelector('.top-bar');
    const gamingPage = document.getElementById('page-gaming');
    const filterBar = gamingPage && gamingPage.querySelector('.gaming-filter-bar');
    if (!bar || !gamingPage || !filterBar || bar.parentElement === gamingPage) return;
    gamingPage.insertBefore(bar, filterBar);
    bar.classList.remove('net-integrated');
    bar.classList.add('gaming-integrated');
}

// System & Memory: move the global top bar under the hero (above the filter/tab
// bar) so they get the same search/action bar as Gaming/Network. Reuses the
// generic 'net-integrated' styling (no network-specific or body-scoped rules).
function _integratePageTopBar(pageId, filterSelector) {
    const bar = document.querySelector('.top-bar');
    const page = document.getElementById(pageId);
    const filterBar = page && page.querySelector(filterSelector);
    if (!bar || !page || !filterBar || bar.parentElement === page) return;
    page.insertBefore(bar, filterBar);
    bar.classList.remove('gaming-integrated');
    bar.classList.add('net-integrated');
}

// Publish the resting (non-integrated) .top-bar height so the System/Memory filter
// bars can sticky-dock right below the translucent sticky header (--xt-topbar-h).
function updateTopBarHeightVar() {
    const bar = document.querySelector('.top-bar');
    if (!bar || bar.classList.contains('net-integrated') || bar.classList.contains('gaming-integrated')) return;
    const h = Math.round(bar.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--xt-topbar-h', `${h}px`);
}
window.addEventListener('resize', updateTopBarHeightVar);
window.addEventListener('DOMContentLoaded', updateTopBarHeightVar);

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    // Hide Input tab from sidebar if disabled
    if (!INPUT_PAGE_ENABLED) {
        const inputNavItem = document.querySelector('[data-page="input"]');
        if (inputNavItem) {
            inputNavItem.style.display = 'none';
        }
    }

    function activatePage(targetPage, activeItem = null) {
        // Prevent Input page from being activated if disabled
        if (!INPUT_PAGE_ENABLED && targetPage === 'input') {
            targetPage = 'dashboard';
            const dashboardNavItem = document.querySelector('[data-page="dashboard"]');
            activeItem = dashboardNavItem;
        }
        
        navItems.forEach(nav => nav.classList.remove('active'));
        if (activeItem) activeItem.classList.add('active');

        pages.forEach(page => {
            page.classList.remove('active');
            if (page.id === `page-${targetPage}`) {
                page.classList.add('active');
            }
        });

        // Force-close the AI welcome overlay when leaving the AI Tweaker page so it
        // doesn't remain open (pointer-events: all) and block clicks on other pages.
        if (targetPage !== 'ai-tweaker') {
            window.forceCloseAiWelcome?.();
        }

        if (targetPage === 'ai-tweaker') {
            document.body.classList.add('ai-tweaker-active');
            document.body.classList.remove('net-page-active');
            document.body.classList.remove('gaming-page-active');
            document.body.classList.remove('game-tune-active');
            _restoreNetTopBar();
            const aiPage = document.getElementById('page-ai-tweaker');
            if (aiPage) {
                aiPage.classList.remove('ai-entered');
                void aiPage.offsetWidth;
                aiPage.classList.add('ai-entered');
            }
            if (!aiWelcomeShownThisSession && !localStorage.getItem('xtweaks-ai-welcome-seen')) {
                aiWelcomeShownThisSession = true;
                const openWelcome = window.replayAiWelcomeModalMotion || ((options = {}) => {
                    const ov = document.getElementById('ai-welcome-overlay');
                    if (!ov) return;
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (options.source === 'page-enter' && !document.getElementById('page-ai-tweaker')?.classList.contains('active')) return;
                            ov.classList.remove('is-closing', 'ai-motion-reset');
                            ov.classList.add('is-open');
                        });
                    });
                });
                openWelcome({ source: 'page-enter' });
            }
        } else if (targetPage === 'network') {
            document.body.classList.remove('ai-tweaker-active');
            document.body.classList.remove('gaming-page-active');
            document.body.classList.remove('game-tune-active');
            document.body.classList.add('net-page-active');
            _integrateNetTopBar();
            scheduleNetworkCardsOnEntry({ source: 'page-enter' });
        } else if (targetPage === 'gaming') {
            document.body.classList.remove('ai-tweaker-active');
            document.body.classList.remove('net-page-active');
            document.body.classList.remove('game-tune-active');
            document.body.classList.add('gaming-page-active');
            _integrateGamingTopBar();
            scheduleGamingCardsOnEntry({ source: 'page-enter' });
        } else if (targetPage === 'fortnite') {
            document.body.classList.remove('ai-tweaker-active');
            document.body.classList.remove('net-page-active');
            document.body.classList.remove('gaming-page-active');
            document.body.classList.add('game-tune-active');
            _restoreNetTopBar();
            window.replayGameTuneCards?.();
        } else {
            document.body.classList.remove('ai-tweaker-active');
            document.body.classList.remove('net-page-active');
            document.body.classList.remove('gaming-page-active');
            document.body.classList.remove('game-tune-active');
            if (targetPage === 'system') {
                _integratePageTopBar('page-system', '.sys-filter-bar');
                scheduleSysMemCardsOnEntry('page-system', { source: 'page-enter' });
                loadSysCpuSection();
            } else if (targetPage === 'memory') {
  _integratePageTopBar('page-memory', '.mem-filter-bar');
  scheduleSysMemCardsOnEntry('page-memory', { source: 'page-enter' });
} else if (targetPage === 'process-reducer') {
  _integratePageTopBar('page-process-reducer', '.prx-filter-bar');
  scheduleProcessReducerCardsOnEntry({ source: 'page-enter' });
} else {
                _restoreNetTopBar();
                updateTopBarHeightVar();
                if (targetPage === 'dashboard') {
                    const dashPage = document.getElementById('page-dashboard');
                    if (dashPage) {
                        dashPage.classList.remove('dash-entered');
                        void dashPage.offsetWidth;
                        dashPage.classList.add('dash-entered');
                    }
                    scheduleDashboardCardsOnEntry({ source: 'page-enter' });
                }
                if (targetPage === 'about') {
                    scheduleAboutCardsOnEntry({ source: 'page-enter' });
                }
                if (targetPage === 'cleanup') {
                    scheduleCleanupCardsOnEntry({ source: 'page-enter' });
                }
                if (targetPage === 'settings') {
                    scheduleSettingsCardsOnEntry({ source: 'page-enter' });
                }
            }
        }
    }

    window.activateRendererPage = activatePage;

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPage = item.dataset.page;
            activatePage(targetPage, item);
        });
    });
}

function initializeSettingsPage() {
    const page = document.getElementById('page-settings');
    if (!page) return;
    if (page.dataset.settingsInitialized === 'true') return;
    page.dataset.settingsInitialized = 'true';

    const storageKey = 'xtweaks-settings-v1';
    const settingsVersion = 3;
    const defaults = {
        settingsVersion,
        launchOnStartup: true,
        minimizeToTray: false,
        language: 'English',
        theme: 'xins-premium',
        accentFinish: 'pearl',
        navigationStyle: 'full'
    };
    const themeLabels = {
        'xins-premium': 'Xins Premium',
        obsidian: 'Obsidian',
        'silver-mist': 'Silver Mist',
        'frost-glass': 'Frost Glass'
    };
    const navigationLabels = {
        full: 'Full Sidebar',
        compact: 'Compact Rail'
    };
    const validOptions = {
        language: ['English'],
        theme: Object.keys(themeLabels),
        accentFinish: ['pearl', 'graphite', 'chrome'],
        navigationStyle: Object.keys(navigationLabels)
    };

    function normalizeSettings(input = {}) {
        const next = { ...defaults, ...input };
        next.settingsVersion = settingsVersion;
        next.launchOnStartup = Boolean(next.launchOnStartup);
        next.minimizeToTray = Boolean(next.minimizeToTray);
        if (!validOptions.language.includes(next.language)) next.language = defaults.language;
        if (!validOptions.theme.includes(next.theme)) next.theme = defaults.theme;
        if (!validOptions.accentFinish.includes(next.accentFinish)) next.accentFinish = defaults.accentFinish;
        if (!validOptions.navigationStyle.includes(next.navigationStyle)) next.navigationStyle = defaults.navigationStyle;
        return next;
    }

    function getPersistedSettings(nextSettings) {
        const { navigationStyle, ...persisted } = nextSettings;
        return persisted;
    }

    function loadSettings() {
        try {
            const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const storedVersion = Number(stored.settingsVersion) || 1;
            if (storedVersion < 2 && stored.theme === 'obsidian') {
                stored.theme = defaults.theme;
            }
            if (storedVersion < settingsVersion && stored.navigationStyle === 'hidden') {
                stored.navigationStyle = defaults.navigationStyle;
            }
            const normalized = normalizeSettings(stored);
            normalized.navigationStyle = defaults.navigationStyle;
            if (storedVersion < settingsVersion || Object.prototype.hasOwnProperty.call(stored, 'navigationStyle')) {
                localStorage.setItem(storageKey, JSON.stringify(getPersistedSettings(normalized)));
            }
            return normalized;
        } catch {
            return { ...defaults };
        }
    }

    function saveSettings(nextSettings) {
        const normalized = normalizeSettings(nextSettings);
        localStorage.setItem(storageKey, JSON.stringify(getPersistedSettings(normalized)));
        return normalized;
    }

    let settings = loadSettings();

    function setToggleState(toggle, isOn) {
        toggle.classList.toggle('is-on', isOn);
        toggle.setAttribute('aria-pressed', String(isOn));
    }

    function setChoiceState(group, value) {
        page.querySelectorAll(`[data-settings-choice-group="${group}"]`).forEach((item) => {
            const isSelected = item.dataset.settingsValue === value;
            item.classList.toggle('is-selected', isSelected);
            item.setAttribute('aria-pressed', String(isSelected));
        });
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
    }

    function applyAccentFinish(accentFinish) {
        document.documentElement.dataset.accentFinish = accentFinish;
    }

    function applyNavigationStyle(navigationStyle) {
        document.body.classList.toggle('settings-nav-compact', navigationStyle === 'compact');
        document.body.classList.toggle('settings-nav-hidden', navigationStyle === 'hidden');
        document.body.classList.toggle('settings-nav-full', navigationStyle === 'full');
        document.querySelector('[data-sidebar-layout-toggle]')?.setAttribute('aria-pressed', String(navigationStyle === 'compact'));
    }

    function updateStatusChips() {
        const themeStatus = page.querySelector('[data-settings-status="theme"]');
        const startupStatus = page.querySelector('[data-settings-status="startup"]');
        const navigationStatus = page.querySelector('[data-settings-status="navigation"]');
        if (themeStatus) themeStatus.textContent = themeLabels[settings.theme] || themeLabels[defaults.theme];
        if (startupStatus) startupStatus.textContent = settings.launchOnStartup ? 'Enabled' : 'Off';
        if (navigationStatus) navigationStatus.textContent = navigationLabels[settings.navigationStyle] || navigationLabels[defaults.navigationStyle];
    }

    function applySettingsToUI() {
        page.querySelectorAll('[data-settings-key]').forEach((control) => {
            const key = control.dataset.settingsKey;
            if (control.classList.contains('settings-toggle')) {
                setToggleState(control, Boolean(settings[key]));
            } else if (control.matches('select')) {
                control.value = settings[key] || defaults[key];
            }
        });

        setChoiceState('theme', settings.theme);
        setChoiceState('accent', settings.accentFinish);
        setChoiceState('navigationStyle', settings.navigationStyle);
        applyTheme(settings.theme);
        applyAccentFinish(settings.accentFinish);
        applyNavigationStyle(settings.navigationStyle);
        updateStatusChips();
    }

    function updateSettings(patch, notification) {
        settings = saveSettings({ ...settings, ...patch });
        applySettingsToUI();
        if (notification) {
            showNotification(notification.type || 'success', notification.title, notification.message, {
                key: 'settings-preference',
                duration: 2400
            });
        }
    }

    function resetSettings() {
        settings = saveSettings(defaults);
        applySettingsToUI();
        showNotification('success', 'Settings Reset', 'Settings restored to defaults.', {
            key: 'settings-preference',
            duration: 2600
        });
    }

    function openSettingsUrl(url) {
        if (!url) return;
        try {
            if (window.electronAPI?.openExternal) {
                window.electronAPI.openExternal(url);
            } else {
                window.open(url, '_blank', 'noopener');
            }
        } catch {
            window.open(url, '_blank', 'noopener');
        }
    }

    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn?.addEventListener('click', () => {
        if (typeof window.activateRendererPage === 'function') {
            window.activateRendererPage('settings');
        }
    });

    const sidebarLayoutToggle = document.querySelector('[data-sidebar-layout-toggle]');
    const toggleSidebarLayout = () => {
        updateSettings({
            navigationStyle: settings.navigationStyle === 'compact' ? 'full' : 'compact'
        });
    };
    sidebarLayoutToggle?.addEventListener('click', toggleSidebarLayout);
    sidebarLayoutToggle?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleSidebarLayout();
    });

    page.querySelectorAll('.settings-toggle').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const key = toggle.dataset.settingsKey;
            if (!key) return;
            const isOn = !toggle.classList.contains('is-on');
            const messages = {
                launchOnStartup: {
                    title: 'Startup Preference Saved',
                    message: 'Startup preference saved.'
                },
                minimizeToTray: {
                    title: 'Tray Preference Saved',
                    message: 'Tray preference saved.'
                }
            };
            updateSettings({ [key]: isOn }, messages[key]);
        });
    });

    // Delegated so a click anywhere on a choice card (theme/accent/nav) registers,
    // regardless of which decorative child was hit — fixes the theme-card hitbox.
    page.addEventListener('click', (event) => {
        const choice = event.target.closest('[data-settings-choice-group]');
        if (!choice || !page.contains(choice)) return;
        const group = choice.dataset.settingsChoiceGroup;
        const value = choice.dataset.settingsValue;
        if (!group || !value) return;
        if (group === 'theme') {
            updateSettings({ theme: value }, {
                title: 'Theme Saved',
                message: `${themeLabels[value] || 'Theme'} selected.`
            });
        } else if (group === 'accent') {
            updateSettings({ accentFinish: value }, {
                title: 'Accent Finish Saved',
                message: `${choice.textContent.trim()} selected.`
            });
        } else if (group === 'navigationStyle') {
            updateSettings({ navigationStyle: value }, {
                title: 'Navigation Style Updated',
                message: `${choice.textContent.trim()} enabled for this session.`
            });
        }
    });

    page.querySelectorAll('.settings-select[data-settings-key]').forEach((select) => {
        select.addEventListener('change', () => {
            const key = select.dataset.settingsKey;
            updateSettings({ [key]: select.value }, {
                title: 'Language Saved',
                message: 'Language saved.'
            });
        });
    });

    const resetBtn = page.querySelector('.settings-reset-btn');
    resetBtn?.addEventListener('click', resetSettings);

    page.querySelectorAll('[data-settings-open-url]').forEach((button) => {
        button.addEventListener('click', () => {
            openSettingsUrl(button.dataset.settingsOpenUrl);
        });
    });

    const search = document.getElementById('settings-search');
    search?.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        page.querySelectorAll('.settings-content-section').forEach((section) => {
            const searchableText = [
                section.textContent,
                ...Array.from(section.querySelectorAll('[data-settings-value], [data-settings-key], [data-settings-open-url]')).map((item) =>
                    `${item.dataset.settingsValue || ''} ${item.dataset.settingsKey || ''} ${item.dataset.settingsOpenUrl || ''}`
                )
            ].join(' ').toLowerCase();
            section.hidden = Boolean(query) && !searchableText.includes(query);
        });
    });

    applySettingsToUI();
}

function initializeInputTab() {
    // Input page temporarily hidden until controller visualizer is stable.
    if (!INPUT_PAGE_ENABLED) return;
    
    const page = document.getElementById('page-input');
    if (!page) return;

    const apiPill = document.getElementById('input-api-status');
    const activeButtonsEl = document.getElementById('input-active-buttons');
    const viewerNote = document.getElementById('input-viewer-note');
    const fallback = document.getElementById('input-model-fallback');
    const stage = document.getElementById('input-viewer-stage');
    const canvas = document.getElementById('input-model-canvas');
    const xboxTuneToggle = document.getElementById('input-xbox-tune-toggle');
    const xboxTuner = document.getElementById('input-xbox-tuner');
    const inputTunerTitle = document.getElementById('input-tuner-title');
    const xboxCopyValuesBtn = document.getElementById('input-xbox-copy-values');
    const xboxResetSlidersBtn = document.getElementById('input-xbox-reset-sliders');
    const xboxTunerCloseBtn = document.getElementById('input-xbox-tuner-close');
    const selectedButtonEl = document.getElementById('input-selected-button');
    const assignmentSelect = document.getElementById('input-assignment-select');
    const profileStatus = document.getElementById('input-profile-status');
    const profileKey = 'xtweaks-input-remap-profile';
    const modelPaths = {
        xbox: 'assets/models/controllers/xbox_elite_controller.glb',
        // Temporary PS5 asset: keep original materials/textures and replace with a higher-quality GLB later.
        ps5: 'assets/models/controllers/white_ps5_controller.glb',
        playstation: 'assets/models/controllers/white_ps5_controller.glb'
    };
    const INPUT_MODEL_FRAMING = {
        xbox: {
            // distanceMultiplier controls zoom: lower is closer.
            distanceMultiplier: 0.35,
            // scaleMultiplier controls model size inside its centered pivot.
            scaleMultiplier: 2.45,
            // positionOffset controls where the whole pivot group sits.
            positionOffset: { x: -0.10, y: 0, z: 0 },
            targetOffset: { x: -0.02, y: 0.04, z: 0 },
            cameraOffset: { x: 0.15, y: 0.18, z: 0.03 },
            // rotation controls the starting pose restored by Reset View.
            rotation: { x: 0.24, y: -1.95, z: 0.04 }
        },
        ps5: {
            distanceMultiplier: 0.52,
            scaleMultiplier: 2.96,
            positionOffset: { x: 0, y: 0.04, z: 0 },
            targetOffset: { x: 0, y: 0.055, z: 0 },
            cameraOffset: { x: 0.08, y: 0.2, z: 0.04 },
            rotation: { x: 0.2, y: -0.42, z: 0.01 }
        },
        playstation: {
            distanceMultiplier: 0.52,
            scaleMultiplier: 2.96,
            positionOffset: { x: 0, y: 0.04, z: 0 },
            targetOffset: { x: 0, y: 0.055, z: 0 },
            cameraOffset: { x: 0.08, y: 0.2, z: 0.04 },
            rotation: { x: 0.2, y: -0.42, z: 0.01 }
        }
    };
    const INPUT_XBOX_DECAL_TUNER_ENABLED = false;
    const INPUT_MODEL_MATERIAL_MODE = {
        xbox: 'preserveOriginal',
        ps5: 'preserveOriginal',
        playstation: 'preserveOriginal'
    };
    const defaultXboxFraming = JSON.parse(JSON.stringify(INPUT_MODEL_FRAMING.xbox));
    const defaultPlayStationFraming = JSON.parse(JSON.stringify(INPUT_MODEL_FRAMING.playstation));
    const xboxTuneFields = [
        'distanceMultiplier',
        'scaleMultiplier',
        'positionOffset.x',
        'positionOffset.y',
        'positionOffset.z',
        'rotation.x',
        'rotation.y',
        'rotation.z',
        'cameraOffset.x',
        'cameraOffset.y',
        'cameraOffset.z'
    ];
    const buttonNames = [
        'A', 'B', 'X', 'Y', 'Left Bumper', 'Right Bumper', 'Left Trigger', 'Right Trigger',
        'View', 'Menu', 'Left Stick', 'Right Stick', 'D-Pad Up', 'D-Pad Down', 'D-Pad Left',
        'D-Pad Right', 'Home'
    ];

    let activeModel = 'xbox';
    let selectedButton = 'A / Cross';
    let profile = {};
    let threeViewer = null;
    let threeViewerCreatePromise = null;
    let inputViewerActivationSerial = 0;
    let rotationX = -8;
    let rotationY = 0;
    let isDragging = false;
    let dragStart = { x: 0, y: 0, rx: rotationX, ry: rotationY };
    let isTunerDragging = false;
    let tunerDragStart = { x: 0, y: 0, left: 0, top: 0 };
    let lastTimestamp = null;
    let pollingSamples = [];

    if (xboxTuner && xboxTuner.parentElement !== document.body) {
        document.body.appendChild(xboxTuner);
    }

    try {
        profile = JSON.parse(localStorage.getItem(profileKey) || '{}') || {};
    } catch {
        profile = {};
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const formatAxis = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number.toFixed(2) : '0.00';
    };

    const updateFallbackTransform = () => {
        const controller = fallback?.querySelector('.input-fallback-controller');
        if (!controller) return;
        controller.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
    };

    const setViewerFallback = (message) => {
        if (canvas) canvas.hidden = true;
        if (fallback) fallback.hidden = false;
        if (viewerNote) {
            viewerNote.textContent = message || `Could not load ${modelPaths[activeModel]}`;
        }
        const fallbackText = fallback?.querySelector('p');
        if (fallbackText) {
            fallbackText.textContent = message || 'Controller model missing - add xbox-controller.glb or ps5-controller.glb';
        }
        updateFallbackTransform();
    };

    const setViewerLoading = () => {
        if (canvas) canvas.hidden = false;
        if (fallback) fallback.hidden = true;
        if (viewerNote) viewerNote.textContent = `Loading ${modelPaths[activeModel]}`;
    };

    const disposeObject3D = (THREE, object) => {
        if (!object) return;
        object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.filter(Boolean).forEach((material) => {
                Object.keys(material).forEach((key) => {
                    const value = material[key];
                    if (value && typeof value.dispose === 'function' && value.isTexture) value.dispose();
                });
                material.dispose?.();
            });
        });
        THREE.Cache?.clear?.();
    };

    const createThreeViewer = async () => {
        if (!canvas || !stage) throw new Error('Viewer canvas is unavailable.');

        const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
            import('../../node_modules/three/build/three.module.js'),
            import('../../node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
            import('../../node_modules/three/examples/jsm/controls/OrbitControls.js')
        ]);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        const loader = new GLTFLoader();
        const controls = new OrbitControls(camera, renderer.domElement);
        const root = new THREE.Group();
        let currentModel = null;
        let animationFrame = 0;
        let disposed = false;
        let resizeObserver = null;
        let loadSerial = 0;
        let isOrbiting = false;
        let lastFrame = null;
        const loggedInputMaterialInventory = new Set();
        const INPUT_MODEL_DEBUG_MATERIALS = false;
        const INPUT_SCENE_LIGHTING = {
            ambientIntensity: 0.88,
            keyIntensity: 2.05,
            fillIntensity: 1.45,
            rimIntensity: 2.65,
            topHighlightIntensity: 1.15,
            lowerFillIntensity: 0.9,
            exposure: 1.03
        };

        scene.add(root);
        scene.add(new THREE.AmbientLight(0xb8b8b8, INPUT_SCENE_LIGHTING.ambientIntensity));

        // Soft key light keeps the graphite shell visible without washing it gray.
        const keyLight = new THREE.DirectionalLight(0xffffff, INPUT_SCENE_LIGHTING.keyIntensity);
        keyLight.position.set(3.1, 4.2, 4.4);
        scene.add(keyLight);

        // Front fill controls button/stick readability from the camera side.
        const frontFillLight = new THREE.DirectionalLight(0xe8e8e8, INPUT_SCENE_LIGHTING.fillIntensity);
        frontFillLight.position.set(-1.8, 1.4, 5.2);
        scene.add(frontFillLight);

        // Rim light separates the black controller edges from the dark stage.
        const rimLight = new THREE.DirectionalLight(0xd9d9d9, INPUT_SCENE_LIGHTING.rimIntensity);
        rimLight.position.set(-4.4, 2.7, -4.9);
        scene.add(rimLight);

        // Small top highlight adds glossy product-render catches on sticks/buttons.
        const topHighlight = new THREE.PointLight(0xffffff, INPUT_SCENE_LIGHTING.topHighlightIntensity, 7);
        topHighlight.position.set(0.4, 3.1, 2.4);
        scene.add(topHighlight);

        const lowerFill = new THREE.PointLight(0xb0b0b0, INPUT_SCENE_LIGHTING.lowerFillIntensity, 9);
        lowerFill.position.set(0, -1.5, 2.2);
        scene.add(lowerFill);

        camera.position.set(0, 0.55, 5);
        controls.enableDamping = true;
        controls.dampingFactor = 0.075;
        controls.enablePan = false;
        controls.minDistance = 2.2;
        controls.maxDistance = 7;
        controls.minPolarAngle = Math.PI * 0.22;
        controls.maxPolarAngle = Math.PI * 0.78;
        controls.target.set(0, 0, 0);
        controls.update();
        controls.addEventListener('start', () => { isOrbiting = true; });
        controls.addEventListener('end', () => { isOrbiting = false; });

        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = INPUT_SCENE_LIGHTING.exposure;

        const resize = () => {
            if (disposed) return;
            const rect = stage.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
        };

        const getBoundsWithoutHelpers = (object) => {
            object.updateMatrixWorld(true);
            const box = new THREE.Box3();
            object.traverse((child) => {
                if (!child.isMesh || !child.geometry) return;
                let cursor = child;
                while (cursor) {
                    if (cursor.userData?.xtweaksExcludeFromBounds) return;
                    cursor = cursor.parent;
                }
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
            });
            if (box.isEmpty()) return new THREE.Box3().setFromObject(object);
            return box;
        };

        const applyFramingToObject = (framedObject, modelKey) => {
            const framingKey = modelKey === 'ps5' ? 'playstation' : modelKey;
            const preset = INPUT_MODEL_FRAMING[framingKey] || INPUT_MODEL_FRAMING.xbox;
            const maxDim = framedObject.userData.xtweaksMaxDim || 1;
            const scale = preset.scaleMultiplier / maxDim;
            const rotation = new THREE.Euler(preset.rotation.x, preset.rotation.y, preset.rotation.z);
            const isXbox = modelKey === 'xbox';

            const centerPosition = framedObject.userData.xtweaksCenterPosition || new THREE.Vector3(0, 0, 0);
            framedObject.position.copy(centerPosition);
            framedObject.scale.setScalar(scale);
            framedObject.rotation.copy(rotation);

            const framedBox = getBoundsWithoutHelpers(framedObject);
            const sphere = framedBox.getBoundingSphere(new THREE.Sphere());
            const radius = Math.max(sphere.radius, 0.75);
            const positionOffset = new THREE.Vector3(preset.positionOffset.x, preset.positionOffset.y, preset.positionOffset.z);
            framedObject.position.copy(centerPosition).add(positionOffset.multiplyScalar(radius));
            framedObject.userData.xtweaksBasePosition = framedObject.position.clone();
            framedObject.userData.xtweaksBaseRotation = rotation.clone();
            const fov = THREE.MathUtils.degToRad(camera.fov);
            const distance = Math.max(1.75, (radius / Math.sin(fov / 2)) * preset.distanceMultiplier);
            const targetOffset = new THREE.Vector3(preset.targetOffset.x, preset.targetOffset.y, preset.targetOffset.z).multiplyScalar(radius);
            const target = isXbox ? centerPosition.clone().add(targetOffset) : targetOffset;
            const cameraOffset = new THREE.Vector3(preset.cameraOffset.x, preset.cameraOffset.y, preset.cameraOffset.z);

            controls.target.copy(target);
            camera.position.set(
                target.x + radius * cameraOffset.x,
                target.y + radius * cameraOffset.y,
                distance + radius * cameraOffset.z
            );
            camera.near = Math.max(0.01, distance / 100);
            camera.far = Math.max(distance * 100, camera.position.length() * 12);
            camera.updateProjectionMatrix();
            controls.minDistance = Math.max(1.05, distance * 0.62);
            controls.maxDistance = distance * 1.65;
            controls.update();
            lastFrame = { distance, radius, target, cameraOffset, rotation };
        };

        const frameModel = (model, modelKey) => {
            const framingKey = modelKey === 'ps5' ? 'playstation' : modelKey;
            const preset = INPUT_MODEL_FRAMING[framingKey] || INPUT_MODEL_FRAMING.xbox;
            model.updateMatrixWorld(true);
            const box = getBoundsWithoutHelpers(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const scale = preset.scaleMultiplier / maxDim;
            const isXbox = modelKey === 'xbox';
            const framedObject = isXbox ? new THREE.Group() : model;

            if (isXbox) {
                // Xbox source origin is off-center. Center the GLB inside a pivot so drag rotation
                // and Reset View orbit around the middle of the controller.
                model.position.sub(center);
                framedObject.add(model);
            } else {
                model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            }

            framedObject.userData.xtweaksModelKey = modelKey;
            framedObject.userData.xtweaksMaxDim = maxDim;
            framedObject.userData.xtweaksCenterPosition = framedObject.position.clone();
            applyFramingToObject(framedObject, modelKey);
            return framedObject;
        };

        const isBrightMaterial = (material) => {
            if (!material) return true;
            const color = material.color;
            if (color && ((color.r + color.g + color.b) / 3) > 0.58) return true;
            const factor = material.userData?.gltfExtensions?.KHR_materials_pbrSpecularGlossiness?.diffuseFactor;
            if (Array.isArray(factor) && ((factor[0] + factor[1] + factor[2]) / 3) > 0.58) return true;
            return !material.map && !material.normalMap && !material.roughnessMap && !material.metalnessMap;
        };

        const getInputMaterialRole = (mesh, material) => {
            const name = `${mesh?.name || ''} ${material?.name || ''}`.toLowerCase();
            if (/\b(a|button_a|a_button|face_a)\b/.test(name)) return 'button-a';
            if (/\b(b|button_b|b_button|face_b)\b/.test(name)) return 'button-b';
            if (/\b(x|button_x|x_button|face_x)\b/.test(name)) return 'button-x';
            if (/\b(y|button_y|y_button|face_y)\b/.test(name)) return 'button-y';
            if (/button|face|dpad|d-pad|stick|thumb|trigger|bumper|logo|label|cross|circle|square|triangle|vraymtl/.test(name)) return 'detail';
            if (/shell|body|case|housing|controller/.test(name)) return 'shell';
            return 'unknown';
        };

        const getButtonAccentColor = (role) => {
            // Disable button accents by returning null here if a future model's named buttons look too loud.
            const accents = {
                'button-a': 0x2f8f57,
                'button-b': 0x9c3535,
                'button-x': 0x356b9f,
                'button-y': 0xa88b32
            };
            return accents[role] || null;
        };

        const isNewControllerAsset = (path = '') => {
            return path.includes('xbox_elite_controller.glb')
                || path.includes('white_ps5_controller.glb');
        };

        const getMaterialColorHex = (material) => {
            return material?.color?.getHexString ? `#${material.color.getHexString()}` : 'none';
        };

        const getTextureSourceName = (texture) => {
            const image = texture?.image;
            return texture?.name || image?.src || image?.currentSrc || image?.uuid || 'embedded/unknown';
        };

        const markBaseColorTexture = (texture) => {
            if (!texture) return;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
        };

        const markGltfTextureOrientation = (texture) => {
            if (!texture) return;
            texture.flipY = false;
            texture.needsUpdate = true;
        };

        const createFallbackInputMaterial = (THREE) => new THREE.MeshPhysicalMaterial({
            name: 'xtweaks_missing_material_fallback',
            color: new THREE.Color(0x111214),
            roughness: 0.42,
            metalness: 0.08,
            clearcoat: 0.2,
            clearcoatRoughness: 0.5
        });

        const logInputMaterialInventory = (model, modelKey, path) => {
            if (loggedInputMaterialInventory.has(modelKey)) return;
            loggedInputMaterialInventory.add(modelKey);
            const rows = [];
            const detailRows = [];
            const meshNames = new Set();
            const materialNames = new Set();
            model.traverse((child) => {
                if (!child.isMesh) return;
                meshNames.add(child.name || '(unnamed mesh)');
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.filter(Boolean).forEach((material) => {
                    materialNames.add(material.name || '(unnamed material)');
                    const role = getInputMaterialRole(child, material);
                    const row = {
                        mesh: child.name || '(unnamed mesh)',
                        material: material.name || '(unnamed material)',
                        role,
                        colorHex: getMaterialColorHex(material),
                        hasMap: Boolean(material.map),
                        mapSource: getTextureSourceName(material.map),
                        hasNormalMap: Boolean(material.normalMap),
                        normalMapSource: getTextureSourceName(material.normalMap),
                        hasRoughnessMap: Boolean(material.roughnessMap),
                        hasMetalnessMap: Boolean(material.metalnessMap),
                        hasAlphaMap: Boolean(material.alphaMap),
                        alphaMapSource: getTextureSourceName(material.alphaMap),
                        action: isNewControllerAsset(path) ? 'preserved' : 'legacy material pass'
                    };
                    rows.push(row);
                    if (role !== 'unknown' && role !== 'shell') detailRows.push(row);
                });
            });
            if (INPUT_MODEL_DEBUG_MATERIALS) console.info(`[INPUT 3D] ${modelKey} model inventory`, {
                path,
                meshCount: meshNames.size,
                materialCount: materialNames.size,
                meshNames: Array.from(meshNames),
                materialNames: Array.from(materialNames),
                materials: rows
            });
            if (INPUT_MODEL_DEBUG_MATERIALS && modelKey === 'xbox' && !detailRows.length) {
                console.info('[INPUT 3D] Xbox GLB does not expose separate named button/detail meshes; preserving its texture maps instead of applying per-button colors.');
            }
        };

        const applyPremiumMaterialPass = (model, modelKey, path) => {
            if (isNewControllerAsset(path)) {
                const materialMode = modelKey === 'xbox'
                    ? INPUT_MODEL_MATERIAL_MODE.xbox
                    : INPUT_MODEL_MATERIAL_MODE.playstation;
                if (INPUT_MODEL_DEBUG_MATERIALS) console.info('[Input Model] preserving original materials for new controller asset', { modelKey, path, materialMode });
                logInputMaterialInventory(model, modelKey, path);
                model.traverse((child) => {
                    if (!child.isMesh) return;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    const repaired = materials.map((material) => {
                        if (material) {
                            if (modelKey === 'xbox') {
                                markBaseColorTexture(material.map);
                                markGltfTextureOrientation(material.normalMap);
                                markGltfTextureOrientation(material.roughnessMap);
                                markGltfTextureOrientation(material.metalnessMap);
                                markGltfTextureOrientation(material.aoMap);
                                if (material.emissive?.set) material.emissive.set(0x000000);
                                if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
                                if ('toneMapped' in material) material.toneMapped = true;
                                if ('envMapIntensity' in material) {
                                    material.envMapIntensity = Math.min(material.envMapIntensity ?? 0.55, 0.55);
                                }
                                material.needsUpdate = true;
                            }
                            if (INPUT_MODEL_DEBUG_MATERIALS) console.info('[Input Model] controller material preserved', {
                                path,
                                modelKey,
                                mesh: child.name || '(unnamed mesh)',
                                material: material.name || '(unnamed material)',
                                colorHex: getMaterialColorHex(material),
                                hasMap: Boolean(material.map),
                                mapSource: getTextureSourceName(material.map),
                                hasNormalMap: Boolean(material.normalMap),
                                normalMapSource: getTextureSourceName(material.normalMap),
                                hasRoughnessMap: Boolean(material.roughnessMap),
                                hasMetalnessMap: Boolean(material.metalnessMap),
                                hasAlphaMap: Boolean(material.alphaMap),
                                alphaMapSource: getTextureSourceName(material.alphaMap),
                                action: 'preserved'
                            });
                            return material;
                        }

                        console.warn('[Input Model] missing material replaced with fallback', {
                            path,
                            mesh: child.name || '(unnamed mesh)'
                        });
                        return createFallbackInputMaterial(THREE);
                    });
                    child.material = Array.isArray(child.material) ? repaired : repaired[0];
                });
                return;
            }

            const isXboxModel = modelKey === 'xbox';
            logInputMaterialInventory(model, modelKey, path);

            model.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = true;
                child.receiveShadow = true;
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                const upgraded = materials.map((material) => {
                    const role = getInputMaterialRole(child, material);
                    const accentColor = isXboxModel ? getButtonAccentColor(role) : null;
                    const hasTextureMaps = Boolean(material?.map || material?.normalMap || material?.roughnessMap || material?.metalnessMap || material?.alphaMap || material?.aoMap);
                    const preserveOriginalMaps = hasTextureMaps && !accentColor;
                    // Shell fallback: only darken missing/broken clay-white materials.
                    // Textured materials are preserved first so baked labels/colors/details remain readable.
                    const forceDark = !preserveOriginalMaps && !accentColor && isBrightMaterial(material);
                    // Button/detail preservation: named buttons get muted accents; named details stay graphite.
                    const detailColor = role === 'detail' && !preserveOriginalMaps ? new THREE.Color(0x141618) : null;
                    const premium = new THREE.MeshPhysicalMaterial({
                        name: material?.name ? `${material.name}_xtweaks_dark` : 'xtweaks_premium_graphite',
                        color: accentColor ? new THREE.Color(accentColor)
                            : detailColor || (forceDark ? new THREE.Color(0x08090a)
                            : (preserveOriginalMaps ? (material.color?.clone?.() || new THREE.Color(0xffffff)) : (material.color?.clone?.() || new THREE.Color(0x0b0c0d)))),
                        map: material?.map || null,
                        normalMap: material?.normalMap || null,
                        roughnessMap: material?.roughnessMap || null,
                        metalnessMap: material?.metalnessMap || null,
                        aoMap: material?.aoMap || null,
                        emissiveMap: material?.emissiveMap || null,
                        alphaMap: material?.alphaMap || null,
                        transparent: material?.transparent || false,
                        opacity: material?.opacity ?? 1,
                        alphaTest: material?.alphaTest ?? 0,
                        side: material?.side ?? THREE.FrontSide,
                        roughness: forceDark || accentColor ? 0.38 : Math.min(Math.max(material?.roughness ?? 0.44, 0.35), 0.5),
                        metalness: forceDark || accentColor ? 0.1 : Math.min(Math.max(material?.metalness ?? 0.08, 0.05), 0.15),
                        clearcoat: 0.24,
                        clearcoatRoughness: 0.46
                    });
                    premium.envMapIntensity = preserveOriginalMaps ? 0.82 : 0.72;
                    premium.needsUpdate = true;
                    material?.dispose?.();
                    return premium;
                });
                child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
            });
        };

        const loadModel = async (modelKey) => {
            if (disposed) return;
            const path = modelPaths[modelKey];
            const serial = ++loadSerial;
            setViewerLoading();
            console.info(`[INPUT 3D] Loading ${modelKey} controller model: ${path}`);

            try {
                const gltf = await loader.loadAsync(path);
                if (disposed || serial !== loadSerial) {
                    disposeObject3D(THREE, gltf.scene);
                    return;
                }

                if (currentModel) {
                    root.remove(currentModel);
                    disposeObject3D(THREE, currentModel);
                    currentModel = null;
                }

                applyPremiumMaterialPass(gltf.scene, modelKey, path);
                currentModel = frameModel(gltf.scene, modelKey);
                root.add(currentModel);

                if (canvas) canvas.hidden = false;
                if (fallback) fallback.hidden = true;
                if (viewerNote) viewerNote.textContent = `${modelKey === 'ps5' ? 'PlayStation' : 'Xbox'} controller model loaded`;
                console.info(`[INPUT 3D] Loaded ${modelKey} controller model successfully.`);
            } catch (error) {
                console.error(`[INPUT 3D] Failed to load ${modelKey} controller model from ${path}:`, error);
                if (currentModel) {
                    root.remove(currentModel);
                    disposeObject3D(THREE, currentModel);
                    currentModel = null;
                }
                setViewerFallback(`Could not load ${path} - ${error.message || 'model unavailable'}`);
            }
        };

        const animate = () => {
            if (disposed) return;
            animationFrame = requestAnimationFrame(animate);
            controls.update();
            if (currentModel && !isOrbiting) {
                const base = currentModel.userData.xtweaksBasePosition || currentModel.position;
                currentModel.position.y = base.y + Math.sin(performance.now() * 0.0012) * 0.035;
            }
            renderer.render(scene, camera);
        };

        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(stage);
        animate();

        return {
            loadModel,
            resize,
            hasModel() {
                return Boolean(currentModel);
            },
            updateModelFraming(modelKey) {
                if (!currentModel || currentModel.userData.xtweaksModelKey !== modelKey) return;
                applyFramingToObject(currentModel, modelKey);
            },
            updateXboxFraming() {
                if (!currentModel || currentModel.userData.xtweaksModelKey !== 'xbox') return;
                applyFramingToObject(currentModel, 'xbox');
            },
            resetView() {
                const distance = lastFrame?.distance || 5;
                const radius = lastFrame?.radius || 1.2;
                const target = lastFrame?.target || { x: 0, y: 0, z: 0 };
                const cameraOffset = lastFrame?.cameraOffset || { x: 0, y: 0.08, z: 0 };
                camera.position.set(
                    target.x + radius * cameraOffset.x,
                    target.y + radius * cameraOffset.y,
                    distance + radius * (cameraOffset.z || 0)
                );
                controls.target.copy(target);
                if (currentModel) {
                    const rotation = currentModel.userData.xtweaksBaseRotation || lastFrame?.rotation;
                    if (rotation) currentModel.rotation.copy(rotation);
                    const base = currentModel.userData.xtweaksBasePosition;
                    if (base) currentModel.position.copy(base);
                }
                controls.update();
            },
            isActive() {
                return !disposed && Boolean(currentModel);
            },
            dispose() {
                disposed = true;
                cancelAnimationFrame(animationFrame);
                resizeObserver?.disconnect();
                if (currentModel) disposeObject3D(THREE, currentModel);
                controls.dispose();
                renderer.dispose();
                renderer.forceContextLoss?.();
            }
        };
    };

    const waitForViewerStageSize = async () => {
        for (let frame = 0; frame < 45; frame += 1) {
            const rect = stage?.getBoundingClientRect?.();
            if (page.classList.contains('active') && rect?.width > 16 && rect?.height > 16) return true;
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return false;
    };

    const ensureThreeViewer = async () => {
        if (threeViewer) {
            threeViewer.resize?.();
            return threeViewer;
        }
        if (threeViewerCreatePromise) {
            try {
                return await threeViewerCreatePromise;
            } catch (error) {
                setViewerFallback(`Three.js viewer failed to initialize - ${error.message || 'unavailable'}`);
                return null;
            }
        }
        try {
            threeViewerCreatePromise = (async () => {
                const hasSize = await waitForViewerStageSize();
                if (!hasSize) throw new Error('Viewer stage is not visible yet.');
                const viewer = await createThreeViewer();
                viewer.resize?.();
                threeViewer = viewer;
                return viewer;
            })();
            return await threeViewerCreatePromise;
        } catch (error) {
            setViewerFallback(`Three.js viewer failed to initialize - ${error.message || 'unavailable'}`);
            return null;
        } finally {
            threeViewerCreatePromise = null;
        }
    };

    const loadActiveModel = async ({ force = false } = {}) => {
        const viewer = await ensureThreeViewer();
        if (!viewer) return;
        viewer.resize?.();
        if (!force && viewer.hasModel?.()) return;
        await viewer.loadModel(activeModel);
    };

    const activateInputViewer = async ({ force = false } = {}) => {
        const serial = ++inputViewerActivationSerial;
        const hasSize = await waitForViewerStageSize();
        if (!hasSize || serial !== inputViewerActivationSerial) return;
        const viewer = await ensureThreeViewer();
        if (!viewer || serial !== inputViewerActivationSerial) return;
        viewer.resize?.();
        if (force || !viewer.hasModel?.()) await viewer.loadModel(activeModel);
    };

    const resetView = () => {
        if (threeViewer?.isActive()) {
            threeViewer.resetView();
            return;
        }
        rotationX = -8;
        rotationY = 0;
        updateFallbackTransform();
    };

    const getActiveTuningKey = () => activeModel === 'ps5' ? 'playstation' : 'xbox';

    const getActiveTuningLabel = () => activeModel === 'ps5' ? 'PlayStation' : 'Xbox';

    const getActiveFramingPreset = () => INPUT_MODEL_FRAMING[getActiveTuningKey()];

    const mirrorPlayStationPreset = () => {
        INPUT_MODEL_FRAMING.ps5 = JSON.parse(JSON.stringify(INPUT_MODEL_FRAMING.playstation));
    };

    const getTuneValue = (path) => {
        return path.split('.').reduce((value, key) => value?.[key], getActiveFramingPreset());
    };

    const setTuneValue = (path, value) => {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((object, key) => object[key], getActiveFramingPreset());
        target[lastKey] = Number(value);
        if (getActiveTuningKey() === 'playstation') mirrorPlayStationPreset();
    };

    const syncTunerField = (path) => {
        const value = getTuneValue(path);
        xboxTuner?.querySelectorAll(`[data-xbox-tune="${path}"], [data-xbox-tune-number="${path}"]`).forEach((input) => {
            input.value = value;
        });
    };

    const syncModelTunerLabels = () => {
        const label = getActiveTuningLabel();
        if (xboxTuneToggle) xboxTuneToggle.textContent = `Tune ${label}`;
        if (inputTunerTitle) inputTunerTitle.textContent = `Temporary ${label} Framing Tuner`;
    };

    const syncXboxTuner = () => {
        syncModelTunerLabels();
        xboxTuneFields.forEach(syncTunerField);
    };

    const applyXboxTunerValue = (path, value) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        setTuneValue(path, number);
        syncTunerField(path);
        threeViewer?.updateModelFraming?.(activeModel);
    };

    const setXboxTunerVisibleForModel = () => {
        if (!INPUT_XBOX_DECAL_TUNER_ENABLED) {
            if (xboxTuneToggle) xboxTuneToggle.hidden = true;
            if (xboxTuner) xboxTuner.hidden = true;
            return;
        }
        if (xboxTuneToggle) xboxTuneToggle.hidden = false;
        syncModelTunerLabels();
        if (xboxTuner && !xboxTuner.hidden) syncXboxTuner();
    };

    const clampTunerToViewport = (left, top) => {
        if (!xboxTuner) return { left, top };
        const rect = xboxTuner.getBoundingClientRect();
        const padding = 10;
        const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
        const maxTop = Math.max(padding, window.innerHeight - rect.height - padding);
        return {
            left: Math.min(Math.max(padding, left), maxLeft),
            top: Math.min(Math.max(padding, top), maxTop)
        };
    };

    const setTunerPosition = (left, top) => {
        if (!xboxTuner) return;
        const next = clampTunerToViewport(left, top);
        xboxTuner.style.left = `${next.left}px`;
        xboxTuner.style.top = `${next.top}px`;
        xboxTuner.style.right = 'auto';
    };

    const copyTextWithFallback = async (text) => {
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand?.('copy') || false;
            textarea.remove();
            return copied;
        }
    };

    const formatXboxPresetForCopy = () => {
        const presetKey = getActiveTuningKey();
        const preset = getActiveFramingPreset();
        const value = (number) => Number(number).toFixed(2).replace(/\.00$/, '');
        return `const ${presetKey} = {
    distanceMultiplier: ${value(preset.distanceMultiplier)},
    scaleMultiplier: ${value(preset.scaleMultiplier)},
    positionOffset: { x: ${value(preset.positionOffset.x)}, y: ${value(preset.positionOffset.y)}, z: ${value(preset.positionOffset.z)} },
    targetOffset: { x: ${value(preset.targetOffset.x)}, y: ${value(preset.targetOffset.y)}, z: ${value(preset.targetOffset.z)} },
    cameraOffset: { x: ${value(preset.cameraOffset.x)}, y: ${value(preset.cameraOffset.y)}, z: ${value(preset.cameraOffset.z)} },
    rotation: { x: ${value(preset.rotation.x)}, y: ${value(preset.rotation.y)}, z: ${value(preset.rotation.z)} }
};`;
    };

    const setActiveModel = (model) => {
        activeModel = model === 'ps5' ? 'ps5' : 'xbox';
        page.querySelectorAll('[data-input-model]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.inputModel === activeModel);
        });
        setXboxTunerVisibleForModel();
        if (page.classList.contains('active')) loadActiveModel({ force: true });
    };

    page.querySelectorAll('[data-input-model]').forEach((btn) => {
        btn.addEventListener('click', () => setActiveModel(btn.dataset.inputModel));
    });

    document.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', () => {
            if (item.dataset.page !== 'input' && xboxTuner) xboxTuner.hidden = true;
            if (item.dataset.page === 'input') activateInputViewer();
        });
    });

    const inputPageObserver = new MutationObserver(() => {
        if (page.classList.contains('active')) activateInputViewer();
    });
    inputPageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });

    document.getElementById('input-reset-view')?.addEventListener('click', resetView);

    xboxTuneToggle?.addEventListener('click', () => {
        if (!INPUT_XBOX_DECAL_TUNER_ENABLED) return;
        if (!xboxTuner) return;
        xboxTuner.hidden = !xboxTuner.hidden;
        if (!xboxTuner.hidden) {
            syncXboxTuner();
        }
    });

    xboxTunerCloseBtn?.addEventListener('click', () => {
        if (xboxTuner) xboxTuner.hidden = true;
    });

    xboxTuner?.querySelector('.input-tuner-head')?.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        const rect = xboxTuner.getBoundingClientRect();
        isTunerDragging = true;
        tunerDragStart = {
            x: event.clientX,
            y: event.clientY,
            left: rect.left,
            top: rect.top
        };
        xboxTuner.classList.add('is-dragging');
        xboxTuner.setPointerCapture?.(event.pointerId);
    });

    xboxTuner?.addEventListener('pointermove', (event) => {
        if (!isTunerDragging) return;
        setTunerPosition(
            tunerDragStart.left + event.clientX - tunerDragStart.x,
            tunerDragStart.top + event.clientY - tunerDragStart.y
        );
    });

    const endTunerDrag = (event) => {
        if (!isTunerDragging) return;
        isTunerDragging = false;
        xboxTuner?.classList.remove('is-dragging');
        xboxTuner?.releasePointerCapture?.(event.pointerId);
    };
    xboxTuner?.addEventListener('pointerup', endTunerDrag);
    xboxTuner?.addEventListener('pointercancel', endTunerDrag);
    window.addEventListener('resize', () => {
        if (!xboxTuner || xboxTuner.hidden || !xboxTuner.style.left) return;
        const rect = xboxTuner.getBoundingClientRect();
        setTunerPosition(rect.left, rect.top);
    });

    xboxTuner?.querySelectorAll('[data-xbox-tune], [data-xbox-tune-number]').forEach((input) => {
        const path = input.dataset.xboxTune || input.dataset.xboxTuneNumber;
        input.addEventListener('input', () => applyXboxTunerValue(path, input.value));
        input.addEventListener('change', () => applyXboxTunerValue(path, input.value));
    });

    xboxResetSlidersBtn?.addEventListener('click', () => {
        if (getActiveTuningKey() === 'playstation') {
            INPUT_MODEL_FRAMING.playstation = JSON.parse(JSON.stringify(defaultPlayStationFraming));
            mirrorPlayStationPreset();
        } else {
            INPUT_MODEL_FRAMING.xbox = JSON.parse(JSON.stringify(defaultXboxFraming));
        }
        syncXboxTuner();
        threeViewer?.updateModelFraming?.(activeModel);
    });

    xboxCopyValuesBtn?.addEventListener('click', async () => {
        const text = formatXboxPresetForCopy();
        const copied = await copyTextWithFallback(text);

        if (copied) {
            xboxCopyValuesBtn.textContent = 'Copied';
        } else {
            console.info(`[INPUT 3D] ${getActiveTuningLabel()} framing values:`, text);
            xboxCopyValuesBtn.textContent = 'Logged';
        }
        window.setTimeout(() => {
            xboxCopyValuesBtn.textContent = 'Copy Values';
        }, 1200);
    });

    stage?.addEventListener('pointerdown', (event) => {
        if (threeViewer?.isActive()) return;
        isDragging = true;
        dragStart = { x: event.clientX, y: event.clientY, rx: rotationX, ry: rotationY };
        stage.setPointerCapture?.(event.pointerId);
        stage.classList.add('is-dragging');
    });

    stage?.addEventListener('pointermove', (event) => {
        if (threeViewer?.isActive()) return;
        if (!isDragging) return;
        rotationY = dragStart.ry + (event.clientX - dragStart.x) * 0.35;
        rotationX = Math.max(-28, Math.min(18, dragStart.rx - (event.clientY - dragStart.y) * 0.25));
        updateFallbackTransform();
    });

    const endDrag = (event) => {
        isDragging = false;
        stage?.releasePointerCapture?.(event.pointerId);
        stage?.classList.remove('is-dragging');
    };
    stage?.addEventListener('pointerup', endDrag);
    stage?.addEventListener('pointercancel', endDrag);
    stage?.addEventListener('pointerleave', () => {
        isDragging = false;
        stage.classList.remove('is-dragging');
    });

    document.getElementById('input-apply-btn')?.addEventListener('click', () => {
        showNotification('warning', 'Input Tweaks UI Ready', 'No system-wide input tweaks were applied yet.');
    });

    const refreshAssignment = () => {
        if (selectedButtonEl) selectedButtonEl.textContent = selectedButton;
        if (assignmentSelect) assignmentSelect.value = profile[selectedButton] || selectedButton;
    };

    document.querySelectorAll('#input-button-list button').forEach((btn) => {
        btn.addEventListener('click', () => {
            selectedButton = btn.dataset.button || btn.textContent.trim();
            document.querySelectorAll('#input-button-list button').forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');
            refreshAssignment();
        });
    });

    assignmentSelect?.addEventListener('change', () => {
        profile[selectedButton] = assignmentSelect.value;
        if (profileStatus) profileStatus.textContent = 'Unsaved local profile changes.';
    });

    document.getElementById('input-save-profile')?.addEventListener('click', () => {
        if (assignmentSelect) profile[selectedButton] = assignmentSelect.value;
        localStorage.setItem(profileKey, JSON.stringify(profile));
        if (profileStatus) profileStatus.textContent = 'Profile saved in XTweaks - system-wide remap not active yet.';
        showNotification('success', 'Input Profile Saved', 'Profile saved in XTweaks - system-wide remap not active yet.');
    });

    const resetLiveReadout = () => {
        setText('input-left-x', '0.00');
        setText('input-left-y', '0.00');
        setText('input-right-x', '0.00');
        setText('input-right-y', '0.00');
        setText('input-left-trigger', '0.00');
        setText('input-right-trigger', '0.00');
        setText('input-polling', 'Unavailable');
        if (activeButtonsEl) activeButtonsEl.textContent = 'None';
        lastTimestamp = null;
        pollingSamples = [];
    };

    const updateGamepadState = () => {
        const supported = 'getGamepads' in navigator;
        if (!supported) {
            if (apiPill) apiPill.textContent = 'Unavailable';
            resetLiveReadout();
            requestAnimationFrame(updateGamepadState);
            return;
        }

        if (apiPill) apiPill.textContent = 'Available';
        const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
        const pad = pads[0];

        if (!pad) {
            resetLiveReadout();
            requestAnimationFrame(updateGamepadState);
            return;
        }

        const axes = pad.axes || [];
        setText('input-left-x', formatAxis(axes[0]));
        setText('input-left-y', formatAxis(axes[1]));
        setText('input-right-x', formatAxis(axes[2]));
        setText('input-right-y', formatAxis(axes[3]));
        setText('input-left-trigger', formatAxis(pad.buttons?.[6]?.value));
        setText('input-right-trigger', formatAxis(pad.buttons?.[7]?.value));

        const active = (pad.buttons || [])
            .map((button, index) => button?.pressed ? (buttonNames[index] || `Button ${index}`) : null)
            .filter(Boolean);
        if (activeButtonsEl) activeButtonsEl.textContent = active.length ? active.join(', ') : 'None';

        if (Number.isFinite(pad.timestamp) && pad.timestamp > 0 && lastTimestamp !== null && pad.timestamp !== lastTimestamp) {
            const delta = pad.timestamp - lastTimestamp;
            if (delta > 0 && delta < 100) {
                pollingSamples.push(delta);
                if (pollingSamples.length > 36) pollingSamples.shift();
            }
        }
        lastTimestamp = Number.isFinite(pad.timestamp) ? pad.timestamp : null;

        if (pollingSamples.length >= 12) {
            const avg = pollingSamples.reduce((sum, value) => sum + value, 0) / pollingSamples.length;
            const hz = Math.round(1000 / avg);
            setText('input-polling', Number.isFinite(hz) ? `${hz} Hz` : 'Unavailable');
        } else {
            setText('input-polling', 'Unavailable');
        }

        requestAnimationFrame(updateGamepadState);
    };

    window.addEventListener('gamepadconnected', () => {
        lastTimestamp = null;
        pollingSamples = [];
    });
    window.addEventListener('gamepaddisconnected', resetLiveReadout);
    window.addEventListener('beforeunload', () => threeViewer?.dispose(), { once: true });

    refreshAssignment();
    syncXboxTuner();
    setXboxTunerVisibleForModel();
    setActiveModel(activeModel);
    updateGamepadState();
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
    const STEPS = ['scan', 'review', 'clean', 'verify'];

    // ── Pipeline state ───────────────────────────────────────────
    function setPipelineStep(activeStep) {
        document.querySelectorAll('#page-cleanup .cu-pipe-step').forEach(el => {
            const step = el.dataset.step;
            el.classList.toggle('cu-pipe-active', step === activeStep);
        });
    }
    // Initially no step active
    setPipelineStep(null);

    // ── Helpers ──────────────────────────────────────────────────
    function fmtBytes(b) {
        if (!b || b <= 0) return null;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), 3);
        return parseFloat((b / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function scanLabel(type, data) {
        if (!data) return 'Unable to inspect';
        switch (type) {
            case 'temp': {
                const s = fmtBytes(data.bytes);
                if (s) return `${s} found`;
                return data.count > 0 ? `${data.count} files found` : 'Nothing to clean';
            }
            case 'dns':
                return data.entries > 0 ? `${data.entries} entries cached` : 'Cache empty';
            case 'recycle': {
                const s = fmtBytes(data.bytes);
                if (s) return `${s} in Bin`;
                return data.count > 0 ? `${data.count} items found` : 'Bin is empty';
            }
            case 'prefetch':
                return data.count > 0 ? `${data.count} files found` : 'Nothing to clean';
            case 'windows-update': {
                const s = fmtBytes(data.bytes);
                if (s) return `${s} found`;
                return data.count > 0 ? `${data.count} files found` : 'Nothing to clean';
            }
            default: return 'Unknown';
        }
    }

    function hasFindings(type, data) {
        if (!data) return false;
        switch (type) {
            case 'temp':           return data.count > 0 || data.bytes > 0;
            case 'dns':            return data.entries > 0;
            case 'recycle':        return data.count > 0 || data.bytes > 0;
            case 'prefetch':       return data.count > 0;
            case 'windows-update': return data.count > 0 || data.bytes > 0;
            default: return false;
        }
    }

    function addLogRow(msg, state = 'idle', timeStr = null) {
        const body = document.querySelector('#page-cleanup .cu-log-body');
        if (!body) return;
        const row = document.createElement('div');
        row.className = 'cu-log-row';
        const dot = document.createElement('span');
        dot.className = `cu-log-dot cu-dot-${state}`;
        const msgEl = document.createElement('span');
        msgEl.className = 'cu-log-msg';
        msgEl.textContent = msg;
        const timeEl = document.createElement('span');
        timeEl.className = 'cu-log-time';
        timeEl.textContent = timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        row.append(dot, msgEl, timeEl);
        body.prepend(row);
        // Keep at most 8 rows
        while (body.children.length > 8) body.removeChild(body.lastChild);
    }

    function setCardStatus(card, label, state = 'ready') {
        const statusEl = card.querySelector('.cu-card-status');
        if (statusEl) {
            statusEl.textContent = label;
            statusEl.dataset.state = state;
        }
    }

    // ── Scan ─────────────────────────────────────────────────────
    const scanBtn = document.getElementById('cu-scan-btn');
    let scanResults = null;

    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            if (scanBtn.disabled) return;
            scanBtn.disabled = true;
            const labelEl = scanBtn.querySelector('.cu-scan-btn-label');
            if (labelEl) labelEl.textContent = 'Scanning…';
            scanBtn.classList.add('cu-scan-btn--running');

            setPipelineStep('scan');

            // Reset card statuses
            document.querySelectorAll('#page-cleanup .cleanup-card').forEach(c => {
                setCardStatus(c, 'Scanning…', 'scanning');
                const btn = c.querySelector('.cleanup-btn');
                if (btn) btn.disabled = true;
            });

            try {
                scanResults = await window.electronAPI.scanCleanup();
                setPipelineStep('review');
                addLogRow('Scan completed — review results below', 'success');

                document.querySelectorAll('#page-cleanup .cleanup-card').forEach(card => {
                    const type = card.dataset.cleanup;
                    const data = scanResults?.[type] ?? null;
                    const label = scanLabel(type, data);
                    const found = hasFindings(type, data);
                    setCardStatus(card, label, found ? 'found' : 'clean');
                    const btn = card.querySelector('.cleanup-btn');
                    if (btn) btn.disabled = !found;
                    addLogRow(`${card.querySelector('.cu-card-title')?.textContent || type} · ${label}`, found ? 'found' : 'clean');
                });
            } catch (err) {
                setPipelineStep(null);
                addLogRow('Scan failed — check permissions', 'error');
                document.querySelectorAll('#page-cleanup .cleanup-card').forEach(c => {
                    setCardStatus(c, 'Scan failed', 'error');
                    const btn = c.querySelector('.cleanup-btn');
                    if (btn) btn.disabled = false;
                });
            } finally {
                scanBtn.disabled = false;
                scanBtn.classList.remove('cu-scan-btn--running');
                if (labelEl) labelEl.textContent = 'Scan System';
            }
        });
    }

    // ── Clean buttons ────────────────────────────────────────────
    document.querySelectorAll('#page-cleanup .cleanup-card').forEach(card => {
        const cleanupType = card.dataset.cleanup;
        const cleanBtn = card.querySelector('.cleanup-btn');
        if (!cleanBtn) return;

        cleanBtn.addEventListener('click', async () => {
            if (cleanBtn.disabled) return;
            cleanBtn.disabled = true;
            cleanBtn.textContent = 'Cleaning…';
            setPipelineStep('clean');

            const title = card.querySelector('.cu-card-title')?.textContent || cleanupType;
            addLogRow(`${title} · Cleaning…`, 'idle');

            try {
                const result = await window.electronAPI.runCleanup(cleanupType);

                if (result.success) {
                    setCardStatus(card, 'Cleaned', 'clean');
                    addLogRow(`${title} · Cleaned successfully`, 'success');
                    showNotification('success', 'Cleanup Complete', result.message);
                    setPipelineStep('verify');

                    // Re-scan this category to verify
                    try {
                        const fresh = await window.electronAPI.scanCleanup();
                        const data = fresh?.[cleanupType] ?? null;
                        const label = scanLabel(cleanupType, data);
                        const found = hasFindings(cleanupType, data);
                        setCardStatus(card, found ? label : 'Verified clean', found ? 'found' : 'clean');
                        addLogRow(`${title} · Verify: ${found ? label : 'clean'}`, found ? 'found' : 'success');
                        scanResults = fresh;
                    } catch {}
                } else {
                    setCardStatus(card, 'Failed', 'error');
                    addLogRow(`${title} · Cleanup failed`, 'error');
                    showNotification('error', 'Cleanup Failed', result.message);
                    cleanBtn.disabled = false;
                    setPipelineStep('review');
                }
            } catch (error) {
                setCardStatus(card, 'Error', 'error');
                addLogRow(`${title} · Error: ${error.message}`, 'error');
                showNotification('error', 'Error', error.message);
                cleanBtn.disabled = false;
                setPipelineStep('review');
            } finally {
                cleanBtn.textContent = 'Clean';
            }
        });
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

function showNotification(type, title, message, options = {}) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    if (options.key) {
        container.querySelectorAll(`[data-notification-key="${options.key}"]`).forEach((existing) => {
            existing.remove();
        });
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    if (options.key) {
        notification.dataset.notificationKey = options.key;
    }

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
    }, options.duration || 5000);
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

    // Discord links inside dashboard
    document.querySelectorAll('a[data-social="discord"]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const url = a.getAttribute('href');
            try { window.electronAPI.openExternal(url); }
            catch { window.open(url, '_blank'); }
        });
    });

    // Global search — filter across toggle/tweak/cleanup cards by title text
    // Network cards (data-net-cat) are excluded here; applyNetworkFilter() handles them
    const search = document.getElementById('global-search');
    if (search) {
        search.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            const cards = document.querySelectorAll('.toggle-card:not([data-net-cat]), .tweak-card, .cleanup-card, .slider-card');
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

const GAME_TUNE_PROFILES = [
    {
        id: 'fortnite',
        name: 'Fortnite',
        category: 'Battle Royale',
        status: 'Wired',
        image: 'assets/games/Fortnite.png',
        tone: 'violet',
        description: 'Competitive profile with Fortnite-specific and system-level tweaks.',
        optimizeTweaks: ['fortnite-priority', 'fortnite-clear-cache', 'optimize-power-plan', 'optimize-visual-effects', 'disable-xbox-services'],
        sections: [
            {
                title: 'FPS',
                items: [
                    { type: 'slider', label: 'FPS Limit', value: 240, min: 30, max: 360, step: 10, unit: ' FPS' },
                    { type: 'toggle', label: 'Multithreaded Rendering', detail: 'Use all available CPU cores.', tweakId: 'toggle-fn-multithreaded', defaultChecked: true },
                    { type: 'button', label: 'Fortnite High Priority', detail: 'Set Fortnite process scheduling priority.', tweakId: 'fortnite-priority' }
                ]
            },
            {
                title: 'Graphics',
                items: [
                    { type: 'slider', label: '3D Resolution Scale', value: 100, min: 50, max: 100, step: 5, unit: '%' },
                    { type: 'slider', label: 'View Distance', value: 3, min: 1, max: 4, step: 1, labels: ['Near', 'Medium', 'Far', 'Epic'] },
                    { type: 'slider', label: 'Effects Quality', value: 1, min: 1, max: 4, step: 1, labels: ['Low', 'Medium', 'High', 'Epic'] }
                ]
            },
            {
                title: 'Latency',
                items: [
                    { type: 'button', label: 'Timer Resolution', detail: 'Sharpen timing precision for competitive play.', tweakId: 'timer-resolution' },
                    { type: 'button', label: 'High Performance Power', detail: 'Keep CPU and GPU clocks stable.', tweakId: 'optimize-power-plan' }
                ]
            },
            {
                title: 'Input',
                items: [
                    { type: 'button', label: 'Disable Xbox Services', detail: 'Reduce unused gaming overlay services.', tweakId: 'disable-xbox-services' },
                    { type: 'toggle', label: 'NVIDIA Highlights', detail: 'Background clip capture.', tweakId: 'toggle-fn-nvidia-highlights' }
                ]
            },
            {
                title: 'Network',
                items: [
                    { type: 'button', label: 'Disable Nagle Algorithm', detail: 'Lower TCP packet delay for supported adapters.', tweakId: 'disable-nagle' },
                    { type: 'button', label: 'Network Throttling', detail: 'Remove Windows network throttling.', tweakId: 'optimize-network-throttling' }
                ]
            },
            {
                title: 'System',
                items: [
                    { type: 'button', label: 'Clear Fortnite Cache', detail: 'Remove stale cache files that can stutter.', tweakId: 'fortnite-clear-cache' },
                    { type: 'button', label: 'Optimize Visual Effects', detail: 'Free system UI rendering overhead.', tweakId: 'optimize-visual-effects' }
                ]
            }
        ]
    },
    {
        id: 'apex',
        name: 'Apex Legends',
        category: 'Battle Royale',
        status: 'Template',
        image: 'assets/games/Apex Legends.jpg',
        tone: 'teal',
        description: 'Fast-paced shooter profile ready for per-game wiring.',
        sections: []
    },
    {
        id: 'cod',
        name: 'Call of Duty / Warzone',
        category: 'FPS',
        status: 'Template',
        image: 'assets/games/Call of Duty  Warzone.jpg',
        tone: 'steel',
        description: 'FPS profile scaffold for latency, graphics, and network tuning.',
        sections: []
    },
    {
        id: 'cs2',
        name: 'Counter-Strike 2',
        category: 'FPS',
        status: 'Template',
        image: 'assets/games/csgo 2.jpg',
        tone: 'amber',
        description: 'Competitive shooter profile scaffold.',
        sections: []
    },
    {
        id: 'valorant',
        name: 'Valorant',
        category: 'FPS',
        status: 'Template',
        image: 'assets/games/valorant-game.jpg',
        tone: 'rose',
        description: 'Tactical shooter profile scaffold.',
        sections: []
    },
    {
        id: 'overwatch-2',
        name: 'Overwatch 2',
        category: 'Hero Shooter',
        status: 'Template',
        image: 'assets/games/Overwatch 2.jpg',
        tone: 'blue',
        description: 'Hero shooter profile scaffold.',
        sections: []
    },
    {
        id: 'rainbow-six-siege',
        name: 'Rainbow Six Siege',
        category: 'FPS',
        status: 'Template',
        image: 'assets/games/Rainbow 6 Seige.jpg',
        tone: 'silver',
        description: 'Tactical shooter profile scaffold.',
        sections: []
    },
    {
        id: 'pubg',
        name: 'PUBG: Battlegrounds',
        category: 'Battle Royale',
        status: 'Template',
        image: 'assets/games/pubg-battlegrounds-16v1j.jpg',
        tone: 'amber',
        description: 'Battle royale profile scaffold.',
        sections: []
    },
    {
        id: 'the-finals',
        name: 'The Finals',
        category: 'FPS',
        status: 'Template',
        image: 'assets/games/The finals.png',
        tone: 'teal',
        description: 'Arena shooter profile scaffold.',
        sections: []
    }
];

function initializeGameTunePage() {
    const page = document.getElementById('page-fortnite');
    if (!page) return;

    const grid = document.getElementById('game-tune-grid');
    const chips = document.getElementById('game-tune-chips');
    const search = document.getElementById('game-tune-search');
    const empty = document.getElementById('game-tune-empty');
    const count = document.getElementById('game-tune-count');
    const gridView = document.getElementById('game-tune-grid-view');
    const editor = document.getElementById('game-tune-editor');
    const editorTitle = document.getElementById('game-tune-editor-title');
    const editorSub = document.getElementById('game-tune-editor-sub');
    const editorGrid = document.getElementById('game-tune-editor-grid');
    const editorOptimize = document.getElementById('game-tune-editor-optimize');
    const backBtn = document.getElementById('game-tune-back');
    const devToggle = document.getElementById('game-tune-dev-toggle');
    const devPanel = document.getElementById('game-tune-dev-panel');
    const devTarget = document.getElementById('gt-anim-target');
    const respectMotionToggle = document.getElementById('gt-anim-respect-motion');
    if (!grid || !chips || !search || !gridView || !editor || !editorGrid) return;

    const categories = ['All', ...Array.from(new Set(GAME_TUNE_PROFILES.map(game => game.category)))];
    let activeCategory = 'All';
    let activeGame = GAME_TUNE_PROFILES[0];
    const animDefaults = {
        duration: 620,
        stagger: 85,
        slideX: 0,
        slideY: 18,
        blur: 2,
        opacity: 0.05,
        scale: 0.98,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    };
    const allAnim = { ...animDefaults };
    const gameAnimOverrides = new Map();
    let activeAnimTarget = 'all';

    const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

    const getSections = (game) => game.sections?.length ? game.sections : [
        {
            title: 'FPS',
            items: [
                { type: 'slider', label: 'Frame Target', value: 165, min: 60, max: 360, step: 15, unit: ' FPS' },
                { type: 'button', label: 'Power Plan', detail: 'Apply the shared high performance profile.', tweakId: 'optimize-power-plan' }
            ]
        },
        {
            title: 'Latency',
            items: [
                { type: 'button', label: 'Timer Resolution', detail: 'Shared competitive timing tweak.', tweakId: 'timer-resolution' },
                { type: 'button', label: 'Disable Nagle Algorithm', detail: 'Shared low-latency network tweak.', tweakId: 'disable-nagle' }
            ]
        },
        {
            title: 'Graphics',
            items: [
                { type: 'slider', label: 'Render Scale', value: 100, min: 70, max: 100, step: 5, unit: '%' },
                { type: 'button', label: 'Visual Effects', detail: 'Reduce Windows visual overhead.', tweakId: 'optimize-visual-effects' }
            ]
        },
        {
            title: 'Input',
            items: [
                { type: 'button', label: 'Disable Xbox Services', detail: 'Remove unused gaming services.', tweakId: 'disable-xbox-services' },
                { type: 'toggle', label: 'Focus Input Path', detail: 'Local placeholder setting.' }
            ]
        },
        {
            title: 'Network',
            items: [
                { type: 'button', label: 'Network Throttling', detail: 'Shared network throughput tweak.', tweakId: 'optimize-network-throttling' }
            ]
        },
        {
            title: 'System',
            items: [
                { type: 'toggle', label: 'Quiet Background Apps', detail: 'Local placeholder setting.' }
            ]
        }
    ];

    const profileHasRealOptimize = (game) => Array.isArray(game.optimizeTweaks) && game.optimizeTweaks.length > 0;

    const getAnimConfig = (gameId) => ({
        ...allAnim,
        ...(gameId && gameAnimOverrides.get(gameId) ? gameAnimOverrides.get(gameId) : {})
    });

    const getCurrentAnimConfig = () => activeAnimTarget === 'all'
        ? allAnim
        : getAnimConfig(activeAnimTarget);

    const writeCurrentAnimConfig = (patch) => {
        if (activeAnimTarget === 'all') {
            Object.assign(allAnim, patch);
            return;
        }
        gameAnimOverrides.set(activeAnimTarget, {
            ...getAnimConfig(activeAnimTarget),
            ...patch
        });
    };

    const getVisibleGameCards = () => Array.from(grid.querySelectorAll('.game-card[data-game-id]')).filter(card => !card.closest('[hidden]'));

    const getAnimTargetLabel = (targetId) => {
        if (targetId === 'all') return 'All cards';
        return GAME_TUNE_PROFILES.find(game => game.id === targetId)?.name || targetId || 'Unknown';
    };

    const getSelectLabel = (select, value) => Array.from(select?.options || []).find(option => option.value === value)?.textContent || value || '';

    const setCustomMenuOpen = (key, open) => {
        const button = document.getElementById(`gt-anim-${key}-button`);
        const menu = document.getElementById(`gt-anim-${key}-menu`);
        if (!button || !menu) return;
        ['target', 'easing'].forEach(otherKey => {
            if (otherKey === key) return;
            const otherButton = document.getElementById(`gt-anim-${otherKey}-button`);
            const otherMenu = document.getElementById(`gt-anim-${otherKey}-menu`);
            if (otherButton && otherMenu) {
                otherMenu.hidden = true;
                otherButton.setAttribute('aria-expanded', 'false');
            }
        });
        menu.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
    };

    const syncCustomSelect = (key) => {
        const select = document.getElementById(`gt-anim-${key}`);
        const button = document.getElementById(`gt-anim-${key}-button`);
        const menu = document.getElementById(`gt-anim-${key}-menu`);
        if (!select || !button || !menu) return;
        button.textContent = getSelectLabel(select, select.value);
        menu.innerHTML = Array.from(select.options).map(option => (
            `<button type="button" role="option" data-value="${safeText(option.value)}" aria-selected="${option.value === select.value ? 'true' : 'false'}">${safeText(option.textContent)}</button>`
        )).join('');
    };

    const animateCards = (targetId = 'all', options = {}) => {
        const reduceMotion = Boolean(respectMotionToggle?.checked) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cards = getVisibleGameCards();
        const targetCards = targetId === 'all'
            ? cards
            : cards.filter(card => card.dataset.gameId === targetId);

        const getStartState = (config) => {
            const startOpacity = Math.max(0, Math.min(0.95, Number(config.opacity)));
            const startScale = Math.max(0.78, Math.min(1.12, Number(config.scale)));
            const slideX = Number(config.slideX) || 0;
            const slideY = Number(config.slideY) || 0;
            const blur = Math.max(0, Number(config.blur) || 0);
            return {
                opacity: startOpacity,
                transform: `translate3d(${slideX}px, ${slideY}px, 0) scale(${startScale})`,
                filter: `blur(${blur}px)`
            };
        };

        const resetCardAnimationState = (card) => {
            if (card._gameTuneAnimTimer) {
                window.clearTimeout(card._gameTuneAnimTimer);
                card._gameTuneAnimTimer = null;
            }
            card.classList.remove('game-card-enter');
            card.style.removeProperty('--gt-enter-opacity');
            card.style.removeProperty('--gt-enter-transform');
            card.style.removeProperty('--gt-enter-filter');
            card.style.removeProperty('--gt-enter-duration');
            card.style.removeProperty('--gt-enter-delay');
            card.style.removeProperty('--gt-enter-easing');
        };

        if (targetCards.length === 0) {
            return;
        }

        if (reduceMotion) {
            targetCards.forEach(resetCardAnimationState);
            return;
        }

        targetCards.forEach((card, targetIndex) => {
            resetCardAnimationState(card);
            const config = getAnimConfig(card.dataset.gameId);
            const start = getStartState(config);
            const delay = targetId === 'all'
                ? Math.max(0, targetIndex) * Number(config.stagger || 0)
                : 0;
            const duration = Number(config.duration) || animDefaults.duration;
            card.style.setProperty('--gt-enter-opacity', String(start.opacity));
            card.style.setProperty('--gt-enter-transform', start.transform);
            card.style.setProperty('--gt-enter-filter', start.filter);
            card.style.setProperty('--gt-enter-duration', `${duration}ms`);
            card.style.setProperty('--gt-enter-delay', `${delay}ms`);
            card.style.setProperty('--gt-enter-easing', config.easing || animDefaults.easing);
        });

        if (targetCards[0]) targetCards[0].getBoundingClientRect();

        requestAnimationFrame(() => {
            targetCards.forEach((card) => {
                const config = getAnimConfig(card.dataset.gameId);
                const delay = Number.parseFloat(card.style.getPropertyValue('--gt-enter-delay')) || 0;
                const duration = Number(config.duration) || animDefaults.duration;
                card.classList.add('game-card-enter');
                card._gameTuneAnimTimer = window.setTimeout(() => {
                    resetCardAnimationState(card);
                }, delay + duration + 80);
            });
        });
    };

    window.replayGameTuneCards = () => {
        if (!page.classList.contains('active') || editor.hidden === false) return;
        requestAnimationFrame(() => animateCards('all', { fromPageVisit: true }));
    };

    const renderChips = () => {
        chips.innerHTML = categories.map(cat => (
            `<button class="game-tune-chip${cat === activeCategory ? ' is-active' : ''}" type="button" data-category="${safeText(cat)}">${safeText(cat)}</button>`
        )).join('');
    };

    const renderAnimTargets = () => {
        if (!devTarget) return;
        devTarget.innerHTML = [
            '<option value="all">All cards</option>',
            ...GAME_TUNE_PROFILES.map(game => `<option value="${safeText(game.id)}">${safeText(game.name)}</option>`)
        ].join('');
        devTarget.value = activeAnimTarget;
        syncCustomSelect('target');
    };

    const cardImage = (game) => {
        if (game.image) {
            return `<img src="${safeText(game.image)}" alt="${safeText(game.name)} banner" loading="lazy">`;
        }
        return `<div class="game-card-placeholder" data-tone="${safeText(game.tone)}"><span>${safeText(game.name)}</span></div>`;
    };

    const renderCards = () => {
        const query = search.value.trim().toLowerCase();
        const visibleGames = GAME_TUNE_PROFILES.filter(game => {
            const categoryOk = activeCategory === 'All' || game.category === activeCategory;
            const text = `${game.name} ${game.category} ${game.description}`.toLowerCase();
            return categoryOk && (!query || text.includes(query));
        });

        grid.innerHTML = visibleGames.map(game => `
            <article class="game-card" data-game-id="${safeText(game.id)}" tabindex="0" aria-label="Open ${safeText(game.name)} editor">
                <span class="tc-aurora" aria-hidden="true"></span>
                <span class="tc-accent" aria-hidden="true"></span>
                <div class="game-card-media">${cardImage(game)}</div>
                <div class="game-card-body">
                    <div class="game-card-title-row">
                        <h3>${safeText(game.name)}</h3>
                        <span class="game-status-dot${profileHasRealOptimize(game) ? ' is-wired' : ''}" title="${safeText(game.status)}"></span>
                    </div>
                    <span class="pcard-cat-pill">${safeText(game.category)}</span>
                    <p>${safeText(game.description)}</p>
                    <div class="game-card-actions">
                        <button class="pcard-btn-primary game-optimize-btn" type="button" data-game-id="${safeText(game.id)}">Optimize</button>
                        <button class="pcard-btn-secondary game-editor-btn" type="button" data-game-id="${safeText(game.id)}">Open Editor</button>
                    </div>
                </div>
            </article>
        `).join('');

        if (empty) empty.hidden = visibleGames.length > 0;
        if (count) count.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? 'game' : 'games'}`;

        grid.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
                card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
            });
        });

        requestAnimationFrame(() => animateCards('all'));
    };

    const applyGameOptimize = async (game, trigger) => {
        if (!game) return;
        const originalText = trigger?.textContent;
        if (trigger) {
            trigger.disabled = true;
            trigger.textContent = 'Optimizing...';
        }

        try {
            if (profileHasRealOptimize(game)) {
                const results = [];
                for (const tweakId of game.optimizeTweaks) {
                    results.push(await window.electronAPI.applyTweak(tweakId, 'apply'));
                }
                const failed = results.find(result => !result?.success);
                if (failed) {
                    showNotification('error', `${game.name} Optimize Failed`, failed.message || 'One tweak could not be applied.');
                } else {
                    showNotification('success', `${game.name} Optimized`, 'Profile tweaks applied successfully.');
                }
            } else {
                showNotification('warning', `${game.name} Profile`, 'This profile is ready in the UI. Per-game optimize commands are not wired yet.');
            }
        } catch (error) {
            showNotification('error', `${game.name} Optimize Failed`, error.message || 'Unexpected error.');
        } finally {
            if (trigger) {
                trigger.disabled = false;
                trigger.textContent = originalText || 'Optimize';
            }
        }
    };

    const renderControl = (game, section, item, index) => {
        const key = `${game.id}-${section.title}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (item.type === 'slider') {
            const valueText = item.labels ? item.labels[Math.max(0, Number(item.value) - Number(item.min))] : `${item.value}${item.unit || ''}`;
            const marks = item.labels ? item.labels : [item.min, Math.round((item.min + item.max) / 2), item.max].map(v => `${v}${item.unit || ''}`);
            return `
                <div class="game-editor-control game-editor-slider">
                    <div class="slider-header">
                        <span class="slider-label">${safeText(item.label)}</span>
                        <span class="slider-value" id="${key}-value">${safeText(valueText)}</span>
                    </div>
                    <input type="range" class="custom-slider game-tune-range" id="${key}" min="${item.min}" max="${item.max}" step="${item.step}" value="${item.value}" data-labels="${safeText((item.labels || []).join('|'))}" data-unit="${safeText(item.unit || '')}">
                    <div class="slider-marks">${marks.map(mark => `<span>${safeText(mark)}</span>`).join('')}</div>
                </div>
            `;
        }

        if (item.type === 'toggle') {
            return `
                <div class="game-editor-control game-editor-toggle">
                    <div>
                        <h4>${safeText(item.label)}</h4>
                        <p>${safeText(item.detail || 'Local profile setting.')}</p>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" ${item.defaultChecked ? 'checked' : ''} data-game-toggle="${safeText(item.tweakId || '')}">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `;
        }

        return `
            <div class="game-editor-control game-editor-button">
                <div>
                    <h4>${safeText(item.label)}</h4>
                    <p>${safeText(item.detail || 'Apply this profile action.')}</p>
                </div>
                <button class="pcard-btn-secondary game-editor-action" type="button" data-tweak-id="${safeText(item.tweakId || '')}">Apply</button>
            </div>
        `;
    };

    const openEditor = (game) => {
        activeGame = game || GAME_TUNE_PROFILES[0];
        editorTitle.textContent = activeGame.name;
        editorSub.textContent = activeGame.description;
        editorOptimize.textContent = `Optimize ${activeGame.name}`;
        editorGrid.innerHTML = getSections(activeGame).map(section => `
            <section class="game-editor-card">
                <span class="tc-aurora" aria-hidden="true"></span>
                <div class="game-editor-card-head">
                    <span class="game-tune-eyebrow-sm">${safeText(section.title)}</span>
                </div>
                <div class="game-editor-controls">
                    ${section.items.map((item, index) => renderControl(activeGame, section, item, index)).join('')}
                </div>
            </section>
        `).join('');
        gridView.hidden = true;
        editor.hidden = false;
        if (backBtn) backBtn.hidden = false;
    };

    const closeEditor = () => {
        editor.hidden = true;
        gridView.hidden = false;
        if (backBtn) backBtn.hidden = true;
        requestAnimationFrame(() => animateCards('all'));
    };

    const pulseButton = (button) => {
        if (!button) return;
        button.classList.remove('game-tune-btn-pulse');
        void button.offsetWidth;
        button.classList.add('game-tune-btn-pulse');
        window.setTimeout(() => button.classList.remove('game-tune-btn-pulse'), 420);
    };

    chips.addEventListener('click', (e) => {
        const chip = e.target.closest('.game-tune-chip');
        if (!chip) return;
        activeCategory = chip.dataset.category || 'All';
        renderChips();
        renderCards();
    });

    search.addEventListener('input', renderCards);

    grid.addEventListener('click', (e) => {
        const optimizeBtn = e.target.closest('.game-optimize-btn');
        const editorBtn = e.target.closest('.game-editor-btn');
        const card = e.target.closest('.game-card[data-game-id]');
        const gameId = (optimizeBtn || editorBtn || card)?.dataset.gameId;
        const game = GAME_TUNE_PROFILES.find(profile => profile.id === gameId);
        if (optimizeBtn) {
            pulseButton(optimizeBtn);
            applyGameOptimize(game, optimizeBtn);
            return;
        }
        if (editorBtn) {
            openEditor(game);
            return;
        }
        if (card) openEditor(game);
    });

    grid.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('button, input, select, textarea')) return;
        const card = e.target.closest('.game-card[data-game-id]');
        if (!card) return;
        e.preventDefault();
        const game = GAME_TUNE_PROFILES.find(profile => profile.id === card.dataset.gameId);
        openEditor(game);
    });

    editorGrid.addEventListener('input', (e) => {
        const slider = e.target.closest('.game-tune-range');
        if (!slider) return;
        const valueEl = document.getElementById(`${slider.id}-value`);
        const labels = (slider.dataset.labels || '').split('|').filter(Boolean);
        const value = Number(slider.value);
        const min = Number(slider.min);
        if (valueEl) {
            valueEl.textContent = labels.length ? labels[Math.max(0, value - min)] : `${slider.value}${slider.dataset.unit || ''}`;
        }
    });

    editorGrid.addEventListener('change', async (e) => {
        const toggle = e.target.closest('[data-game-toggle]');
        if (!toggle) return;
        const tweakId = toggle.dataset.gameToggle;
        if (!tweakId) {
            showNotification('warning', 'Local Setting', 'This toggle is a UI-only profile setting for now.');
            return;
        }
        try {
            const result = await window.electronAPI.applyTweak(tweakId, toggle.checked ? 'enable' : 'disable');
            if (result.success) showNotification('success', 'Setting Updated', `${activeGame.name} setting updated.`);
            else showNotification('error', 'Setting Failed', result.message || 'Could not apply setting.');
        } catch (error) {
            showNotification('error', 'Setting Failed', error.message || 'Could not apply setting.');
        }
    });

    editorGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('.game-editor-action');
        if (!btn) return;
        const tweakId = btn.dataset.tweakId;
        if (!tweakId) {
            showNotification('warning', 'Local Action', 'This action is a UI-only profile placeholder for now.');
            return;
        }
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Applying...';
        try {
            const result = await window.electronAPI.applyTweak(tweakId, 'apply');
            if (result.success) showNotification('success', 'Tweak Applied', `${activeGame.name}: ${original} applied.`);
            else showNotification('error', 'Tweak Failed', result.message || 'Could not apply tweak.');
        } catch (error) {
            showNotification('error', 'Tweak Failed', error.message || 'Could not apply tweak.');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });

    editorOptimize.addEventListener('click', () => applyGameOptimize(activeGame, editorOptimize));
    backBtn?.addEventListener('click', () => {
        pulseButton(backBtn);
        closeEditor();
    });

    devToggle?.addEventListener('click', () => {
        if (!devPanel) return;
        devPanel.hidden = !devPanel.hidden;
        devToggle.setAttribute('aria-expanded', String(!devPanel.hidden));
    });

    document.addEventListener('click', (e) => {
        if (!devPanel || devPanel.hidden) return;
        if (e.target.closest('#game-tune-dev')) return;
        devPanel.hidden = true;
        devToggle?.setAttribute('aria-expanded', 'false');
    });

    const animControls = {
        duration: { input: document.getElementById('gt-anim-duration'), label: document.getElementById('gt-anim-duration-value'), unit: 'ms', fromInput: Number, toInput: value => value, format: value => `${value}ms` },
        stagger: { input: document.getElementById('gt-anim-stagger'), label: document.getElementById('gt-anim-stagger-value'), unit: 'ms', fromInput: Number, toInput: value => value, format: value => `${value}ms` },
        slideX: { input: document.getElementById('gt-anim-slide-x'), label: document.getElementById('gt-anim-slide-x-value'), unit: 'px', fromInput: Number, toInput: value => value, format: value => `${value}px` },
        slideY: { input: document.getElementById('gt-anim-slide-y'), label: document.getElementById('gt-anim-slide-y-value'), unit: 'px', fromInput: Number, toInput: value => value, format: value => `${value}px` },
        blur: { input: document.getElementById('gt-anim-blur'), label: document.getElementById('gt-anim-blur-value'), unit: 'px', fromInput: Number, toInput: value => value, format: value => `${value}px` },
        opacity: { input: document.getElementById('gt-anim-opacity'), label: document.getElementById('gt-anim-opacity-value'), fromInput: value => Number(value) / 100, toInput: value => Math.round(Number(value) * 100), format: value => Number(value).toFixed(2) },
        scale: { input: document.getElementById('gt-anim-scale'), label: document.getElementById('gt-anim-scale-value'), fromInput: value => Number(value) / 100, toInput: value => Math.round(Number(value) * 100), format: value => Number(value).toFixed(2) }
    };

    const syncAnimControls = () => {
        const config = getCurrentAnimConfig();
        Object.entries(animControls).forEach(([key, control]) => {
            if (!control.input) return;
            control.input.value = control.toInput(config[key]);
            if (control.label) control.label.textContent = control.format(config[key]);
        });
        const easing = document.getElementById('gt-anim-easing');
        if (easing) easing.value = config.easing;
        syncCustomSelect('target');
        syncCustomSelect('easing');
    };

    Object.entries(animControls).forEach(([key, control]) => {
        if (!control.input) return;
        control.input.addEventListener('input', () => {
            writeCurrentAnimConfig({ [key]: control.fromInput(control.input.value) });
            syncAnimControls();
            animateCards(activeAnimTarget);
        });
    });

    document.getElementById('gt-anim-easing')?.addEventListener('change', (e) => {
        writeCurrentAnimConfig({ easing: e.target.value });
        syncAnimControls();
        animateCards(activeAnimTarget);
    });

    devTarget?.addEventListener('change', (e) => {
        activeAnimTarget = e.target.value || 'all';
        syncAnimControls();
        animateCards(activeAnimTarget);
    });

    devPanel?.addEventListener('click', (e) => {
        const customButton = e.target.closest('.game-tune-custom-select > button');
        const customOption = e.target.closest('.game-tune-custom-menu [data-value]');
        if (customButton) {
            const key = customButton.parentElement?.dataset.gtSelect;
            if (!key) return;
            setCustomMenuOpen(key, customButton.getAttribute('aria-expanded') !== 'true');
            return;
        }
        if (customOption) {
            const customSelect = customOption.closest('.game-tune-custom-select');
            const key = customSelect?.dataset.gtSelect;
            const select = key ? document.getElementById(`gt-anim-${key}`) : null;
            if (!select) return;
            select.value = customOption.dataset.value || '';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            syncCustomSelect(key);
            setCustomMenuOpen(key, false);
            return;
        }
        setCustomMenuOpen('target', false);
        setCustomMenuOpen('easing', false);
    });

    devPanel?.addEventListener('click', (e) => {
        if (!e.target.closest('#gt-anim-replay')) return;
        animateCards(activeAnimTarget, { fromReplay: true });
    });

    document.getElementById('gt-anim-reset-selected')?.addEventListener('click', () => {
        if (activeAnimTarget === 'all') {
            Object.assign(allAnim, animDefaults);
            gameAnimOverrides.clear();
        } else {
            gameAnimOverrides.set(activeAnimTarget, { ...animDefaults });
        }
        syncAnimControls();
        animateCards(activeAnimTarget, { fromReplay: true });
    });

    document.getElementById('gt-anim-reset-all')?.addEventListener('click', () => {
        Object.assign(allAnim, animDefaults);
        gameAnimOverrides.clear();
        syncAnimControls();
        animateCards('all', { fromReplay: true });
    });

    devToggle?.setAttribute('aria-expanded', 'false');
    renderAnimTargets();
    syncAnimControls();

    renderChips();
    renderCards();
}

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
    },
    'gpu-scheduling': {
        impact: 'High',
        category: 'Performance',
        body: 'Hands frame scheduling off to the GPU\'s own hardware queue, lifting that overhead off the driver and CPU. At high frame rates, frame pacing tightens and input latency drops measurably.'
    },
    'game-priority': {
        impact: 'High',
        category: 'Performance',
        body: 'Moves active game processes to High scheduling priority so the CPU dispatcher keeps them fed even at peak load. Background tasks yield — the foreground stops competing.'
    },
    'optimize-visual-effects': {
        impact: 'Medium',
        category: 'Performance',
        body: 'Strips DWM animations, transparency, and shadow passes from the compositor. Every render cycle the effects pipeline was using comes back to your frame budget.'
    },
    'disable-hpet': {
        impact: 'High',
        category: 'Latency',
        body: 'Bypasses the High Precision Event Timer and dynamic-tick scheduling. Interrupt frequency drops, timer resolution tightens, and the CPU spends fewer cycles answering the clock.'
    },
    'optimize-ssd': {
        impact: 'Medium',
        category: 'Storage',
        body: 'Confirms TRIM, AHCI, and write-caching settings are healthy for SSD workloads. Predictable storage latency and fewer background maintenance spikes during active sessions.'
    },
    'disable-fast-startup': {
        impact: 'Medium',
        category: 'Startup',
        body: 'Forces a clean cold boot instead of reading a hybrid sleep image. Driver state resets fully, stale kernel sessions clear, and startup behavior stays predictable across reboots.'
    },
    'bcdedit-tweaks': {
        impact: 'High',
        category: 'Boot',
        body: 'Edits the Boot Configuration Database to tune kernel timeouts, timer resolution, and partition alignment. Effects are low-level and persist from POST through to desktop session start.'
    },
    'disable-windows-tips': {
        impact: 'Low',
        category: 'UI',
        body: 'Shuts off the tips engine and consumer experience suggestion service. No more unsolicited prompts or lock-screen ads — the shell stays quiet unless you ask for something.'
    }
};

const NETWORK_DETAILS = {
    // ── Featured functional pcards ────────────────────────────────
    'auto-dns-finder': {
        impact: 'Low',
        impactLabel: 'Low Risk',
        category: 'DNS Tool',
        body: 'Tests your current DNS against trusted providers and recommends the fastest stable option for your connection.',
        hint: 'Opens DNS scan modal'
    },
    'flush-dns-cache': {
        impact: 'Low',
        impactLabel: 'Safe',
        category: 'Repair',
        body: 'Clears stale DNS resolver entries that can cause websites, launchers, or services to connect slowly or fail.',
        hint: 'Safe local command'
    },
    'adapter-reset': {
        impact: 'Low',
        impactLabel: 'Safe',
        category: 'Repair',
        body: 'Requests a fresh network lease from your router. Useful for IP conflicts, stuck connections, or router-side lease issues.',
        hint: 'May briefly reconnect'
    },
    'packet-loss-test': {
        impact: 'Low',
        impactLabel: 'Safe',
        category: 'Diagnostics',
        body: 'Checks packet loss and jitter across your gateway, current DNS, and stable public endpoints to pinpoint where instability starts.',
        hint: 'No settings changed'
    },
    // ── Advanced cards ─────────────────────────────────────────────
    'tcp-ip-repair': {
        impact: 'Medium',
        impactLabel: 'Admin',
        category: 'Repair',
        body: 'Resets the Winsock catalog and TCP/IP stack to factory defaults. Resolves stubborn network breakage caused by corrupt socket entries.',
        hint: 'Restart required'
    },
    'network-doctor': {
        impact: 'Low',
        impactLabel: 'Safe',
        category: 'Diagnostics',
        body: 'Coming soon: scans common network configuration issues and suggests targeted fixes without applying any changes automatically.',
        hint: 'Not yet available',
        comingSoon: true
    },
    'dns-server-manager': {
        impact: 'Low',
        impactLabel: 'Safe',
        category: 'DNS',
        body: 'Coming soon: save and switch between DNS server profiles. Shows the exact servers that will be applied before confirming.',
        hint: 'Not yet available',
        comingSoon: true
    },
    'game-route-checker': {
        impact: 'Low',
        impactLabel: 'Safe',
        category: 'Routing',
        body: 'Coming soon: measures ping and hop count to common game server regions to help identify routing issues on your path.',
        hint: 'Not yet available',
        comingSoon: true
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
    const id = card.dataset.toggle || card.dataset.networkCard || card.dataset.tweak || '';
    const category = card.dataset.cat || 'default';
    const isGpuCard = card.dataset.gpuCard === '1';
    const isTweakCard = card.dataset.tweakCard === '1';
    const isNetPcard = card.classList.contains('net-pcard');
    const isNetAdvCard = card.classList.contains('net-adv-card');
    const isNetworkPlaceholder = !!card.dataset.networkCard && !isNetPcard && !isNetAdvCard;

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

    // Pcards use .pcard-title; adv-cards use .adv-card-titles h4 or .tweak-info h4; toggle-cards use .tc-titles h4
    const title = isGpuCard
        ? (card.querySelector('.gpu-card-title')?.textContent || '')
        : (card.querySelector('.tc-titles h4')?.textContent
           || card.querySelector('.tweak-info h4')?.textContent
           || card.querySelector('.pcard-title')?.textContent
           || card.querySelector('.adv-card-titles h4')?.textContent
           || '');
    const isOn = card.classList.contains('on');

    // Network pcards and adv-cards get a silver tooltip; everything else keeps its cat color
    tt.dataset.cat = (isNetPcard || isNetAdvCard) ? 'network-tool' : category;
    tt.dataset.impact = detail.impact.toLowerCase();
    tt.querySelector('.tt-title').textContent = title;
    tt.querySelector('.tt-cat').textContent = detail.category;
    tt.querySelector('.tt-impact-text').textContent = detail.impactLabel || `${detail.impact} impact`;
    tt.querySelector('.tt-body').textContent = detail.body;

    if (isGpuCard) {
        tt.querySelector('.tt-state-text').textContent = 'Coming soon';
        tt.querySelector('.tt-hint').textContent = 'Placeholder · not yet active';
        tt.classList.remove('is-on', 'is-ready');
    } else if (isTweakCard) {
        tt.querySelector('.tt-state-text').textContent = 'Ready';
        tt.querySelector('.tt-hint').textContent = 'Click Apply to activate';
        tt.classList.remove('is-on');
        tt.classList.add('is-ready');
    } else if (isNetPcard) {
        tt.querySelector('.tt-state-text').textContent = 'Ready';
        tt.querySelector('.tt-hint').textContent = detail.hint || 'Click to run';
        tt.classList.remove('is-on');
        tt.classList.add('is-ready');
    } else if (isNetAdvCard) {
        if (detail.comingSoon) {
            tt.querySelector('.tt-state-text').textContent = 'Coming soon';
            tt.querySelector('.tt-hint').textContent = detail.hint || 'Not yet available';
            tt.classList.remove('is-on', 'is-ready');
        } else {
            tt.querySelector('.tt-state-text').textContent = 'Ready';
            tt.querySelector('.tt-hint').textContent = detail.hint || 'Click to run';
            tt.classList.remove('is-on');
            tt.classList.add('is-ready');
        }
    } else {
        tt.querySelector('.tt-state-text').textContent = isNetworkPlaceholder ? 'Placeholder locked' : (isOn ? 'Currently active' : 'Currently inactive');
        tt.querySelector('.tt-hint').textContent = isNetworkPlaceholder ? 'Coming soon' : 'Toggle to apply';
        tt.classList.remove('is-ready');
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

const ENTRY_CARD_SHINE_DURATION = 780;
const ENTRY_CARD_SHINE_OFFSET = 60;

function clearEntryCardShine(item) {
    if (!item) return;
    if (item._entryShineTimer) {
        clearTimeout(item._entryShineTimer);
        item._entryShineTimer = null;
    }
    item.classList.remove('page-card-entry-shine');
    item.style.removeProperty('--entry-shine-delay');
}

function applyEntryCardShine(item, index, stagger = 55, duration = ENTRY_CARD_SHINE_DURATION) {
    if (!item) return;
    clearEntryCardShine(item);
    item.style.setProperty('--entry-shine-delay', `${index * stagger + ENTRY_CARD_SHINE_OFFSET}ms`);
    item.classList.add('page-card-entry-shine');
    item._entryShineTimer = setTimeout(() => {
        clearEntryCardShine(item);
    }, index * stagger + ENTRY_CARD_SHINE_OFFSET + duration + 180);
}

const GAMING_ENTRY_MOTION = {
    duration: 820,
    stagger: 90,
    slideX: 0,
    slideY: 14,
    blur: 5,
    opacity: 0,
    scale: 0.985,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
let gamingPageEnterMotionLastRun = 0;
let gamingTabMotionLastRun = 0;
let gamingTabMotionRequest = 0;

function getGamingEntryCards(page) {
    const collect = (selector) => Array.from(page.querySelectorAll(selector)).filter(item => {
        if (!item) return false;
        if (item.dataset.gamingHidden === 'true' || item.closest('[data-gaming-hidden]')) return false;
        const rect = item.getBoundingClientRect();
        return rect.width >= 8 && rect.height >= 8;
    });

    const presetCards = collect('.gaming-preset-card');
    const toggleCards = collect('.gaming-pcard, .gaming-toggle-card');
    const sliderCards = collect('.gaming-slider-card');
    const advancedCards = collect('.gaming-adv-card, .gaming-tool-card');
    const emptyCards = collect('.gaming-empty-state:not([hidden])');
    return [...presetCards, ...toggleCards, ...sliderCards, ...advancedCards, ...emptyCards];
}

function clearGamingEntryCardAnimations(items = []) {
    items.forEach(item => {
        if (item._gamingWaapiAnimation) {
            item._gamingWaapiAnimation.cancel();
            item._gamingWaapiAnimation = null;
        }
        clearEntryCardShine(item);
        item.style.removeProperty('will-change');
        item.style.removeProperty('pointer-events');
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
    });
}

function animateGamingCardsOnEntry() {
    const page = document.getElementById('page-gaming');
    if (!page?.classList.contains('active')) return 0;

    const targetItems = getGamingEntryCards(page).filter(Boolean);
    clearGamingEntryCardAnimations(targetItems);
    if (targetItems[0]) targetItems[0].offsetHeight;

    const started = [];
    targetItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        applyEntryCardShine(item, index, GAMING_ENTRY_MOTION.stagger);
        item.style.pointerEvents = 'none';

        const animation = item.animate([
            {
                opacity: GAMING_ENTRY_MOTION.opacity,
                transform: `translate3d(${GAMING_ENTRY_MOTION.slideX}px, ${GAMING_ENTRY_MOTION.slideY}px, 0) scale(${GAMING_ENTRY_MOTION.scale})`,
                filter: `blur(${GAMING_ENTRY_MOTION.blur}px)`
            },
            {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale(1)',
                filter: 'blur(0px)'
            }
        ], {
            duration: GAMING_ENTRY_MOTION.duration,
            delay: index * GAMING_ENTRY_MOTION.stagger,
            easing: GAMING_ENTRY_MOTION.easing,
            fill: 'both'
        });

        item.style.willChange = 'transform, opacity, filter';
        item._gamingWaapiAnimation = animation;
        setTimeout(() => {
            if (item._gamingWaapiAnimation === animation) item.style.removeProperty('pointer-events');
        }, index * GAMING_ENTRY_MOTION.stagger);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (item._gamingWaapiAnimation === animation) {
                    animation.cancel();
                    item._gamingWaapiAnimation = null;
                    item.style.removeProperty('will-change');
                    item.style.removeProperty('pointer-events');
                    item.style.removeProperty('opacity');
                    item.style.removeProperty('transform');
                    item.style.removeProperty('filter');
                }
            });
        started.push(animation);
    });

    return started.length;
}

function scheduleGamingCardsOnEntry(options = {}) {
    const page = document.getElementById('page-gaming');
    if (!page) return;
    const requestId = ++gamingTabMotionRequest;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!page.classList.contains('active')) return;
            const now = performance.now();
            if (options.source === 'page-enter' && now - gamingPageEnterMotionLastRun < 900) return;
            if (options.source === 'page-enter') gamingPageEnterMotionLastRun = now;
            if (options.source === 'tab-click') {
                if (requestId !== gamingTabMotionRequest) return;
                if (now - gamingTabMotionLastRun < 450) {
                    setTimeout(() => {
                        if (requestId !== gamingTabMotionRequest || !page.classList.contains('active')) return;
                        gamingTabMotionLastRun = performance.now();
                        animateGamingCardsOnEntry();
                    }, 450 - (now - gamingTabMotionLastRun));
                    return;
                }
                gamingTabMotionLastRun = now;
            }
            animateGamingCardsOnEntry();
        });
    });
}

function initializeGamingPage() {
    const page = document.getElementById('page-gaming');
    const tabs = page?.querySelectorAll('.gaming-filter-tab');
    if (!page || !tabs?.length || page.dataset.gamingInitialized === 'true') return;
    page.dataset.gamingInitialized = 'true';

    const applyFilter = (filter) => {
        const activeFilter = ['all', 'toggles', 'performance', 'advanced'].includes(filter) ? filter : 'all';
        const sectionMap = {
            all: ['presets', 'toggles', 'performance', 'advanced'],
            toggles: ['toggles'],
            performance: ['performance'],
            advanced: ['advanced']
        };
        const visibleSections = new Set(sectionMap[activeFilter] || sectionMap.all);
        const advancedCards = Array.from(page.querySelectorAll('.gaming-adv-card, .gaming-tool-card'));
        const advancedEmpty = document.getElementById('gaming-advanced-empty');

        tabs.forEach(tab => {
            tab.classList.toggle('gaming-filter-active', tab.dataset.gamingFilter === activeFilter);
        });

        page.querySelectorAll('[data-gaming-section]').forEach(section => {
            const sectionKey = section.dataset.gamingSection || '';
            section.toggleAttribute('data-gaming-hidden', !visibleSections.has(sectionKey));
        });

        page.querySelectorAll('[data-gaming-cat]').forEach(item => {
            item.toggleAttribute('data-gaming-hidden', false);
        });

        if (advancedEmpty) {
            advancedEmpty.hidden = !['all', 'advanced'].includes(activeFilter) || advancedCards.length > 0;
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            clearGamingEntryCardAnimations(Array.from(page.querySelectorAll('.gaming-preset-card, .gaming-pcard, .gaming-toggle-card, .gaming-slider-card, .gaming-adv-card, .gaming-tool-card, .gaming-empty-state')));
            applyFilter(tab.dataset.gamingFilter || 'all');
            tab.classList.remove('is-activating');
            void tab.offsetWidth;
            tab.classList.add('is-activating');
            tab.addEventListener('animationend', () => tab.classList.remove('is-activating'), { once: true });
            scheduleGamingCardsOnEntry({ source: 'tab-click' });
        });
    });

    page.querySelectorAll('[data-gaming-preset]').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.gaming-preset-card');
            const presetName = card?.querySelector('.gaming-preset-title')?.textContent || 'Gaming preset';
            // TODO: Phase 2 - wire preset buttons to backend preset execution after review.
            showNotification('success', 'Preset queued', `${presetName} is ready for local preset wiring.`);
        });
    });

    applyFilter('all');

    page.querySelectorAll('.gaming-adv-card').forEach(card => {
        if (card.dataset.tooltipWired === '1') return;
        card.dataset.tooltipWired = '1';
        card.dataset.tweakCard = '1';
        card.dataset.cat = 'gaming';
        let showTimer;
        card.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => showTooltipFor(card), 220);
        });
        card.addEventListener('mouseleave', () => {
            clearTimeout(showTimer);
            hideTooltip();
        });
    });

    window.animateGamingCardsOnEntry = animateGamingCardsOnEntry;
    if (page.classList.contains('active')) scheduleGamingCardsOnEntry({ source: 'page-enter' });
}

// ── System & Memory: card reveal motion (mirrors Network/Gaming entrance) ──
const SYSMEM_ENTRY_MOTION = {
    duration: 820,
    stagger: 90,
    slideY: 14,
    blur: 5,
    opacity: 0,
    scale: 0.985,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
const sysMemMotionState = {
    'page-system': { lastRun: 0, request: 0 },
    'page-memory': { lastRun: 0, request: 0 }
};

function getSysMemEntryCards(page) {
    return Array.from(page.querySelectorAll('.sys-pcard, .mem-pcard')).filter(card => {
        if (!card || card.style.display === 'none') return false;
        const rect = card.getBoundingClientRect();
        return rect.width >= 8 && rect.height >= 8;
    });
}

function animateSysMemCardsOnEntry(pageId) {
    const page = document.getElementById(pageId);
    if (!page?.classList.contains('active')) return 0;
    const items = getSysMemEntryCards(page);
    items.forEach(item => {
        if (item._sysMemEntryAnimation) { item._sysMemEntryAnimation.cancel(); item._sysMemEntryAnimation = null; }
        clearEntryCardShine(item);
        item.style.removeProperty('will-change');
        item.style.removeProperty('pointer-events');
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
    });
    if (items[0]) items[0].offsetHeight;
    let started = 0;
    items.forEach((item, index) => {
        applyEntryCardShine(item, index, SYSMEM_ENTRY_MOTION.stagger);
        item.style.pointerEvents = 'none';
        const animation = item.animate([
            {
                opacity: SYSMEM_ENTRY_MOTION.opacity,
                transform: `translate3d(0, ${SYSMEM_ENTRY_MOTION.slideY}px, 0) scale(${SYSMEM_ENTRY_MOTION.scale})`,
                filter: `blur(${SYSMEM_ENTRY_MOTION.blur}px)`
            },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0px)' }
        ], {
            duration: SYSMEM_ENTRY_MOTION.duration,
            delay: index * SYSMEM_ENTRY_MOTION.stagger,
            easing: SYSMEM_ENTRY_MOTION.easing,
            fill: 'both'
        });
        item.style.willChange = 'transform, opacity, filter';
        item._sysMemEntryAnimation = animation;
        setTimeout(() => {
            if (item._sysMemEntryAnimation === animation) item.style.removeProperty('pointer-events');
        }, index * SYSMEM_ENTRY_MOTION.stagger);
        animation.finished.catch(() => {}).finally(() => {
            if (item._sysMemEntryAnimation === animation) {
                animation.cancel();
                item._sysMemEntryAnimation = null;
                item.style.removeProperty('will-change');
                item.style.removeProperty('pointer-events');
                item.style.removeProperty('opacity');
                item.style.removeProperty('transform');
                item.style.removeProperty('filter');
            }
        });
        started++;
    });
    return started;
}

function scheduleSysMemCardsOnEntry(pageId, options = {}) {
    const page = document.getElementById(pageId);
    if (!page) return;
    const state = sysMemMotionState[pageId] || (sysMemMotionState[pageId] = { lastRun: 0, request: 0 });
    const requestId = ++state.request;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!page.classList.contains('active')) return;
            if (options.source === 'tab-click' && requestId !== state.request) return;
            const now = performance.now();
            if (options.source !== 'page-enter' && now - state.lastRun < 220) return;
            state.lastRun = now;
            animateSysMemCardsOnEntry(pageId);
        });
    });
}

// Pointer-following aurora + safe (visual-only) action buttons for System/Memory pcards.
function enhanceSysMemCards(page, btnSelector) {
    page.querySelectorAll('.sys-pcard, .mem-pcard').forEach(card => {
        if (card.dataset.sysmemHover === '1') return;
        card.dataset.sysmemHover = '1';
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
            card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
    });
    // These buttons are presentation-only (the toggles/sliders apply on their own
    // change events, and the .tweak-btn.apply buttons are wired by initializeTweaks).
    // Keep them safe: focus the relevant control and surface a local notification.
    page.querySelectorAll(btnSelector).forEach(btn => {
        if (btn.dataset.safeWired === '1') return;
        btn.dataset.safeWired = '1';
        btn.addEventListener('click', () => {
            const card = btn.closest('.toggle-card, .slider-card, .tweak-card');
            const title = card?.querySelector('.pcard-title')?.textContent?.trim() || 'This control';
            const slider = card?.querySelector('input[type="range"]');
            const toggle = card?.querySelector('input[type="checkbox"]');
            if (slider) {
                slider.focus();
                showNotification('info', 'Adjust to apply', `Use the ${title} slider to set your preferred value.`);
            } else if (toggle) {
                toggle.focus();
                showNotification('info', title, `${title} is ${toggle.checked ? 'enabled' : 'disabled'} locally.`);
            } else {
                showNotification('info', title, `${title} is ready.`);
            }
        });
    });
}

function makeSysMemFilter(opts) {
    const { page, pageId, tabs, prefix, validFilters, descriptions } = opts;
    const catAttr = `[data-${prefix}-cat]`;
    const activeClass = `${prefix}-filter-active`;
    const filterKey = `${prefix}Filter`;
    const countEl = page.querySelector(`[data-${prefix}-count]`);

    const applyFilter = (filter, opts2 = {}) => {
        const activeFilter = validFilters.includes(filter) ? filter : 'all';

        let visible = 0;
        page.querySelectorAll(catAttr).forEach(card => {
            const cats = (card.dataset[`${prefix}Cat`] || '').split(' ').filter(Boolean);
            const isVisible = activeFilter === 'all' || cats.includes(activeFilter);
            card.style.display = isVisible ? '' : 'none';
            if (isVisible) visible++;
        });

        page.querySelectorAll(`[data-${prefix}-section]`).forEach(section => {
            const heading = section.querySelector(`.${prefix}-section-h2`);
            const subtext = section.querySelector(`.${prefix}-section-desc`);
            if (heading) heading.textContent = descriptions[activeFilter].heading;
            if (subtext) subtext.textContent = descriptions[activeFilter].subtext;
        });

        if (countEl) countEl.textContent = `${visible} tool${visible === 1 ? '' : 's'}`;

        tabs.forEach(tab => {
            tab.classList.toggle(activeClass, tab.dataset[filterKey] === activeFilter);
        });

        if (opts2.animate) scheduleSysMemCardsOnEntry(pageId, { source: 'tab-click' });
    };

    return applyFilter;
}

function initializeSystemPage() {
    const page = document.getElementById('page-system');
    const tabs = page?.querySelectorAll('.sys-filter-tab');
    if (!page || !tabs?.length || page.dataset.sysInitialized === 'true') return;
    page.dataset.sysInitialized = 'true';

    const filterDescriptions = {
        all: { heading: 'Recommended Optimizations', subtext: 'Safe local tools for Windows responsiveness, startup behavior, and background services.' },
        toggles: { heading: 'Quick System Switches', subtext: 'Fast Windows toggles for common background features and services.' },
        performance: { heading: 'Performance Controls', subtext: 'Tune visual effects, scheduling, and responsiveness settings.' },
        startup: { heading: 'Startup Behavior', subtext: 'Adjust boot timing and startup-related Windows behavior.' },
        advanced: { heading: 'Advanced System Tools', subtext: 'Deeper local system controls for users who want extra tuning.' }
    };

    const applyFilter = makeSysMemFilter({
        page, pageId: 'page-system', tabs, prefix: 'sys',
        validFilters: ['all', 'toggles', 'performance', 'startup', 'advanced'],
        descriptions: filterDescriptions
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => applyFilter(tab.dataset.sysFilter, { animate: true }));
    });

    enhanceSysMemCards(page, '.sys-card-btn');
    applyFilter('all');

    page.querySelectorAll('.sys-tweak-pcard').forEach(card => {
        if (card.dataset.tooltipWired === '1') return;
        card.dataset.tooltipWired = '1';
        card.dataset.tweakCard = '1';
        card.dataset.cat = 'system';
        let showTimer;
        card.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => showTooltipFor(card), 220);
        });
        card.addEventListener('mouseleave', () => {
            clearTimeout(showTimer);
            hideTooltip();
        });
    });
}

function initializeMemoryPage() {
    const page = document.getElementById('page-memory');
    const tabs = page?.querySelectorAll('.mem-filter-tab');
    if (!page || !tabs?.length || page.dataset.memInitialized === 'true') return;
    page.dataset.memInitialized = 'true';

    const filterDescriptions = {
        all: { heading: 'Recommended Optimizations', subtext: 'Local memory tools for cache cleanup, compression, page file tuning, and system stability.' },
        toggles: { heading: 'Quick Memory Switches', subtext: 'Fast toggles for memory services, cache behavior, and RAM features.' },
        ram: { heading: 'RAM Management', subtext: 'Tools for compression, cache behavior, and active memory responsiveness.' },
        pagefile: { heading: 'Page File Tuning', subtext: 'Adjust virtual memory ranges and paging behavior safely.' },
        advanced: { heading: 'Advanced Memory Tools', subtext: 'Extra memory controls for cache priority, page priority, and advanced tuning.' }
    };

    const applyFilter = makeSysMemFilter({
        page, pageId: 'page-memory', tabs, prefix: 'mem',
        validFilters: ['all', 'toggles', 'ram', 'pagefile', 'advanced'],
        descriptions: filterDescriptions
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => applyFilter(tab.dataset.memFilter, { animate: true }));
    });

    enhanceSysMemCards(page, '.mem-card-btn');
    applyFilter('all');
}

/* ─────────────────────────────────────────────────────────────────────────
   CPU MONITOR — loads real CPU data into System page CPU section
   ───────────────────────────────────────────────────────────────────────── */

let _sysCpuSectionLoaded = false;

function formatUptimeDisplay(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

async function loadSysCpuSection() {
    if (_sysCpuSectionLoaded) return;
    _sysCpuSectionLoaded = true;

    const nameEl   = document.getElementById('sys-cpu-name');
    const fillEl   = document.getElementById('sys-cpu-usage-fill');
    const pctEl    = document.getElementById('sys-cpu-usage-pct');
    const coresEl  = document.getElementById('sys-cpu-cores');
    const threadsEl= document.getElementById('sys-cpu-threads');
    const clockEl  = document.getElementById('sys-cpu-clock');
    const uptimeEl = document.getElementById('sys-cpu-uptime');
    const procList = document.getElementById('sys-cpu-proc-list');

    try {
        const [sysInfo, liveStats] = await Promise.all([
            window.electronAPI?.getSystemInfo?.(),
            window.electronAPI?.getLiveStats?.(),
        ]);

        if (nameEl && sysInfo?.cpu?.model) nameEl.textContent = sysInfo.cpu.model;

        const usage = typeof liveStats?.cpuUsage === 'number' ? liveStats.cpuUsage : 0;
        if (fillEl) fillEl.style.width = `${usage}%`;
        if (pctEl) pctEl.textContent = `${usage}%`;

        // os.cpus().length = logical processors (threads)
        if (threadsEl && sysInfo?.cpu?.cores) threadsEl.textContent = sysInfo.cpu.cores;
        if (clockEl && sysInfo?.cpu?.speed) {
            clockEl.textContent = `${(sysInfo.cpu.speed / 1000).toFixed(1)} GHz`;
        }
        if (uptimeEl && sysInfo?.uptime) uptimeEl.textContent = formatUptimeDisplay(sysInfo.uptime);

        // Enhance with WMI data (physical core count, precise clock, exact model name)
        try {
            const fullInfo = await window.electronAPI?.getFullSystemInfo?.();
            const cpuFull = fullInfo?.cpu?.data;
            if (cpuFull) {
                if (nameEl && cpuFull.Name) nameEl.textContent = cpuFull.Name;
                if (coresEl && cpuFull.NumberOfCores != null) coresEl.textContent = cpuFull.NumberOfCores;
                if (threadsEl && cpuFull.NumberOfLogicalProcessors != null) threadsEl.textContent = cpuFull.NumberOfLogicalProcessors;
                if (clockEl && cpuFull.MaxClockSpeed) {
                    clockEl.textContent = `${(cpuFull.MaxClockSpeed / 1000).toFixed(2)} GHz`;
                }
            }
        } catch { /* WMI optional — basic data already shown */ }

    } catch { /* entire section fails gracefully */ }

    // Top background processes from existing scan (sorted by RAM)
    if (procList) {
        try {
            const bgCtx = await window.electronAPI?.getBackgroundContext?.();
            const procs = (bgCtx?.processes || [])
                .filter(p => p.ramMB != null)
                .sort((a, b) => (b.ramMB || 0) - (a.ramMB || 0))
                .slice(0, 5);

            if (procs.length) {
                procList.innerHTML = procs.map(p => `
                    <div class="sys-cpu-proc-row">
                        <span class="sys-cpu-proc-name">${p.name}</span>
                        <span class="sys-cpu-proc-ram">${p.ramMB} MB</span>
                        <span class="sys-cpu-proc-cat">${p.category}</span>
                    </div>
                `).join('');
            } else {
                procList.innerHTML = '<div class="sys-cpu-empty">No known background processes detected.</div>';
            }
        } catch {
            procList.innerHTML = '<div class="sys-cpu-empty">Process data unavailable.</div>';
        }
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   PROCESS REDUCER — scan, safe-close, advanced review, restore
   ───────────────────────────────────────────────────────────────────────── */

function initializeProcessReducer() {
    const page = document.getElementById('page-process-reducer');
    if (!page || page.dataset.prInitialized === '1') return;
    page.dataset.prInitialized = '1';

    // ── PRX Modal elements (new 4-state modal) ──
    const prxModal        = document.getElementById('prx-modal');
    const prxModalClose   = document.getElementById('prx-modal-close');
    const prxModalBackdrop= document.getElementById('prx-modal-backdrop');
    const prxStateReady   = document.getElementById('prx-state-ready');
    const prxStateScan    = document.getElementById('prx-state-scan');
    const prxStateResults = document.getElementById('prx-state-results');
    const prxStateError   = document.getElementById('prx-state-error');
    const prxStartScanBtn = document.getElementById('prx-start-scan-btn');
    const prxScanStatus   = document.getElementById('prx-scan-status');
    const prxScanBar      = document.getElementById('prx-scan-bar');
    const prxScanSteps    = document.getElementById('prx-scan-steps');
    const prxErrorMsg     = document.getElementById('prx-error-msg');
    const prxBaBefore     = document.getElementById('prx-ba-before');
    const prxBaAfter      = document.getElementById('prx-ba-after');
    const prxBaBeforeMem  = document.getElementById('prx-ba-before-mem');
    const prxBaAfterMem   = document.getElementById('prx-ba-after-mem');
    const prxFreedRam     = document.getElementById('prx-freed-ram');
    const prxFreedCpu     = document.getElementById('prx-freed-cpu');
    const prxSafeCount    = document.getElementById('prx-safe-count');
    const prxCloseList    = document.getElementById('prx-close-list');
    const prxCloseBtn     = document.getElementById('prx-close-btn');
    const prxReviewPlanBtn= document.getElementById('prx-review-plan-btn');
    const prxApplyBtn        = document.getElementById('prx-apply-btn');
    const prxRetryBtn        = document.getElementById('prx-retry-btn');
    const prxBgTweaksSection = document.getElementById('prx-bg-tweaks-section');
    const prxAdminNotice     = document.getElementById('prx-admin-notice');
    const prxStartupCount    = document.getElementById('prx-startup-count');
    const prxBgTweaksCount   = document.getElementById('prx-bg-tweaks-count');
    const prxBaLabelBefore   = document.getElementById('prx-ba-label-before');
    const prxBaLabelAfter    = document.getElementById('prx-ba-label-after');

    // ── Page UI elements ──
    const prxOpenBtn     = document.getElementById('prx-open-btn');
    const prxRestoreBtn  = document.getElementById('prx-restore-btn');
    const prxLastScanBar = document.getElementById('prx-last-scan-bar');
    const advancedBtn    = document.getElementById('pr-advanced-review-btn');
    const statusDot      = document.getElementById('pr-status-dot');
    const statusText     = document.getElementById('pr-status-text');

    // ── Hidden legacy elements (JS-wired, not visible) ──
    const resultsEl      = document.getElementById('pr-results');
    const installedPanel = document.getElementById('pr-installed-panel');
    const startupListEl  = document.getElementById('pr-startup-list');
    const modalOverlay   = document.getElementById('pr-modal-overlay');
    const modalProc      = document.getElementById('pr-modal-proc');
    const modalFill      = document.getElementById('pr-modal-progress-fill');
    const modalPct       = document.getElementById('pr-modal-pct');
    const modalCounts    = document.getElementById('pr-modal-counts');
    const modalCancel    = document.getElementById('pr-modal-cancel');
    const successOverlay = document.getElementById('pr-success-overlay');
    const successStats   = document.getElementById('pr-success-stats');
    const confirmOverlay = document.getElementById('pr-confirm-overlay');
    const confirmSub     = document.getElementById('pr-confirm-sub');
    const confirmList    = document.getElementById('pr-confirm-list');
    const confirmCancel  = document.getElementById('pr-confirm-cancel');
    const confirmContinue = document.getElementById('pr-confirm-continue');

    let prProcesses = [];
    const closedApps = [];
    const ignoredProcs = new Set();
    let cancelRequested = false;
    let currentSort = 'ram';
    let liveStatsBefore = null;
    let startupDataLoaded = false;
    let _confirmResolve = null;
    let _scanTimers = [];
    let _prxPollInterval = null;
    let _prxAppsLiveInterval = null;

    // ── Category icon SVGs (inline, no downloads) ──
    const CAT_ICONS = {
        'Browser':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        'Launcher':   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        'Chat':       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        'Overlay':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
        'Cloud':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
        'Cloud Sync': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
        'Startup':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 7 13 17 8 12 1 19"/><polyline points="17 7 23 7 23 13"/></svg>',
        'RGB':        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
        'RGB / Peripheral': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>',
        'Anti-Cheat': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        'Updater':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.34"/></svg>',
        'Background': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
        'default':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    };

    function getCategoryKey(cat) {
        if (!cat) return 'default';
        const c = cat.toLowerCase();
        if (c.includes('browser'))       return 'Browser';
        if (c.includes('launcher'))      return 'Launcher';
        if (c.includes('chat') || c.includes('voice') || c.includes('discord')) return 'Chat';
        if (c.includes('overlay'))       return 'Overlay';
        if (c.includes('cloud') || c.includes('sync') || c.includes('onedrive')) return 'Cloud Sync';
        if (c.includes('startup'))       return 'Startup';
        if (c.includes('rgb') || c.includes('peripheral') || c.includes('lighting')) return 'RGB';
        if (c.includes('anti') || c.includes('cheat')) return 'Anti-Cheat';
        if (c.includes('update') || c.includes('updater')) return 'Updater';
        if (c.includes('background'))    return 'Background';
        return 'default';
    }

    function buildIconCell(name, category) {
        const key = getCategoryKey(category);
        const svg = CAT_ICONS[key] || CAT_ICONS['default'];
        const el = document.createElement('div');
        el.className = 'pr-proc-icon';
        el.innerHTML = svg;
        return el;
    }

    function buildInitialTile(name) {
        const el = document.createElement('div');
        el.className = 'pr-proc-icon-initial';
        el.textContent = (name || '?').charAt(0);
        return el;
    }

    function normalizeCatForPill(cat) {
        if (!cat) return { label: 'Unknown', key: '' };
        const c = cat.toLowerCase();
        if (c.includes('browser'))  return { label: 'Browser',  key: 'Browser' };
        if (c.includes('launcher')) return { label: 'Launcher', key: 'Launcher' };
        if (c.includes('chat') || c.includes('voice')) return { label: 'Chat', key: 'Chat' };
        if (c.includes('overlay'))  return { label: 'Overlay',  key: 'Overlay' };
        if (c.includes('cloud') || c.includes('sync')) return { label: 'Cloud', key: 'Cloud' };
        if (c.includes('startup'))  return { label: 'Startup',  key: 'Startup' };
        if (c.includes('rgb') || c.includes('peripheral') || c.includes('lighting')) return { label: 'RGB', key: 'RGB' };
        return { label: cat, key: '' };
    }

    function setStatus(text, scanning = false) {
        if (statusText) statusText.textContent = text;
        if (statusDot) statusDot.classList.toggle('scanning', scanning);
    }

    // ── PRX Modal: open / close ──
    function openPrxModal() {
        if (!prxModal) return;
        // Always reset to ready state on open
        prxStateReady?.classList.remove('prx-hidden');
        prxStateScan?.classList.add('prx-hidden');
        prxStateResults?.classList.add('prx-hidden');
        prxStateError?.classList.add('prx-hidden');
        if (prxStartScanBtn) { prxStartScanBtn.dataset.scanning = ''; prxStartScanBtn.disabled = false; }
        prxModal.classList.add('active');
        prxModal.setAttribute('aria-hidden', 'false');
    }

    function closePrxModal() {
        if (!prxModal) return;
        prxModal.classList.remove('active');
        prxModal.setAttribute('aria-hidden', 'true');
        _scanTimers.forEach(clearTimeout);
        _scanTimers = [];
        clearInterval(_prxPollInterval);
        _prxPollInterval = null;
    }

    // ── PRX Modal: scan state ──
    function showPrxScanState() {
        if (prxScanBar) prxScanBar.style.width = '0%';
        if (prxScanStatus) prxScanStatus.textContent = 'Scanning running processes…';
        const steps = prxScanSteps?.querySelectorAll('.prx-scan-step') || [];
        steps.forEach(s => s.classList.remove('active', 'done'));
        prxStateReady?.classList.add('prx-hidden');
        prxStateScan?.classList.remove('prx-hidden');
        prxStateResults?.classList.add('prx-hidden');
        prxStateError?.classList.add('prx-hidden');

        _scanTimers.forEach(clearTimeout);
        _scanTimers = [];
        const stepMessages = [
            'Scanning running processes…',
            'Measuring CPU and memory impact…',
            'Filtering protected Windows tasks…',
            'Building safe close plan…',
        ];
        const durations    = [0, 600, 1300, 2100];
        const progressPcts = [15, 40, 68, 88];
        steps.forEach((step, idx) => {
            const t = setTimeout(() => {
                steps.forEach((s, si) => {
                    if (si < idx)       { s.classList.remove('active'); s.classList.add('done'); }
                    else if (si === idx) { s.classList.add('active');   s.classList.remove('done'); }
                    else                 { s.classList.remove('active', 'done'); }
                });
                if (prxScanStatus) prxScanStatus.textContent = stepMessages[idx] || '';
                if (prxScanBar)    prxScanBar.style.width    = `${progressPcts[idx] || 0}%`;
            }, durations[idx]);
            _scanTimers.push(t);
        });
    }

    const BG_TWEAKS = [
        // ── Game & Background Services ─────────────────────────────────────────
        { _group: 'Game & Background Services' },
        { id: 'disable-game-bar',        title: 'Game Bar Background Cut',        desc: 'Disables Game Bar background capture and recording overhead.',                      badge: 'restart',   checked: true  },
        { id: 'disable-xbox-services',   title: 'Xbox DVR Background Services',   desc: 'Disables Xbox DVR overlay, GameBar nexus, and background capture hooks.',          badge: 'restart',   checked: true  },
        { id: 'disable-background-apps', title: 'Background App Suppression',     desc: 'Prevents UWP apps from running background tasks when not in use.',                  badge: 'restart',   checked: true  },
        { id: 'disable-edge-background', title: 'Edge Background Guard',          desc: 'Stops Edge Startup Boost and background extension activity from staying active after Edge closes.', badge: 'restart', checked: true  },
        { id: 'disable-widgets',         title: 'Widgets Background Cut',          desc: 'Turns off Windows Widgets background presence and taskbar widget activity.',              badge: 'restart',   checked: true  },
        // ── Telemetry & Content ────────────────────────────────────────────────
        { _group: 'Telemetry & Content' },
        { id: 'disable-telemetry',    title: 'Telemetry Silence',              desc: 'Disables Windows feedback prompts, tailored experiences, and diagnostic UI noise.', badge: 'immediate', checked: true  },
        { id: 'disable-windows-tips', title: 'Windows Tips Suppression',       desc: 'Turns off Windows tips, suggestions, and promotional app content.',                  badge: 'immediate', checked: true  },
        { id: 'disable-delivery-opt', title: 'Delivery Optimization Restrict', desc: 'Stops Windows from uploading your updates to other PCs in the background.',          badge: 'immediate', checked: true  },
        // ── Search & Cloud ─────────────────────────────────────────────────────
        { _group: 'Search & Cloud' },
        { id: 'disable-search-indexing', title: 'Search Cloud Isolation',    desc: 'Removes Bing web results from Windows Search — keeps search local only.',           badge: 'restart',   checked: true  },
        { id: 'disable-cortana',         title: 'Cortana Search Assistance', desc: 'Disables Cortana background data collection and Bing cloud integration.',             badge: 'restart',   checked: false },
        // ── Scheduler & Responsiveness ─────────────────────────────────────────
        { _group: 'Scheduler & Responsiveness' },
        { id: 'slider-proc-scheduling', title: 'Windows Priority Optimizer', desc: 'Tunes foreground app responsiveness and reduces background scheduling delay.',       badge: 'immediate', checked: true  },
        // ── Input & Accessibility ──────────────────────────────────────────────
        { _group: 'Input & Accessibility' },
        { id: 'disable-sticky-keys-prompt', title: 'Sticky Keys Guard',        desc: 'Prevents accidental Sticky Keys, Toggle Keys, and Filter Keys popup dialogs.',  badge: 'immediate', checked: true  },
        { id: 'disable-voice-activation',   title: 'Voice Activation Silence', desc: 'Disables background voice activation listeners for all apps.',                   badge: 'restart',   checked: false },
        // ── Review First ───────────────────────────────────────────────────────
        { _group: 'Review First' },
        { id: 'quiet-windows-update',    title: 'Windows Update Quiet Mode',    desc: 'Sets active hours (8am–10pm) so Windows defers auto-restart during the day. Does not disable security updates.', badge: 'review', checked: false },
        { id: 'disable-teams-startup',   title: 'Teams / Chat Startup Quiet',   desc: 'Reviews Teams/Chat startup behavior so it does not relaunch in the background unless the user wants it.', badge: 'review', checked: false },
        { id: null, title: 'Cloud Sync Quiet Mode',   desc: 'Limits cloud sync startup behavior. Review first — may interrupt active sync.',                  badge: 'review', checked: false, disabled: true },
        { id: null, title: 'Sensor Activity Guard',   desc: 'Reduces background location and sensor polling. Review first — affects all apps.',                badge: 'review', checked: false, disabled: true },
        { id: null, title: 'WebDAV Background Guard', desc: 'WebClient service management requires administrator access — coming in a future update.',         badge: 'soon',   checked: false, disabled: true },
        // ── Startup Load ───────────────────────────────────────────────────────
        { _group: 'Startup Load' },
        { id: '__startup__', title: 'Startup Load Review', desc: 'Review which apps launch at boot and disable unnecessary entries. Startup changes apply next restart.', badge: 'next-boot', checked: false, isStartupLink: true },
    ];

    // ── PRX Modal: results state ──
    function showPrxResultsState(procs, ls, data) {
        _scanTimers.forEach(clearTimeout);
        _scanTimers = [];
        if (prxScanBar) prxScanBar.style.width = '100%';
        const steps = prxScanSteps?.querySelectorAll('.prx-scan-step') || [];
        steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });

        const safeProcs      = procs.filter(p => p.safeToClose && !ignoredProcs.has(p.processName));
        const totalProcs     = procs.length;
        const safeCount      = safeProcs.length;
        const totalScanned   = data?.totalScanned || totalProcs;
        const isAdmin        = data?.isAdmin !== false;
        const startupCount   = Array.isArray(data?.startups) ? data.startups.length : 0;
        const estimatedRamMB = safeProcs.reduce((sum, p) => sum + (p.ramMB || 0), 0);
        const totalRamMB     = ls?.totalRamMB || 8192;
        const usedRamMB      = ls?.memoryUsage != null ? Math.round(totalRamMB * (ls.memoryUsage / 100)) : null;
        const afterMemStr    = estimatedRamMB > 0 && usedRamMB != null
            ? `~${((usedRamMB - estimatedRamMB) / 1024).toFixed(1)} GB after close`
            : estimatedRamMB > 0 ? `~${estimatedRamMB} MB to free` : '—';

        // Left card: real scan count (matches Task Manager reality)
        if (prxBaLabelBefore) prxBaLabelBefore.textContent = 'Current';
        const prxBaBeforeUnit = prxBaBefore?.nextElementSibling;
        if (prxBaBefore)     prxBaBefore.textContent     = totalScanned;
        if (prxBaBeforeUnit) prxBaBeforeUnit.textContent  = 'processes scanned';
        if (prxBaBeforeMem)  prxBaBeforeMem.textContent   =
            isAdmin ? `${totalProcs} candidates` : `${totalProcs} candidates · limited visibility`;

        // Right card: when safeCount > 0 show immediate closures; when 0 emphasize module count
        if (prxBaLabelAfter)  prxBaLabelAfter.textContent  = 'Optimization plan';
        const prxBaAfterUnit  = prxBaAfter?.nextElementSibling;
        const activeTweakCount = BG_TWEAKS.filter(t => !t._group && !t.disabled && t.id && t.id !== '__startup__').length;
        if (safeCount > 0) {
            if (prxBaAfter)     prxBaAfter.textContent     = safeCount;
            if (prxBaAfterUnit) prxBaAfterUnit.textContent  = safeCount === 1 ? 'immediate closure' : 'immediate closures';
            if (prxBaAfterMem)  prxBaAfterMem.textContent   = `${activeTweakCount} background modules ready`;
        } else {
            if (prxBaAfter)     prxBaAfter.textContent     = activeTweakCount;
            if (prxBaAfterUnit) prxBaAfterUnit.textContent  = activeTweakCount === 1 ? 'background module' : 'background modules';
            if (prxBaAfterMem)  prxBaAfterMem.textContent   = '0 immediate closures found';
        }

        // Last-scanned timestamp + 60s auto-poll
        const scanTimeEl = document.getElementById('prx-scan-time');
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (scanTimeEl) scanTimeEl.textContent = `Last scanned: ${nowStr}`;
        clearInterval(_prxPollInterval);
        _prxPollInterval = setInterval(() => {
            if (prxModal?.classList.contains('active')) triggerScan();
            else { clearInterval(_prxPollInterval); _prxPollInterval = null; }
        }, 60000);

        // Stats row — do not fabricate CPU savings
        if (prxFreedRam)     prxFreedRam.textContent     = estimatedRamMB > 0 ? `${estimatedRamMB} MB` : '—';
        if (prxFreedCpu)     prxFreedCpu.textContent     = '—'; // CPU impact not reliably measurable
        if (prxSafeCount)    prxSafeCount.textContent    = safeCount;
        if (prxStartupCount) prxStartupCount.textContent = startupCount > 0 ? startupCount : '—';
        if (prxBgTweaksCount) prxBgTweaksCount.textContent = activeTweakCount;

        // Admin notice
        if (prxAdminNotice) prxAdminNotice.classList.toggle('prx-hidden', isAdmin);

        // Apply Safe Close: disable when nothing can be closed
        if (prxApplyBtn) {
            prxApplyBtn.disabled = safeCount === 0;
            prxApplyBtn.title    = safeCount === 0 ? 'No immediate safe closures found on this PC' : '';
        }

        // Immediate safe closures list
        if (prxCloseList) {
            if (safeProcs.length) {
                const shown = safeProcs.slice(0, 8);
                const more  = safeProcs.length > 8 ? safeProcs.length - 8 : 0;
                prxCloseList.innerHTML = shown.map(p => {
                    const nm  = p.name || p.processName || 'Unknown';
                    const cat = p.category || '';
                    const ram = p.ramMB ? `${p.ramMB} MB` : '';
                    return `<div class="prx-close-item">
                        <span class="prx-close-dot"></span>
                        <span class="prx-close-name">${nm}</span>
                        ${cat ? `<span class="prx-close-cat">${cat}</span>` : ''}
                        ${ram ? `<span class="prx-close-ram">${ram}</span>` : ''}
                    </div>`;
                }).join('') + (more ? `<div class="prx-close-more">…and ${more} more recommended</div>` : '');
            } else {
                prxCloseList.innerHTML = `<div class="prx-zero-close-msg">
                    No low-risk helper processes are safe to close right now. Your running apps look clean.<br>
                    Use <strong>Background Modules</strong> and <strong>Startup Review</strong> below for deeper reduction after reboot.
                </div>`;
            }
        }

        // Background Optimization Modules — grouped layout
        if (prxBgTweaksSection) {
            const BADGE = {
                'immediate': { cls: 'prx-badge-immediate', text: 'immediate'       },
                'restart':   { cls: 'prx-badge-restart',   text: 'may need restart' },
                'review':    { cls: 'prx-badge-review',     text: 'review first'    },
                'soon':      { cls: 'prx-badge-soon',       text: 'coming soon'     },
                'next-boot': { cls: 'prx-badge-restart',   text: 'next restart'    },
            };

            const renderItem = t => {
                const b = BADGE[t.badge] || BADGE['review'];
                if (t.isStartupLink) return `
                    <div class="prx-tweak-item prx-tweak-startup-link" role="button" tabindex="0" data-action="startup-review">
                        <div class="prx-tweak-info">
                            <span class="prx-tweak-title">${t.title}</span>
                            <span class="prx-tweak-desc">${t.desc}</span>
                        </div>
                        <span class="prx-tweak-badge ${b.cls}">${b.text}</span>
                        <span class="prx-startup-link-arrow">→</span>
                    </div>`;
                if (t.disabled) return `
                    <div class="prx-tweak-item prx-tweak-disabled">
                        <div class="prx-tweak-info">
                            <span class="prx-tweak-title">${t.title}</span>
                            <span class="prx-tweak-desc">${t.desc}</span>
                        </div>
                        <span class="prx-tweak-badge ${b.cls}">${b.text}</span>
                    </div>`;
                return `
                    <label class="prx-tweak-item">
                        <input type="checkbox" class="prx-tweak-chk" data-tweak-id="${t.id}"${t.checked ? ' checked' : ''}>
                        <div class="prx-tweak-info">
                            <span class="prx-tweak-title">${t.title}</span>
                            <span class="prx-tweak-desc">${t.desc}</span>
                        </div>
                        <span class="prx-tweak-badge ${b.cls}">${b.text}</span>
                    </label>`;
            };

            // Build per-group sections
            const groups = [];
            let cur = null;
            for (const t of BG_TWEAKS) {
                if (t._group) { if (cur) groups.push(cur); cur = { label: t._group, items: [] }; }
                else if (cur) cur.items.push(t);
            }
            if (cur) groups.push(cur);

            const sectionsHtml = groups.map(g => `
                <div class="prx-tweak-group-label">${g.label}</div>
                <div class="prx-tweak-list">${g.items.map(renderItem).join('')}</div>
            `).join('');

            prxBgTweaksSection.innerHTML = `
                <div class="prx-tweaks-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                    Background Optimization Modules
                </div>
                <p class="prx-tweaks-impact-note">Estimated impact is based on this PC's running apps, startup entries, and selected background modules.</p>
                ${sectionsHtml}
                <button class="prx-tweaks-apply-btn" id="prx-tweaks-apply-btn" type="button">Apply Selected Tweaks</button>
                <div class="prx-tweaks-result" id="prx-tweaks-result" hidden></div>
            `;
            document.getElementById('prx-tweaks-apply-btn')?.addEventListener('click', applyBgTweaks);
            document.querySelectorAll('#prx-bg-tweaks-section .prx-tweak-startup-link').forEach(el => {
                el.addEventListener('click', () => {
                    closePrxModal();
                    switchPrxTab('apps');
                    if (startupListEl) {
                        startupListEl.closest?.('[hidden]')?.removeAttribute('hidden');
                        startupListEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else if (installedPanel) {
                        installedPanel.hidden = false;
                        installedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }

        setTimeout(() => {
            prxStateScan?.classList.add('prx-hidden');
            prxStateResults?.classList.remove('prx-hidden');
        }, 380);
    }

    async function applyBgTweaks() {
        const applyBtn = document.getElementById('prx-tweaks-apply-btn');
        const resultEl = document.getElementById('prx-tweaks-result');
        const checked  = [...document.querySelectorAll('#prx-bg-tweaks-section .prx-tweak-chk:checked')];
        if (!checked.length) return;
        if (applyBtn)  { applyBtn.disabled = true; applyBtn.textContent = 'Applying…'; }
        if (resultEl)  { resultEl.hidden = true; }

        let applied = 0, failed = 0;
        for (const chk of checked) {
            const item = chk.closest('.prx-tweak-item');
            try {
                const res = await window.electronAPI?.applyTweak?.(chk.dataset.tweakId, 'apply');
                if (res?.success) {
                    applied++;
                    item?.classList.remove('prx-tweak-failed');
                    item?.classList.add('prx-tweak-applied');
                    chk.disabled = true;
                    console.log('[BG Tweak] Applied:', chk.dataset.tweakId);
                } else {
                    failed++;
                    item?.classList.add('prx-tweak-failed');
                    console.warn('[BG Tweak] Failed:', chk.dataset.tweakId, res);
                }
            } catch (err) {
                failed++;
                item?.classList.add('prx-tweak-failed');
                console.warn('[BG Tweak] Error:', chk.dataset.tweakId, err?.message || err);
            }
        }
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply Selected Tweaks'; }

        // Show honest result — registry writes do NOT instantly lower process count.
        // Effects may appear after restart, sign-out, or the affected app relaunches.
        if (resultEl) {
            resultEl.hidden = false;
            if (applied > 0 && failed === 0) {
                resultEl.className = 'prx-tweaks-result prx-tweaks-result-ok';
                resultEl.innerHTML = `<strong>${applied} setting${applied !== 1 ? 's' : ''} applied.</strong><br>
                    Some changes take effect after restart, sign-out, or app relaunch.<br>
                    Running process count won't change immediately — this is expected.`;
            } else if (applied > 0) {
                resultEl.className = 'prx-tweaks-result prx-tweaks-result-ok';
                resultEl.innerHTML = `<strong>${applied} applied, ${failed} failed.</strong><br>
                    Some changes take effect after restart or sign-out. Run as administrator for full access.`;
            } else {
                resultEl.className = 'prx-tweaks-result prx-tweaks-result-err';
                resultEl.innerHTML = `<strong>No settings could be applied.</strong> Try relaunching as administrator.`;
            }
        }
        // Card labels stay as "Current" / "Optimization plan" — do not imply the count changed.
    }

    // ── PRX Modal: error state ──
    function showPrxErrorState(msg) {
        _scanTimers.forEach(clearTimeout);
        _scanTimers = [];
        if (prxErrorMsg) prxErrorMsg.textContent = msg || 'An error occurred while scanning.';
        prxStateReady?.classList.add('prx-hidden');
        prxStateScan?.classList.add('prx-hidden');
        prxStateResults?.classList.add('prx-hidden');
        prxStateError?.classList.remove('prx-hidden');
    }

    function getSorted(procs) {
        const arr = [...procs];
        if (currentSort === 'name') return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (currentSort === 'category') return arr.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        return arr.sort((a, b) => (b.ramMB || 0) - (a.ramMB || 0));
    }

    function applySearch() {
        const input = document.querySelector('#page-process-reducer .pr-search');
        if (!input) return;
        const query = (input.value || '').toLowerCase().trim();
        document.querySelectorAll('#page-process-reducer .pr-process-row').forEach(row => {
            row.style.display = !query || row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    }

    function updateRestoreCard() {
        const dot  = document.getElementById('prx-restore-dot');
        const text = document.getElementById('prx-restore-status');
        if (closedApps.length) {
            dot?.classList.add('active');
            if (text) text.textContent = `${closedApps.length} app${closedApps.length !== 1 ? 's' : ''} closed`;
            if (prxRestoreBtn) prxRestoreBtn.disabled = false;
        }
    }

    // ── PRX Modal event wiring ──
    prxOpenBtn?.addEventListener('click', openPrxModal);
    prxModalClose?.addEventListener('click', closePrxModal);
    prxModalBackdrop?.addEventListener('click', closePrxModal);
    prxCloseBtn?.addEventListener('click', closePrxModal);
    prxRetryBtn?.addEventListener('click', () => {
        showPrxScanState();
        triggerScan();
    });
    prxReviewPlanBtn?.addEventListener('click', () => {
        closePrxModal();
        switchPrxTab('apps');
        if (startupListEl) {
            startupListEl.closest?.('[hidden]')?.removeAttribute('hidden');
            startupListEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (installedPanel) {
            installedPanel.hidden = false;
            installedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (resultsEl) {
            resultsEl.hidden = false;
            resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    prxApplyBtn?.addEventListener('click', () => {
        closePrxModal();
        triggerSafeReduce();
    });
    prxStartScanBtn?.addEventListener('click', () => {
        if (prxStartScanBtn.dataset.scanning === '1') return;
        triggerScan();
    });

    document.getElementById('prx-refresh-btn')?.addEventListener('click', async () => {
        await window.electronAPI?.clearBgCache?.();
        triggerScan();
    });

    // Escape key closes modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && prxModal?.classList.contains('active')) closePrxModal();
    });

    // ── Confirm Modal (replaces window.confirm) ──
    function showConfirmModal(eligible) {
        return new Promise(resolve => {
            _confirmResolve = resolve;
            if (confirmSub) confirmSub.textContent = `This will safe-close ${eligible.length} non-critical background app${eligible.length !== 1 ? 's' : ''}.`;
            if (confirmList) {
                const shown = eligible.slice(0, 8);
                const more  = eligible.length > 8 ? eligible.length - 8 : 0;
                confirmList.innerHTML = shown.map(p =>
                    `<div class="pr-confirm-list-item">${p.name || p.processName}<span class="pr-confirm-list-cat">${p.category || ''}</span></div>`
                ).join('') + (more ? `<div class="pr-confirm-more">…and ${more} more</div>` : '');
            }
            if (confirmOverlay) {
                confirmOverlay.classList.add('active');
                confirmOverlay.setAttribute('aria-hidden', 'false');
            }
        });
    }
    function hideConfirmModal(result) {
        if (confirmOverlay) {
            confirmOverlay.classList.remove('active');
            confirmOverlay.setAttribute('aria-hidden', 'true');
        }
        if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
    }
    confirmCancel?.addEventListener('click',   () => hideConfirmModal(false));
    confirmContinue?.addEventListener('click', () => hideConfirmModal(true));

    function renderProcessGroups(processes) {
        const safeList    = document.getElementById('pr-safe-list');
        const reviewList  = document.getElementById('pr-review-list');
        const safeCountEl      = document.getElementById('pr-safe-count');
        const revCountEl       = document.getElementById('pr-review-count');
        const safeGroupEl      = document.getElementById('pr-group-safe');
        const reviewGroupEl    = document.getElementById('pr-group-review');
        const protectedGroupEl = document.getElementById('pr-group-protected');
        const scrollEl         = document.querySelector('.prx-results-scroll');

        const visible   = processes.filter(p => !ignoredProcs.has(p.processName));
        const sorted    = getSorted(visible);
        const safeProcs = sorted.filter(p =>  p.safeToClose);
        const revProcs  = sorted.filter(p => !p.safeToClose);

        if (safeCountEl) safeCountEl.textContent = safeProcs.length;
        if (revCountEl)  revCountEl.textContent  = revProcs.length;
        if (safeList)   safeList.innerHTML   = '';
        if (reviewList) reviewList.innerHTML  = '';

        const makeRow = (p, allowClose) => {
            const row = document.createElement('div');
            row.className = 'pr-process-row';
            row.dataset.pid  = p.pid  != null ? String(p.pid) : '';
            row.dataset.proc = p.processName || '';

            const isClosed   = closedApps.some(c => c.processName === p.processName);
            if (isClosed) row.classList.add('closed');

            const ramMB      = p.ramMB != null ? p.ramMB : null;
            const ramText    = ramMB != null ? `${ramMB} MB` : '—';
            // max ~1500 MB for bar scale
            const ramPct     = ramMB != null ? Math.min(100, Math.round((ramMB / 1500) * 100)) : 0;
            const pill       = normalizeCatForPill(p.category);
            const displayName = p.name || p.processName || 'Unknown';
            const isVerified = !!(p.name && p.name !== p.processName);

            // icon cell (colored by category)
            const iconEl = buildIconCell(displayName, p.category);
            iconEl.dataset.cat = pill.key;
            row.appendChild(iconEl);

            const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
            const ignoreSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
            const closeSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

            const actionsHtml = isClosed
                ? `<div class="pr-proc-actions"><span class="pr-row-btn closed-tag">Closed</span></div>`
                : allowClose
                ? `<div class="pr-proc-actions">
                       <button class="pr-row-btn edit-btn" type="button">${editSvg} Edit</button>
                       <button class="pr-row-btn ignore-btn" type="button">${ignoreSvg} Ignore</button>
                       <button class="pr-row-btn close-btn" type="button">${closeSvg} Safe Reduce</button>
                   </div>`
                : `<div class="pr-proc-actions">
                       <button class="pr-row-btn edit-btn" type="button">${editSvg} Edit</button>
                       <button class="pr-row-btn ignore-btn" type="button">${ignoreSvg} Ignore</button>
                   </div>`;

            const rest = document.createElement('div');
            rest.style.display = 'contents';
            rest.innerHTML = `
                <div class="pr-proc-info">
                    <div class="pr-proc-name-row">
                        <span class="pr-proc-name">${displayName}</span>
                        ${isVerified ? '<span class="pr-proc-verified">Verified</span>' : ''}
                    </div>
                    <div class="pr-proc-detail">${p.processName || ''}${p.pid != null ? `<span class="pr-proc-pid"> · PID ${p.pid}</span>` : ''}</div>
                </div>
                <div class="pr-proc-cpu-wrap">
                    <span class="pr-proc-cpu-val">—</span>
                    <div class="pr-proc-cpu-bar"><div class="pr-proc-cpu-fill" style="width:0%"></div></div>
                </div>
                <div class="pr-proc-ram-wrap">
                    <span class="pr-proc-ram-val">${ramText}</span>
                    <div class="pr-proc-ram-bar"><div class="pr-proc-ram-fill" style="width:${ramPct}%"></div></div>
                </div>
                <div class="pr-proc-cat" data-cat="${pill.key}">
                    <span class="pr-proc-cat-dot"></span>${pill.label}
                </div>
                ${actionsHtml}
            `;
            row.appendChild(rest);

            row.querySelector('.edit-btn')?.addEventListener('click', () => openProcReview(p));
            row.querySelector('.ignore-btn')?.addEventListener('click', () => {
                ignoredProcs.add(p.processName);
                row.style.transition = 'opacity 0.2s';
                row.style.opacity = '0';
                setTimeout(() => row.remove(), 220);
                const countEl = p.safeToClose ? safeCountEl : revCountEl;
                if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent, 10) - 1);
            });
            if (allowClose && !isClosed) {
                row.querySelector('.close-btn')?.addEventListener('click', () => closeSingleProcess(p, row));
            }
            return row;
        };

        console.log(`[ProcGroups] total: ${processes.length} | safe: ${safeProcs.length} | review: ${revProcs.length}`);

        if (safeList && safeProcs.length) {
            safeProcs.forEach(p => {
                const row = makeRow(p, true);
                safeList.appendChild(row);
                requestAnimationFrame(() => row.classList.add('pr-revealed'));
            });
        }
        if (reviewList && revProcs.length) {
            revProcs.forEach(p => {
                const row = makeRow(p, false);
                reviewList.appendChild(row);
                requestAnimationFrame(() => row.classList.add('pr-revealed'));
            });
        }

        // Debug: confirm scroll container is actually overflowing
        setTimeout(() => {
            if (scrollEl) {
                const rows = scrollEl.querySelectorAll('.pr-process-row').length;
                console.log(`[ProcGroups] scrollHeight: ${scrollEl.scrollHeight} | clientHeight: ${scrollEl.clientHeight} | rows in DOM: ${rows}`);
            }
        }, 100);

        // Show/hide groups based on content — no empty-box waste
        if (safeGroupEl)      safeGroupEl.style.display      = safeProcs.length ? '' : 'none';
        if (reviewGroupEl)    reviewGroupEl.style.display     = revProcs.length  ? '' : 'none';
        if (protectedGroupEl) protectedGroupEl.style.display  = 'none';

        // Zero-rows message when scan returned nothing closeable
        const zeroMsgId = 'prx-zero-rows-msg';
        const existingZeroMsg = scrollEl?.querySelector('#prx-zero-rows-msg');
        if (safeProcs.length === 0 && revProcs.length === 0) {
            if (!existingZeroMsg && scrollEl) {
                const z = document.createElement('div');
                z.id = zeroMsgId;
                z.className = 'prx-zero-rows-msg';
                z.textContent = 'No detected apps need review right now. Your system looks clean.';
                scrollEl.appendChild(z);
            }
        } else {
            existingZeroMsg?.remove();
        }

        applySearch();
        const pillsEl = document.getElementById('prx-results-pills');
        if (pillsEl) {
            pillsEl.innerHTML = [
                safeProcs.length ? `<span class="prx-res-pill prx-res-pill-safe">${safeProcs.length} safe</span>` : '',
                revProcs.length  ? `<span class="prx-res-pill prx-res-pill-review">${revProcs.length} review</span>` : '',
                `<span class="prx-res-pill prx-res-pill-protected">protected hidden</span>`,
            ].join('');
        }
        const sourceEl = document.getElementById('prx-scan-source');
        if (sourceEl) {
            const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            sourceEl.textContent = `Live scan from this PC · refreshed at ${ts}`;
        }
    }

    async function closeSingleProcess(p, row) {
        if (p.pid == null || !p.safeToClose) return;
        const closeBtn = row.querySelector('.close-btn');
        if (closeBtn) { closeBtn.disabled = true; closeBtn.textContent = '…'; }
        try {
            const result = await window.electronAPI?.closeProcess?.(p.pid, p.processName);
            if (result?.success) {
                row.classList.add('closing');
                setTimeout(() => {
                    row.classList.remove('closing');
                    row.classList.add('closed');
                    const actEl = row.querySelector('.pr-proc-actions');
                    if (actEl) actEl.innerHTML = '<span class="pr-row-btn closed-tag">Closed</span>';
                }, 340);
                closedApps.push({ name: p.name || p.processName, processName: p.processName, category: p.category });
                updateClosedSection();
                if (prxRestoreBtn) prxRestoreBtn.disabled = false;
                showNotification('success', 'Process closed', `${p.name || p.processName} was stopped.`);
            } else {
                if (closeBtn) { closeBtn.disabled = false; closeBtn.textContent = 'Safe Close'; }
                const reason = result?.error === 'not_whitelisted'
                    ? 'Not in the verified safe-close list.'
                    : 'The process could not be stopped.';
                showNotification('error', 'Could not close', reason);
            }
        } catch {
            if (closeBtn) { closeBtn.disabled = false; closeBtn.textContent = 'Safe Close'; }
            showNotification('error', 'Error', 'Could not reach the process manager.');
        }
    }

    function openProcReview(p) {
        // Singleton overlay — created once, reused each open
        let ov = document.getElementById('prx-proc-review-ov');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'prx-proc-review-ov';
            ov.className = 'prx-proc-review-ov';
            ov.setAttribute('hidden', '');
            ov.innerHTML = `
                <div class="prx-proc-review-card" role="dialog" aria-modal="true">
                    <button class="prx-proc-review-x" id="prx-proc-review-x" type="button" aria-label="Close">✕</button>
                    <div class="prx-proc-review-hdr">
                        <div class="prx-proc-review-icon-wrap" id="prx-proc-review-icon"></div>
                        <div class="prx-proc-review-title-col">
                            <span class="prx-proc-review-name" id="prx-proc-review-name"></span>
                            <span class="prx-proc-review-status-pill" id="prx-proc-review-status"></span>
                        </div>
                    </div>
                    <dl class="prx-proc-review-dl" id="prx-proc-review-dl"></dl>
                    <p class="prx-proc-review-reason" id="prx-proc-review-reason"></p>
                    <div class="prx-proc-review-foot" id="prx-proc-review-foot"></div>
                </div>`;
            document.body.appendChild(ov);
            const closeOv = () => ov.setAttribute('hidden', '');
            document.getElementById('prx-proc-review-x').addEventListener('click', closeOv);
            ov.addEventListener('click', e => { if (e.target === ov) closeOv(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hasAttribute('hidden')) closeOv(); });
        }

        const isProtected = !p.safeToClose && (
            p.category === 'System / Windows' ||
            p.category === 'Driver / Hardware' ||
            p.category === 'Anti-Cheat' ||
            p.category === 'Antivirus'
        );
        const status    = p.safeToClose ? 'Safe to Close' : isProtected ? 'Protected' : 'Review First';
        const statusKey = p.safeToClose ? 'safe'          : isProtected ? 'protected' : 'review';
        const reason    = p.safeToClose
            ? 'This looks like a low-risk helper or updater process. It can be included in Safe Reduce to free up memory.'
            : isProtected
            ? 'Windows core services, drivers, antivirus, and system-critical tasks are protected and cannot be closed here.'
            : 'This app is active or user-facing. XTweaks will not close it automatically. You can ignore it or manually review it.';
        const ramText = p.ramMB != null ? `${p.ramMB} MB` : '—';

        document.getElementById('prx-proc-review-name').textContent = p.name || p.processName || 'Unknown';
        const statusEl = document.getElementById('prx-proc-review-status');
        statusEl.textContent = status;
        statusEl.className   = `prx-proc-review-status-pill prx-proc-review-status-${statusKey}`;
        document.getElementById('prx-proc-review-icon').innerHTML = buildIconCell(p.name || p.processName, p.category).outerHTML;
        document.getElementById('prx-proc-review-reason').textContent = reason;

        const dl = document.getElementById('prx-proc-review-dl');
        dl.innerHTML = [
            ['Process',  p.processName || '—'],
            ['PID',      p.pid != null ? String(p.pid) : '—'],
            ['Memory',   ramText],
            ['Category', p.category || 'Unknown'],
            ['Status',   status],
        ].map(([k, v]) => `<div class="prx-proc-review-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

        const foot = document.getElementById('prx-proc-review-foot');
        foot.innerHTML = '';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'prx-proc-review-btn-sec';
        closeBtn.textContent = 'Close'; closeBtn.type = 'button';
        closeBtn.addEventListener('click', () => ov.setAttribute('hidden', ''));
        foot.appendChild(closeBtn);

        if (!isProtected) {
            const ignBtn = document.createElement('button');
            ignBtn.className = 'prx-proc-review-btn-sec';
            ignBtn.textContent = 'Ignore'; ignBtn.type = 'button';
            ignBtn.addEventListener('click', () => {
                ignoredProcs.add(p.processName);
                const rowEl = document.querySelector(`#page-process-reducer .pr-process-row[data-proc="${p.processName}"]`);
                if (rowEl) { rowEl.style.transition = 'opacity 0.2s'; rowEl.style.opacity = '0'; setTimeout(() => rowEl.remove(), 220); }
                ov.setAttribute('hidden', '');
            });
            foot.appendChild(ignBtn);
        }

        if (p.safeToClose && p.pid != null) {
            const reduceBtn = document.createElement('button');
            reduceBtn.className = 'prx-proc-review-btn-primary';
            reduceBtn.textContent = 'Safe Reduce'; reduceBtn.type = 'button';
            reduceBtn.addEventListener('click', async () => {
                reduceBtn.disabled = true; reduceBtn.textContent = 'Closing…';
                const rowEl = document.querySelector(`#page-process-reducer .pr-process-row[data-proc="${p.processName}"]`);
                if (rowEl) await closeSingleProcess(p, rowEl);
                ov.setAttribute('hidden', '');
            });
            foot.appendChild(reduceBtn);
        }

        ov.removeAttribute('hidden');
    }

    function updateClosedSection() {
        const section      = document.getElementById('pr-closed-section');
        const list         = document.getElementById('pr-closed-list');
        const historyEmpty = document.getElementById('prx-history-empty');
        if (!section || !list) return;
        if (!closedApps.length) { section.hidden = true; return; }
        section.hidden = false;
        if (historyEmpty) historyEmpty.hidden = true;
        list.innerHTML = closedApps.map(c => `
            <div class="pr-closed-row">
                <span class="pr-closed-name">${c.name}</span>
                <span class="pr-closed-hint">${c.category} &middot; Relaunch from taskbar or Start menu</span>
            </div>
        `).join('');
    }

    function renderStartupItems(entries) {
        if (!startupListEl) return;
        if (!entries || !entries.length) {
            startupListEl.innerHTML = '<div class="pr-proc-empty">No startup items found.</div>';
            return;
        }
        const all = entries.slice(0, 50);
        startupListEl.innerHTML = '';
        all.forEach(s => {
            const name     = s.name || s.display || 'Unknown';
            const category = s.category || 'Unknown';
            const loc      = s.location || '';
            const bucket   = s.bucket || (s.safe ? 'safe' : 'unknown');
            const type     = loc.toLowerCase().includes('hkcu') ? 'User' : loc ? 'System' : 'Unknown';

            const card = document.createElement('div');
            card.className = 'pr-su-card';

            // icon / initial
            const key = getCategoryKey(category);
            const svg = CAT_ICONS[key] || CAT_ICONS['default'];
            const iconEl = document.createElement('div');
            iconEl.className = 'pr-su-icon';
            if (key !== 'default') {
                iconEl.innerHTML = svg;
            } else {
                iconEl.textContent = name.charAt(0).toUpperCase();
            }

            const badgeClass = bucket === 'safe' ? 'safe' : bucket === 'protected' ? 'system' : 'review';
            const badgeLabel = bucket === 'safe' ? 'Safe' : bucket === 'protected' ? 'System' : 'Review';

            const body = document.createElement('div');
            body.className = 'pr-su-body';
            body.innerHTML = `<div class="pr-su-name">${name}</div><div class="pr-su-meta">${category} &bull; ${type}</div>`;

            const badge = document.createElement('span');
            badge.className = `pr-su-badge ${badgeClass}`;
            badge.textContent = badgeLabel;

            card.appendChild(iconEl);
            card.appendChild(body);
            card.appendChild(badge);

            if (bucket === 'safe' && (loc.toLowerCase().includes('hkcu') || loc.toLowerCase().includes('hklm'))) {
                const disableBtn = document.createElement('button');
                disableBtn.className = 'pr-su-disable-btn';
                disableBtn.type = 'button';
                disableBtn.textContent = 'Disable';
                disableBtn.addEventListener('click', async () => {
                    disableBtn.disabled = true;
                    disableBtn.textContent = '…';
                    try {
                        const res = await window.electronAPI?.disableStartupEntry?.(name, loc);
                        if (res?.success) {
                            disableBtn.textContent = 'Disabled';
                            badge.className = 'pr-su-badge system';
                            badge.textContent = 'Disabled';
                            showNotification('success', 'Startup disabled', `${name} will no longer launch at startup.`);
                        } else {
                            disableBtn.disabled = false;
                            disableBtn.textContent = 'Disable';
                            showNotification('error', 'Could not disable', res?.error === 'manual_required' ? 'Manual removal required for this entry.' : 'Operation failed.');
                        }
                    } catch {
                        disableBtn.disabled = false;
                        disableBtn.textContent = 'Disable';
                        showNotification('error', 'Error', 'Could not reach the startup manager.');
                    }
                });
                card.appendChild(disableBtn);
            } else {
                const tag = document.createElement('span');
                tag.className = 'pr-su-coming-tag';
                tag.textContent = 'Review only';
                card.appendChild(tag);
            }

            startupListEl.appendChild(card);
        });
    }

    function showModal(beforeCount, totalEligible) {
        if (!modalOverlay) return;
        if (modalFill)   modalFill.style.width   = '0%';
        if (modalPct)    modalPct.textContent     = '0%';
        if (modalProc)   modalProc.textContent    = 'Preparing…';
        if (modalCounts) modalCounts.textContent  = `Before: ${beforeCount} processes — closing ${totalEligible}`;
        modalOverlay.classList.add('active');
        modalOverlay.setAttribute('aria-hidden', 'false');
    }
    function hideModal() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('active');
        modalOverlay.setAttribute('aria-hidden', 'true');
    }
    function showSuccessCard(before, after, ramFreedMB, startupChanged) {
        if (!successOverlay || !successStats) return;
        const stopped = before - after;
        let html = `<strong>${before}</strong> → <strong>${after}</strong> active processes<br>`;
        html += `<strong>${stopped}</strong> app${stopped !== 1 ? 's' : ''} stopped`;
        if (ramFreedMB > 0) html += `<br>~<strong>${ramFreedMB} MB</strong> RAM freed`;
        const restartNote = startupChanged
            ? 'Startup changes apply on next restart.'
            : 'No restart required. Changes take effect immediately.';
        html += `<br><span class="pr-success-restart-note">${restartNote}</span>`;
        successStats.innerHTML = html;
        successOverlay.classList.add('active');
        successOverlay.setAttribute('aria-hidden', 'false');
    }
    function hideSuccessCard() {
        if (!successOverlay) return;
        successOverlay.classList.remove('active');
        successOverlay.setAttribute('aria-hidden', 'true');
    }

    // ── Main scan trigger (called from Start Scan button inside modal) ──
    async function triggerScan() {
        if (prxStartScanBtn?.dataset.scanning === '1') return;
        if (prxStartScanBtn) { prxStartScanBtn.dataset.scanning = '1'; prxStartScanBtn.disabled = true; }

        showPrxScanState();
        setStatus('Scanning background processes…', true);
        if (resultsEl) resultsEl.hidden = true;

        try {
            const [data, ls] = await Promise.all([
                window.electronAPI?.getBackgroundContext?.(),
                window.electronAPI?.getLiveStats?.().catch(() => null),
            ]);

            if (!startupDataLoaded) {
                window.electronAPI?.getStartupContext?.().then(su => {
                    startupDataLoaded = true;
                    const all = [
                        ...(su?.registryEntries || []),
                        ...(su?.folderEntries   || []),
                    ];
                    if (startupListEl) {
                        startupListEl.dataset.pending = JSON.stringify(all.slice(0, 50));
                    }
                }).catch(() => {});
            }

            prProcesses     = data?.processes || [];
            liveStatsBefore = ls;

            renderProcessGroups(prProcesses);
            if (resultsEl) {
                resultsEl.hidden = false;
                const appsEmpty = document.getElementById('prx-apps-empty');
                if (appsEmpty) appsEmpty.style.display = 'none';
            }

            const safeCount    = prProcesses.filter(p => p.safeToClose && !ignoredProcs.has(p.processName)).length;
            const totalScanned = data?.totalScanned || prProcesses.length;
            setStatus(`Scanned ${totalScanned} processes — ${prProcesses.length} candidates, ${safeCount} safe to close.`, false);

            await new Promise(r => setTimeout(r, 500));
            showPrxResultsState(prProcesses, ls, data);

            if (prxLastScanBar) prxLastScanBar.hidden = false;
            if (advancedBtn) advancedBtn.disabled = prProcesses.length === 0;

            const mainStatusEl = document.getElementById('prx-main-status');
            if (mainStatusEl) mainStatusEl.textContent = safeCount > 0 ? `${safeCount} safe to close` : 'System looks clean';

        } catch (err) {
            console.error('[Process Reducer] Scan error:', err);
            const reason = (err && err.message) ? err.message : 'Process backend unavailable';
            showPrxErrorState(`Scan failed — ${reason}. Try again or relaunch the app.`);
            setStatus('Scan failed — process backend unavailable.', false);
        } finally {
            if (prxStartScanBtn) { prxStartScanBtn.dataset.scanning = ''; prxStartScanBtn.disabled = false; }
        }
    }

    // ── Safe Reduce (triggered from modal results or tool buttons) ──
    async function triggerSafeReduce() {
        const eligible = prProcesses.filter(p =>
            p.safeToClose &&
            !closedApps.some(c => c.processName === p.processName) &&
            !ignoredProcs.has(p.processName)
        );
        if (!eligible.length) {
            showNotification('info', 'Nothing to reduce', 'No safe-to-close processes found. Run a scan first.');
            return;
        }

        const ok = await showConfirmModal(eligible);
        if (!ok) return;

        cancelRequested = false;
        const beforeCount = prProcesses.filter(p => !closedApps.some(c => c.processName === p.processName)).length;
        showModal(beforeCount, eligible.length);
        setStatus(`Reducing ${eligible.length} process${eligible.length !== 1 ? 'es' : ''}…`, true);

        let closed = 0, ramFreed = 0;
        for (let i = 0; i < eligible.length; i++) {
            if (cancelRequested) break;
            const p   = eligible[i];
            const pct = Math.round(((i + 1) / eligible.length) * 100);
            if (modalProc)   modalProc.textContent   = p.name || p.processName;
            if (modalFill)   modalFill.style.width   = `${pct}%`;
            if (modalPct)    modalPct.textContent    = `${pct}%`;
            if (modalCounts) modalCounts.textContent = `Closing ${i + 1} of ${eligible.length}…`;
            try {
                const result = await window.electronAPI?.closeProcess?.(p.pid, p.processName);
                if (result?.success) {
                    closed++;
                    ramFreed += p.ramMB || 0;
                    closedApps.push({ name: p.name || p.processName, processName: p.processName, category: p.category });
                    const row = resultsEl?.querySelector(`.pr-process-row[data-proc="${p.processName}"]`);
                    if (row) {
                        row.classList.add('closed');
                        const actEl = row.querySelector('.pr-proc-actions');
                        if (actEl) actEl.innerHTML = '<span class="pr-row-btn closed-tag">Closed</span>';
                    }
                }
            } catch { /* continue */ }
        }

        hideModal();
        updateClosedSection();
        updateRestoreCard();
        setStatus(cancelRequested ? 'Reduction cancelled.' : `Closed ${closed} of ${eligible.length} process${eligible.length !== 1 ? 'es' : ''}.`, false);

        if (!cancelRequested && closed > 0) {
            showSuccessCard(beforeCount, beforeCount - closed, ramFreed, false);
        } else if (!cancelRequested) {
            showNotification('error', 'Nothing stopped', 'Processes could not be closed. They may have already exited.');
        }
    }

    // ── Modal Cancel ──
    modalCancel?.addEventListener('click', () => {
        cancelRequested = true;
        hideModal();
        setStatus('Reduction cancelled.', false);
    });

    // ── Success Card Buttons ──
    document.getElementById('pr-success-review-btn')?.addEventListener('click', () => {
        hideSuccessCard();
        switchPrxTab('apps');
        resultsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('pr-success-restore-btn')?.addEventListener('click', () => {
        hideSuccessCard();
        updateClosedSection();
        switchPrxTab('history');
        const section = document.getElementById('pr-closed-section');
        if (section) { section.hidden = false; section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        showNotification('info', 'Restore Guide', `${closedApps.length} app${closedApps.length !== 1 ? 's were' : ' was'} closed. Relaunch from taskbar or Start menu.`);
    });

    // ── Advanced Review ──
    advancedBtn?.addEventListener('click', () => {
        const isAdvanced = advancedBtn.dataset.advanced === '1';
        if (isAdvanced) {
            advancedBtn.dataset.advanced = '';
            advancedBtn.textContent = 'Advanced Review';
            const reviewList = document.getElementById('pr-review-list');
            if (reviewList) reviewList.innerHTML = '';
            const revProcs = getSorted(prProcesses.filter(p => !p.safeToClose && !ignoredProcs.has(p.processName)));
            revProcs.forEach(p => {
                const row = document.createElement('div');
                row.className = 'pr-process-row pr-revealed';
                row.dataset.pid  = p.pid != null ? String(p.pid) : '';
                row.dataset.proc = p.processName || '';
                const isClosed    = closedApps.some(c => c.processName === p.processName);
                if (isClosed) row.classList.add('closed');
                const pill        = normalizeCatForPill(p.category);
                const displayName = p.name || p.processName || 'Unknown';
                const isVerified  = !!(p.name && p.name !== p.processName);
                const ramMB       = p.ramMB != null ? p.ramMB : null;
                const ramPct      = ramMB != null ? Math.min(100, Math.round((ramMB / 1500) * 100)) : 0;
                const iconEl      = buildIconCell(displayName, p.category);
                iconEl.dataset.cat = pill.key;
                row.appendChild(iconEl);
                const rest = document.createElement('div');
                rest.style.display = 'contents';
                rest.innerHTML = `
                    <div class="pr-proc-info">
                        <div class="pr-proc-name-row"><span class="pr-proc-name">${displayName}</span>${isVerified ? '<span class="pr-proc-verified">Verified</span>' : ''}</div>
                        <div class="pr-proc-detail">${p.processName || ''}</div>
                    </div>
                    <div class="pr-proc-cpu-wrap"><span class="pr-proc-cpu-val">—</span><div class="pr-proc-cpu-bar"><div class="pr-proc-cpu-fill" style="width:0%"></div></div></div>
                    <div class="pr-proc-ram-wrap"><span class="pr-proc-ram-val">${ramMB != null ? ramMB + ' MB' : '—'}</span><div class="pr-proc-ram-bar"><div class="pr-proc-ram-fill" style="width:${ramPct}%"></div></div></div>
                    <div class="pr-proc-cat" data-cat="${pill.key}"><span class="pr-proc-cat-dot"></span>${pill.label}</div>
                    <div class="pr-proc-actions">${isClosed ? '<span class="pr-row-btn closed-tag">Closed</span>' : ''}</div>
                `;
                row.appendChild(rest);
                if (reviewList) reviewList.appendChild(row);
            });
        } else {
            advancedBtn.dataset.advanced = '1';
            advancedBtn.textContent = 'Exit Advanced Review';
            const closeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
            const revProcs = prProcesses.filter(p => !p.safeToClose && !ignoredProcs.has(p.processName));
            revProcs.forEach(p => {
                const row = document.querySelector(`#pr-review-list .pr-process-row[data-proc="${p.processName}"]`);
                if (!row) return;
                const actEl = row.querySelector('.pr-proc-actions');
                if (!actEl || actEl.querySelector('.close-btn')) return;
                const isClosed = closedApps.some(c => c.processName === p.processName);
                if (isClosed) return;
                const btn = document.createElement('button');
                btn.className = 'pr-row-btn close-btn';
                btn.type = 'button';
                btn.innerHTML = `${closeSvg} Safe Reduce`;
                btn.addEventListener('click', () => closeSingleProcess(p, row));
                actEl.appendChild(btn);
            });
            showNotification('info', 'Advanced Review', 'Review-bucket processes now have close buttons. Use caution — they may affect system features.');
        }
    });

    // ── Restore / Session History card ──
    prxRestoreBtn?.addEventListener('click', () => {
        if (!closedApps.length) {
            showNotification('info', 'No session data', 'No apps have been closed this session yet.');
            return;
        }
        updateClosedSection();
        switchPrxTab('history');
        const section = document.getElementById('pr-closed-section');
        if (section) { section.hidden = false; section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        showNotification('info', 'Restore Guide', `${closedApps.length} app${closedApps.length !== 1 ? 's were' : ' was'} closed this session. Relaunch from taskbar or Start menu.`);
    });

    // ── Tab panel switcher ──
    async function refreshLiveProcessStats() {
        if (!prProcesses.length) return;
        try {
            const raw = await window.electronAPI?.getLiveProcessStats?.();
            if (!raw || !Array.isArray(raw)) return;
            // Build map: processName key → summed RAM across all instances with same name
            const liveMap = new Map();
            for (const p of raw) {
                const key = (p.Name || '').toLowerCase().replace(/\s+/g, '');
                if (!key) continue;
                const prev = liveMap.get(key);
                const ram = typeof p.RAM_MB === 'number' ? p.RAM_MB : 0;
                liveMap.set(key, { pid: p.Id, ramMB: (prev?.ramMB || 0) + ram });
            }
            // Update prProcesses data model
            prProcesses = prProcesses.filter(p => liveMap.has(p.processName));
            prProcesses.forEach(p => {
                const live = liveMap.get(p.processName);
                if (live) p.ramMB = live.ramMB;
            });
            // Update DOM in-place — no rebuild, no flash, scroll stays put
            document.querySelectorAll('#page-process-reducer .pr-process-row').forEach(row => {
                const procName = row.dataset.proc;
                if (!procName) return;
                const live = liveMap.get(procName);
                if (!live) {
                    // Process ended — fade out and remove
                    row.style.transition = 'opacity 0.3s';
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 320);
                } else {
                    // Update RAM bar and value only
                    const ramMB  = live.ramMB;
                    const ramPct = Math.min(100, Math.round((ramMB / 1500) * 100));
                    const ramVal  = row.querySelector('.pr-proc-ram-val');
                    const ramFill = row.querySelector('.pr-proc-ram-fill');
                    if (ramVal)  ramVal.textContent  = `${ramMB} MB`;
                    if (ramFill) ramFill.style.width  = `${ramPct}%`;
                }
            });
            // Update timestamp only (no full pills rebuild)
            const sourceEl = document.getElementById('prx-scan-source');
            if (sourceEl) {
                const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                sourceEl.textContent = `Live scan from this PC · refreshed at ${ts}`;
            }
        } catch { /* silent — don't disrupt UI on transient PS error */ }
    }

    function switchPrxTab(name) {
        // Always stop the live refresh; restart below only when landing on Apps
        if (_prxAppsLiveInterval) { clearInterval(_prxAppsLiveInterval); _prxAppsLiveInterval = null; }

        const panels = ['overview', 'apps', 'history'];
        panels.forEach(n => {
            const panel = document.getElementById(`prx-panel-${n}`);
            panel?.classList.toggle('prx-tab-hidden', n !== name);
        });
        page.querySelectorAll('.prx-filter-tab').forEach(t => {
            t.classList.toggle('prx-filter-active', t.dataset.prxTab === name);
        });
        // Re-enforce results visibility when returning to Apps tab if scan data exists
        if (name === 'apps' && prProcesses.length > 0) {
            if (resultsEl) resultsEl.hidden = false;
            const appsEmpty = document.getElementById('prx-apps-empty');
            if (appsEmpty) appsEmpty.style.display = 'none';
            // Start 3-second live refresh while user is on Apps tab
            _prxAppsLiveInterval = setInterval(refreshLiveProcessStats, 3000);
        }
    }

    // Wheel handler: when hovering the row list, scroll the card first.
    // preventDefault (non-passive) prevents the outer .content from also scrolling
    // when the card still has rows to reveal — matches the user's expectation that
    // the card is the scroll target. Once the card hits top/bottom, the event is
    // left un-prevented and outer page scroll takes over naturally.
    (function () {
        const sc = document.querySelector('#prx-panel-apps .prx-results-scroll');
        if (!sc) return;
        sc.addEventListener('wheel', e => {
            const atTop    = sc.scrollTop <= 0 && e.deltaY < 0;
            const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1 && e.deltaY > 0;
            if (atTop || atBottom) return;   // at boundary — let outer page scroll
            e.preventDefault();              // card has more rows — scroll card only
            sc.scrollTop += e.deltaY;
        }, { passive: false });
    }());

    document.getElementById('prx-filter-tabs')?.addEventListener('click', e => {
        const tab = e.target.closest('[data-prx-tab]');
        if (!tab) return;

        // Tab press animation
        tab.classList.remove('prx-is-activating');
        void tab.offsetWidth;
        tab.classList.add('prx-is-activating');
        tab.addEventListener('animationend', () => tab.classList.remove('prx-is-activating'), { once: true });

        switchPrxTab(tab.dataset.prxTab);
    });

    // Open modal from Apps empty state button
    document.getElementById('prx-apps-open-btn')?.addEventListener('click', openPrxModal);

    // ── Tool card buttons ──
    document.getElementById('prx-startup-btn')?.addEventListener('click', () => {
        if (!startupDataLoaded) {
            showNotification('info', 'Scan first', 'Run a scan to load startup item data.');
            return;
        }
        switchPrxTab('apps');
        if (installedPanel) {
            installedPanel.hidden = false;
            installedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (startupListEl?.dataset.pending) {
            try {
                const pending = JSON.parse(startupListEl.dataset.pending);
                delete startupListEl.dataset.pending;
                renderStartupItems(pending);
            } catch {}
        }
    });

    document.getElementById('prx-mem-hog-btn')?.addEventListener('click', () => {
        if (!prProcesses.length) {
            showNotification('info', 'Scan first', 'Run a scan to identify memory hogs.');
            return;
        }
        const top = [...prProcesses].sort((a, b) => (b.ramMB || 0) - (a.ramMB || 0)).slice(0, 5);
        const msg = top.map(p => `${p.name || p.processName}: ${p.ramMB || 0} MB`).join(' · ');
        showNotification('info', 'Top Memory Users', msg);
    });

    document.getElementById('prx-tray-btn')?.addEventListener('click', () => {
        if (!prProcesses.length) {
            showNotification('info', 'Scan first', 'Run a scan to detect tray apps.');
            return;
        }
        const tray = prProcesses.filter(p => {
            const c = (p.category || '').toLowerCase();
            return c.includes('tray') || c.includes('updater') || c.includes('launcher') || c.includes('overlay');
        });
        if (!tray.length) {
            showNotification('info', 'No tray apps', 'No known tray apps detected in this scan.');
            return;
        }
        const msg = tray.slice(0, 4).map(p => p.name || p.processName).join(', ');
        showNotification('info', `${tray.length} Tray Apps Found`, `${msg}${tray.length > 4 ? '…' : ''}. View full scan for details.`);
    });

    // ── Live Process Snapshot card (Apps tab) ──
    (function initPrxSnapshot() {
        const MAX_HIST  = 30;
        let cpuHistory  = [];
        let bootTime    = null;
        let _snapIntvl  = null;

        function fmtUptime(sec) {
            const d = Math.floor(sec / 86400);
            const h = Math.floor((sec % 86400) / 3600);
            const m = Math.floor((sec % 3600) / 60);
            if (d > 0) return `${d}d ${h}h`;
            if (h > 0) return `${h}h ${m}m`;
            return `${m}m`;
        }

        function fmtNum(n) {
            return n >= 1000 ? n.toLocaleString() : String(n);
        }

        function updateSparkline() {
            if (cpuHistory.length < 2) return;
            const W = 200, H = 26, pad = 2;
            const step = W / (MAX_HIST - 1);
            const pts = cpuHistory.map((v, i) => {
                const x = (i * step).toFixed(1);
                const y = (H - pad - ((v / 100) * (H - pad * 2))).toFixed(1);
                return `${x},${y}`;
            });
            const lineEl = document.getElementById('snap-spark-line');
            const fillEl = document.getElementById('snap-spark-fill');
            if (lineEl) lineEl.setAttribute('points', pts.join(' '));
            if (fillEl && pts.length >= 2) {
                const lastX = (( cpuHistory.length - 1) * step).toFixed(1);
                fillEl.setAttribute('points', `${pts.join(' ')} ${lastX},${H} 0,${H}`);
            }
        }

        async function tick() {
            try {
                const stats = await window.electronAPI?.getLiveStats?.();
                if (!stats) return;
                const cpu  = Math.round(stats.cpuUsage    || 0);
                const mem  = Math.round(stats.memoryUsage || 0);
                const prcs = stats.processCount || 0;
                const thrd = stats.threadCount  || 0;
                const hndl = stats.handleCount  || 0;

                const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
                set('snap-cpu',     `${cpu}%`);
                set('snap-procs',   prcs > 0 ? fmtNum(prcs) : '—');
                set('snap-mem',     `${mem}%`);
                set('snap-threads', thrd > 0 ? `${fmtNum(thrd)} threads`  : '—');
                set('snap-handles', hndl > 0 ? `${fmtNum(hndl)} handles`  : '—');
                set('snap-time',    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

                if (bootTime) {
                    const elapsed = Math.round((Date.now() - bootTime) / 1000);
                    set('snap-uptime', fmtUptime(elapsed));
                }

                cpuHistory.push(cpu);
                if (cpuHistory.length > MAX_HIST) cpuHistory.shift();
                updateSparkline();
            } catch {}
        }

        function startPoll() {
            if (_snapIntvl) return;
            tick();
            _snapIntvl = setInterval(tick, 3000);
        }
        function stopPoll() {
            clearInterval(_snapIntvl);
            _snapIntvl = null;
        }

        // Load static CPU info once (synchronous Node.js os.cpus(), zero PS cost)
        window.electronAPI?.getCpuStatic?.().then(info => {
            if (!info) return;
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            set('snap-cpu-model', info.model);
            set('snap-cores',    `${info.logicalCores} logical cores`);
            set('snap-clock',    `${info.speedMHz} MHz`);
            bootTime = Date.now() - info.uptimeSeconds * 1000;
        }).catch(() => {});

        // Start polling; stop when Processes page is hidden
        startPoll();
        const prxPage = document.getElementById('page-process-reducer');
        if (prxPage) {
            new MutationObserver(() => {
                prxPage.hidden ? stopPoll() : startPoll();
            }).observe(prxPage, { attributes: true, attributeFilter: ['hidden'] });
        }
    })();

    // ── Fix 7: Module cards on overview page ──
    function renderModuleCards() {
        const container = document.getElementById('prx-module-cards');
        if (!container) return;
        const BADGE_MAP = {
            'immediate': { cls: 'prx-badge-immediate', text: 'immediate'        },
            'restart':   { cls: 'prx-badge-restart',   text: 'may need restart' },
            'review':    { cls: 'prx-badge-review',     text: 'review first'    },
            'soon':      { cls: 'prx-badge-soon',       text: 'coming soon'     },
        };
        const modules = BG_TWEAKS.filter(t => !t._group && !t.disabled && t.id && t.id !== '__startup__');
        if (!modules.length) return;

        const cardsHtml = modules.map(t => {
            const b = BADGE_MAP[t.badge] || BADGE_MAP['review'];
            const isReview = t.badge === 'review';
            const footBtn  = isReview
                ? `<button class="prx-mc-review-btn" data-module-id="${t.id}" type="button">Review First</button>`
                : `<button class="prx-mc-apply-btn"  data-module-id="${t.id}" type="button">Apply</button>`;
            return `<div class="prx-module-card" data-module-id="${t.id}">
                <div class="prx-mc-shine" aria-hidden="true"></div>
                <div class="prx-mc-top">
                    <span class="prx-mc-title">${t.title}</span>
                    <span class="prx-tweak-badge ${b.cls}">${b.text}</span>
                </div>
                <p class="prx-mc-desc">${t.desc}</p>
                <div class="prx-mc-foot">${footBtn}</div>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div class="prx-section-top prx-section-top-sm" style="margin-top:18px">
                <span class="prx-section-label-sm">Background Optimization Modules</span>
            </div>
            <div class="prx-mc-grid">${cardsHtml}</div>`;

        async function applyModule(id, btn) {
            const card = btn.closest('.prx-module-card');
            btn.disabled = true; btn.textContent = 'Applying…';
            try {
                const res = await window.electronAPI?.applyTweak?.(id, 'apply');
                if (res?.success) { card?.classList.add('prx-mc-applied'); btn.textContent = 'Applied'; }
                else { card?.classList.add('prx-mc-failed'); btn.textContent = 'Failed'; btn.disabled = false; }
            } catch { card?.classList.add('prx-mc-failed'); btn.textContent = 'Failed'; btn.disabled = false; }
        }

        container.querySelectorAll('.prx-mc-apply-btn').forEach(btn => {
            btn.addEventListener('click', () => applyModule(btn.dataset.moduleId, btn));
        });

        // Review-first cards: first click shows description + changes to "Apply Anyway", second click applies
        container.querySelectorAll('.prx-mc-review-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.dataset.confirmed !== '1') {
                    btn.dataset.confirmed = '1';
                    btn.textContent = 'Apply Anyway';
                    const mod = BG_TWEAKS.find(t => t.id === btn.dataset.moduleId);
                    showNotification('info', mod?.title || 'Review First', mod?.desc || 'Review this action before applying.', { duration: 4200 });
                    return;
                }
                await applyModule(btn.dataset.moduleId, btn);
            });
        });
    }
    renderModuleCards();

    enhancePrxCards();
}

const GAMING_CARD_DESCRIPTIONS = {
    'gaming-game-bar': 'Control the Xbox Game Bar overlay and background capture behavior.',
    'gaming-game-mode': 'Tune Windows Game Mode behavior for smoother gaming sessions.',
    'gaming-mouse-accel': 'Adjust pointer precision behavior for more consistent aim and input.',
    'gaming-fullscreen-opt': 'Control Windows fullscreen optimization behavior for game compatibility.'
};

function enhanceToggleCards() {
    const cards = document.querySelectorAll('.toggle-card[data-toggle]');
    cards.forEach(card => {
        if (card.dataset.enhanced === '1') return;
        // System & Memory cards ship their own premium pcard markup (icon, tags,
        // status, action button) and are wired in initializeSystemPage/Memory.
        // Skip them so this generic enhancer doesn't overwrite that structure.
        if (card.classList.contains('sys-pcard') || card.classList.contains('mem-pcard')) return;
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

        if (card.classList.contains('gaming-pcard')) {
            const detail = TOGGLE_DETAILS[id] || {};
            const cardDesc = GAMING_CARD_DESCRIPTIONS[id] || desc;
            card.innerHTML = `
                <span class="tc-aurora" aria-hidden="true"></span>
                <span class="tc-shine" aria-hidden="true"></span>
                <span class="tc-accent" aria-hidden="true"></span>
                <div class="pcard-top">
                    <div class="pcard-icon-wrap">${getToggleIconHtml(id)}</div>
                    <span class="pcard-cat-pill">${detail.category || 'Gaming'}</span>
                </div>
                <div class="pcard-body">
                    <h4 class="pcard-title">${title}</h4>
                    <p class="pcard-desc">${cardDesc}</p>
                </div>
                <div class="pcard-tags">
                    <span class="pcard-tag">${detail.impact || 'Medium'} impact</span>
                    <span class="pcard-tag">Local</span>
                </div>
                <div class="pcard-foot">
                    <div class="pcard-status">
                        <span class="tc-status-dot"></span>
                        <span class="pcard-status-text">${isChecked ? 'Enabled' : 'Disabled'}</span>
                    </div>
                </div>
            `;
        } else {
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
        }
        // Re-attach the original toggle switch (preserves its event listeners)
        (card.querySelector('.tc-foot') || card.querySelector('.pcard-foot')).appendChild(sw);

        // Mirror state to .on / .off classes
        const sync = () => {
            card.classList.toggle('on', !!input.checked);
            card.classList.toggle('off', !input.checked);
            const txt = card.querySelector('.tc-status-text, .pcard-status-text');
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

function enhancePrxCards() {
    const cards = document.querySelectorAll(
        '#page-process-reducer .prx-pcard, #page-process-reducer .prx-adv-card'
    );
    cards.forEach(card => {
        if (card.dataset.prxEnhanced === '1') return;
        card.dataset.prxEnhanced = '1';

        card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
            card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
        });

        const body  = card.dataset.hoverBody || '';
        const cat   = card.dataset.hoverCat  || 'Process Tool';
        const hint  = card.dataset.hoverHint || 'Click to use';
        const title = card.querySelector('.pcard-title, .adv-card-titles h4')?.textContent || '';
        if (!body) return;

        let showTimer;
        card.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => {
                const tt = ensureTooltip();
                tt.dataset.cat = 'process';
                tt.dataset.impact = 'low';
                tt.querySelector('.tt-title').textContent = title;
                tt.querySelector('.tt-cat').textContent = cat;
                tt.querySelector('.tt-impact-text').textContent = 'Safe';
                tt.querySelector('.tt-body').textContent = body;
                tt.querySelector('.tt-state-text').textContent = 'Ready';
                tt.querySelector('.tt-hint').textContent = hint;
                tt.classList.remove('is-on');
                tt.classList.add('is-ready');

                const rect = card.getBoundingClientRect();
                const ttWidth = 320, margin = 12;
                let left = rect.left + rect.width / 2 - ttWidth / 2;
                left = Math.max(margin, Math.min(left, window.innerWidth - ttWidth - margin));
                let top = rect.bottom + 10;
                let placeAbove = false;
                if (top + 220 > window.innerHeight) { top = rect.top - 10; placeAbove = true; }
                tt.style.left = `${left}px`;
                tt.style.top  = `${top}px`;
                tt.classList.toggle('place-above', placeAbove);
                tt.style.setProperty('--arrow-left', `${(rect.left + rect.width / 2) - left}px`);
                tt.classList.add('visible');
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
        if (document.getElementById('page-network')?.classList.contains('active')) {
            scheduleNetworkCardsOnEntry({ source: 'page-enter' });
        }
        if (document.getElementById('page-gaming')?.classList.contains('active')) {
            scheduleGamingCardsOnEntry({ source: 'page-enter' });
        }
        // Dashboard initial-load animation is anchored to window.load below
        // to avoid running during the black/unpainted window phase.
    }, 0);
});

// Dashboard cold-launch entrance: delay until after first real paint.
// window.load fires after all resources are parsed; the extra 380 ms gives
// Electron time to composite the first visible frame before the animation starts.
// Navigation-triggered replays go through activatePage → scheduleDashboardCardsOnEntry
// and are unaffected by this block.
window.addEventListener('load', () => {
    setTimeout(() => {
        scheduleDashboardCardsOnEntry({ source: 'page-enter' });
        if (document.getElementById('page-cleanup')?.classList.contains('active')) {
            scheduleCleanupCardsOnEntry({ source: 'page-enter' });
        }
        if (document.getElementById('page-settings')?.classList.contains('active')) {
            scheduleSettingsCardsOnEntry({ source: 'page-enter' });
        }
    }, 380);
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

        // ── Always show NVIDIA + AMD tabs (plus any extra detected vendors) ──
        const TAB_LABEL = { nvidia: 'NVIDIA', amd: 'AMD / Radeon', intel: 'Intel', unknown: 'Unknown' };
        const tabVendors = ['nvidia', 'amd'];
        uniqueGpus.forEach(g => { if (!tabVendors.includes(g.vendor)) tabVendors.push(g.vendor); });

        gpuVendorTabs.textContent = '';
        tabVendors.forEach(vendor => {
            const isDetected = uniqueGpus.some(g => g.vendor === vendor);
            const btn = document.createElement('button');
            btn.className = 'gpu-vendor-tab'
                + (vendor === defaultVendor ? ' active' : '')
                + (!isDetected ? ' gpu-vendor-tab--preview' : '');
            btn.dataset.vendor = vendor;
            btn.textContent = TAB_LABEL[vendor] || VENDOR_NAME[vendor];
            btn.addEventListener('click', () => {
                gpuVendorTabs.querySelectorAll('.gpu-vendor-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                gpuSections.querySelectorAll('.gpu-vendor-section').forEach(s => {
                    s.hidden = s.dataset.vendor !== vendor;
                });
                ['gpu-sc-temp', 'gpu-sc-usage', 'gpu-sc-power'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.dataset.vendor = vendor;
                });
                const g = uniqueGpus.find(x => x.vendor === vendor);
                if (g) {
                    gpuResultsInfo.innerHTML = buildInfoHtml(g);
                    if (gpuResultsHeader) gpuResultsHeader.className = `gpu-results-header gpu-results-header--${g.vendor}`;
                } else {
                    gpuResultsInfo.innerHTML = `<div class="gpu-ri-vendor-row"><span class="gpu-ri-vendor-name" style="opacity:0.45">${TAB_LABEL[vendor] || vendor} — not detected</span></div>`;
                    if (gpuResultsHeader) gpuResultsHeader.className = `gpu-results-header gpu-results-header--${vendor}`;
                }
            });
            gpuVendorTabs.appendChild(btn);
        });

        // ── Build vendor sections (detected + preview) ────────
        gpuSections.textContent = '';
        tabVendors.forEach((vendor, idx) => {
            const detectedGpu = uniqueGpus.find(g => g.vendor === vendor);
            const isPreview = !detectedGpu;
            const gpuObj = detectedGpu || { vendor, name: null, driverVersion: null, vram: null, driverDate: null };
            const section = buildVendorSection(gpuObj, idx, isPreview);
            section.dataset.vendor = vendor;
            if (vendor !== defaultVendor) section.hidden = true;
            gpuSections.appendChild(section);
        });

        gpuResultsState.hidden = false;
    }

    function buildVendorSection(gpu, idx, isPreview = false) {
        const v     = gpu.vendor;
        const cards = GPU_CARDS[v] || GPU_CARDS.unknown;

        const section = document.createElement('div');
        section.className = `gpu-vendor-section gpu-vendor-section--${v}`;
        section.style.animationDelay = `${idx * 0.08}s`;

        // Preview mode banner (honest notice when vendor not detected)
        if (isPreview) {
            const banner = document.createElement('div');
            banner.className = 'gpu-preview-banner';
            banner.textContent = `Preview mode — no ${VENDOR_NAME[v] || v} GPU detected on this system. Cards below show available controls if a compatible GPU were present.`;
            section.appendChild(banner);
        }

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

            // Inject real detected data into info-badge card descriptions
            let liveDesc = c.desc;
            if (c.badge === 'info') {
                const titleLower = c.title.toLowerCase();
                if (isPreview && (titleLower.includes('vram') || titleLower.includes('driver') || titleLower.includes('arc driver'))) {
                    liveDesc = `No ${VENDOR_NAME[v] || v} GPU detected on this system.`;
                } else if (titleLower.includes('vram') && gpu.vram) {
                    liveDesc = `${gpu.vram} detected on your ${VENDOR_NAME[v]} GPU. VRAM capacity determines texture quality headroom and memory-pressure tolerance.`;
                } else if (titleLower.includes('driver') && gpu.driverVersion) {
                    const dateStr = gpu.driverDate ? ` (${gpu.driverDate})` : '';
                    liveDesc = `Driver ${gpu.driverVersion}${dateStr} installed. Confirms driver currency and aids regression isolation when performance changes.`;
                }
            }

            const isSafe = c.badge === 'safe';
            const btnText = c.badge === 'info' ? 'Read Only' : (isSafe ? 'Run' : 'Coming Soon');

            card.innerHTML = `
                <div class="gpu-card-aurora" aria-hidden="true"></div>
                <div class="gpu-card-top">
                    <div class="gpu-card-icon gpu-card-icon--${v}">${iconSvg(c.icon)}</div>
                    <div class="gpu-card-body">
                        <h4 class="gpu-card-title">${c.title}</h4>
                        <p class="gpu-card-desc">${liveDesc}</p>
                    </div>
                </div>
                <div class="gpu-card-foot">
                    <div class="gpu-card-foot-left">
                        <span class="gpu-card-badge ${BADGE_CLASS[c.badge] || 'gpu-badge--soon'}"><span class="gpu-badge-dot" aria-hidden="true"></span>${BADGE_LABEL[c.badge] || 'Coming Soon'}</span>
                        <span class="gpu-card-impact gpu-impact--${impactLower}">${c.impact || 'Medium'} Impact</span>
                    </div>
                    <button class="gpu-card-btn" ${isSafe ? '' : 'disabled'}>${btnText}</button>
                </div>
            `;

            if (isSafe && c.title === 'Shader Cache Cleanup') {
                const cardBtn = card.querySelector('.gpu-card-btn');
                if (cardBtn) {
                    cardBtn.textContent = 'Scan Cache';
                    let shaderState = 'idle';
                    cardBtn.addEventListener('click', async () => {
                        if (shaderState === 'idle' || shaderState === 'rescan') {
                            shaderState = 'scanning';
                            cardBtn.disabled = true;
                            cardBtn.textContent = 'Scanning…';
                            try {
                                const res = await window.electronAPI.scanShaderCache(v);
                                if (!res.available) { shaderState = 'idle'; cardBtn.textContent = 'Unavailable'; return; }
                                if (res.count === 0) { shaderState = 'idle'; cardBtn.textContent = 'Cache Empty'; cardBtn.disabled = false; return; }
                                const mb = res.bytes > 0 ? ` (${(res.bytes / 1048576).toFixed(1)} MB)` : '';
                                cardBtn.textContent = `Clean ${res.count} files${mb}`;
                                cardBtn.disabled = false;
                                shaderState = 'ready';
                            } catch { shaderState = 'idle'; cardBtn.textContent = 'Scan Cache'; cardBtn.disabled = false; }
                        } else if (shaderState === 'ready') {
                            if (!confirm('Clear the GPU shader cache? Windows will rebuild it next time games load shaders.')) return;
                            shaderState = 'cleaning';
                            cardBtn.disabled = true;
                            cardBtn.textContent = 'Cleaning…';
                            try {
                                await window.electronAPI.cleanShaderCache(v);
                                shaderState = 'rescan'; cardBtn.textContent = 'Done — Rescan'; cardBtn.disabled = false;
                            } catch { shaderState = 'ready'; cardBtn.textContent = 'Clean Failed'; cardBtn.disabled = false; }
                        }
                    });
                }
            }

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

    // ── Shader Cache Cleanup cards — badge:'safe' for supported vendors ──────
    ['nvidia', 'amd', 'intel'].forEach(v => {
        const cards = GPU_CARDS[v];
        if (!cards) return;
        const sc = cards.find(c => c.title === 'Shader Cache Cleanup');
        if (sc) sc.badge = 'safe';
    });

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
            'NEVER recommend disabling or closing anti-cheat software: Riot Vanguard (vgc.exe, vgtray.exe), Easy Anti-Cheat (EasyAntiCheat.exe, EasyAntiCheat_launcher.exe), or BattlEye (BEService.exe, BELauncher.exe). These are kernel-level security drivers — disabling them will prevent protected games from launching and can result in hardware bans. Always warn the user if they ask about them. ' +
            'Lunar Client (lunarclient.exe) is a Minecraft launcher with its own overlay and auto-updater — it is safe to close when not gaming. ' +
            'NVIDIA ShadowPlay / GeForce Experience overlay (nvsphelper64.exe, nvsphelper.exe) hooks into the graphics pipeline; suggest disabling the in-game overlay in GeForce Experience settings rather than killing the process. ' +
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
        'anti cheat', 'anticheat', 'vanguard', 'battleye', 'easy anti cheat',
        'lunar client', 'nvidia overlay', 'shadowplay', 'geforce overlay',
        'adobe updater', 'google updater', 'onedrive sync',
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
    let startupContext    = null;
    let startupContextTime = 0;
    const STARTUP_CTX_TTL_R = 90000;
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
        // OneDrive
        'onedrive': 'OneDrive', 'onedrivesetup': 'OneDrive', 'onedriveupdater': 'OneDrive',
        // Epic Games
        'epicgameslauncher': 'Epic Games Launcher', 'epicwebhelper': 'Epic Games Launcher',
        'epiconlineservices': 'Epic Games Launcher',
        // Google
        'googleupdater': 'Google Updater', 'googleupdatertaskuser': 'Google Updater',
        'googleupdate': 'Google Updater', 'googleupdatecore': 'Google Updater',
        'googledrivesync': 'Google Drive', 'googledrive': 'Google Drive', 'googledrivefs': 'Google Drive',
        'chrome': 'Google Chrome', 'googlechrome': 'Google Chrome',
        // Steam
        'steam': 'Steam', 'steamwebhelper': 'Steam', 'steamservice': 'Steam',
        'steamclient': 'Steam', 'steamerrorreporter': 'Steam',
        // NVIDIA
        'nvcontainer': 'NVIDIA Services', 'nvtelemetrycontainer': 'NVIDIA Services',
        'nvshadowplay': 'NVIDIA ShadowPlay', 'nvsphelper64': 'NVIDIA ShadowPlay', 'nvsphelper': 'NVIDIA ShadowPlay',
        'geforceexperience': 'GeForce Experience', 'nvdisplay.container': 'NVIDIA Services',
        'nvbackend': 'NVIDIA ShadowPlay',
        // Riot / Vanguard
        'riotclientservices': 'Riot Client', 'riotclientux': 'Riot Client',
        'riotclientcrashhandler': 'Riot Client',
        'vgc': 'Riot Vanguard', 'vgtray': 'Riot Vanguard',
        // EA
        'eadesktop': 'EA App', 'eabackgroundservice': 'EA App', 'easteam': 'EA App',
        'ealaunchhelper': 'EA App',
        // Battle.net / Blizzard
        'battlenet': 'Battle.net', 'battlenetlauncher': 'Battle.net', 'blizzardagent': 'Battle.net',
        // Discord
        'discord': 'Discord', 'discordptb': 'Discord', 'discordcanary': 'Discord',
        'update': 'Discord',
        // Teams
        'teams': 'Microsoft Teams', 'ms-teams': 'Microsoft Teams',
        // Lunar Client
        'lunarclient': 'Lunar Client', 'lunar': 'Lunar Client',
        // Anti-cheat (display only — never suggest closing)
        'easyanticheat': 'Easy Anti-Cheat', 'easyanticheat_launcher': 'Easy Anti-Cheat',
        'eaclaunch': 'Easy Anti-Cheat',
        'beservice': 'BattlEye', 'belvservice': 'BattlEye', 'belauncher': 'BattlEye',
        // Adobe
        'adobeupdateservice': 'Adobe Updater', 'adobeupdatedaemon': 'Adobe Updater',
        'adobegcclient': 'Adobe Creative Cloud', 'creativecloudapp': 'Adobe Creative Cloud',
        'coresyncdaemon': 'Adobe Creative Cloud', 'adobeipccbroker': 'Adobe Creative Cloud',
        'adobedesktop': 'Adobe Creative Cloud',
        // Xbox / Game Bar (Windows built-in)
        'gamebar': 'Xbox Game Bar', 'xboxgamemonitor': 'Xbox Game Monitor',
        'gamebarftserver': 'Xbox Game Bar', 'gamebarfthost': 'Xbox Game Bar',
    };
    function normalizeAppName(raw) {
        if (!raw) return raw || '';
        const key = raw.toLowerCase().replace(/[\s._\-]+/g, '').replace(/\.exe$/i, '');
        return APP_NAME_MAP[key] || raw;
    }

    // Apps that must never be recommended for closing/disabling — flagged in AI context
    const PROTECTED_APPS = new Set([
        'Riot Vanguard', 'Easy Anti-Cheat', 'BattlEye',
    ]);

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
                const isProtected = PROTECTED_APPS.has(name);
                const action   = isProtected          ? 'DO NOT DISABLE — anti-cheat/security software'
                               : canClose && canDisable ? 'safe to close and disable from startup'
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

    /* ── Startup context helpers ── */
    async function loadStartupContext() {
        if (!window.electronAPI.getStartupContext) return;
        if (startupContext && !startupContext.scanFailed && (Date.now() - startupContextTime) < STARTUP_CTX_TTL_R) return;
        try {
            const data = await window.electronAPI.getStartupContext();
            if (data) { startupContext = data; startupContextTime = Date.now(); }
        } catch { startupContext = { scanFailed: true }; }
    }

    const BUCKET_LABEL = {
        safe:           'Usually safe to disable from startup',
        'game-dependent':'Game-dependent — keep if you use this game',
        review:         'Review before disabling',
        protected:      'Do not disable (system/driver)',
        unknown:        'Unknown — review manually',
        optional:       'Optional / user preference',
    };

    function formatStartupContextForAI(ctx) {
        if (!ctx || ctx.scanFailed) {
            return ctx && ctx.scanFailed
                ? 'Startup Scan: failed — could not read startup data from this PC. Do not guess startup apps.'
                : '';
        }
        const ageS   = ctx.scannedAt ? Math.round((Date.now() - ctx.scannedAt) / 1000) : 0;
        const source = ctx.fromCache  ? `cached ${ageS}s ago` : `live scan ${ageS}s ago`;
        const lines  = [`Startup Scan Results (${source}):`];

        const all = [
            ...(ctx.registryEntries || []).map(e => ({ ...e, sourceLabel: 'Registry Run' })),
            ...(ctx.folderEntries   || []).map(e => ({ ...e, sourceLabel: 'Startup Folder' })),
        ];

        if (all.length > 0) {
            lines.push('Registry & Folder Startup Entries:');
            for (const e of all) {
                const bucket = BUCKET_LABEL[e.bucket] || e.bucket;
                const cmd    = e.command ? ` [${e.command.slice(0, 80)}]` : '';
                lines.push(`  - ${e.display || e.name} (${e.category}) [${e.sourceLabel}] — ${bucket}${cmd}`);
            }
        } else {
            lines.push('Registry & Folder Startup Entries: none found (scan may have returned empty).');
        }

        const tasks = ctx.scheduledTasks || [];
        if (tasks.length > 0) {
            lines.push('Scheduled Startup Tasks (logon/boot triggered, non-Microsoft):');
            for (const t of tasks.slice(0, 25)) {
                const bucket = BUCKET_LABEL[t.bucket] || t.bucket;
                lines.push(`  - ${t.display || t.name} (${t.category}) [${t.state}] — ${bucket}`);
            }
        }

        return lines.join('\n');
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
                    // Refresh bg context + startup context if stale, then show bg card
                    const needBgRefresh      = !bgContext      || (Date.now() - bgContextTime)      > BG_CONTEXT_TTL;
                    const needStartupRefresh = !startupContext || (Date.now() - startupContextTime) > STARTUP_CTX_TTL_R;
                    const refreshes = [];
                    if (needBgRefresh)
                        refreshes.push(window.electronAPI.getBackgroundContext().then(d => { if (d) { bgContext = d; bgContextTime = Date.now(); } }).catch(() => {}));
                    if (needStartupRefresh && window.electronAPI.getStartupContext)
                        refreshes.push(window.electronAPI.getStartupContext().then(d => { if (d) { startupContext = d; startupContextTime = Date.now(); } }).catch(() => {}));
                    Promise.all(refreshes).then(() => {
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
                const [raw, bgRaw, startupRaw] = await Promise.all([
                    window.electronAPI.getAISystemContext(),
                    window.electronAPI.getBackgroundContext().catch(() => null),
                    window.electronAPI.getStartupContext ? window.electronAPI.getStartupContext().catch(() => null) : Promise.resolve(null),
                ]);
                if (bgRaw)      { bgContext = bgRaw;           bgContextTime     = Date.now(); }
                if (startupRaw) { startupContext = startupRaw; startupContextTime = Date.now(); }
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

                const startupStr = formatStartupContextForAI(startupContext);
                if (startupStr) pcContext += '\n\n' + startupStr;

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
            if (typeof window.replayAiWelcomeModalMotion === 'function') {
                window.replayAiWelcomeModalMotion({ source: 'manual' });
            }
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
        const cardFrame = document.getElementById('ai-welcome-card-frame');
        if (!overlay || !continueBtn) return;
        const THEME_CARD_MAP = {
            'xins-premium': './assets/Welcome Cards Ai tweaker Cards/Ai Popup Card - Xins Premium.html',
            'obsidian':     './assets/Welcome Cards Ai tweaker Cards/Ai Popup Card - Obsidian.html',
            'silver-mist':  './assets/Welcome Cards Ai tweaker Cards/Ai Popup Card - Silver Mist.html',
            'frost-glass':  './assets/Welcome Cards Ai tweaker Cards/Ai Popup Card - Frost Glass.html',
        };
        let currentCardTheme = null;
        function updateCardFrame() {
            if (!cardFrame) return;
            const theme = document.documentElement.dataset.theme || 'xins-premium';
            if (theme === currentCardTheme) return;
            const newSrc = THEME_CARD_MAP[theme] || THEME_CARD_MAP['xins-premium'];
            // Skip reload if iframe already shows the correct file (avoids reload-on-open flash)
            try {
                if (cardFrame.src === new URL(newSrc, document.baseURI).href) {
                    currentCardTheme = theme;
                    return;
                }
            } catch { /* ignore URL resolution errors */ }
            currentCardTheme = theme;
            cardFrame.src = newSrc;
        }
        // Pre-load the correct card for the current theme while the popup is still hidden
        updateCardFrame();
        const motionStorageKey = 'xtweaks-ai-modal-motion-v1';
        const motionSettingsVersion = 3;
        const motionDefaults = {
            backdropOpacity: 0.58,
            backdropBlur: 12,
            backdropDuration: 500,
            backdropDelay: 0,
            cardOpacityStart: 0,
            cardDuration: 620,
            cardDelay: 90,
            cardSlideY: 18,
            cardScaleStart: 0.965,
            cardBlurStart: 10
        };
        const motionFields = {
            backdropOpacity: { css: '--ai-modal-backdrop-opacity', unit: '', decimals: 2 },
            backdropBlur: { css: '--ai-modal-backdrop-blur', unit: 'px', decimals: 0 },
            backdropDuration: { css: '--ai-modal-backdrop-duration', unit: 'ms', decimals: 0 },
            backdropDelay: { css: '--ai-modal-backdrop-delay', unit: 'ms', decimals: 0 },
            cardOpacityStart: { css: '--ai-modal-card-opacity-start', unit: '', decimals: 2 },
            cardDuration: { css: '--ai-modal-card-duration', unit: 'ms', decimals: 0 },
            cardDelay: { css: '--ai-modal-card-delay', unit: 'ms', decimals: 0 },
            cardSlideY: { css: '--ai-modal-card-slide-y', unit: 'px', decimals: 0 },
            cardScaleStart: { css: '--ai-modal-card-scale-start', unit: '', decimals: 3 },
            cardBlurStart: { css: '--ai-modal-card-blur-start', unit: 'px', decimals: 0 }
        };
        let motionSettings = { ...motionDefaults };
        const motionTimers = new Set();
        const motionFrames = new Set();
        let cardMotionAnimation = null;

        function clearAiModalMotionTimers() {
            motionTimers.forEach((timerId) => clearTimeout(timerId));
            motionTimers.clear();
            motionFrames.forEach((frameId) => cancelAnimationFrame(frameId));
            motionFrames.clear();
            modal?.getAnimations().forEach((animation) => animation.cancel());
            if (cardMotionAnimation) {
                cardMotionAnimation.cancel();
                cardMotionAnimation = null;
            }
        }

        function setMotionTimeout(callback, delay) {
            const timerId = setTimeout(() => {
                motionTimers.delete(timerId);
                callback();
            }, delay);
            motionTimers.add(timerId);
            return timerId;
        }

        function setMotionFrame(callback) {
            const frameId = requestAnimationFrame(() => {
                motionFrames.delete(frameId);
                callback();
            });
            motionFrames.add(frameId);
            return frameId;
        }

        function clampMotionValue(key, value) {
            const input = document.querySelector(`[data-ai-motion="${key}"]`);
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return motionDefaults[key];
            if (!input) return numeric;
            return Math.min(Math.max(numeric, Number(input.min)), Number(input.max));
        }

        function formatMotionValue(key, value) {
            const field = motionFields[key];
            const fixed = Number(value).toFixed(field.decimals);
            const clean = field.decimals > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
            return `${clean}${field.unit}`;
        }

        function applyModalMotionSettings(next = motionSettings) {
            motionSettings = { ...motionSettings, ...next };
            Object.entries(motionFields).forEach(([key, field]) => {
                const value = clampMotionValue(key, motionSettings[key]);
                motionSettings[key] = value;
                overlay.style.setProperty(field.css, formatMotionValue(key, value));
                const input = document.querySelector(`[data-ai-motion="${key}"]`);
                const output = document.querySelector(`[data-ai-motion-output="${key}"]`);
                if (input) input.value = String(value);
                if (output) output.textContent = formatMotionValue(key, value);
            });
        }

        function loadModalMotionSettings() {
            try {
                const stored = JSON.parse(localStorage.getItem(motionStorageKey) || '{}');
                motionSettings = stored.motionSettingsVersion === motionSettingsVersion
                    ? { ...motionDefaults, ...stored }
                    : { ...motionDefaults };
            } catch {
                motionSettings = { ...motionDefaults };
            }
            applyModalMotionSettings(motionSettings);
        }

        function getMotionCloseFallbackMs() {
            const backdropMs = motionSettings.backdropDuration + motionSettings.backdropDelay;
            const cardMs = 320;
            return Math.max(360, Math.min(Math.max(backdropMs, cardMs) + 120, 1200));
        }

        function getMotionEntranceTotalMs() {
            const backdropMs = motionSettings.backdropDuration + motionSettings.backdropDelay;
            const cardMs = motionSettings.cardDuration + motionSettings.cardDelay + 1200;
            return Math.max(backdropMs, cardMs) + 160;
        }

        function clearModalCardInlineState() {
            if (!modal) return;
            modal.style.removeProperty('opacity');
            modal.style.removeProperty('transform');
            modal.style.removeProperty('filter');
            modal.style.removeProperty('will-change');
            modal.style.removeProperty('pointer-events');
            modal.style.removeProperty('visibility');
        }

        function setModalCardStartState() {
            if (!modal) return;
            modal.style.opacity = String(motionSettings.cardOpacityStart);
            modal.style.transform = `translate3d(0, ${motionSettings.cardSlideY}px, 0) scale(${motionSettings.cardScaleStart})`;
            modal.style.filter = `blur(${motionSettings.cardBlurStart}px)`;
            modal.style.visibility = 'visible';
            modal.style.pointerEvents = 'auto';
            modal.style.willChange = 'transform, opacity, filter';
        }

        function animateModalCardIn() {
            if (!modal) return null;
            if (cardMotionAnimation) {
                cardMotionAnimation.cancel();
                cardMotionAnimation = null;
            }
            overlay.classList.add('ai-card-waapi-entering');
            setModalCardStartState();
            void modal.offsetHeight;
            setMotionFrame(() => {
                setMotionFrame(() => {
                    if (!overlay.classList.contains('is-open') || overlay.classList.contains('ai-motion-reset')) return;
                    setModalCardStartState();
                    modal.getBoundingClientRect();
                    cardMotionAnimation = modal.animate([
                        {
                            opacity: motionSettings.cardOpacityStart,
                            transform: `translate3d(0, ${motionSettings.cardSlideY}px, 0) scale(${motionSettings.cardScaleStart})`,
                            filter: `blur(${motionSettings.cardBlurStart}px)`
                        },
                        {
                            opacity: 1,
                            transform: 'translate3d(0, 0, 0) scale(1)',
                            filter: 'blur(0px)'
                        }
                    ], {
                        duration: motionSettings.cardDuration,
                        delay: motionSettings.cardDelay,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        fill: 'forwards'
                    });
                    cardMotionAnimation.onfinish = () => {
                        if (cardMotionAnimation) {
                            cardMotionAnimation.cancel();
                            cardMotionAnimation = null;
                        }
                        modal.style.opacity = '1';
                        modal.style.transform = 'translate3d(0, 0, 0) scale(1)';
                        modal.style.filter = 'blur(0px)';
                        modal.style.removeProperty('will-change');
                        overlay.classList.remove('ai-card-waapi-entering');
                    };
                    cardMotionAnimation.oncancel = () => {
                        overlay.classList.remove('ai-card-waapi-entering');
                        if (cardMotionAnimation) cardMotionAnimation = null;
                    };
                });
            });
            return null;
        }

        function animateModalCardOut() {
            if (!modal) return null;
            if (cardMotionAnimation) {
                cardMotionAnimation.cancel();
                cardMotionAnimation = null;
            }
            modal.style.opacity = '1';
            modal.style.transform = 'translate3d(0, 0, 0) scale(1)';
            modal.style.filter = 'blur(0px)';
            modal.style.visibility = 'visible';
            modal.style.pointerEvents = 'auto';
            modal.style.willChange = 'transform, opacity, filter';
            void modal.offsetHeight;
            cardMotionAnimation = modal.animate([
                {
                    opacity: 1,
                    transform: 'translate3d(0, 0, 0) scale(1)',
                    filter: 'blur(0px)'
                },
                {
                    opacity: 0,
                    transform: 'translate3d(0, 12px, 0) scale(0.985)',
                    filter: 'blur(6px)'
                }
            ], {
                duration: 280,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards'
            });
            cardMotionAnimation.onfinish = () => {
                if (cardMotionAnimation) {
                    cardMotionAnimation.cancel();
                    cardMotionAnimation = null;
                }
                clearModalCardInlineState();
            };
            cardMotionAnimation.oncancel = () => {
                if (cardMotionAnimation) cardMotionAnimation = null;
            };
            return cardMotionAnimation;
        }

        function resetAiModalAnimationState() {
            overlay.classList.remove('is-open', 'is-closing');
            overlay.classList.remove('ai-card-waapi-entering');
            overlay.classList.add('ai-motion-reset');
            setModalCardStartState();
            void overlay.offsetWidth;
        }

        function replayAiModalMotionPreview(options = {}) {
            const aiPage = document.getElementById('page-ai-tweaker');
            const now = performance.now();
            if (options.source === 'page-enter' && now - aiWelcomePageEnterLastRun < 700) return;
            if (options.source === 'page-enter') aiWelcomePageEnterLastRun = now;

            updateCardFrame();
            clearAiModalMotionTimers();
            resetAiModalAnimationState();

            setMotionFrame(() => {
                setMotionFrame(() => {
                    if (options.source === 'page-enter' && !aiPage?.classList.contains('active')) return;
                    overlay.classList.remove('ai-motion-reset', 'is-closing');
                    void overlay.offsetWidth;
                    overlay.classList.add('is-open');
                    animateModalCardIn();
                    setMotionTimeout(() => {
                        overlay.classList.remove('ai-motion-reset');
                    }, getMotionEntranceTotalMs());
                });
            });
        }

        function closeWelcome() {
            if (!overlay.classList.contains('is-open')) return; // already closing or closed
            if (dismissCheck?.checked) {
                localStorage.setItem('xtweaks-ai-welcome-seen', '1');
            }
            clearAiModalMotionTimers();
            overlay.classList.remove('is-open');
            overlay.classList.remove('ai-motion-reset');
            overlay.classList.remove('ai-card-waapi-entering');
            overlay.classList.add('is-closing');
            animateModalCardOut();

            let done = false;
            function finish() {
                if (done) return;
                done = true;
                overlay.classList.remove('is-closing');
                overlay.classList.remove('ai-motion-reset');
                overlay.classList.remove('ai-card-waapi-entering');
                clearModalCardInlineState();
            }
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                finish();
            } else {
                modal?.addEventListener('animationend', finish, { once: true });
                setTimeout(finish, getMotionCloseFallbackMs()); // fallback if animationend doesn't fire
            }
        }

        loadModalMotionSettings();
        window.replayAiWelcomeModalMotion = replayAiModalMotionPreview;
        // Called by activatePage when navigating away from AI Tweaker — no animation,
        // just kill all open-state classes and stale inline styles immediately.
        window.forceCloseAiWelcome = function() {
            if (!overlay) return;
            overlay.classList.remove('is-open', 'is-closing', 'ai-card-waapi-entering', 'ai-motion-reset');
            if (cardMotionAnimation) { cardMotionAnimation.cancel(); cardMotionAnimation = null; }
            clearModalCardInlineState();
        };

        continueBtn.addEventListener('click', closeWelcome);
        window.addEventListener('message', (e) => {
            if (!e.data || typeof e.data !== 'object') return;
            if (e.data.type === 'ai-welcome-dismiss') {
                if (dismissCheck) dismissCheck.checked = !!e.data.checked;
            } else if (e.data.type === 'ai-welcome-continue') {
                closeWelcome();
            }
        });
        const themeObs = new MutationObserver(() => {
            // Always update — pre-loads correct card while hidden, updates immediately when open
            updateCardFrame();
        });
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeWelcome();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeWelcome();
        });

        const motionBtn = document.getElementById('ai-modal-motion-btn');
        const motionPanel = document.getElementById('ai-modal-motion-panel');
        const motionClose = document.getElementById('ai-modal-motion-close');
        const motionPreview = document.getElementById('ai-modal-motion-preview');
        const motionReset = document.getElementById('ai-modal-motion-reset');
        const motionSave = document.getElementById('ai-modal-motion-save');
        const setMotionPanelOpen = (isOpen) => {
            if (!motionPanel || !motionBtn) return;
            motionPanel.hidden = !isOpen;
            motionBtn.classList.toggle('is-open', isOpen);
            motionBtn.setAttribute('aria-expanded', String(isOpen));
        };
        motionBtn?.setAttribute('aria-controls', 'ai-modal-motion-panel');
        motionBtn?.setAttribute('aria-expanded', 'false');
        motionBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            setMotionPanelOpen(Boolean(motionPanel?.hidden));
        });
        motionClose?.addEventListener('click', () => setMotionPanelOpen(false));
        motionPanel?.querySelectorAll('[data-ai-motion]').forEach((input) => {
            input.addEventListener('input', () => {
                const key = input.dataset.aiMotion;
                if (!key) return;
                applyModalMotionSettings({ [key]: Number(input.value) });
            });
        });
        motionPreview?.addEventListener('click', () => replayAiModalMotionPreview({ source: 'preview' }));
        motionReset?.addEventListener('click', () => {
            applyModalMotionSettings({ ...motionDefaults });
            localStorage.removeItem(motionStorageKey);
        });
        motionSave?.addEventListener('click', () => {
            localStorage.setItem(motionStorageKey, JSON.stringify({
                motionSettingsVersion,
                ...motionSettings
            }));
            showNotification('success', 'Modal Motion Saved', 'AI Tweaker modal motion saved locally.', {
                key: 'ai-modal-motion',
                duration: 2200
            });
        });
        document.addEventListener('click', (event) => {
            if (!motionPanel || motionPanel.hidden) return;
            if (motionPanel.contains(event.target) || motionBtn?.contains(event.target)) return;
            setMotionPanelOpen(false);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') setMotionPanelOpen(false);
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

        // ── AI welcome card orb — exact port from reference (SPEED/particles/floatOrb)
        const aipOrbWrap = document.getElementById('ai-orb-wrap');
        const aipCanvas  = document.getElementById('ai-orb-canvas');
        if (aipOrbWrap && aipCanvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const aipCtx = aipCanvas.getContext('2d');
            const AIP_W = aipCanvas.width, AIP_H = aipCanvas.height;
            const AIP_CX = AIP_W / 2, AIP_CY = AIP_H / 2;

            const AIP_SPEED = {
                orbitOuter:    0.0015,
                orbitInner:    0.0022,
                trailLength:   1.2,
                float:         0.3,
                floatDist:     4,
                particleDrift: 0.28,
                particlePulse: 0.18,
            };

            function aipRand(a, b) { return a + Math.random() * (b - a); }

            const aipTravelDot = document.getElementById('aiOrb-travel-dot');
            const aipInnerDot  = document.getElementById('aiOrb-inner-dot');
            const aipTrailArc  = document.getElementById('aiOrb-trail-arc');
            const AIP_R = 66, AIP_RI = 54;

            let aipParticles = [];
            function aipInitParticles() {
                const isFrost  = document.documentElement.dataset.theme === 'frost-glass';
                const color    = isFrost ? 'rgba(15,40,80,0.9)' : '#ffffff';
                const alphaMin = isFrost ? 0.08 : 0.1;
                const alphaMax = isFrost ? 0.35 : 0.5;
                aipParticles = [];
                for (let i = 0; i < 38; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist  = aipRand(30, 95);
                    aipParticles.push({
                        x: AIP_CX + Math.cos(angle) * dist,
                        y: AIP_CY + Math.sin(angle) * dist,
                        baseX: AIP_CX + Math.cos(angle) * dist,
                        baseY: AIP_CY + Math.sin(angle) * dist,
                        r:     aipRand(0.4, 1.4),
                        alpha: aipRand(alphaMin, alphaMax),
                        speed: aipRand(0.0004, 0.0012),
                        phase: Math.random() * Math.PI * 2,
                        drift: aipRand(2, 6),
                        color,
                    });
                }
            }

            let aipT = 0;
            function aipDrawParticles() {
                aipCtx.clearRect(0, 0, AIP_W, AIP_H);
                aipT += 0.016;
                for (const p of aipParticles) {
                    const wobble  = Math.sin(aipT * p.speed * AIP_SPEED.particleDrift * 3000 + p.phase);
                    const wobble2 = Math.cos(aipT * p.speed * AIP_SPEED.particleDrift * 2400 + p.phase);
                    p.x = p.baseX + wobble  * p.drift;
                    p.y = p.baseY + wobble2 * p.drift;
                    const pulse = 0.5 + 0.5 * Math.sin(aipT * p.speed * AIP_SPEED.particlePulse * 3000 + p.phase);
                    aipCtx.beginPath();
                    aipCtx.arc(p.x, p.y, p.r * (0.8 + 0.4 * pulse), 0, Math.PI * 2);
                    aipCtx.fillStyle   = p.color;
                    aipCtx.globalAlpha = p.alpha * (0.5 + 0.5 * pulse);
                    aipCtx.fill();
                }
                aipCtx.globalAlpha = 1;
            }

            function aipArcPath(cx, cy, r, s, e) {
                const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
                const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
                const diff = ((e - s) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                return `M ${x1} ${y1} A ${r} ${r} 0 ${diff > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
            }

            let aipOrbitAngle = 0, aipInnerAngle = Math.PI;
            function aipAnimateSVG() {
                aipOrbitAngle += AIP_SPEED.orbitOuter;
                aipInnerAngle -= AIP_SPEED.orbitInner;
                if (aipTravelDot) {
                    aipTravelDot.setAttribute('cx', 80 + AIP_R  * Math.cos(aipOrbitAngle));
                    aipTravelDot.setAttribute('cy', 80 + AIP_R  * Math.sin(aipOrbitAngle));
                }
                if (aipTrailArc) {
                    aipTrailArc.setAttribute('d', aipArcPath(80, 80, AIP_R, aipOrbitAngle - AIP_SPEED.trailLength, aipOrbitAngle));
                }
                if (aipInnerDot) {
                    aipInnerDot.setAttribute('cx', 80 + AIP_RI * Math.cos(aipInnerAngle));
                    aipInnerDot.setAttribute('cy', 80 + AIP_RI * Math.sin(aipInnerAngle));
                }
            }

            let aipFloatT = 0;
            function aipFloatOrb() {
                aipFloatT += 0.016;
                aipOrbWrap.style.transform = `translateY(${Math.sin(aipFloatT * AIP_SPEED.float) * AIP_SPEED.floatDist}px)`;
            }

            let aipRafId = null;
            function aipLoop() {
                aipDrawParticles();
                aipAnimateSVG();
                aipFloatOrb();
                aipRafId = requestAnimationFrame(aipLoop);
            }

            const aipObs = new MutationObserver(() => {
                if (overlay.classList.contains('is-open')) {
                    if (!aipRafId) {
                        aipT = 0; aipFloatT = 0;
                        aipOrbitAngle = 0; aipInnerAngle = Math.PI;
                        aipInitParticles();
                        aipRafId = requestAnimationFrame(aipLoop);
                    }
                } else {
                    if (aipRafId) {
                        cancelAnimationFrame(aipRafId);
                        aipRafId = null;
                        aipOrbWrap.style.transform = '';
                    }
                }
            });
            aipObs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
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

// ── Network Card Actions ──────────────────────────────────────
const NETWORK_ENTRY_MOTION = {
    duration: 820,
    stagger: 90,
    slideX: 0,
    slideY: 14,
    blur: 5,
    opacity: 0,
    scale: 0.985,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
let networkPageEnterMotionLastRun = 0;
let networkTabMotionLastRun = 0;
let networkTabMotionRequest = 0;

function getNetworkEntryCards(page) {
    return Array.from(page.querySelectorAll('.net-pcard, .net-adv-card, .network-card')).filter(card => {
        if (!card) return false;
        if (card.closest('.net-hero, .net-filter-bar, .top-bar')) return false;
        if (card.style.display === 'none') return false;
        const rect = card.getBoundingClientRect();
        return rect.width >= 8 && rect.height >= 8;
    });
}

function clearNetworkEntryCardAnimations(items = []) {
    items.forEach(item => {
        if (item._networkEntryAnimation) {
            item._networkEntryAnimation.cancel();
            item._networkEntryAnimation = null;
        }
        clearEntryCardShine(item);
        item.style.removeProperty('will-change');
        item.style.removeProperty('pointer-events');
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
    });
}

function animateNetworkCardsOnEntry() {
    const page = document.getElementById('page-network');
    if (!page?.classList.contains('active')) return 0;

    const targetItems = getNetworkEntryCards(page);
    clearNetworkEntryCardAnimations(targetItems);
    if (targetItems[0]) targetItems[0].offsetHeight;

    let started = 0;
    targetItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        applyEntryCardShine(item, index, NETWORK_ENTRY_MOTION.stagger);
        item.style.pointerEvents = 'none';

        const animation = item.animate([
            {
                opacity: NETWORK_ENTRY_MOTION.opacity,
                transform: `translate3d(${NETWORK_ENTRY_MOTION.slideX}px, ${NETWORK_ENTRY_MOTION.slideY}px, 0) scale(${NETWORK_ENTRY_MOTION.scale})`,
                filter: `blur(${NETWORK_ENTRY_MOTION.blur}px)`
            },
            {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale(1)',
                filter: 'blur(0px)'
            }
        ], {
            duration: NETWORK_ENTRY_MOTION.duration,
            delay: index * NETWORK_ENTRY_MOTION.stagger,
            easing: NETWORK_ENTRY_MOTION.easing,
            fill: 'both'
        });

        item.style.willChange = 'transform, opacity, filter';
        item._networkEntryAnimation = animation;
        setTimeout(() => {
            if (item._networkEntryAnimation === animation) item.style.removeProperty('pointer-events');
        }, index * NETWORK_ENTRY_MOTION.stagger);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (item._networkEntryAnimation === animation) {
                    animation.cancel();
                    item._networkEntryAnimation = null;
                    item.style.removeProperty('will-change');
                    item.style.removeProperty('pointer-events');
                    item.style.removeProperty('opacity');
                    item.style.removeProperty('transform');
                    item.style.removeProperty('filter');
                }
            });
        started++;
    });

    return started;
}

function scheduleNetworkCardsOnEntry(options = {}) {
    const page = document.getElementById('page-network');
    if (!page) return;
    const requestId = ++networkTabMotionRequest;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!page.classList.contains('active')) return;
            const now = performance.now();
            if (options.source === 'page-enter' && now - networkPageEnterMotionLastRun < 900) return;
            if (options.source === 'page-enter') networkPageEnterMotionLastRun = now;
            if (options.source === 'tab-click') {
                if (requestId !== networkTabMotionRequest) return;
                if (now - networkTabMotionLastRun < 450) {
                    setTimeout(() => {
                        if (requestId !== networkTabMotionRequest || !page.classList.contains('active')) return;
                        networkTabMotionLastRun = performance.now();
                        animateNetworkCardsOnEntry();
                    }, 450 - (now - networkTabMotionLastRun));
                    return;
                }
                networkTabMotionLastRun = now;
            }
            animateNetworkCardsOnEntry();
        });
    });
}

// ── Dashboard: card reveal motion (mirrors Network/Gaming entrance) ──────────
const DASHBOARD_ENTRY_MOTION = {
    duration: 820,
    stagger: 100,
    slideX: 0,
    slideY: 20,
    blur: 8,
    opacity: 0,
    scale: 0.98,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};

let dashboardPageEnterMotionLastRun = 0;
let dashboardTabMotionLastRun = 0;
let dashboardTabMotionRequest = 0;

function getDashboardEntryCards(page) {
    const items = [];
    const hero = page.querySelector('#hero-card');
    if (hero) items.push(hero);
    page.querySelectorAll('.assets-grid > .asset-card').forEach(c => items.push(c));
    const discord = page.querySelector('#discord-card');
    if (discord) items.push(discord);
    const active = page.querySelector('.active-card.glass');
    if (active) items.push(active);
    return items.filter(item => {
        const rect = item.getBoundingClientRect();
        return rect.width >= 8 && rect.height >= 8;
    });
}

function clearDashboardEntryCardAnimations(items = []) {
    items.forEach(item => {
        if (item._dashboardEntryAnimation) {
            item._dashboardEntryAnimation.cancel();
            item._dashboardEntryAnimation = null;
        }
        item.style.removeProperty('will-change');
        item.style.removeProperty('pointer-events');
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
        clearEntryCardShine(item);
    });
}

function animateDashboardCardsOnEntry() {
    const page = document.getElementById('page-dashboard');
    if (!page?.classList.contains('active')) return 0;

    const motion = DASHBOARD_ENTRY_MOTION;
    const targetItems = getDashboardEntryCards(page);
    clearDashboardEntryCardAnimations(targetItems);
    if (targetItems[0]) targetItems[0].offsetHeight;

    let started = 0;
    targetItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        applyEntryCardShine(item, index, motion.stagger);
        item.style.pointerEvents = 'none';

        const animation = item.animate([
            {
                opacity: motion.opacity,
                transform: `translate3d(${motion.slideX}px, ${motion.slideY}px, 0) scale(${motion.scale})`,
                filter: `blur(${motion.blur}px)`
            },
            {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale(1)',
                filter: 'blur(0px)'
            }
        ], {
            duration: motion.duration,
            delay: index * motion.stagger,
            easing: motion.easing,
            fill: 'both'
        });

        item.style.willChange = 'transform, opacity, filter';
        item._dashboardEntryAnimation = animation;
        setTimeout(() => {
            if (item._dashboardEntryAnimation === animation) item.style.removeProperty('pointer-events');
        }, index * motion.stagger);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (item._dashboardEntryAnimation === animation) {
                    animation.cancel();
                    item._dashboardEntryAnimation = null;
                    item.style.removeProperty('will-change');
                    item.style.removeProperty('pointer-events');
                    item.style.removeProperty('opacity');
                    item.style.removeProperty('transform');
                    item.style.removeProperty('filter');
                }
            });
        started++;
    });

    return started;
}

function scheduleDashboardCardsOnEntry(options = {}) {
    const page = document.getElementById('page-dashboard');
    if (!page) return;
    const requestId = ++dashboardTabMotionRequest;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!page.classList.contains('active')) return;
            const now = performance.now();
            if (options.source === 'page-enter' && now - dashboardPageEnterMotionLastRun < 900) return;
            if (options.source === 'page-enter') dashboardPageEnterMotionLastRun = now;
            if (options.source === 'tab-click') {
                if (requestId !== dashboardTabMotionRequest) return;
                if (now - dashboardTabMotionLastRun < 450) {
                    setTimeout(() => {
                        if (requestId !== dashboardTabMotionRequest || !page.classList.contains('active')) return;
                        dashboardTabMotionLastRun = performance.now();
                        animateDashboardCardsOnEntry();
                    }, 450 - (now - dashboardTabMotionLastRun));
                    return;
                }
                dashboardTabMotionLastRun = now;
            }
            animateDashboardCardsOnEntry();
        });
    });
}

// ── AI Process Reducer: card reveal motion ────────────────────────────────────
const PROCESS_REDUCER_ENTRY_MOTION = {
    duration: 820,
    stagger: 90,
    slideX: 0,
    slideY: 20,
    blur: 8,
    opacity: 0,
    scale: 0.98,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};

let prxPageEnterMotionLastRun = 0;
let prxTabMotionLastRun = 0;
let prxTabMotionRequest = 0;

function getPrxEntryCards(page) {
    const panel = page.querySelector('#prx-panel-overview') || page;
    return Array.from(panel.querySelectorAll('.prx-pcard, .prx-adv-card')).filter(item => {
        const rect = item.getBoundingClientRect();
        return rect.width >= 8 && rect.height >= 8;
    });
}

function clearPrxEntryCardAnimations(items = []) {
    items.forEach(item => {
        if (item._prxEntryAnimation) {
            item._prxEntryAnimation.cancel();
            item._prxEntryAnimation = null;
        }
        item.style.removeProperty('will-change');
        item.style.removeProperty('pointer-events');
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
        clearEntryCardShine(item);
    });
}

function animatePrxCardsOnEntry() {
    const page = document.getElementById('page-process-reducer');
    if (!page?.classList.contains('active')) return 0;

    const motion = PROCESS_REDUCER_ENTRY_MOTION;
    const targetItems = getPrxEntryCards(page);
    clearPrxEntryCardAnimations(targetItems);
    if (targetItems[0]) targetItems[0].offsetHeight;

    let started = 0;
    targetItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        applyEntryCardShine(item, index, motion.stagger);
        item.style.pointerEvents = 'none';

        const animation = item.animate([
            {
                opacity: motion.opacity,
                transform: `translate3d(${motion.slideX}px, ${motion.slideY}px, 0) scale(${motion.scale})`,
                filter: `blur(${motion.blur}px)`
            },
            {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale(1)',
                filter: 'blur(0px)'
            }
        ], {
            duration: motion.duration,
            delay: index * motion.stagger,
            easing: motion.easing,
            fill: 'both'
        });

        item.style.willChange = 'transform, opacity, filter';
        item._prxEntryAnimation = animation;
        setTimeout(() => {
            if (item._prxEntryAnimation === animation) item.style.removeProperty('pointer-events');
        }, index * motion.stagger);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (item._prxEntryAnimation === animation) {
                    animation.cancel();
                    item._prxEntryAnimation = null;
                    item.style.removeProperty('will-change');
                    item.style.removeProperty('pointer-events');
                    item.style.removeProperty('opacity');
                    item.style.removeProperty('transform');
                    item.style.removeProperty('filter');
                }
            });
        started++;
    });

    return started;
}

function scheduleProcessReducerCardsOnEntry(options = {}) {
    const page = document.getElementById('page-process-reducer');
    if (!page) return;
    const requestId = ++prxTabMotionRequest;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!page.classList.contains('active')) return;
            const now = performance.now();
            if (options.source === 'page-enter' && now - prxPageEnterMotionLastRun < 900) return;
            if (options.source === 'page-enter') prxPageEnterMotionLastRun = now;
            if (options.source === 'tab-click') {
                if (requestId !== prxTabMotionRequest) return;
                if (now - prxTabMotionLastRun < 450) {
                    setTimeout(() => {
                        if (requestId !== prxTabMotionRequest || !page.classList.contains('active')) return;
                        prxTabMotionLastRun = performance.now();
                        animatePrxCardsOnEntry();
                    }, 450 - (now - prxTabMotionLastRun));
                    return;
                }
                prxTabMotionLastRun = now;
            }
            animatePrxCardsOnEntry();
        });
    });
}

function initializeNetworkCards() {
    // ── Tab filter + search ────────────────────────────────────
    let netActiveFilter = 'all';

    function applyNetworkFilter() {
        const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
        const allCards = document.querySelectorAll('#page-network [data-net-cat]');
        let featuredVisible = 0;
        let advancedVisible = 0;

        allCards.forEach(card => {
            const cats  = (card.dataset.netCat || '').split(' ');
            const text  = card.textContent.toLowerCase();
            const catOk = netActiveFilter === 'all' || cats.includes(netActiveFilter);
            const textOk = !q || text.includes(q);
            const show   = catOk && textOk;

            if (card._netAnim) {
                card._netAnim.cancel();
                card._netAnim = null;
            }
            if (card._networkEntryAnimation) {
                card._networkEntryAnimation.cancel();
                card._networkEntryAnimation = null;
            }
            clearEntryCardShine(card);
            card.style.removeProperty('opacity');
            card.style.removeProperty('transform');
            card.style.removeProperty('filter');
            card.style.removeProperty('will-change');
            card.style.display = show ? '' : 'none';

            if (show) {
                if (card.classList.contains('net-pcard')) featuredVisible++;
                else advancedVisible++;
            }
            return;

            const wasHidden = card.style.display === 'none';

            if (show) {
                if (card.classList.contains('net-pcard')) featuredVisible++;
                else advancedVisible++;

                if (wasHidden) {
                    // Card was truly hidden — cancel any stale anim and animate it in
                    if (card._netAnim) { card._netAnim.cancel(); card._netAnim = null; }
                    card.style.display = '';

                    if (!reducedMotion) {
                        const delay = Math.min(enterIndex * 25, 140);
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(8px)';
                        const anim = card.animate(
                            [{ opacity: 0, transform: 'translateY(8px)' },
                             { opacity: 1, transform: 'translateY(0)' }],
                            { duration: 210, delay, easing: 'ease-out', fill: 'none' }
                        );
                        card._netAnim = anim;
                        const finish = () => {
                            if (card._netAnim === anim) {
                                card._netAnim = null;
                                card.style.opacity = '';
                                card.style.transform = '';
                            }
                        };
                        anim.onfinish = finish;
                        anim.oncancel = finish;
                    }
                    enterIndex++;
                } else {
                    // Card already visible — cancel any leave anim and let it stay
                    if (card._netAnim) {
                        card._netAnim.cancel();
                        card._netAnim = null;
                        card.style.opacity = '';
                        card.style.transform = '';
                    }
                }
            } else {
                if (wasHidden) return; // Already hidden — nothing to do

                // Cancel any enter anim so card is at CSS opacity:1 before leaving
                if (card._netAnim) {
                    card._netAnim.cancel();
                    card._netAnim = null;
                    card.style.opacity = '';
                    card.style.transform = '';
                }

                if (reducedMotion) {
                    card.style.display = 'none';
                    return;
                }

                // Animate out, then set display:none in onfinish
                const anim = card.animate(
                    [{ opacity: 1, transform: 'translateY(0)' },
                     { opacity: 0, transform: 'translateY(6px)' }],
                    { duration: 155, easing: 'ease-in', fill: 'forwards' }
                );
                card._netAnim = anim;
                anim.onfinish = () => {
                    if (card._netAnim === anim) {
                        card.style.display = 'none';
                        try { anim.cancel(); } catch (_) {}
                        card._netAnim = null;
                        card.style.opacity = '';
                        card.style.transform = '';
                    }
                };
                anim.oncancel = () => {
                    if (card._netAnim === anim) {
                        card._netAnim = null;
                        card.style.opacity = '';
                        card.style.transform = '';
                    }
                };
            }
        });

        // Show/hide section containers — defer hiding to let leave anims finish
        const featuredSection = document.querySelector('#page-network .net-section:not(.net-section-adv)');
        const advancedSection = document.querySelector('#page-network .net-section-adv');
        if (featuredVisible > 0) { if (featuredSection) featuredSection.style.display = ''; }
        else if (featuredSection) featuredSection.style.display = 'none';
        if (advancedVisible > 0) { if (advancedSection) advancedSection.style.display = ''; }
        else if (advancedSection) advancedSection.style.display = 'none';

        // Empty state
        let emptyEl = document.getElementById('net-empty-state');
        if (!emptyEl) {
            emptyEl = document.createElement('p');
            emptyEl.id        = 'net-empty-state';
            emptyEl.className = 'net-empty-state';
            emptyEl.textContent = 'No matching network tools found.';
            document.getElementById('page-network')?.appendChild(emptyEl);
        }
        emptyEl.style.display = (featuredVisible + advancedVisible) === 0 ? '' : 'none';
    }

    // Wire pointer-following aurora for network cards (not handled by enhanceToggleCards)
    document.querySelectorAll('#page-network [data-net-cat]').forEach(card => {
        card.addEventListener('pointermove', (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width)  * 100}%`);
            card.style.setProperty('--my', `${((e.clientY - r.top)  / r.height) * 100}%`);
        });
    });

    // Tab clicks
    document.getElementById('net-filter-tabs')?.addEventListener('click', (e) => {
        const tab = e.target.closest('.net-filter-tab');
        if (!tab) return;

        // Update visual active state
        document.querySelectorAll('.net-filter-tab').forEach(t => t.classList.remove('net-filter-active'));
        tab.classList.add('net-filter-active');

        // Spring press via Web Animations API — always creates a new animation,
        // replays even on same-tab re-click, no CSS class/transition conflict
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            if (tab._pressAnim) tab._pressAnim.cancel();
            tab._pressAnim = tab.animate(
                [{ transform: 'scale(0.91)' },
                 { transform: 'scale(1.05)', offset: 0.5 },
                 { transform: 'scale(1)' }],
                { duration: 260, easing: 'ease-out' }
            );
            tab._pressAnim.onfinish = tab._pressAnim.oncancel = () => { tab._pressAnim = null; };
        }

        netActiveFilter = tab.dataset.filter || 'all';
        clearNetworkEntryCardAnimations(Array.from(document.querySelectorAll('#page-network .net-pcard, #page-network .net-adv-card, #page-network .network-card')));
        applyNetworkFilter();
        scheduleNetworkCardsOnEntry({ source: 'tab-click' });
    });

    // Search — re-run combined filter when network page is active
    document.getElementById('global-search')?.addEventListener('input', () => {
        if (document.getElementById('page-network')?.classList.contains('active')) {
            applyNetworkFilter();
        }
    });

    // Dev replay button — re-runs the enter animation on all currently visible network cards
    document.getElementById('net-replay-btn')?.addEventListener('click', () => {
        let idx = 0;
        document.querySelectorAll('#page-network [data-net-cat]').forEach(card => {
            if (card.style.display === 'none') return;
            if (card._netAnim) { card._netAnim.cancel(); card._netAnim = null; }
            card.style.opacity = '0';
            card.style.transform = 'translateY(8px)';
            const delay = Math.min(idx * 25, 160);
            const anim = card.animate(
                [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
                { duration: 210, delay, easing: 'ease-out', fill: 'none' }
            );
            card._netAnim = anim;
            const finish = () => {
                if (card._netAnim === anim) {
                    card._netAnim = null;
                    card.style.opacity = '';
                    card.style.transform = '';
                }
            };
            anim.onfinish = anim.oncancel = finish;
            idx++;
        });
    });

    // Hover tooltip for featured pcards and advanced cards — reuses showTooltipFor/hideTooltip
    document.querySelectorAll('#page-network .net-pcard[data-network-card], #page-network .net-adv-card[data-network-card]').forEach(card => {
        let showTimer;
        card.addEventListener('mouseenter', () => {
            clearTimeout(showTimer);
            showTimer = setTimeout(() => showTooltipFor(card), 220);
        });
        card.addEventListener('mouseleave', () => {
            clearTimeout(showTimer);
            hideTooltip();
        });
    });

    const setNetworkActionRunning = (btn, running) => {
        const card = btn.closest('[data-network-card]');
        if (card) card.classList.toggle('net-action-running', running);
    };

    // Flush DNS
    document.getElementById('flush-dns-btn')?.addEventListener('click', async function () {
        const btn = this;
        const statusEl = btn.closest('[data-network-card]')?.querySelector('.pcard-status-text');
        btn.disabled = true;
        setNetworkActionRunning(btn, true);
        btn.textContent = 'Clearing...';
        if (statusEl) statusEl.textContent = 'Clearing cache...';
        try {
            const r = await window.electronAPI.flushDns();
            if (r.success) {
                if (statusEl) statusEl.textContent = 'Done';
                showNotification('success', 'DNS Cache Cleared', 'Resolver cache flushed. Stale entries removed.');
                setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 3000);
            } else {
                if (statusEl) statusEl.textContent = 'Failed';
                showNotification('error', 'Flush Failed', r.message || 'Could not flush DNS cache.');
                setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 3000);
            }
        } catch {
            if (statusEl) statusEl.textContent = 'Ready';
            showNotification('error', 'Error', 'Unexpected error during DNS flush.');
        }
        setNetworkActionRunning(btn, false);
        btn.disabled = false;
        btn.textContent = 'Flush DNS';
    });

    // Release / Renew IP
    document.getElementById('release-renew-btn')?.addEventListener('click', async function () {
        const btn = this;
        const statusEl = btn.closest('[data-network-card]')?.querySelector('.pcard-status-text');
        btn.disabled = true;
        setNetworkActionRunning(btn, true);
        btn.textContent = 'Requesting...';
        if (statusEl) statusEl.textContent = 'Requesting lease...';
        showNotification('warning', 'IP Renewal', 'Releasing and renewing IP — connection may drop briefly.');
        try {
            const r = await window.electronAPI.releaseRenewIp();
            if (r.success) {
                if (statusEl) statusEl.textContent = 'Renewed';
                showNotification('success', 'IP Renewed', 'Fresh lease obtained from your router.');
                setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 3000);
            } else {
                if (statusEl) statusEl.textContent = 'Failed';
                showNotification('error', 'IP Renewal Failed', r.message || 'Could not release/renew IP.');
                setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 3000);
            }
        } catch {
            if (statusEl) statusEl.textContent = 'Ready';
            showNotification('error', 'Error', 'Unexpected error during IP renewal.');
        }
        setNetworkActionRunning(btn, false);
        btn.disabled = false;
        btn.textContent = 'Release/Renew';
    });

    // Packet Loss Test — gateway, current DNS, Cloudflare, Google (deduped, parallel)
    document.getElementById('packet-test-btn')?.addEventListener('click', async function () {
        const btn = this;
        const statusEl = btn.closest('[data-network-card]')?.querySelector('.pcard-status-text');
        btn.disabled = true;
        setNetworkActionRunning(btn, true);
        btn.textContent = 'Testing...';
        if (statusEl) statusEl.textContent = 'Testing gateway, DNS, and public endpoints...';
        try {
            // Detect active physical adapter's gateway and primary DNS
            let gateway = null;
            let primaryDns = null;
            try {
                const net = await window.electronAPI.getActiveNetwork();
                if (net?.success) {
                    gateway    = net.gateway    || null;
                    primaryDns = net.primaryDns || null;
                }
            } catch { /* non-fatal — proceed without gateway/DNS */ }

            // Build deduplicated ordered target list:
            // gateway → current DNS → Cloudflare → Google
            const seen = new Set();
            const isV4 = ip => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
            const targets = [];
            const addTarget = (ip, label) => {
                if (ip && isV4(ip) && !seen.has(ip)) { targets.push({ ip, label }); seen.add(ip); }
            };
            addTarget(gateway,    'Gateway');
            addTarget(primaryDns, 'Your DNS');
            addTarget('1.1.1.1',  'Cloudflare');
            addTarget('8.8.8.8',  'Google');

            const results = await Promise.all(targets.map(async ({ ip, label }) => {
                try {
                    const r = await window.electronAPI.runPacketTest(ip);
                    return { label, ip, r };
                } catch {
                    return { label, ip, r: { success: false } };
                }
            }));

            // Log every target for diagnostics
            console.log('[PacketTest]', results.map(({ label, ip, r }) => ({
                label, ip,
                ...(r.stats || { result: r.success ? 'no stats' : 'failed' })
            })));

            // Format per-target result line
            const fmtResult = ({ label, r }) => {
                if (!r.success || !r.stats) return `${label}: Unavailable`;
                const { averageMs, packetLoss, jitterMs } = r.stats;
                const parts = [
                    averageMs  !== null ? `${averageMs}ms avg`           : null,
                    packetLoss !== null ? `${packetLoss}% loss`          : null,
                    jitterMs   !== null ? `±${Math.round(jitterMs)}ms`   : null,
                ].filter(Boolean);
                return `${label}: ${parts.join(' ')}`;
            };
            const lines = results.map(fmtResult);

            // Contextual interpretation
            const hasLoss = r => r?.success && (r.stats?.packetLoss ?? 0) > 0;
            const gatewayR  = results.find(r => r.label === 'Gateway');
            const dnsR      = results.find(r => r.label === 'Your DNS');
            const publicRs  = results.filter(r => r.label === 'Cloudflare' || r.label === 'Google');

            const gatewayLoss = hasLoss(gatewayR?.r);
            const dnsLoss     = hasLoss(dnsR?.r);
            const publicLoss  = publicRs.some(r => hasLoss(r.r));
            const anyLoss     = gatewayLoss || dnsLoss || publicLoss;
            const allFailed   = results.every(r => !r.r.success || !r.r.stats);

            let hint = '';
            if (gatewayLoss && !dnsLoss && !publicLoss) {
                hint = 'Local router or Wi-Fi is likely the issue.';
            } else if (!gatewayLoss && dnsLoss && !publicLoss) {
                hint = 'DNS route may be unstable. Consider switching DNS servers.';
            } else if (!gatewayLoss && !dnsLoss && publicLoss) {
                hint = 'Possible ISP or internet routing issue.';
            } else if (anyLoss) {
                hint = 'Multiple hops affected — check your router and ISP.';
            }

            const body = hint ? `${lines.join(' | ')} — ${hint}` : lines.join(' | ');

            if (allFailed) {
                if (statusEl) statusEl.textContent = 'Unreachable';
                showNotification('error', 'Packet Test Failed', 'No endpoints responded. Check your connection.');
            } else if (anyLoss) {
                if (statusEl) statusEl.textContent = 'Loss detected';
                showNotification('warning', 'Packet Loss Detected', body);
            } else {
                if (statusEl) statusEl.textContent = 'Stable';
                showNotification('success', 'Connection Looks Stable', body);
            }
            setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 4000);
        } catch {
            if (statusEl) statusEl.textContent = 'Ready';
            showNotification('error', 'Error', 'Unexpected error during packet test.');
        }
        setNetworkActionRunning(btn, false);
        btn.disabled = false;
        btn.textContent = 'Run Test';
    });

    // Winsock Reset
    document.getElementById('winsock-reset-btn')?.addEventListener('click', async function () {
        const btn = this;
        const statusEl = btn.closest('[data-network-card]')?.querySelector('.pcard-status-text');
        btn.disabled = true;
        setNetworkActionRunning(btn, true);
        btn.textContent = 'Resetting...';
        if (statusEl) statusEl.textContent = 'Resetting catalog...';
        try {
            const r = await window.electronAPI.resetWinsock();
            if (r.success) {
                if (statusEl) statusEl.textContent = 'Restart needed';
                showNotification('warning', 'Winsock Reset', 'Catalog reset complete. Restart your PC for changes to take effect.');
            } else if (r.message && (r.message.toLowerCase().includes('access') || r.message.toLowerCase().includes('denied') || r.message.toLowerCase().includes('admin'))) {
                if (statusEl) statusEl.textContent = 'Admin required';
                showNotification('error', 'Admin Required', 'Run this app as Administrator to reset Winsock.');
                setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 4000);
            } else {
                if (statusEl) statusEl.textContent = 'Failed';
                showNotification('error', 'Reset Failed', r.message || 'Could not reset Winsock.');
                setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; }, 3000);
            }
        } catch {
            if (statusEl) statusEl.textContent = 'Ready';
            showNotification('error', 'Error', 'Unexpected error during Winsock reset.');
        }
        setNetworkActionRunning(btn, false);
        btn.disabled = false;
        btn.textContent = 'Reset Winsock';
    });
}

// ── DNS Optimizer Popcard ─────────────────────────────────────
function initializeDnsOptimizer() {
    const modal    = document.getElementById('dns-modal');
    const openBtn  = document.getElementById('open-dns-optimizer-btn');
    const closeBtn = document.getElementById('dns-modal-close');
    const backdrop = document.getElementById('dns-modal-backdrop');
    if (!modal || !openBtn) return;

    const DNS_CONFIGS = {
        'Cloudflare': { servers: ['1.1.1.1',  '1.0.0.1'],           detail: 'Fast general-purpose DNS' },
        'Google':     { servers: ['8.8.8.8',  '8.8.4.4'],            detail: 'Reliable, widely supported DNS' },
        'Quad9':      { servers: ['9.9.9.9',  '149.112.112.112'],     detail: 'Security-focused DNS' },
    };

    let scanData         = null;
    let selectedDns      = null;
    let isCurrentDnsBest = false;
    let currentRec       = null;   // latest pickRecommendation() output
    let mode             = 'balanced'; // balanced | fastest | security
    let scanDepth        = 'accurate'; // quick | accurate | deep
    const SCAN_DEPTHS    = { quick: 1, accurate: 3, deep: 5 };
    let lastScanTime     = null;
    const fmtTime        = (d) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // ── Open / Close ────────────────────────────────────────
    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.getAttribute('aria-hidden')) closeModal();
    });

    function openModal() {
        modal.removeAttribute('aria-hidden');
        modal.classList.add('dns-modal-visible');
        runScan();
    }
    function closeModal() {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('dns-modal-visible');
        resetLog();
    }

    // ── State helpers ───────────────────────────────────────
    function showState(id) {
        document.querySelectorAll('.dns-state').forEach(el => el.classList.add('dns-hidden'));
        document.getElementById(id)?.classList.remove('dns-hidden');
    }
    function setScanProgress(pct) {
        const bar = document.getElementById('dns-scan-bar');
        if (bar) bar.style.width = `${pct}%`;
    }
    function setScanStatus(msg) {
        const el = document.getElementById('dns-scan-status');
        if (el) el.textContent = msg;
    }

    // ── Log drawer ──────────────────────────────────────────
    function resetLog() {
        const el = document.getElementById('dns-log-entries');
        if (el) el.innerHTML = '';
    }
    function addLog(msg, type = 'info') {
        const el = document.getElementById('dns-log-entries');
        if (!el) return;
        const row = document.createElement('div');
        row.className = `dns-log-row dns-log-${type}`;
        const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        row.innerHTML = `<span class="dns-log-time">${t}</span><span class="dns-log-msg">${msg}</span>`;
        el.appendChild(row);
        el.scrollTop = el.scrollHeight;
    }

    // ── Rescan wiring ───────────────────────────────────────
    document.getElementById('dns-rescan-btn')?.addEventListener('click', runScan);

    // ── Mode selector wiring ─────────────────────────────────
    document.getElementById('dns-mode-selector')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.dns-mode-btn');
        if (!btn) return;
        const newMode = btn.dataset.mode;
        if (!newMode || newMode === mode) return;
        mode = newMode;
        document.querySelectorAll('.dns-mode-btn').forEach(b => b.classList.remove('dns-mode-active'));
        btn.classList.add('dns-mode-active');
        if (scanData) {
            showResults(scanData); // re-evaluate with new mode, no rescan
        }
    });

    document.getElementById('dns-depth-selector')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.dns-depth-btn');
        if (!btn) return;
        const newDepth = btn.dataset.depth;
        if (!newDepth || newDepth === scanDepth) return;
        scanDepth = newDepth;
        document.querySelectorAll('.dns-depth-btn').forEach(b => b.classList.remove('dns-depth-active'));
        btn.classList.add('dns-depth-active');
        if (scanData) runScan(); // depth changed — old results are now stale
    });

    // VPN scope change invalidates current results
    document.getElementById('dns-include-vpn')?.addEventListener('change', () => {
        if (scanData) runScan();
    });

    // ── Confidence calculation ───────────────────────────────
    function calcConfidence(pingResults, dnsLookup, dk, rounds) {
        const issues = [];
        let deductions = 0;

        // Depth-based confidence adjustment
        const r = rounds || 1;
        if (r === 1) {
            deductions += 15; // Quick scan: single round is noisy
        } else if (r >= 5) {
            deductions -= 10; // Deep scan: more data = more confidence
        }

        // Packet loss on any provider
        pingResults.forEach(r => {
            if (r.available && r.loss !== null && r.loss > 0) {
                issues.push(`${r.loss}% packet loss on ${r.label}`);
                deductions += r.loss > 10 ? 40 : 25;
            }
        });

        // High jitter (>15 ms) on any provider
        pingResults.forEach(r => {
            if (r.available && r.jitter !== null && r.jitter > 15) {
                issues.push(`high jitter on ${r.label} (${r.jitter}ms)`);
                deductions += r.jitter > 30 ? 20 : 10;
            }
        });

        // Margin between best and second-best DNS lookup
        const withLookup = pingResults.filter(r => r.available && dnsLookup[dk(r.label)]?.available);
        if (withLookup.length >= 2) {
            const sorted = [...withLookup].sort((a, b) =>
                dnsLookup[dk(a.label)].avg - dnsLookup[dk(b.label)].avg);
            const margin = dnsLookup[dk(sorted[1].label)].avg - dnsLookup[dk(sorted[0].label)].avg;
            if (margin < 5) {
                issues.push(`results within 5ms — effectively identical`);
                deductions += 35;
            } else if (margin < 15) {
                issues.push(`small margin between providers (${margin}ms)`);
                deductions += 15;
            }
        } else if (withLookup.length < 2) {
            issues.push('too few providers responded for comparison');
            deductions += 20;
        }

        const score = Math.max(0, 100 - deductions);
        return {
            level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
            score,
            issues,
        };
    }

    // ── Recommendation logic ─────────────────────────────────
    // All providers compete on equal footing. Provider identity only affects
    // labelling, not scoring — except in Security Focused mode where Quad9 is
    // the explicit target.
    function pickRecommendation(data, selectedMode, confidence) {
        const dk = (label) => label === 'Current DNS' ? 'CurrentDNS' : label;
        const allAvailable = data.pingResults.filter(r => r.available);
        if (allAvailable.length === 0) {
            return { action: 'none', best: null, reason: 'No providers responded.' };
        }

        const currentDl = data.dnsLookup?.['CurrentDNS'];

        // Sort by DNS lookup latency; Current DNS wins ties so users aren't
        // nudged into a switch with no real benefit.
        const sorted = [...allAvailable].sort((a, b) => {
            const dlA = data.dnsLookup?.[dk(a.label)];
            const dlB = data.dnsLookup?.[dk(b.label)];
            if (dlA?.available && dlB?.available) {
                if (dlA.avg !== dlB.avg) return dlA.avg - dlB.avg;
                if (a.label === 'Current DNS') return -1;
                if (b.label === 'Current DNS') return 1;
                return 0;
            }
            if (dlA?.available) return -1;
            if (dlB?.available) return 1;
            return (a.avg ?? 9999) - (b.avg ?? 9999);
        });

        const fastest    = sorted[0];
        const fastestDl  = data.dnsLookup?.[dk(fastest.label)];
        // Best non-Current provider by measurement (no provider pre-selected)
        const bestProvider = sorted.find(r => r.label !== 'Current DNS' && DNS_CONFIGS[r.label]);
        const bestProvDl   = bestProvider ? data.dnsLookup?.[bestProvider.label] : null;

        // ms saved by switching to testDl vs current DNS (positive = faster)
        const improvement = (testDl) =>
            currentDl?.available && testDl?.available ? currentDl.avg - testDl.avg : null;

        // Low-confidence note appended to switch reasons
        const stabilityNote = confidence.level === 'low'
            ? ' Results may vary — network looked unstable. Retest with downloads paused.' : '';

        // ── SECURITY mode ──────────────────────────────────────────
        if (selectedMode === 'security') {
            const quad9Row = allAvailable.find(r => r.label === 'Quad9');
            const quad9Dl  = data.dnsLookup?.['Quad9'];
            const isAlreadyQuad9 = data.adapter.dnsServers[0] === '9.9.9.9';

            if (!quad9Row || !quad9Dl?.available) {
                return { action: 'keep', best: fastest,
                    reason: 'Quad9 did not respond in this scan. Cannot recommend it — keeping current DNS. Try again or check your connection.' };
            }

            if (isAlreadyQuad9) {
                return { action: 'keep', best: quad9Row,
                    reason: 'Quad9 security-focused DNS is already active — no change needed.' };
            }

            const lagVsFastest = fastestDl?.available ? quad9Dl.avg - fastestDl.avg : 0;
            if (lagVsFastest > 60) {
                return { action: 'keep', best: fastest,
                    reason: `Quad9 is ${lagVsFastest}ms slower than the fastest provider in this scan. This is a significant trade-off — keeping current DNS. Try again on a quieter network, or use Balanced mode.` };
            }

            const imp       = improvement(quad9Dl);
            const speedDesc = lagVsFastest <= 0 ? 'the fastest option in this scan'
                            : `${lagVsFastest}ms slower than fastest`;
            const tradeoff  = imp !== null && imp < 0
                ? ` Trade-off: ${Math.abs(imp)}ms slower than your current DNS.` : '';
            return {
                action: 'switch', best: quad9Row, provider: 'Quad9',
                reason: `Quad9 is ${speedDesc} and filters malicious domains.${tradeoff}${stabilityNote}`,
            };
        }

        // ── FASTEST mode ──────────────────────────────────────────
        if (selectedMode === 'fastest') {
            if (fastest.label === 'Current DNS') {
                return { action: 'keep', best: fastest,
                    reason: 'Current DNS measured fastest in this scan — no change needed.' };
            }
            const imp = improvement(fastestDl);
            if (imp !== null && imp < 5) {
                return { action: 'keep', best: fastest,
                    reason: `${fastest.label} is only ${imp}ms faster than current DNS — too small to matter (under 5ms threshold).` };
            }
            return {
                action: 'switch', best: fastest, provider: fastest.label,
                reason: imp !== null
                    ? `${fastest.label} measured ${imp}ms faster than current DNS.${stabilityNote}`
                    : `Fastest DNS lookup in this scan.${stabilityNote}`,
            };
        }

        // ── BALANCED mode ────────────────────────────────────────
        // All providers compete equally. Current DNS wins ties.
        if (fastest.label === 'Current DNS') {
            return { action: 'keep', best: fastest,
                reason: 'Current DNS is already strong — no change needed.' };
        }

        if (!bestProvider) {
            return { action: 'keep', best: fastest,
                reason: 'No switchable provider outperformed current DNS in this scan.' };
        }

        const imp = improvement(bestProvDl);

        // Conservative switch threshold that scales with confidence
        const threshold = confidence.level === 'high' ? 15
                        : confidence.level === 'medium' ? 25
                        : 40;

        if (imp !== null && imp < threshold) {
            if (imp <= 0) {
                return { action: 'keep', best: fastest,
                    reason: `Current DNS is already comparable to ${bestProvider.label} — no major improvement found.` };
            }
            return { action: 'keep', best: fastest,
                reason: `${bestProvider.label} is ${imp}ms faster — within the ${threshold}ms keep-current threshold for ${confidence.level}-confidence results. Not enough to justify a change.` };
        }

        return {
            action: 'switch', best: bestProvider, provider: bestProvider.label,
            reason: imp !== null
                ? `${bestProvider.label} is ${imp}ms faster than current DNS.${stabilityNote}`
                : `Fastest switchable DNS in this scan.${stabilityNote}`,
        };
    }

    // ── Scan ────────────────────────────────────────────────
    async function runScan() {
        scanData      = null;
        lastScanTime  = null;
        selectedDns   = null;
        resetLog();
        showState('dns-state-scan');
        setScanProgress(5);
        setScanStatus('Detecting physical adapter...');
        addLog(`Scan started at ${fmtTime(new Date())}`);

        const includeVpn = document.getElementById('dns-include-vpn')?.checked ?? false;
        if (includeVpn) addLog('VPN/virtual adapters included in search.');

        setScanProgress(15);
        let result;
        try {
            result = await window.electronAPI.dnsOptimizerScan({ includeVpn, rounds: SCAN_DEPTHS[scanDepth] });
        } catch (err) {
            addLog(`Error: ${err.message}`, 'error');
            showScanError('Unexpected error during scan.');
            return;
        }

        if (!result.success) {
            // Log any skipped adapters before showing error
            (result.skippedAdapters || []).forEach(s =>
                addLog(`Skipped "${s}" — virtual/VPN adapter ignored by default.`, 'warning'));
            addLog(`Scan failed: ${result.message}`, 'error');
            showScanError(result.message || 'Could not detect network adapter.');
            return;
        }

        // Log skipped adapters even on success
        (result.skippedAdapters || []).forEach(s =>
            addLog(`Skipped "${s}" — virtual/VPN adapter.`, 'warning'));

        scanData     = result;
        lastScanTime = new Date();
        setScanProgress(40);
        setScanStatus('Running latency and DNS lookup tests...');

        addLog(`Adapter: ${result.adapter.name} (${result.adapter.connType})`);
        if (result.adapter.ipv4)    addLog(`IPv4: ${result.adapter.ipv4}`);
        if (result.adapter.gateway) addLog(`Gateway: ${result.adapter.gateway}`);
        addLog(`Current DNS: ${result.adapter.dnsServers.join(', ') || 'Unknown'}`);

        // Animate progress while waiting for the concurrent tests (already running)
        for (let p = 50; p <= 88; p += 6) {
            await new Promise(r => setTimeout(r, 300));
            setScanProgress(p);
        }

        result.pingResults.forEach(r => {
            if (r.available) {
                const lossStr = r.loss !== null ? `${r.loss}%` : '?';
                addLog(`Ping ${r.label} (${r.ip}): ${r.avg}ms avg  ${r.jitter}ms jitter  ${lossStr} loss`);
            } else {
                addLog(`Ping ${r.label} (${r.ip || 'N/A'}): Unavailable`);
            }
        });

        if (result.dnsLookup) {
            for (const [k, v] of Object.entries(result.dnsLookup)) {
                const label = k === 'CurrentDNS' ? 'Current DNS' : k;
                if (v?.available) {
                    addLog(`DNS lookup ${label}: ${v.avg}ms avg (${v.samples} domains tested)`);
                } else {
                    addLog(`DNS lookup ${label}: Unavailable`);
                }
            }
        }
        if (result.currentDnsMatchesProvider) {
            addLog(`Current DNS IP matches ${result.currentDnsMatchesProvider} — lookup result shared within this scan (not re-tested separately).`);
        }
        if (result.testParams) {
            const { domains, rounds, pingCount } = result.testParams;
            addLog(`Test params: ${rounds} round${rounds !== 1 ? 's' : ''} × ${domains} domains per provider · ${pingCount} pings per target`);
        }
        addLog(`Scan completed at ${fmtTime(new Date())} — fresh results`);

        setScanProgress(100);
        setTimeout(() => showResults(result), 350);
    }

    // ── Results ─────────────────────────────────────────────
    function showResults(data) {
        showState('dns-state-results');
        isCurrentDnsBest = false;
        selectedDns      = null;
        currentRec       = null;

        // Last tested timestamp
        const ltEl = document.getElementById('dns-last-tested');
        if (ltEl) {
            ltEl.textContent = lastScanTime ? `Last tested: ${fmtTime(lastScanTime)}` : '';
        }

        // Sync mode button active state (handles re-entry from mode change)
        document.querySelectorAll('.dns-mode-btn').forEach(b => {
            b.classList.toggle('dns-mode-active', b.dataset.mode === mode);
        });

        // Adapter info card
        const adEl = document.getElementById('dns-adapter-info');
        if (adEl) {
            adEl.innerHTML = `
                <div class="dns-info-row"><span>Adapter</span><b title="${data.adapter.name}">${data.adapter.name}</b></div>
                <div class="dns-info-row"><span>Type</span><b>${data.adapter.connType}</b></div>
                <div class="dns-info-row"><span>IPv4</span><b>${data.adapter.ipv4 || '—'}</b></div>
                <div class="dns-info-row"><span>Current DNS</span><b>${data.adapter.dnsServers.join(', ') || '—'}</b></div>
            `;
        }

        const dk = (label) => label === 'Current DNS' ? 'CurrentDNS' : label;

        // Confidence + recommendation
        const confidence = calcConfidence(data.pingResults, data.dnsLookup, dk, data.testParams?.rounds);
        const rec        = pickRecommendation(data, mode, confidence);
        currentRec       = rec;

        // Which row gets the "best" badge
        const badgeLabel = rec.action === 'switch' ? rec.provider
                         : rec.action === 'keep'   ? rec.best?.label
                         : null;

        // isCurrentDnsBest: true only when current DNS is genuinely fastest in raw sort
        const allAvailable = data.pingResults.filter(r => r.available);
        const rawSorted = [...allAvailable].sort((a, b) => {
            const dlA = data.dnsLookup?.[dk(a.label)];
            const dlB = data.dnsLookup?.[dk(b.label)];
            if (dlA?.available && dlB?.available) {
                if (dlA.avg !== dlB.avg) return dlA.avg - dlB.avg;
                if (a.label === 'Current DNS') return -1;
                if (b.label === 'Current DNS') return 1;
                return 0;
            }
            if (dlA?.available) return -1;
            if (dlB?.available) return 1;
            return (a.avg ?? 9999) - (b.avg ?? 9999);
        });
        isCurrentDnsBest = rawSorted[0]?.label === 'Current DNS';

        // Wire up apply
        if (rec.action === 'switch' && DNS_CONFIGS[rec.provider]) {
            selectedDns = { label: rec.provider, servers: DNS_CONFIGS[rec.provider].servers };
        }

        // Build comparison table
        const tableEl = document.getElementById('dns-comparison-table');
        if (tableEl) {
            tableEl.innerHTML = '';
            data.pingResults.forEach(r => {
                const cfg          = DNS_CONFIGS[r.label];
                const isCurrentRow = r.label === 'Current DNS';
                const dl           = data.dnsLookup?.[dk(r.label)];
                const isBadge      = r.label === badgeLabel;
                const isActive     = selectedDns?.label === r.label;

                const row = document.createElement('div');
                row.className = [
                    'dns-row',
                    isActive     ? 'dns-row-active'      : '',
                    !r.available ? 'dns-row-unavailable' : '',
                    isCurrentRow ? 'dns-row-current'     : '',
                ].filter(Boolean).join(' ');

                const barMs  = (dl?.available ? dl.avg : r.avg) || 0;
                const barPct = Math.min(100, barMs / 2);
                const latBar = r.available
                    ? `<div class="dns-lat-bar"><div class="dns-lat-fill" style="width:${barPct}%"></div></div>`
                    : '';

                const lookupStr = dl?.available ? `${dl.avg}ms` : r.available ? 'Unavail' : '—';
                const pingStr   = r.available && r.avg   !== null ? `${r.avg}ms`   : '—';
                const jitterStr = r.available && r.jitter !== null ? `${r.jitter}ms` : '—';
                const lossStr   = r.available && r.loss   !== null ? `${r.loss}%`   : '—';

                let serverLine;
                if (isCurrentRow) {
                    const ips = data.adapter.dnsServers.join(', ') || r.ip || '—';
                    const matchTag = data.currentDnsMatchesProvider
                        ? `<span class="dns-current-match">= ${data.currentDnsMatchesProvider}</span>` : '';
                    serverLine = `${ips} ${matchTag}`;
                } else {
                    serverLine = cfg ? cfg.servers.join(', ') : (r.ip || '—');
                }

                const detailLine = isCurrentRow ? 'Your currently configured DNS server'
                                 : (cfg ? cfg.detail : '');

                let badgeHtml = '';
                if (isBadge && isCurrentRow && rec.action === 'keep') {
                    badgeHtml = isCurrentDnsBest
                        ? '<span class="dns-badge-current">Active · Optimal</span>'
                        : '<span class="dns-badge-current">Keeping</span>';
                } else if (isBadge && !isCurrentRow) {
                    badgeHtml = '<span class="dns-badge-best">Recommended</span>';
                }

                row.innerHTML = `
                    <div class="dns-row-left">
                        <div class="dns-row-name">${r.label} ${badgeHtml}</div>
                        <div class="dns-row-ip">${serverLine}</div>
                        ${detailLine ? `<div class="dns-row-detail">${detailLine}</div>` : ''}
                    </div>
                    <div class="dns-row-right">
                        ${r.available ? `
                            <div class="dns-stat-group">
                                <div class="dns-stat"><span class="dns-stat-val dns-lookup-val">${lookupStr}</span><span class="dns-stat-lbl dns-stat-lbl-tip" title="DNS resolution time — how long this server takes to resolve domain names via Resolve-DnsName">lookup</span></div>
                                <div class="dns-stat"><span class="dns-stat-val">${pingStr}</span><span class="dns-stat-lbl dns-stat-lbl-tip" title="Network round-trip time to the DNS server IP — different from lookup time">ping</span></div>
                                <div class="dns-stat"><span class="dns-stat-val">${jitterStr}</span><span class="dns-stat-lbl">jitter</span></div>
                                <div class="dns-stat"><span class="dns-stat-val">${lossStr}</span><span class="dns-stat-lbl">loss</span></div>
                            </div>
                            ${latBar}
                        ` : '<span class="dns-unavail-tag">Unavailable</span>'}
                    </div>
                `;

                if (cfg && !isCurrentRow) {
                    row.style.cursor = 'pointer';
                    row.addEventListener('click', () => {
                        tableEl.querySelectorAll('.dns-row').forEach(el => el.classList.remove('dns-row-active'));
                        row.classList.add('dns-row-active');
                        selectedDns = { label: r.label, servers: cfg.servers };
                        currentRec  = { action: 'switch', provider: r.label };
                        isCurrentDnsBest = false;
                        updateApplyBtn();
                        addLog(`Manually selected: ${r.label}`);
                    });
                }
                tableEl.appendChild(row);
            });
        }

        // Methodology note — derived from actual testParams in scan result
        const methodEl = document.getElementById('dns-methodology-note');
        if (methodEl) {
            if (data.testParams) {
                const { domains, rounds, pingCount } = data.testParams;
                methodEl.textContent = `Tested ${domains} domains × ${rounds} lookup${rounds !== 1 ? 's' : ''} per provider · ${pingCount} ping samples per target`;
            } else {
                methodEl.textContent = '';
            }
        }

        // Confidence badge
        const badge = document.getElementById('dns-confidence-badge');
        if (badge) {
            const label = confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1);
            badge.textContent = `${label} Confidence`;
            badge.className = `dns-confidence-badge dns-confidence-${confidence.level}`;
        }

        // Recommendation text
        const recEl = document.getElementById('dns-recommendation-text');
        if (recEl) {
            if (rec.action === 'none') {
                recEl.innerHTML = 'No providers responded — try again.';
            } else if (rec.action === 'keep') {
                const matchNote = (isCurrentDnsBest && data.currentDnsMatchesProvider)
                    ? `Current DNS = ${data.currentDnsMatchesProvider} — already strong, no change needed.`
                    : rec.reason;
                recEl.innerHTML = matchNote;
            } else {
                const noteHtml = rec.note ? `<em> ${rec.note}</em>` : '';
                recEl.innerHTML = `<b>${rec.provider} DNS</b> — ${rec.reason}${noteHtml}`;
            }
        }

        // Log confidence, stability issues, mode, and reasoning
        addLog(`Confidence: ${confidence.level}${confidence.issues.length ? ' — ' + confidence.issues.join('; ') : ''}`);
        addLog(`Mode: ${mode} → ${rec.action === 'switch' ? 'Recommend switch to ' + rec.provider : 'Keep current DNS'}`);
        addLog(rec.reason);
        // Log whether current DNS was close to the best
        const currentDlLog = data.dnsLookup?.['CurrentDNS'];
        const bestForLog   = data.pingResults.filter(r => r.available && DNS_CONFIGS[r.label])
            .sort((a, b) => (data.dnsLookup?.[a.label]?.avg ?? 9999) - (data.dnsLookup?.[b.label]?.avg ?? 9999))[0];
        if (currentDlLog?.available && bestForLog) {
            const margin = (data.dnsLookup?.[bestForLog.label]?.avg ?? null);
            if (margin !== null) {
                const diff = currentDlLog.avg - margin;
                if (diff <= 0) addLog(`Current DNS is ${Math.abs(diff)}ms faster than best provider.`);
                else addLog(`Current DNS is ${diff}ms slower than ${bestForLog.label}.`);
            }
        }

        updateApplyBtn();
    }

    function updateApplyBtn() {
        const btn = document.getElementById('dns-apply-btn');
        if (!btn) return;
        if (currentRec?.action === 'switch' && selectedDns) {
            btn.disabled    = false;
            btn.textContent = `Apply ${selectedDns.label} DNS`;
        } else if (currentRec?.action === 'keep' || (!selectedDns && currentRec?.action !== 'switch')) {
            btn.disabled    = true;
            btn.textContent = isCurrentDnsBest
                ? 'Current DNS is Already Optimal'
                : 'No Meaningful Improvement Found';
        } else {
            btn.disabled    = true;
            btn.textContent = 'Select a DNS Provider Above';
        }
    }

    // ── Apply ───────────────────────────────────────────────
    document.getElementById('dns-apply-btn')?.addEventListener('click', async function () {
        if (!selectedDns || !scanData) return;
        const btn = this;
        btn.disabled    = true;
        btn.textContent = 'Applying...';
        addLog(`Applying ${selectedDns.label}: ${selectedDns.servers.join(', ')}`);

        let result;
        try {
            result = await window.electronAPI.dnsOptimizerApply({
                ifIndex:     scanData.adapter.ifIndex,
                dnsServers:  selectedDns.servers,
                adapterName: scanData.adapter.name,
            });
        } catch (err) {
            addLog(`Error: ${err.message}`, 'error');
            btn.disabled    = false;
            btn.textContent = `Apply ${selectedDns.label} DNS`;
            showNotification('error', 'Apply Error', err.message);
            return;
        }

        if (result.requiresAdmin) {
            addLog('Admin required — right-click app → Run as administrator', 'error');
            btn.disabled    = false;
            btn.textContent = `Apply ${selectedDns.label} DNS`;
            showNotification('error', 'Admin Required', 'Right-click the app and choose "Run as administrator", then try again.');
            return;
        }
        if (!result.success) {
            addLog(`Apply failed: ${result.message}`, 'error');
            btn.disabled    = false;
            btn.textContent = `Apply ${selectedDns.label} DNS`;
            showNotification('error', 'DNS Apply Failed', result.message || 'Unknown error.');
            return;
        }

        addLog('DNS applied successfully.', 'success');
        showApplied();
    });

    function showApplied() {
        showState('dns-state-applied');
        document.getElementById('dns-applied-label').textContent = selectedDns.label;
        document.getElementById('dns-before-dns').textContent    = scanData?.adapter?.dnsServers?.join(', ') || '—';
        document.getElementById('dns-after-dns').textContent     = selectedDns.servers.join(', ');
    }

    function showScanError(msg) {
        showState('dns-state-error');
        const el = document.getElementById('dns-error-msg');
        if (el) el.textContent = msg || 'An unknown error occurred.';
    }

    // ── Restore ─────────────────────────────────────────────
    document.getElementById('dns-restore-btn')?.addEventListener('click', async function () {
        const btn = this;
        btn.disabled    = true;
        btn.textContent = 'Restoring...';
        addLog('Restoring original DNS...');
        let result;
        try { result = await window.electronAPI.dnsOptimizerRestore(); }
        catch (err) {
            addLog(`Error: ${err.message}`, 'error');
            btn.disabled    = false;
            btn.textContent = 'Restore Original DNS';
            showNotification('error', 'Restore Error', err.message);
            return;
        }
        if (result.requiresAdmin) {
            addLog('Admin required', 'error');
            btn.disabled    = false;
            btn.textContent = 'Restore Original DNS';
            showNotification('error', 'Admin Required', 'Run as Administrator to restore DNS.');
            return;
        }
        if (result.success) {
            addLog('DNS restored.', 'success');
            showNotification('success', 'DNS Restored', 'Original DNS settings restored.');
            closeModal();
        } else {
            addLog(`Restore failed: ${result.message}`, 'error');
            btn.disabled    = false;
            btn.textContent = 'Restore Original DNS';
            showNotification('error', 'Restore Failed', result.message || 'Unknown error.');
        }
    });

    // ── Retry / Rescan ──────────────────────────────────────
    document.getElementById('dns-retry-btn')?.addEventListener('click', runScan);
}

function initializeAboutTilt() {
    const MAX_TILT = 8;
    const RETURN_MS = 440;
    const RETURN_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

    document.querySelectorAll('.about-team-tilt').forEach(wrapper => {
        if (wrapper.dataset.tiltReady === 'true') return;
        wrapper.dataset.tiltReady = 'true';

        const card = wrapper.querySelector('.t-tilt-card');
        if (!card) return;

        let rafId = null;
        let isHovering = false;
        let returnTimer = null;

        function cancelReturn() {
            if (returnTimer) { clearTimeout(returnTimer); returnTimer = null; }
        }

        function applyTilt(clientX, clientY) {
            const rect = wrapper.getBoundingClientRect();
            const px = (clientX - rect.left) / rect.width;
            const py = (clientY - rect.top) / rect.height;
            const rx = (0.5 - py) * MAX_TILT;
            const ry = (px - 0.5) * MAX_TILT;

            // Fast-follow during hover via inline transition
            card.style.transition = 'transform 80ms ease-out';
            card.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
            wrapper.style.setProperty('--tilt-gx', `${(px * 100).toFixed(1)}%`);
            wrapper.style.setProperty('--tilt-gy', `${(py * 100).toFixed(1)}%`);
        }

        function onPointerMove(e) {
            if (!isHovering) return;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                applyTilt(e.clientX, e.clientY);
                rafId = null;
            });
        }

        function onPointerEnter() {
            isHovering = true;
            cancelReturn();
            wrapper.classList.add('is-hover');
            // Switch to fast-follow immediately (cancel any lingering return transition)
            card.style.transition = 'transform 80ms ease-out';
        }

        function onPointerLeave() {
            isHovering = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            cancelReturn();
            wrapper.classList.remove('is-hover');
            wrapper.style.setProperty('--tilt-gx', '50%');
            wrapper.style.setProperty('--tilt-gy', '50%');

            // Apply explicit smooth return transition BEFORE setting neutral transform.
            // This ensures the browser sees a well-defined "from" state with the slow
            // easing already set, so a proper CSS transition fires.
            card.style.transition = `transform ${RETURN_MS}ms ${RETURN_EASE}`;
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';

            // After return completes, clean up inline styles
            returnTimer = setTimeout(() => {
                if (!isHovering) {
                    card.classList.remove('is-tilting');
                    card.style.removeProperty('transition');
                    card.style.removeProperty('transform');
                }
                returnTimer = null;
            }, RETURN_MS + 40);
        }

        wrapper.addEventListener('pointermove', onPointerMove, { passive: true });
        wrapper.addEventListener('pointerenter', onPointerEnter, { passive: true });
        wrapper.addEventListener('pointerleave', onPointerLeave, { passive: true });
        wrapper.addEventListener('pointercancel', onPointerLeave, { passive: true });
    });
}

// ── About: card reveal motion ────────────────────────────────────────────────
const ABOUT_ENTRY_MOTION = {
    duration: 820,
    stagger: 80,
    slideY: 16,
    blur: 6,
    opacity: 0,
    scale: 0.982,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
let aboutPageEnterMotionLastRun = 0;

function getAboutEntryCards() {
    const page = document.getElementById('page-about');
    if (!page) return [];
    const items = [];
    const appCard = page.querySelector('.about-card.app-info');
    if (appCard) items.push(appCard);
    page.querySelectorAll('.about-team-tilt').forEach(el => items.push(el));
    page.querySelectorAll('.feature-card').forEach(el => items.push(el));
    return items;
}

function animateAboutCardsOnEntry() {
    const page = document.getElementById('page-about');
    if (!page?.classList.contains('active')) return;

    const m = ABOUT_ENTRY_MOTION;
    const items = getAboutEntryCards();

    items.forEach(item => {
        if (item._aboutAnim) { try { item._aboutAnim.cancel(); } catch (_) {} item._aboutAnim = null; }
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
        item.style.removeProperty('pointer-events');
    });
    if (items[0]) items[0].offsetHeight;

    items.forEach((item, index) => {
        const delay = index * m.stagger;
        item.style.pointerEvents = 'none';
        const anim = item.animate([
            { opacity: m.opacity, transform: `translateY(${m.slideY}px) scale(${m.scale})`, filter: `blur(${m.blur}px)` },
            { opacity: 1,         transform: 'translateY(0) scale(1)',                       filter: 'blur(0px)' }
        ], { duration: m.duration, delay, easing: m.easing, fill: 'both' });
        item._aboutAnim = anim;
        anim.onfinish = () => {
            item.style.removeProperty('pointer-events');
            item.style.removeProperty('opacity');
            item.style.removeProperty('transform');
            item.style.removeProperty('filter');
            if (item._aboutAnim === anim) item._aboutAnim = null;
        };
        setTimeout(() => item.style.removeProperty('pointer-events'), delay + m.duration + 60);
    });
}

function scheduleAboutCardsOnEntry(options = {}) {
    const now = Date.now();
    if (options.source === 'page-enter' && now - aboutPageEnterMotionLastRun < 900) return;
    if (options.source === 'page-enter') aboutPageEnterMotionLastRun = now;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        animateAboutCardsOnEntry();
    }));
}

// ── Cleanup: card reveal motion ──────────────────────────────────────────────
const CLEANUP_ENTRY_MOTION = {
    duration: 820,
    stagger: 90,
    slideY: 18,
    blur: 7,
    opacity: 0,
    scale: 0.985,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
let cleanupPageEnterMotionLastRun = 0;

function getCleanupEntryItems() {
    const page = document.getElementById('page-cleanup');
    if (!page) return [];
    const items = [];
    const hero = page.querySelector('.cu-hero');
    if (hero) items.push(hero);
    const pipeline = page.querySelector('.cu-pipeline');
    if (pipeline) items.push(pipeline);
    // Safe Cleanup Queue: header then its cards
    const safeHd = page.querySelector('.cu-group-safe .cu-group-hd');
    if (safeHd) items.push(safeHd);
    page.querySelectorAll('.cu-group-safe .cleanup-card').forEach(el => items.push(el));
    // System Cache: header then its cards
    const cacheHd = page.querySelector('.cu-group-cache .cu-group-hd');
    if (cacheHd) items.push(cacheHd);
    page.querySelectorAll('.cu-group-cache .cleanup-card').forEach(el => items.push(el));
    // Recent Activity log
    const log = page.querySelector('.cu-log');
    if (log) items.push(log);
    return items;
}

function animateCleanupCardsOnEntry() {
    const page = document.getElementById('page-cleanup');
    if (!page?.classList.contains('active')) return;

    const m = CLEANUP_ENTRY_MOTION;
    const items = getCleanupEntryItems();

    items.forEach(item => {
        if (item._cleanupAnim) { try { item._cleanupAnim.cancel(); } catch (_) {} item._cleanupAnim = null; }
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
        item.style.removeProperty('pointer-events');
    });
    if (items[0]) items[0].offsetHeight;

    items.forEach((item, index) => {
        const delay = index * m.stagger;
        item.style.pointerEvents = 'none';
        const anim = item.animate([
            { opacity: m.opacity, transform: `translateY(${m.slideY}px) scale(${m.scale})`, filter: `blur(${m.blur}px)` },
            { opacity: 1,         transform: 'translateY(0) scale(1)',                        filter: 'blur(0px)' }
        ], { duration: m.duration, delay, easing: m.easing, fill: 'both' });
        item._cleanupAnim = anim;
        anim.onfinish = () => {
            item.style.removeProperty('pointer-events');
            item.style.removeProperty('opacity');
            item.style.removeProperty('transform');
            item.style.removeProperty('filter');
            if (item._cleanupAnim === anim) item._cleanupAnim = null;
        };
        setTimeout(() => item.style.removeProperty('pointer-events'), delay + m.duration + 60);
    });
}

function scheduleCleanupCardsOnEntry(options = {}) {
    const now = Date.now();
    if (options.source === 'page-enter' && now - cleanupPageEnterMotionLastRun < 900) return;
    if (options.source === 'page-enter') cleanupPageEnterMotionLastRun = now;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        animateCleanupCardsOnEntry();
    }));
}

// ── Settings: card reveal motion (iOS Control Center — slides DOWN from above) ──
const SETTINGS_ENTRY_MOTION = {
    duration: 820,
    stagger: 75,
    slideY: -18,
    blur: 8,
    opacity: 0,
    scale: 0.985,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};
let settingsPageEnterMotionLastRun = 0;

function getSettingsEntryItems() {
    const page = document.getElementById('page-settings');
    if (!page) return [];
    const items = [];
    const header = page.querySelector('.settings-main-header');
    if (header) items.push(header);
    const expCard = page.querySelector('.settings-experience-card');
    if (expCard) items.push(expCard);
    const general = page.querySelector('#settings-general');
    if (general) items.push(general);
    const appearance = page.querySelector('#settings-appearance');
    if (appearance) items.push(appearance);
    const links = page.querySelector('#settings-links');
    if (links) items.push(links);
    return items;
}

function animateSettingsCardsOnEntry() {
    const page = document.getElementById('page-settings');
    if (!page?.classList.contains('active')) return;

    const m = SETTINGS_ENTRY_MOTION;
    const items = getSettingsEntryItems();

    items.forEach(item => {
        if (item._settingsAnim) { try { item._settingsAnim.cancel(); } catch (_) {} item._settingsAnim = null; }
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.style.removeProperty('filter');
        item.style.removeProperty('pointer-events');
    });
    if (items[0]) items[0].offsetHeight;

    items.forEach((item, index) => {
        const delay = index * m.stagger;
        item.style.pointerEvents = 'none';
        const anim = item.animate([
            { opacity: m.opacity, transform: `translateY(${m.slideY}px) scale(${m.scale})`, filter: `blur(${m.blur}px)` },
            { opacity: 1,         transform: 'translateY(0) scale(1)',                       filter: 'blur(0px)' }
        ], { duration: m.duration, delay, easing: m.easing, fill: 'both' });
        item._settingsAnim = anim;
        anim.onfinish = () => {
            item.style.removeProperty('pointer-events');
            item.style.removeProperty('opacity');
            item.style.removeProperty('transform');
            item.style.removeProperty('filter');
            if (item._settingsAnim === anim) item._settingsAnim = null;
        };
        setTimeout(() => item.style.removeProperty('pointer-events'), delay + m.duration + 60);
    });
}

function scheduleSettingsCardsOnEntry(options = {}) {
    const now = Date.now();
    if (options.source === 'page-enter' && now - settingsPageEnterMotionLastRun < 900) return;
    if (options.source === 'page-enter') settingsPageEnterMotionLastRun = now;
    requestAnimationFrame(() => requestAnimationFrame(() => animateSettingsCardsOnEntry()));
}
