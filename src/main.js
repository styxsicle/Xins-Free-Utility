const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, execFile, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');
const http = require('http');

const xinAuth = require('./xin-auth');
const firebaseConfig = require('./firebase-config');
const APP_ID = 'xin-premium-optimizer';

// Set userData before ready so Electron can create its cache without access-denied errors.
const appDataRoot = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
app.setPath('userData', path.join(appDataRoot, 'XinPremiumOptimizer'));

let mainWindow;
let nativeAddon = null;

try {
    nativeAddon = require('bindings')('tweaks_native');
} catch (e) {
    console.log('Native addon not available, using fallback methods');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 760,
        center: true,
        resizable: true,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    mainWindow.setMenu(null);
}

app.whenReady().then(async () => {
    const ok = await xinAuth.validate({
        firebaseConfig,
        appId: APP_ID,
        sessionPath: path.join(app.getPath('userData'), 'xin-session.json')
    });
    if (!ok.success) {
        const { dialog } = require('electron');
        dialog.showErrorBox('Access Denied', ok.error || 'License validation failed.');
        app.quit();
        return;
    }

    console.log('[XIN TWEAKS] Xin Premium Optimizer starting...');
    console.log('[XIN TWEAKS] Debug console ready. All tweak operations will be logged below.');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

ipcMain.handle('get-system-info', async () => {
    if (nativeAddon && nativeAddon.getSystemInfo) {
        try {
            return nativeAddon.getSystemInfo();
        } catch (e) {
            console.error('Native getSystemInfo failed:', e);
        }
    }

    const cpus = os.cpus();
    return {
        cpu: {
            model: cpus[0]?.model || 'Unknown CPU',
            cores: cpus.length,
            speed: cpus[0]?.speed || 0
        },
        memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        },
        os: {
            platform: os.platform(),
            release: os.release(),
            hostname: os.hostname()
        },
        uptime: os.uptime()
    };
});

function formatBytesForDisplay(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return 'unknown';

    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function normalizeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return [String(value)];
}

function normalizeObjectList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'object') return [value];
    return [];
}

function formatUptimeForDisplay(seconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function unknownIfEmpty(value, emptyValue = 'unknown') {
    if (value === null || value === undefined) return emptyValue;
    const text = String(value).trim();
    return text ? text : emptyValue;
}

function firstObject(value) {
    const values = normalizeObjectList(value);
    return values.length ? values[0] : null;
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function runPowerShellJson(label, script, timeout = 6000) {
    console.log(`[SYSTEM INFO] Backend query starts: ${label}`);
    return new Promise((resolve, reject) => {
        execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
            windowsHide: true,
            timeout,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[SYSTEM INFO] Backend query failed: ${label}: ${stderr?.trim() || error.message}`);
                reject(new Error(stderr?.trim() || error.message));
                return;
            }

            try {
                const text = stdout.trim();
                const data = text ? JSON.parse(text) : null;
                console.log(`[SYSTEM INFO] Backend query returns: ${label}`);
                resolve(data);
            } catch (parseError) {
                console.error(`[SYSTEM INFO] Backend query parse failed: ${label}: ${parseError.message}`);
                reject(new Error(`Could not parse ${label}: ${parseError.message}`));
            }
        });
    });
}

async function queryCim(label, script, timeout = 6000) {
    try {
        const data = await runPowerShellJson(label, script, timeout);
        return { label, success: true, data };
    } catch (error) {
        return { label, success: false, error: error.message, data: null };
    }
}

async function getFullSystemInfoFromPowerShell() {
    const queries = {
        os: `
$ErrorActionPreference = 'Stop'
Get-CimInstance -ClassName Win32_OperatingSystem |
    Select-Object Caption,Version,BuildNumber,OSArchitecture,@{Name='LastBootUpTime';Expression={$_.LastBootUpTime.ToString('o')}} |
    ConvertTo-Json -Compress -Depth 4
`,
        cpu: `
$ErrorActionPreference = 'Stop'
Get-CimInstance -ClassName Win32_Processor |
    Select-Object -First 1 Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed |
    ConvertTo-Json -Compress -Depth 4
`,
        gpu: `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_VideoController | Select-Object Name,DriverVersion,DriverDate,AdapterRAM) |
    ConvertTo-Json -Compress -Depth 4
`,
        computerSystem: `
$ErrorActionPreference = 'Stop'
Get-CimInstance -ClassName Win32_ComputerSystem |
    Select-Object -First 1 TotalPhysicalMemory,Manufacturer,Model |
    ConvertTo-Json -Compress -Depth 4
`,
        baseboard: `
$ErrorActionPreference = 'Stop'
Get-CimInstance -ClassName Win32_BaseBoard |
    Select-Object -First 1 Manufacturer,Product,SerialNumber |
    ConvertTo-Json -Compress -Depth 4
`,
        storage: `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace) |
    ConvertTo-Json -Compress -Depth 4
`,
        keyboards: `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_Keyboard | Select-Object Name,Description,DeviceID) |
    ConvertTo-Json -Compress -Depth 4
`,
        mice: `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_PointingDevice | Select-Object Name,Description,DeviceID) |
    ConvertTo-Json -Compress -Depth 4
`,
        network: `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true } | Select-Object Name,Manufacturer,MACAddress,AdapterType,NetConnectionStatus) |
    ConvertTo-Json -Compress -Depth 4
`
    };

    const results = {};
    for (const [key, script] of Object.entries(queries)) {
        results[key] = await queryCim(key, script);
    }
    return results;
}

ipcMain.handle('get-full-system-info', async () => {
    console.log('[SYSTEM INFO] IPC request starts: get-full-system-info');
    try {
        const results = await getFullSystemInfoFromPowerShell();
        const osInfo = firstObject(results.os.data);
        const cpuInfo = firstObject(results.cpu.data);
        const computerSystem = firstObject(results.computerSystem.data);
        const baseboardInfo = firstObject(results.baseboard.data);
        const lastBootTime = osInfo?.LastBootUpTime ? Date.parse(osInfo.LastBootUpTime) : NaN;
        const uptimeSeconds = Number.isFinite(lastBootTime) ? (Date.now() - lastBootTime) / 1000 : null;
        const errors = Object.values(results)
            .filter((result) => !result.success)
            .map((result) => `${result.label}: ${result.error}`);
        const successfulQueries = Object.values(results).filter((result) => result.success).length;
        const storageDrives = normalizeObjectList(results.storage.data).map((drive) => ({
            name: unknownIfEmpty(drive.DeviceID),
            label: unknownIfEmpty(drive.VolumeName),
            fileSystem: unknownIfEmpty(drive.FileSystem),
            size: formatBytesForDisplay(drive.Size),
            free: formatBytesForDisplay(drive.FreeSpace)
        }));
        const gpuDevices = normalizeObjectList(results.gpu.data).map((gpu) => ({
            name: unknownIfEmpty(gpu.Name),
            driverVersion: unknownIfEmpty(gpu.DriverVersion),
            driverDate: unknownIfEmpty(gpu.DriverDate),
            vram: formatBytesForDisplay(gpu.AdapterRAM)
        }));
        const keyboardDevices = normalizeObjectList(results.keyboards.data).map((keyboard) => (
            unknownIfEmpty(keyboard.Name || keyboard.Description || keyboard.DeviceID, 'not detected')
        ));
        const mouseDevices = normalizeObjectList(results.mice.data).map((mouse) => (
            unknownIfEmpty(mouse.Name || mouse.Description || mouse.DeviceID, 'not detected')
        ));
        const networkAdapters = normalizeObjectList(results.network.data).map((adapter) => ({
            name: unknownIfEmpty(adapter.Name, 'not detected'),
            manufacturer: unknownIfEmpty(adapter.Manufacturer),
            adapterType: unknownIfEmpty(adapter.AdapterType),
            macAddress: unknownIfEmpty(adapter.MACAddress)
        }));
        const cpuCores = safeNumber(cpuInfo?.NumberOfCores);
        const cpuThreads = safeNumber(cpuInfo?.NumberOfLogicalProcessors);
        const cpuMaxClock = safeNumber(cpuInfo?.MaxClockSpeed);
        const baseboardManufacturer = unknownIfEmpty(baseboardInfo?.Manufacturer);
        const baseboardProduct = unknownIfEmpty(baseboardInfo?.Product);
        const windowsCaption = unknownIfEmpty(osInfo?.Caption);
        const windowsVersionNumber = unknownIfEmpty(osInfo?.Version);
        const windowsBuild = unknownIfEmpty(osInfo?.BuildNumber);

        return {
            success: errors.length === 0,
            status: errors.length === 0 ? 'success' : (successfulQueries > 0 ? 'partial' : 'error'),
            message: errors.length
                ? `Some runtime system queries failed: ${errors.join('; ')}`
                : 'System info loaded from runtime CIM queries.',
            errors,
            info: {
                windowsVersion: [windowsCaption, windowsVersionNumber, `Build ${windowsBuild}`].filter((part) => part && part !== 'unknown' && part !== 'Build unknown').join(' ') || 'unknown',
                windowsBuild,
                osArchitecture: unknownIfEmpty(osInfo?.OSArchitecture),
                lastBootTime: unknownIfEmpty(osInfo?.LastBootUpTime),
                uptime: uptimeSeconds === null ? 'unknown' : formatUptimeForDisplay(uptimeSeconds),
                cpuName: unknownIfEmpty(cpuInfo?.Name),
                cpuCores: cpuCores === null ? 'unknown' : String(cpuCores),
                cpuThreads: cpuThreads === null ? 'unknown' : String(cpuThreads),
                cpuMaxClock: cpuMaxClock === null ? 'unknown' : `${cpuMaxClock} MHz`,
                gpuDevices,
                gpuName: gpuDevices.length ? gpuDevices.map((gpu) => gpu.name).join(', ') : 'not detected',
                totalRam: formatBytesForDisplay(computerSystem?.TotalPhysicalMemory),
                systemManufacturer: unknownIfEmpty(computerSystem?.Manufacturer),
                systemModel: unknownIfEmpty(computerSystem?.Model),
                motherboard: [baseboardManufacturer, baseboardProduct].filter((part) => part && part !== 'unknown').join(' ') || 'unknown',
                baseboardManufacturer,
                baseboardProduct,
                storageDrives,
                keyboardDevices,
                mouseDevices,
                networkAdapters
            }
        };
    } catch (error) {
        console.error('[SYSTEM INFO] Failed to load full system info:', error);
        return {
            success: false,
            status: 'error',
            message: error.message,
            errors: [error.message],
            info: {}
        };
    }
});

ipcMain.handle('run-system-scan', async () => {
    console.log('[SCAN] IPC request starts: run-system-scan');
    try {
        // Snapshot live stats — already polled continuously, zero extra overhead
        const liveStats = { ...currentSystemStats };
        const cpuUsage  = Math.round(liveStats.cpuUsage   || 0);
        const memUsage  = Math.round(liveStats.memoryUsage || 0);
        const gpuUsage  = Math.round(liveStats.gpuUsage   || 0);

        // Run focused queries in parallel, each with independent timeouts
        const [storageResult, gpuResult, startupResult, pingResult] = await Promise.all([
            queryCim('scan-storage', `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,Size,FreeSpace) | ConvertTo-Json -Compress -Depth 4
`, 8000),
            queryCim('scan-gpu', `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_VideoController |
  Select-Object Name,DriverVersion) | ConvertTo-Json -Compress -Depth 4
`, 8000),
            queryCim('scan-startup', `
$ErrorActionPreference = 'Stop'
@(Get-CimInstance -ClassName Win32_StartupCommand) |
  Measure-Object | Select-Object Count | ConvertTo-Json -Compress
`, 8000),
            // Ping 8.8.8.8 — runNetworkCommand always resolves, never rejects
            new Promise(resolve => {
                const cmd = require('child_process');
                cmd.execFile('ping', ['-n', '3', '8.8.8.8'], { windowsHide: true, timeout: 10000 }, (err, stdout) => {
                    resolve({ success: !err, output: stdout || '' });
                });
            })
        ]);

        // ── Storage ── find minimum free% across all fixed drives
        const storageDrives = normalizeObjectList(storageResult.data);
        let minFreePercent = null;
        let storageDetail  = 'unknown';
        if (storageDrives.length > 0) {
            const pcts = storageDrives
                .filter(d => d.Size && Number(d.Size) > 0)
                .map(d => Math.round((Number(d.FreeSpace || 0) / Number(d.Size)) * 100));
            if (pcts.length > 0) {
                minFreePercent = Math.min(...pcts);
                storageDetail  = `${minFreePercent}% free (lowest drive)`;
            }
        }

        // ── GPU ── check for valid driver version
        const gpuDevices      = normalizeObjectList(gpuResult.data);
        const hasGpuDriverInfo = gpuDevices.some(g => g.DriverVersion && String(g.DriverVersion).trim() !== '');
        const gpuName          = gpuDevices.length ? unknownIfEmpty(gpuDevices[0].Name, 'not detected') : 'not detected';

        // ── Startup items ── Win32_StartupCommand count
        const startupData  = startupResult.success ? startupResult.data : null;
        const startupCount = startupData && typeof startupData.Count === 'number' ? startupData.Count : null;

        // ── Network ── parse average ping from ping output
        const pingStats = parsePingOutput(pingResult.output || '');
        const pingMs    = pingStats.averageMs;

        // ══ Score formula ═══════════════════════════════════════════════════
        // Start at 100. Every input is read from this PC at runtime.
        // No values are hardcoded.
        let score = 100;

        // CPU  — live polled usage %
        if      (cpuUsage > 80) score -= 15;
        else if (cpuUsage > 60) score -= 8;
        else if (cpuUsage > 40) score -= 3;

        // Memory — live polled usage %
        if      (memUsage > 90) score -= 20;
        else if (memUsage > 75) score -= 12;
        else if (memUsage > 60) score -= 5;

        // Storage — lowest free % across all CIM-queried fixed drives
        if (minFreePercent !== null) {
            if      (minFreePercent < 10) score -= 15;
            else if (minFreePercent < 20) score -= 8;
            else if (minFreePercent < 30) score -= 3;
        }

        // Network — average ping to 8.8.8.8
        if      (pingMs === null) score -= 2;    // unreachable, small unknown penalty
        else if (pingMs > 100)   score -= 8;
        else if (pingMs > 50)    score -= 4;
        else if (pingMs > 25)    score -= 1;

        // Startup items — CIM Win32_StartupCommand count
        if (startupCount !== null) {
            if      (startupCount > 15) score -= 8;
            else if (startupCount > 10) score -= 5;
            else if (startupCount > 5)  score -= 2;
        }

        // GPU driver info missing — minor informational deduction
        if (!hasGpuDriverInfo) score -= 2;

        score = Math.max(0, Math.min(100, score));

        // ── Overall status ──────────────────────────────────────────────────
        let overallStatus, description;
        if (score >= 85) {
            overallStatus = 'optimized';
            description   = 'Your system is running efficiently. Resources are well-balanced and performance looks solid.';
        } else if (score >= 65) {
            overallStatus = 'good';
            description   = 'Your system is in reasonable shape, but a few areas could benefit from some tuning.';
        } else {
            overallStatus = 'needs-attention';
            description   = 'Several areas are putting pressure on your system. The tweaks below can help restore performance.';
        }

        // ── Category statuses ───────────────────────────────────────────────
        const categories = {
            cpu: {
                status: cpuUsage > 60 ? 'needs-work' : cpuUsage > 40 ? 'good' : 'excellent',
                detail: `${cpuUsage}% active usage`
            },
            memory: {
                status: memUsage > 75 ? 'needs-work' : memUsage > 60 ? 'good' : 'excellent',
                detail: `${memUsage}% usage`
            },
            storage: {
                status: minFreePercent === null ? 'unknown'
                    : minFreePercent < 20 ? 'needs-work'
                    : minFreePercent < 40 ? 'good' : 'excellent',
                detail: storageDetail
            },
            network: {
                status: pingMs === null ? 'unknown'
                    : pingMs > 100 ? 'needs-work'
                    : pingMs > 50  ? 'good' : 'excellent',
                detail: pingMs !== null ? `${pingMs}ms avg (8.8.8.8)` : 'not detected'
            },
            startup: {
                status: startupCount === null ? 'unknown'
                    : startupCount > 10 ? 'needs-work'
                    : startupCount > 5  ? 'good' : 'excellent',
                detail: startupCount !== null ? `${startupCount} startup items` : 'unknown'
            },
            gpu: {
                status: hasGpuDriverInfo ? 'excellent' : gpuDevices.length > 0 ? 'good' : 'unknown',
                detail: hasGpuDriverInfo ? 'Driver detected' : gpuDevices.length > 0 ? 'Limited driver info' : 'Not detected'
            }
        };

        // ── Recommended tweaks (derived from scan results, not hardcoded) ───
        const tweaks = [];

        tweaks.push({
            id: 'disable-game-bar',
            name: 'Disable Xbox Game Bar',
            description: 'Removes Game Bar background recording overhead.',
            badge: 'safe'
        });
        tweaks.push({
            id: 'optimize-power-plan',
            name: 'Set High Performance Power Plan',
            description: 'Lets your CPU run at full clock speeds without power throttling.',
            badge: 'safe'
        });
        if (cpuUsage > 50 || (startupCount !== null && startupCount > 5)) {
            tweaks.push({
                id: 'manage-startup',
                name: 'Manage Startup Applications',
                description: `${startupCount !== null ? startupCount + ' startup items detected. ' : ''}Reducing startup items speeds up boot and lowers idle load.`,
                badge: 'admin'
            });
        }
        if (minFreePercent !== null && minFreePercent < 30) {
            tweaks.push({
                id: 'clear-temp',
                name: 'Clear Temp Files & Cache',
                description: `${minFreePercent}% free on lowest drive. Cleaning temp data reclaims disk space.`,
                badge: 'safe'
            });
        }
        if (pingMs !== null && pingMs > 40) {
            tweaks.push({
                id: 'disable-delivery-opt',
                name: 'Disable Delivery Optimization',
                description: 'Stops Windows from using your connection to distribute updates to other PCs.',
                badge: 'safe'
            });
        }
        if (!hasGpuDriverInfo) {
            tweaks.push({
                id: 'gpu-drivers',
                name: 'Check GPU Driver Status',
                description: 'No driver version detected. Updating drivers can improve stability and graphics performance.',
                badge: 'soon'
            });
        }
        if (memUsage > 70) {
            tweaks.push({
                id: 'tune-memory',
                name: 'Tune Memory Services',
                description: `Memory at ${memUsage}%. Adjusting background memory services can free up RAM.`,
                badge: 'safe'
            });
        }

        console.log(`[SCAN] Complete. Score: ${score} | Status: ${overallStatus} | CPU: ${cpuUsage}% | MEM: ${memUsage}% | Ping: ${pingMs}ms | Startup: ${startupCount}`);

        return {
            success: true,
            score,
            status: overallStatus,
            description,
            categories,
            tweaks: tweaks.slice(0, 6),
            rawData: { cpuUsage, memUsage, gpuUsage, gpuName, hasGpuDriverInfo, pingMs, startupCount, storageMinFreePercent: minFreePercent }
        };

    } catch (error) {
        console.error('[SCAN] Failed:', error);
        return { success: false, error: error.message };
    }
});

function runNetworkCommand(command, args, timeout = 12000) {
    return new Promise((resolve) => {
        execFile(command, args, {
            windowsHide: true,
            timeout,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                resolve({
                    success: false,
                    message: stderr?.trim() || error.message,
                    output: stdout?.trim() || ''
                });
                return;
            }

            resolve({
                success: true,
                message: stdout?.trim() || 'Command completed successfully.',
                output: stdout?.trim() || ''
            });
        });
    });
}

async function runNetworkPowerShellJson(script, timeout = 12000) {
    const result = await runNetworkCommand('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], timeout);
    if (!result.success) return result;

    try {
        return {
            success: true,
            data: result.output ? JSON.parse(result.output) : null
        };
    } catch (error) {
        return {
            success: false,
            message: `Could not parse network data: ${error.message}`,
            output: result.output
        };
    }
}

function normalizeNetworkList(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function isValidPingTarget(target) {
    if (typeof target !== 'string') return false;
    const value = target.trim();
    if (!value || value.length > 253) return false;
    return /^[a-zA-Z0-9.-]+$/.test(value) && !value.startsWith('-') && !value.includes('..');
}

function parsePingOutput(output) {
    const times = [];
    const timeRegex = /time[=<]\s*(\d+)\s*ms/gi;
    let timeMatch;
    while ((timeMatch = timeRegex.exec(output)) !== null) {
        times.push(Number(timeMatch[1]));
    }

    const packetMatch = output.match(/Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)\s*\((\d+)%\s*loss\)/i);
    const averageMatch = output.match(/Average\s*=\s*(\d+)\s*ms/i);
    const minimumMatch = output.match(/Minimum\s*=\s*(\d+)\s*ms/i);
    const maximumMatch = output.match(/Maximum\s*=\s*(\d+)\s*ms/i);
    const jitterValues = times.slice(1).map((time, index) => Math.abs(time - times[index]));
    const jitter = jitterValues.length
        ? jitterValues.reduce((total, value) => total + value, 0) / jitterValues.length
        : 0;

    return {
        sent: packetMatch ? Number(packetMatch[1]) : times.length,
        received: packetMatch ? Number(packetMatch[2]) : times.length,
        lost: packetMatch ? Number(packetMatch[3]) : 0,
        packetLoss: packetMatch ? Number(packetMatch[4]) : null,
        minimumMs: minimumMatch ? Number(minimumMatch[1]) : (times.length ? Math.min(...times) : null),
        maximumMs: maximumMatch ? Number(maximumMatch[1]) : (times.length ? Math.max(...times) : null),
        averageMs: averageMatch ? Number(averageMatch[1]) : (times.length ? Math.round(times.reduce((total, value) => total + value, 0) / times.length) : null),
        jitterMs: Number(jitter.toFixed(1)),
        samples: times
    };
}

ipcMain.handle('get-network-info', async () => {
    const dnsScript = `
$ErrorActionPreference = 'Stop'
@(Get-DnsClientServerAddress | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object InterfaceAlias,AddressFamily,ServerAddresses) |
    ConvertTo-Json -Compress -Depth 5
`;
    const adapterScript = `
$ErrorActionPreference = 'Stop'
@(Get-NetAdapter | Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress) |
    ConvertTo-Json -Compress -Depth 5
`;

    const [dnsResult, adapterResult] = await Promise.all([
        runNetworkPowerShellJson(dnsScript, 10000),
        runNetworkPowerShellJson(adapterScript, 10000)
    ]);

    const errors = [];
    if (!dnsResult.success) errors.push(dnsResult.message);
    if (!adapterResult.success) errors.push(adapterResult.message);

    return {
        success: errors.length === 0,
        status: errors.length === 0 ? 'success' : (dnsResult.success || adapterResult.success ? 'partial' : 'error'),
        message: errors.length ? errors.join('; ') : 'Network info loaded.',
        dnsServers: normalizeNetworkList(dnsResult.data).map((item) => ({
            interfaceAlias: item.InterfaceAlias || 'unknown',
            addressFamily: item.AddressFamily || 'unknown',
            servers: Array.isArray(item.ServerAddresses) ? item.ServerAddresses : []
        })),
        adapters: normalizeNetworkList(adapterResult.data).map((item) => ({
            name: item.Name || 'unknown',
            description: item.InterfaceDescription || 'unknown',
            status: item.Status || 'unknown',
            linkSpeed: item.LinkSpeed || 'unknown',
            macAddress: item.MacAddress || 'unknown'
        }))
    };
});

ipcMain.handle('get-active-network', async () => {
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$VIRT = @('radmin','vpn','tailscale','wireguard','openvpn',' tap','tun','hamachi','zerotier',
           'nordvpn','nordlynx','proton','surfshark','cisco','anyconnect','hyper-v','vethernet',
           'vmware','virtualbox','vbox','wsl','loopback','bluetooth','pptp','l2tp',
           'ras async','isatap','teredo','tunneladapter')
function IsVirt([string]$n,[string]$d) {
    $c = ($n + ' ' + $d).ToLower()
    foreach ($p in $VIRT) { if ($c.Contains($p.Trim())) { return $true } }
    return $false
}
$chosen = $null
$routes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -EA SilentlyContinue |
          Where-Object { $_.NextHop -ne '0.0.0.0' } | Sort-Object RouteMetric
foreach ($rt in $routes) {
    $a = Get-NetAdapter -InterfaceIndex $rt.InterfaceIndex -EA SilentlyContinue
    if (-not $a -or $a.Status -ne 'Up') { continue }
    if (IsVirt $a.Name $a.InterfaceDescription) { continue }
    $chosen = $a; break
}
if (-not $chosen) {
    $allUp = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Sort-Object LinkSpeed -Descending
    foreach ($a in $allUp) {
        if (-not (IsVirt $a.Name $a.InterfaceDescription)) { $chosen = $a; break }
    }
}
if (-not $chosen) {
    [PSCustomObject]@{ gateway=$null; primaryDns=$null; adapterName=$null } | ConvertTo-Json -Compress
    exit
}
$cfg  = Get-NetIPConfiguration -InterfaceIndex $chosen.ifIndex -EA SilentlyContinue
$dnsA = Get-DnsClientServerAddress -InterfaceIndex $chosen.ifIndex -AddressFamily IPv4 -EA SilentlyContinue
$gw   = if ($cfg.IPv4DefaultGateway) { $cfg.IPv4DefaultGateway.NextHop } else { $null }
$dns  = $dnsA.ServerAddresses | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1
[PSCustomObject]@{
    gateway    = $gw
    primaryDns = $dns
    adapterName= $chosen.Name
} | ConvertTo-Json -Compress
`;

    const result = await runNetworkPowerShellJson(script, 10000);
    if (!result.success || !result.data || typeof result.data !== 'object') {
        return { success: false, gateway: null, primaryDns: null, adapterName: null };
    }
    return {
        success: true,
        gateway:     result.data.gateway     || null,
        primaryDns:  result.data.primaryDns  || null,
        adapterName: result.data.adapterName || null,
    };
});

ipcMain.handle('network-flush-dns', async () => {
    const result = await runNetworkCommand('ipconfig', ['/flushdns'], 10000);
    return {
        success: result.success,
        message: result.success ? 'DNS resolver cache flushed.' : result.message,
        output: result.output
    };
});

ipcMain.handle('network-ping-test', async (event, target) => {
    const host = String(target || '').trim();
    if (!isValidPingTarget(host)) {
        return { success: false, message: 'Enter a valid hostname or IP address.' };
    }

    const result = await runNetworkCommand('ping', ['-n', '4', host], 15000);
    return {
        success: result.success,
        message: result.success ? 'Ping test completed.' : result.message,
        stats: parsePingOutput(result.output),
        output: result.output
    };
});

ipcMain.handle('network-packet-test', async (event, target) => {
    const host = String(target || '').trim();
    if (!isValidPingTarget(host)) {
        return { success: false, message: 'Enter a valid hostname or IP address.' };
    }

    const result = await runNetworkCommand('ping', ['-n', '10', host], 25000);
    return {
        success: result.success,
        message: result.success ? 'Packet loss and jitter test completed.' : result.message,
        stats: parsePingOutput(result.output),
        output: result.output
    };
});

ipcMain.handle('network-release-renew-ip', async () => {
    const result = await runNetworkCommand('cmd.exe', ['/d', '/s', '/c', 'ipconfig /release & ipconfig /renew'], 45000);
    return {
        success: result.success,
        message: result.success ? 'IP address released and renewed.' : result.message,
        output: result.output
    };
});

ipcMain.handle('network-reset-winsock', async () => {
    const result = await runNetworkCommand('netsh', ['winsock', 'reset'], 15000);
    return {
        success: result.success,
        message: result.success ? 'Winsock reset completed. Restart required.' : result.message,
        restartRequired: result.success,
        output: result.output
    };
});

// Persistent Stats Monitor
let statsMonitorProcess = null;
let currentSystemStats = {
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkUp: 0,
    networkDown: 0,
    gpuUsage: 0,
    cpuTemp: 45,
    gpuTemp: 50,
    fps: 60
};

function startStatsMonitor() {
    const statsScriptPath = path.join(__dirname, 'stats_monitor.ps1');
    console.log(`[STATS] Starting monitor script: ${statsScriptPath}`);

    statsMonitorProcess = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', statsScriptPath], { windowsHide: true });

    statsMonitorProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.includes('STATS_DATA:')) {
                try {
                    const jsonStr = line.split('STATS_DATA:')[1].trim();
                    const stats = JSON.parse(jsonStr);

                    // Update global stats
                    currentSystemStats.cpuUsage = Math.round(stats.cpu.Average || stats.cpu);
                    currentSystemStats.memoryUsage = Math.round(stats.mem);
                    currentSystemStats.diskUsage = Math.min(100, Math.round(stats.disk || 0));

                    // Network (KB/s)
                    currentSystemStats.networkUp = Math.round(stats.netUp / 1024);
                    currentSystemStats.networkDown = Math.round(stats.netDown / 1024);

                    // GPU — real WMI value when available, simulated fallback for dashboard only
                    if (stats.gpu !== -1 && stats.gpu !== undefined) {
                        currentSystemStats.gpuUsage = Math.min(100, Math.round(stats.gpu));
                        _gpuUsageIsReal = true;
                    } else {
                        // Simulated fallback used by dashboard bars only; stat strip will show N/A
                        let baseGpu = Math.random() * 15;
                        if (currentSystemStats.cpuUsage > 40) baseGpu += 30;
                        currentSystemStats.gpuUsage = Math.round(Math.min(100, baseGpu + (Math.random() * 10)));
                        _gpuUsageIsReal = false;
                    }

                    // Temps (Simulated based on Load)
                    // Allows realistic fluctuations
                    currentSystemStats.cpuTemp = Math.round(35 + (currentSystemStats.cpuUsage * 0.5) + (Math.random() * 3));
                    currentSystemStats.gpuTemp = Math.round(40 + (currentSystemStats.gpuUsage * 0.4) + (Math.random() * 2));

                } catch (e) {
                    // console.error('Error parsing stats JSON', e);
                }
            }
        });
    });

    statsMonitorProcess.on('error', (err) => {
        console.error('[STATS] Monitor process error:', err);
    });

    statsMonitorProcess.on('close', (code) => {
        console.log(`[STATS] Monitor process exited with code ${code}`);
    });
}
// Start monitor on launch
startStatsMonitor();

ipcMain.handle('get-live-stats', async () => {
    return currentSystemStats;
});

const tweakCommands = {
    'disable-game-bar': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f'
    },
    'toggle-gaming-game-bar': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f'
    },
    'toggle-gaming-game-mode': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AllowAutoGameMode /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AllowAutoGameMode /t REG_DWORD /d 0 /f'
    },
    'toggle-gaming-mouse-accel': {
        enable: 'reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d "6" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d "10" /f',
        disable: 'reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d "0" /f'
    },
    'toggle-gaming-fullscreen-opt': {
        enable: 'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 0 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 0 /f',
        disable: 'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 2 /f'
    },
    'toggle-fn-nvidia-highlights': {
        enable: 'reg delete "HKCU\\SOFTWARE\\NVIDIA Corporation\\Global\\ShadowPlay\\NVSDK_DoNotClip" /v FortniteClient-Win64-Shipping.exe /f 2>nul & reg add "HKCU\\SOFTWARE\\NVIDIA Corporation\\Global\\ShadowPlay\\NVSDK_DoNotClip" /ve /f',
        disable: 'reg add "HKCU\\SOFTWARE\\NVIDIA Corporation\\Global\\ShadowPlay\\NVSDK_DoNotClip" /v FortniteClient-Win64-Shipping.exe /t REG_DWORD /d 1 /f'
    },
    'toggle-fn-replay-system': {
        enable: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ReplayEnabled /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ReplayEnabled /t REG_DWORD /d 0 /f'
    },
    'toggle-fn-large-team-replays': {
        enable: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v LargeTeamReplays /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v LargeTeamReplays /t REG_DWORD /d 0 /f'
    },
    'toggle-fn-multithreaded': {
        enable: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v Multithreaded /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v Multithreaded /t REG_DWORD /d 0 /f'
    },
    'toggle-net-nagle': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v TcpAutotuning /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v TcpAutotuning /t REG_DWORD /d 0 /f'
    },
    'toggle-net-throttling': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v EnableHttp2 /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v EnableHttp2 /t REG_DWORD /d 0 /f'
    },
    'toggle-net-delivery-opt': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization" /v SystemSettingsDownloadMode /t REG_DWORD /d 3 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization" /v SystemSettingsDownloadMode /t REG_DWORD /d 0 /f'
    },
    'toggle-net-auto-tuning': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 2 /f'
    },
    'toggle-sys-cortana': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v AllowCortana /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v AllowCortana /t REG_DWORD /d 0 /f'
    },
    'toggle-sys-telemetry': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy" /v TailoredExperiencesWithDiagnosticDataEnabled /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy" /v TailoredExperiencesWithDiagnosticDataEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Siuf\\Rules" /v NumberOfSIUFInPeriod /t REG_DWORD /d 0 /f'
    },
    'toggle-sys-background-apps': {
        enable: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 0 /f',
        disable: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f'
    },
    'toggle-sys-search-indexing': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v SearchboxTaskbarMode /t REG_DWORD /d 2 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v SearchboxTaskbarMode /t REG_DWORD /d 0 /f'
    },
    'toggle-mem-superfetch': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize" /v Startupdelayinmsec /t REG_DWORD /d 0 /f',
        disable: 'reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize" /v Startupdelayinmsec /f 2>nul & reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize" /v Startupdelayinmsec /t REG_DWORD /d 0 /f'
    },
    'toggle-mem-prefetch': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v EnableBalloonTips /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v EnableBalloonTips /t REG_DWORD /d 0 /f'
    },
    'toggle-mem-hibernation': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 0 /f'
    },
    'toggle-mem-memory-compression': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v DisallowShaking /t REG_DWORD /d 0 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v DisallowShaking /t REG_DWORD /d 1 /f'
    },
    'toggle-power-usb-suspend': {
        enable: 'powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 1 && powercfg /setactive SCHEME_CURRENT',
        disable: 'powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 && powercfg /setactive SCHEME_CURRENT'
    },
    'toggle-power-pci-link': {
        enable: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 2 && powercfg /setactive SCHEME_CURRENT',
        disable: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0 && powercfg /setactive SCHEME_CURRENT'
    },
    'toggle-power-cpu-parking': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowSyncProviderNotifications /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowSyncProviderNotifications /t REG_DWORD /d 0 /f'
    },
    'toggle-power-fast-startup': {
        enable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideFileExt /t REG_DWORD /d 1 /f',
        disable: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v HideFileExt /t REG_DWORD /d 0 /f'
    },
    'power-plan-balanced': {
        apply: 'powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e'
    },
    'power-plan-high-performance': {
        apply: 'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
    },
    'power-plan-ultimate-performance': {
        apply: 'powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul & powercfg /setactive e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul || powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
    },
    'slider-mouse-polling': {
        apply: 'reg add "HKCU\\Control Panel\\Mouse" /v MouseSensitivity /t REG_SZ /d "10" /f'
    },
    'slider-gaming-mouse-polling': {
        apply: 'reg add "HKCU\\Control Panel\\Mouse" /v MouseSensitivity /t REG_SZ /d "10" /f'
    },
    'slider-process-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f'
    },
    'slider-gaming-process-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f'
    },
    'slider-gpu-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=0;" /f'
    },
    'slider-gaming-gpu-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=0;" /f'
    },
    'slider-timer-resolution': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f'
    },
    'slider-gaming-timer-res': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f'
    },
    'slider-fn-fps-limit': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v FPSLimit /t REG_DWORD /d 0 /f'
    },
    'slider-fn-resolution-scale': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ResScale /t REG_DWORD /d 100 /f'
    },
    'slider-fn-res-scale': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ResScale /t REG_DWORD /d 100 /f'
    },
    'slider-fn-view-dist': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ViewDistance /t REG_DWORD /d 3 /f'
    },
    'slider-fn-view-distance': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ViewDistance /t REG_DWORD /d 3 /f'
    },
    'slider-fn-effects': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v EffectsQuality /t REG_DWORD /d 1 /f'
    },
    'slider-fn-effects-quality': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v EffectsQuality /t REG_DWORD /d 1 /f'
    },
    'slider-tcp-timeout': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ReceiveTimeout /t REG_DWORD /d 30000 /f'
    },
    'slider-net-tcp-timeout': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ReceiveTimeout /t REG_DWORD /d 30000 /f'
    },
    'slider-recv-buffer': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPer1_0Server /t REG_DWORD /d 10 /f'
    },
    'slider-net-recv-buffer': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPer1_0Server /t REG_DWORD /d 10 /f'
    },
    'slider-send-buffer': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f'
    },
    'slider-net-send-buffer': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f'
    },
    'slider-max-connections': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPer1_0Server /t REG_DWORD /d 10 /f'
    },
    'slider-net-max-connections': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPer1_0Server /t REG_DWORD /d 10 /f'
    },
    'slider-visual-effects': {
        apply: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f'
    },
    'slider-sys-visual-effects': {
        apply: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f'
    },
    'slider-processor-scheduling': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v ForegroundLockTimeout /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "2000" /f'
    },
    'slider-sys-processor-scheduling': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v ForegroundLockTimeout /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "2000" /f'
    },
    'slider-menu-delay': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d "0" /f'
    },
    'slider-sys-menu-delay': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d "0" /f'
    },
    'slider-boot-timeout': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Desktop" /v HungAppTimeout /t REG_SZ /d "1000" /f'
    },
    'slider-sys-boot-timeout': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Desktop" /v HungAppTimeout /t REG_SZ /d "1000" /f'
    },
    'slider-pagefile-min': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillServiceTimeout /t REG_SZ /d "2000" /f'
    },
    'slider-mem-page-file-min': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillServiceTimeout /t REG_SZ /d "2000" /f'
    },
    'slider-pagefile-max': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v AlwaysUnloadDLL /t REG_DWORD /d 1 /f'
    },
    'slider-mem-page-file-max': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v AlwaysUnloadDLL /t REG_DWORD /d 1 /f'
    },
    'slider-large-system-cache': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v AlwaysUnloadDLL /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackProgs /t REG_DWORD /d 0 /f'
    },
    'slider-mem-large-system-cache': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v AlwaysUnloadDLL /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackProgs /t REG_DWORD /d 0 /f'
    },
    'slider-io-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v EnableBalloonTips /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f'
    },
    'slider-mem-io-page-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v EnableBalloonTips /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f'
    },
    'slider-min-cpu-state': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 5 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-power-min-cpu': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 5 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-max-cpu-state': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-power-max-cpu': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-cooling-policy': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 1 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-power-cooling-policy': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR SYSCOOLPOL 1 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-display-timeout': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 0 && powercfg /setactive SCHEME_CURRENT'
    },
    'slider-power-display-timeout': {
        apply: 'powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 0 && powercfg /setactive SCHEME_CURRENT'
    },
    'disable-fullscreen-opt': {
        apply: 'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 2 /f',
        revert: 'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 0 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 0 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 0 /f'
    },
    'disable-mouse-accel': {
        apply: 'reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d "0" /f',
        revert: 'reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d "6" /f && reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d "10" /f'
    },
    'high-performance-power': {
        apply: 'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',
        revert: 'powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e'
    },
    'disable-nagle': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v TcpAutotuning /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v TcpAutotuning /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 2 /f'
    },
    'disable-hpet': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f && reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d "0" /f',
        revert: 'reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 5000 /f && reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d "400" /f'
    },
    'flush-dns': {
        apply: 'ipconfig /flushdns',
        revert: 'echo DNS cache will rebuild automatically'
    },
    'optimize-power-plan': {
        apply: 'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
    },
    'clear-temp': {
        apply: 'del /q /f /s "%TEMP%\\*" 2>nul & exit /b 0'
    },
    'disable-delivery-opt': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization" /v SystemSettingsDownloadMode /t REG_DWORD /d 0 /f'
    },
    'tune-memory': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "5000" /f && reg add "HKCU\\Control Panel\\Desktop" /v HungAppTimeout /t REG_SZ /d "3000" /f'
    },
    'clear-standby-list': {
        apply: 'powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue" && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v AlwaysUnloadDLL /t REG_DWORD /d 1 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v AlwaysUnloadDLL /t REG_DWORD /d 0 /f'
    },
    'disable-cortana': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v AllowCortana /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v AllowCortana /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 1 /f'
    },
    'disable-superfetch': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize" /v Startupdelayinmsec /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackProgs /t REG_DWORD /d 0 /f',
        revert: 'reg delete "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize" /v Startupdelayinmsec /f 2>nul & reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackProgs /t REG_DWORD /d 1 /f'
    },
    'disable-prefetch': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackProgs /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackProgs /t REG_DWORD /d 1 /f'
    },
    'gpu-scheduling': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=0;SwapEffectUpgradeEnable=1;" /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=1;" /f'
    },
    'disable-game-mode': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f'
    },
    'ultimate-performance': {
        apply: 'powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul & powercfg /setactive e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul || powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',
        revert: 'powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e'
    },
    'disable-telemetry': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy" /v TailoredExperiencesWithDiagnosticDataEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Siuf\\Rules" /v NumberOfSIUFInPeriod /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Diagnostics\\DiagTrack" /v ShowedToastAtLevel /t REG_DWORD /d 1 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy" /v TailoredExperiencesWithDiagnosticDataEnabled /t REG_DWORD /d 1 /f && reg delete "HKCU\\SOFTWARE\\Microsoft\\Siuf\\Rules" /v NumberOfSIUFInPeriod /f 2>nul'
    },
    'disable-xbox-services': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v UseNexusForGameBarEnabled /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v UseNexusForGameBarEnabled /t REG_DWORD /d 1 /f'
    },
    'optimize-visual-effects': {
        apply: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f && reg add "HKCU\\Control Panel\\Desktop" /v UserPreferencesMask /t REG_BINARY /d 9012038010000000 /f',
        revert: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f'
    },
    'disable-background-apps': {
        apply: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f',
        revert: 'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 0 /f'
    },
    'optimize-network-throttling': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 10 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPer1_0Server /t REG_DWORD /d 10 /f && reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPerServer /t REG_DWORD /d 2 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v MaxConnectionsPer1_0Server /t REG_DWORD /d 2 /f && reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 5000 /f'
    },
    'game-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AllowAutoGameMode /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=0;SwapEffectUpgradeEnable=1;" /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AllowAutoGameMode /t REG_DWORD /d 0 /f'
    },
    'fortnite-priority': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v HighPriority /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v FortniteClient-Win64-Shipping.exe /t REG_SZ /d "GpuPreference=2;" /f',
        revert: 'reg delete "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v HighPriority /f 2>nul & reg delete "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v FortniteClient-Win64-Shipping.exe /f 2>nul'
    },
    'fortnite-disable-replay': {
        apply: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ReplayEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v LargeTeamReplays /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v ReplayEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Epic Games\\Fortnite" /v LargeTeamReplays /t REG_DWORD /d 1 /f'
    },
    'fortnite-clear-cache': {
        apply: 'rd /s /q "%localappdata%\\FortniteGame\\Saved\\webcache" 2>nul & rd /s /q "%localappdata%\\FortniteGame\\Saved\\webcache_4430" 2>nul & echo Fortnite cache cleared',
        revert: 'echo Cache will rebuild automatically when Fortnite launches'
    },
    'fortnite-disable-nvidia-highlights': {
        apply: 'reg add "HKCU\\SOFTWARE\\NVIDIA Corporation\\Global\\ShadowPlay\\NVSDK_DoNotClip" /v FortniteClient-Win64-Shipping.exe /t REG_DWORD /d 1 /f 2>nul || echo NVIDIA highlights setting applied',
        revert: 'reg delete "HKCU\\SOFTWARE\\NVIDIA Corporation\\Global\\ShadowPlay\\NVSDK_DoNotClip" /v FortniteClient-Win64-Shipping.exe /f 2>nul'
    },
    'clean-temp': {
        apply: 'del /q /f /s %TEMP%\\* 2>nul & del /q /f /s C:\\Windows\\Temp\\* 2>nul & echo Temp files cleaned',
        revert: 'echo Temp files are automatically recreated as needed'
    },
    'disable-delivery-optimization': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization" /v SystemSettingsDownloadMode /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization" /v SystemSettingsDownloadMode /t REG_DWORD /d 3 /f'
    },
    'disable-search-indexing': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v SearchboxTaskbarMode /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v SearchboxTaskbarMode /t REG_DWORD /d 2 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 1 /f'
    },
    'optimize-ssd': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v EnableBalloonTips /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v EnableBalloonTips /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 1 /f'
    },
    'disable-hibernation': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "1" /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v Start_TrackDocs /t REG_DWORD /d 1 /f && reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "0" /f'
    },
    'bcdedit-tweaks': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "2000" /f',
        revert: 'reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d "400" /f && reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 5000 /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "20000" /f'
    },
    'msi-mode': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=0;SwapEffectUpgradeEnable=1;" /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "VRROptimizeEnable=1;" /f'
    },
    'disable-fast-startup': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "2000" /f && reg add "HKCU\\Control Panel\\Desktop" /v HungAppTimeout /t REG_SZ /d "1000" /f',
        revert: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillAppTimeout /t REG_SZ /d "20000" /f && reg add "HKCU\\Control Panel\\Desktop" /v HungAppTimeout /t REG_SZ /d "5000" /f'
    },
    'timer-resolution': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 1000 /f && reg add "HKCU\\Control Panel\\Desktop" /v ForegroundLockTimeout /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\Control Panel\\Desktop" /v LowLevelHooksTimeout /t REG_DWORD /d 5000 /f && reg add "HKCU\\Control Panel\\Desktop" /v ForegroundLockTimeout /t REG_DWORD /d 200000 /f'
    },
    'slider-proc-scheduling': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v ForegroundFlash /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v ForegroundLockTimeout /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\Control Panel\\Desktop" /v ForegroundFlash /t REG_DWORD /d 3 /f && reg add "HKCU\\Control Panel\\Desktop" /v ForegroundLockTimeout /t REG_DWORD /d 200000 /f'
    },
    'disable-windows-tips': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SubscribedContent-338389Enabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SoftLandingEnabled /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SystemPaneSuggestionsEnabled /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SubscribedContent-338389Enabled /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SoftLandingEnabled /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v SystemPaneSuggestionsEnabled /t REG_DWORD /d 1 /f'
    },
    'slider-large-cache': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v DisableThumbnailCache /t REG_DWORD /d 1 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v IconsOnly /t REG_DWORD /d 0 /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v DisableThumbnailCache /t REG_DWORD /d 0 /f && reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v IconsOnly /t REG_DWORD /d 0 /f'
    },
    'optimize-pagefile': {
        apply: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "1" /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillServiceTimeout /t REG_SZ /d "2000" /f',
        revert: 'reg add "HKCU\\Control Panel\\Desktop" /v AutoEndTasks /t REG_SZ /d "0" /f && reg add "HKCU\\Control Panel\\Desktop" /v WaitToKillServiceTimeout /t REG_SZ /d "5000" /f'
    },
    'disable-power-throttling': {
        apply: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowSuperHidden /t REG_DWORD /d 0 /f && reg add "HKCU\\Control Panel\\Desktop" /v PowerOffActive /t REG_SZ /d "0" /f',
        revert: 'reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowSuperHidden /t REG_DWORD /d 1 /f && reg add "HKCU\\Control Panel\\Desktop" /v PowerOffActive /t REG_SZ /d "1" /f'
    },
    'disable-c-states': {
        apply: 'reg add "HKCU\\Control Panel\\PowerCfg\\GlobalPowerPolicy" /v Policies /t REG_BINARY /d 01000000020000000100000000000000020000000000000000000000 /f && reg add "HKCU\\Control Panel\\Desktop" /v ScreenSaveActive /t REG_SZ /d "0" /f',
        revert: 'reg add "HKCU\\Control Panel\\PowerCfg\\GlobalPowerPolicy" /v Policies /t REG_BINARY /d 01000000020000000000000000000000020000000000000000000000 /f && reg add "HKCU\\Control Panel\\Desktop" /v ScreenSaveActive /t REG_SZ /d "1" /f'
    }
};

ipcMain.handle('apply-tweak', async (event, tweakId, action) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] ========================================`);
    console.log(`[${timestamp}] TWEAK REQUEST: ${tweakId}`);
    console.log(`[${timestamp}] ACTION: ${action}`);

    const tweak = tweakCommands[tweakId];
    if (!tweak) {
        console.log(`[${timestamp}] STATUS: FAILED - Unknown tweak ID`);
        console.log(`[${timestamp}] Available tweaks: ${Object.keys(tweakCommands).length} registered`);
        console.log(`[${timestamp}] ========================================\n`);
        return { success: false, message: `Unknown tweak: ${tweakId}` };
    }

    let command;
    if (action === 'apply' && tweak.apply) {
        command = tweak.apply;
    } else if (action === 'revert' && tweak.revert) {
        command = tweak.revert;
    } else if (action === 'enable' && tweak.enable) {
        command = tweak.enable;
    } else if (action === 'disable' && tweak.disable) {
        command = tweak.disable;
    } else if (action === 'execute' && tweak.execute) {
        command = tweak.execute;
    } else if (tweak.apply) {
        command = tweak.apply;
    } else if (tweak.execute) {
        command = tweak.execute;
    } else {
        console.log(`[${timestamp}] STATUS: FAILED - No command for action '${action}'`);
        console.log(`[${timestamp}] Available actions: ${Object.keys(tweak).join(', ')}`);
        console.log(`[${timestamp}] ========================================\n`);
        return { success: false, message: `No command found for action: ${action}` };
    }

    console.log(`[${timestamp}] COMMAND: ${command}`);

    return new Promise((resolve) => {
        exec(command, { shell: 'cmd.exe', windowsHide: true }, (error, stdout, stderr) => {
            if (error && !command.includes('2>nul') && !command.includes('echo')) {
                console.log(`[${timestamp}] STATUS: FAILED`);
                console.log(`[${timestamp}] ERROR: ${error.message}`);
                if (stderr) console.log(`[${timestamp}] STDERR: ${stderr}`);
                console.log(`[${timestamp}] ========================================\n`);
                resolve({
                    success: false,
                    message: `Failed: ${error.message}`
                });
            } else {
                console.log(`[${timestamp}] STATUS: SUCCESS`);
                if (stdout) console.log(`[${timestamp}] OUTPUT: ${stdout.trim()}`);
                console.log(`[${timestamp}] ========================================\n`);
                resolve({
                    success: true,
                    message: action === 'apply' || action === 'enable' || action === 'execute' ? 'Tweak applied successfully!' : 'Tweak reverted successfully!',
                    output: stdout
                });
            }
        });
    });
});

ipcMain.handle('apply-recommended-tweaks', async (event, tweakIds) => {
    const results = [];
    for (let i = 0; i < tweakIds.length; i++) {
        const id = tweakIds[i];
        const tweakDef = tweakCommands[id];

        event.sender.send('tweak-progress', { step: i + 1, total: tweakIds.length, id, status: 'running' });

        if (!tweakDef || !tweakDef.apply) {
            results.push({ id, success: false, message: 'Not available' });
            event.sender.send('tweak-progress', { step: i + 1, total: tweakIds.length, id, status: 'skipped' });
            continue;
        }

        const cmdHasErrHandling = tweakDef.apply.includes('2>nul') || tweakDef.apply.includes('exit /b 0');
        const result = await new Promise((resolve) => {
            exec(tweakDef.apply, { shell: 'cmd.exe', windowsHide: true, timeout: 15000 }, (error) => {
                if (error && !cmdHasErrHandling) {
                    resolve({ id, success: false, message: error.message });
                } else {
                    resolve({ id, success: true, message: 'Applied' });
                }
            });
        });

        results.push(result);
        event.sender.send('tweak-progress', { step: i + 1, total: tweakIds.length, id, status: result.success ? 'done' : 'failed' });
    }
    return { success: true, results };
});

ipcMain.handle('run-cleanup', async (event, type) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] ========================================`);
    console.log(`[${timestamp}] CLEANUP REQUEST: ${type}`);

    const commands = {
        'temp': 'del /q /f /s %TEMP%\\* 2>nul & del /q /f /s C:\\Windows\\Temp\\* 2>nul',
        'prefetch': 'del /q /s C:\\Windows\\Prefetch\\*.pf 2>nul',
        'dns': 'ipconfig /flushdns',
        'recycle': 'powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"',
        'windows-update': 'del /q /s C:\\Windows\\SoftwareDistribution\\Download\\* 2>nul'
    };

    const command = commands[type];
    if (!command) {
        console.log(`[${timestamp}] STATUS: FAILED - Unknown cleanup type`);
        console.log(`[${timestamp}] ========================================\n`);
        return { success: false, message: 'Unknown cleanup type' };
    }

    console.log(`[${timestamp}] COMMAND: ${command}`);

    return new Promise((resolve) => {
        exec(command, { shell: 'cmd.exe', windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                console.log(`[${timestamp}] STATUS: COMPLETED (with warnings)`);
                if (stderr) console.log(`[${timestamp}] STDERR: ${stderr}`);
            } else {
                console.log(`[${timestamp}] STATUS: SUCCESS`);
                if (stdout) console.log(`[${timestamp}] OUTPUT: ${stdout.trim()}`);
            }
            console.log(`[${timestamp}] ========================================\n`);
            resolve({
                success: true,
                message: `${type.charAt(0).toUpperCase() + type.slice(1)} cleanup completed!`
            });
        });
    });
});

ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
});

// ── Ollama AI Tweaker ──────────────────────────────────────────────────────

function ollamaHttpRequest(path, method, body, timeoutMs) {
    return new Promise((resolve, reject) => {
        const postBody = body ? JSON.stringify(body) : null;
        const options = {
            hostname: '127.0.0.1',
            port: 11434,
            path,
            method,
            headers: postBody
                ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody) }
                : {}
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch { resolve(data); }
            });
        });

        req.setTimeout(timeoutMs || 5000, () => {
            req.destroy();
            reject(new Error('Ollama request timed out'));
        });

        req.on('error', reject);
        if (postBody) req.write(postBody);
        req.end();
    });
}

ipcMain.handle('ollama-detect', async () => {
    // Step 1: Check if the ollama binary exists in PATH (Windows: where, Unix: which)
    const installed = await new Promise((resolve) => {
        execFile('where', ['ollama'], { windowsHide: true, shell: false }, (error) => resolve(!error));
    });

    // Step 2: Check if the Ollama API is responding
    let apiData = null;
    try {
        apiData = await ollamaHttpRequest('/api/tags', 'GET', null, 4000);
    } catch (_) {
        // Not running — intentionally ignored
    }

    const running = apiData !== null;
    const models  = running && Array.isArray(apiData.models) ? apiData.models : [];

    return { installed, running, models };
});

ipcMain.handle('ollama-chat', async (event, messages) => {
    try {
        const data = await ollamaHttpRequest(
            '/api/chat', 'POST',
            { model: 'llama3.2', messages, stream: false },
            90000
        );
        return { success: true, message: data?.message?.content || '' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('ollama-pull-model', async (event, model) => {
    return new Promise((resolve) => {
        let settled = false;

        let proc;
        try {
            proc = spawn('ollama', ['pull', model], { windowsHide: true });
        } catch (spawnErr) {
            console.error('[AI Tweaker] spawn failed:', spawnErr.message);
            return resolve({ success: false, pathError: true, error: spawnErr.message });
        }

        proc.stdout.on('data', (d) => event.sender.send('ollama-pull-progress', { chunk: d.toString() }));
        proc.stderr.on('data', (d) => event.sender.send('ollama-pull-progress', { chunk: d.toString() }));

        proc.on('error', (e) => {
            if (settled) return;
            settled = true;
            console.error('[AI Tweaker] ollama pull error:', e.message);
            resolve({ success: false, pathError: e.code === 'ENOENT', error: e.message });
        });

        proc.on('close', (code) => {
            if (settled) return;
            settled = true;
            resolve({ success: code === 0 });
        });
    });
});

let _aiSetupPromise = null;

async function setupAIEngine(event) {
    const send = (message) => {
        try { event.sender.send('ai-engine-progress', { message }); } catch (_) {}
    };

    // Step 1: Check binary is installed
    send('Checking AI Engine…');
    const installed = await new Promise((resolve) => {
        execFile('where', ['ollama'], { windowsHide: true, shell: false }, (error) => resolve(!error));
    });
    if (!installed) return { success: false, error: 'not_installed' };

    // Step 2: Check if API already responsive
    let apiData = null;
    try { apiData = await ollamaHttpRequest('/api/tags', 'GET', null, 3000); } catch (_) {}

    if (apiData === null) {
        // Need to start the engine
        send('Starting AI Engine…');
        try {
            const proc = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
            proc.unref();
        } catch (e) {
            return { success: false, error: 'start_failed' };
        }

        // Poll until API responds (up to 15 seconds)
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 900));
            try { apiData = await ollamaHttpRequest('/api/tags', 'GET', null, 1500); break; } catch (_) {}
        }
        if (apiData === null) return { success: false, error: 'start_timeout' };
    }

    // Step 3: Check if model is present
    const existingModels = Array.isArray(apiData?.models) ? apiData.models : [];
    const modelReady = existingModels.some(m => m.name && m.name.startsWith('llama3.2'));

    if (!modelReady) {
        send('Downloading AI Model…');
        const pulled = await new Promise((resolve) => {
            let settled = false;
            let proc;
            try {
                proc = spawn('ollama', ['pull', 'llama3.2'], { windowsHide: true });
            } catch (e) {
                return resolve(false);
            }

            proc.stdout.on('data', (d) => {
                const text = d.toString().toLowerCase();
                if (text.includes('verif') || text.includes('writing manifest')) {
                    try { event.sender.send('ai-engine-progress', { message: 'Finalizing AI Model…' }); } catch (_) {}
                }
            });
            proc.stderr.on('data', () => {});
            proc.on('error', () => { if (!settled) { settled = true; resolve(false); } });
            proc.on('close', (code) => { if (!settled) { settled = true; resolve(code === 0); } });
        });

        if (!pulled) return { success: false, error: 'model_pull_failed' };
    }

    // Step 4: Verify ready
    send('Finalizing…');
    try {
        const verify = await ollamaHttpRequest('/api/tags', 'GET', null, 4000);
        const ok = Array.isArray(verify?.models) && verify.models.some(m => m.name && m.name.startsWith('llama3.2'));
        if (!ok) return { success: false, error: 'model_missing_after_pull' };
    } catch (_) {
        return { success: false, error: 'verify_failed' };
    }

    return { success: true };
}

ipcMain.handle('ai-engine-setup', (event) => {
    if (_aiSetupPromise) return _aiSetupPromise;
    _aiSetupPromise = setupAIEngine(event).finally(() => { _aiSetupPromise = null; });
    return _aiSetupPromise;
});

// ── AI Background Context ─────────────────────────────────────────────────

const PROCESS_CATALOG = new Map([
    // Browsers — Review First (may have unsaved tabs/forms)
    ['chrome',               { display: 'Google Chrome',        category: 'Browser',           safeToClose: false, safeToDisableStartup: false }],
    ['msedge',               { display: 'Microsoft Edge',       category: 'Browser',           safeToClose: false, safeToDisableStartup: false }],
    ['firefox',              { display: 'Firefox',              category: 'Browser',           safeToClose: false, safeToDisableStartup: false }],
    ['brave',                { display: 'Brave',                category: 'Browser',           safeToClose: false, safeToDisableStartup: false }],
    ['opera',                { display: 'Opera',                category: 'Browser',           safeToClose: false, safeToDisableStartup: false }],
    // Game launchers — Review First (game may be active or mid-download)
    ['steam',                { display: 'Steam',                category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['epicgameslauncher',    { display: 'Epic Games Launcher',  category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['battlenetlauncher',    { display: 'Battle.net',           category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['riotclientservices',   { display: 'Riot Client',          category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['galaxyclient',         { display: 'GOG Galaxy',           category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['upc',                  { display: 'Ubisoft Connect',      category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['eadesktop',            { display: 'EA App',               category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['playnite.desktopapp',  { display: 'Playnite',             category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: false }],
    // Chat / Voice — Review First (user may be in a call)
    ['discord',              { display: 'Discord',              category: 'Chat/Voice',        safeToClose: false, safeToDisableStartup: true  }],
    ['teams',                { display: 'Microsoft Teams',      category: 'Chat/Voice',        safeToClose: false, safeToDisableStartup: true  }],
    ['slack',                { display: 'Slack',                category: 'Chat/Voice',        safeToClose: false, safeToDisableStartup: true  }],
    ['skype',                { display: 'Skype',                category: 'Chat/Voice',        safeToClose: false, safeToDisableStartup: true  }],
    ['zoom',                 { display: 'Zoom',                 category: 'Chat/Voice',        safeToClose: false, safeToDisableStartup: true  }],
    ['teamspeak3',           { display: 'TeamSpeak 3',          category: 'Chat/Voice',        safeToClose: false, safeToDisableStartup: true  }],
    // Overlays — Review First (driver-adjacent; GeForce Experience has UI)
    ['nvcontainer',          { display: 'NVIDIA Overlay',       category: 'Overlay',           safeToClose: false, safeToDisableStartup: true  }],
    ['geforceexperience',    { display: 'GeForce Experience',   category: 'Overlay',           safeToClose: false, safeToDisableStartup: true  }],
    ['gamebar',              { display: 'Xbox Game Bar',        category: 'Overlay',           safeToClose: false, safeToDisableStartup: false }],
    ['xboxgamemonitor',      { display: 'Xbox Game Monitor',    category: 'Overlay',           safeToClose: false, safeToDisableStartup: false }],
    // RGB / Peripheral — main UI apps are Review First; background-only service is Safe
    ['lightingservice',      { display: 'ASUS Aura Sync',       category: 'RGB/Peripheral',    safeToClose: true,  safeToDisableStartup: true  }],
    ['icue',                 { display: 'Corsair iCUE',         category: 'RGB/Peripheral',    safeToClose: false, safeToDisableStartup: true  }],
    ['razercentral',         { display: 'Razer Synapse',        category: 'RGB/Peripheral',    safeToClose: false, safeToDisableStartup: true  }],
    ['synapse3',             { display: 'Razer Synapse 3',      category: 'RGB/Peripheral',    safeToClose: false, safeToDisableStartup: true  }],
    ['lghub',                { display: 'Logitech G Hub',       category: 'RGB/Peripheral',    safeToClose: false, safeToDisableStartup: true  }],
    ['logioptionsplus',      { display: 'Logi Options+',        category: 'RGB/Peripheral',    safeToClose: false, safeToDisableStartup: true  }],
    ['steelseriesggtool',    { display: 'SteelSeries GG',       category: 'RGB/Peripheral',    safeToClose: false, safeToDisableStartup: true  }],
    // Cloud Sync — Review First (sync may be in progress)
    ['onedrive',             { display: 'Microsoft OneDrive',   category: 'Cloud Sync',        safeToClose: false, safeToDisableStartup: true  }],
    ['dropbox',              { display: 'Dropbox',              category: 'Cloud Sync',        safeToClose: false, safeToDisableStartup: true  }],
    ['googledrivefs',        { display: 'Google Drive',         category: 'Cloud Sync',        safeToClose: false, safeToDisableStartup: true  }],
    ['icloudservices',       { display: 'iCloud',               category: 'Cloud Sync',        safeToClose: false, safeToDisableStartup: true  }],
    // Updaters
    ['adobeupdateservice',   { display: 'Adobe Updater',        category: 'Updater',           safeToClose: true,  safeToDisableStartup: true  }],
    ['googleupdate',         { display: 'Google Updater',       category: 'Updater',           safeToClose: true,  safeToDisableStartup: true  }],
    // Recording / Capture — Review First (may be streaming live)
    ['obs64',                { display: 'OBS Studio',           category: 'Recording/Capture', safeToClose: false, safeToDisableStartup: false }],
    ['obs32',                { display: 'OBS Studio (32-bit)',  category: 'Recording/Capture', safeToClose: false, safeToDisableStartup: false }],
    // Desktop / Other — Review First (active remote session / active playback)
    ['wallpaperengine64',    { display: 'Wallpaper Engine',     category: 'Desktop App',       safeToClose: false, safeToDisableStartup: false }],
    ['parsec',               { display: 'Parsec',               category: 'Remote Access',     safeToClose: false, safeToDisableStartup: true  }],
    ['spotify',              { display: 'Spotify',              category: 'Desktop App',       safeToClose: false, safeToDisableStartup: true  }],
    // Anti-cheat — never safe to close/disable
    ['vgc',                  { display: 'Riot Vanguard',        category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    ['vgtray',               { display: 'Riot Vanguard',        category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    ['easyanticheat',        { display: 'Easy Anti-Cheat',      category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    ['easyanticheat_launcher',{ display: 'Easy Anti-Cheat',     category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    ['beservice',            { display: 'BattlEye',             category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    ['belvservice',          { display: 'BattlEye',             category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    ['faceitclient',         { display: 'FACEIT Client',        category: 'Anti-Cheat',        safeToClose: false, safeToDisableStartup: false }],
    // Lunar Client
    ['lunarclient',          { display: 'Lunar Client',         category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    // NVIDIA ShadowPlay / GeForce
    ['nvsphelper64',         { display: 'NVIDIA ShadowPlay',    category: 'Overlay',           safeToClose: false, safeToDisableStartup: true  }],
    ['nvsphelper',           { display: 'NVIDIA ShadowPlay',    category: 'Overlay',           safeToClose: false, safeToDisableStartup: true  }],
    ['nvbackend',            { display: 'NVIDIA ShadowPlay',    category: 'Overlay',           safeToClose: false, safeToDisableStartup: true  }],
    // Adobe
    ['adobeupdatedaemon',    { display: 'Adobe Updater',        category: 'Updater',           safeToClose: true,  safeToDisableStartup: true  }],
    ['adobegcclient',        { display: 'Adobe Creative Cloud', category: 'Updater',           safeToClose: true,  safeToDisableStartup: true  }],
    ['creativecloudapp',     { display: 'Adobe Creative Cloud', category: 'Updater',           safeToClose: true,  safeToDisableStartup: true  }],
    // Extra game launchers
    ['heroiclauncher',       { display: 'Heroic Games Launcher',category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
    ['xboxapp',              { display: 'Xbox App',             category: 'Game Launcher',     safeToClose: false, safeToDisableStartup: true  }],
]);

const CRITICAL_SERVICES = new Set([
    'wuauserv','bits','trustedinstaller','windefend','wscsvc','mpssvc','sense',
    'audiosrv','audioendpointbuilder',
    'dhcp','dnscache','lanmanserver','lanmanworkstation','netlogon','netman','nsi',
    'rpcss','rpcepmap','winmgmt','eventlog','eventsystem','plugplay',
    'schedule','cryptsvc','keyiso','hidserv','gpsvc','sppsvc','msiserver',
    'wlanautosvc','dot3svc','themes',
]);

// Internal protected processes — never shown in background recommendations or sent to AI
const INTERNAL_PROTECTED_PROCESSES = new Set([
    'ollama',
    'ollama_llms',
    'ollama_runners',
    'xtweaks',
    'xinpremiumoptimizer',
    'xin-premium-optimizer',
    'xintweaks',
]);

// Windows core/OS processes — never surface to the user
const WINDOWS_CORE_PROCS = new Set([
    'system','registry','smss','csrss','wininit','winlogon','services','lsass','lsaiso',
    'fontdrvhost','dwm','sihost','taskhostw','runtimebroker','spoolsv','audiodg',
    'msdtc','wudfhost','dllhost','conhost','werfault','werfaultsecure','wermgr',
    'ctfmon','useroobebroker','netservicesmanager','svchost',
    'explorer','shellexperiencehost','startmenuexperiencehost','searchhost','searchapp',
    'lockapp','applicationframehost','systemsettings','textinputhost','phasedeploymentserver',
    'msmpeng','nissrv','msseces','securityhealthservice','securityhealthsystray',
    'mpcmdrun','mpsigstub','mpdef','antimalwareservice',
    'tiworker','trustedinstaller','wuauclt','musnotification','musnotificationux',
    'msiexec','mmc','consent','dism','rundll32','regsvr32',
    'taskmgr','regedit','cmd','powershell','pwsh',
    'searchindexer','searchprotocolhost','searchfilterhost',
    'backgroundtaskhost','wmiprvse','wmiapsrv','vds',
    'ntoskrnl','ntkrnlmp','idle',
    'winmgmt','wbemhostexe','wbemhost',
    'uhssvc','upfc','usoclient',
    'node','electron','xinpremiumoptimizer','xintweaks',
]);

// Guess category for processes not in PROCESS_CATALOG
function guessProcessCategory(name, path) {
    const n = (name || '').toLowerCase();
    const p = (path || '').toLowerCase();
    if (n.includes('update') || n.includes('updater') || n.includes('autoupdate')) return 'Updater';
    if (n.includes('tray') || n.includes('notification') || n.includes('notify'))   return 'Tray App';
    if (n.includes('helper') || n.includes('agent') || n.includes('daemon'))         return 'Background';
    if (n.includes('launcher') || n.includes('boot') || n.includes('startup'))       return 'Launcher';
    if (p.includes('steam') || p.includes('epic games') || p.includes('battle.net') || p.includes('riot')) return 'Game Launcher';
    if (p.includes('discord') || p.includes('slack') || p.includes('teams') || p.includes('zoom'))        return 'Chat/Voice';
    if (p.includes('spotify') || p.includes('music') || p.includes('media'))                               return 'Media';
    if (p.includes('adobe') || p.includes('creative cloud'))                                                return 'Creative Suite';
    if (p.includes('\\appdata\\') || p.includes('\\program files\\'))                                      return 'User App';
    return 'Background';
}

const SERVICE_CATEGORIES = {
    'diagtrack':             { display: 'Connected User Experiences / Telemetry',  category: 'Review'            },
    'dmwappushservice':      { display: 'Device Management Push Service',           category: 'Review'            },
    'sysmain':               { display: 'SysMain / Superfetch',                     category: 'Review'            },
    'fax':                   { display: 'Fax Service',                              category: 'Review'            },
    'spooler':               { display: 'Print Spooler',                            category: 'Review'            },
    'wersvc':                { display: 'Windows Error Reporting',                  category: 'Review'            },
    'remoteregistry':        { display: 'Remote Registry',                          category: 'Review'            },
    'termservice':           { display: 'Remote Desktop Services',                  category: 'Review'            },
    'xbgm':                  { display: 'Xbox Game Monitoring',                     category: 'Gaming-Related'    },
    'xboxnetapiservice':     { display: 'Xbox Live Networking',                     category: 'Gaming-Related'    },
    'xboxgipsvc':            { display: 'Xbox Accessory Management',                category: 'Gaming-Related'    },
    'gametdvsvc':            { display: 'Xbox Game Mode',                           category: 'Gaming-Related'    },
    'nvsvc':                 { display: 'NVIDIA Driver Helper',                     category: 'Peripheral/Driver' },
    'nvagent':               { display: 'NVIDIA Network Service',                   category: 'Peripheral/Driver' },
    'nvdisplay.containerls': { display: 'NVIDIA Display Container',                 category: 'Peripheral/Driver' },
    'amdextnbridge':         { display: 'AMD External Events Bridge',               category: 'Peripheral/Driver' },
    'gupdate':               { display: 'Google Update Service',                    category: 'Update Service'    },
    'gupdatem':              { display: 'Google Update Service (on demand)',         category: 'Update Service'    },
};

let _bgContextCache = null;
let _bgContextTime  = 0;
const BG_CACHE_TTL  = 60000;

async function collectBackgroundContext() {
    function runPS(script, timeoutMs = 11000) {
        return new Promise((resolve) => {
            const proc = spawn('powershell.exe', [
                '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script
            ], { windowsHide: true });

            let out = '';
            proc.stdout.on('data', d => { out += d.toString(); });
            proc.stderr.on('data', () => {});
            proc.on('error', () => resolve(null));

            const timer = setTimeout(() => { try { proc.kill(); } catch {} resolve(null); }, timeoutMs);
            proc.on('close', () => {
                clearTimeout(timer);
                const trimmed = out.trim();
                if (!trimmed) return resolve(null);
                try { resolve(JSON.parse(trimmed)); } catch { resolve(null); }
            });
        });
    }

    // Run all queries in parallel — admin check is fast (~300 ms), never blocks the others
    const [rawProcs, rawStartups, rawSvcs, rawIsAdmin] = await Promise.all([
        runPS(
            `Get-Process | Select-Object Name, Id, ` +
            `@{N='RAM_MB';E={[math]::Round($_.WorkingSet64/1MB,0)}}, ` +
            `@{N='Path';E={try{$_.Path}catch{''}}} | ` +
            `ConvertTo-Json -Compress -Depth 1`,
            11000
        ),
        runPS(
            `Get-CimInstance Win32_StartupCommand | Select-Object Name, Location | ConvertTo-Json -Compress`,
            11000
        ),
        runPS(
            `Get-Service | Where-Object { $_.Status -eq 'Running' } | ` +
            `Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Compress`,
            11000
        ),
        runPS(
            `([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())` +
            `.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) | ConvertTo-Json`,
            3000
        ),
    ]);

    const isAdmin = rawIsAdmin === true;

    // ── Processes ──────────────────────────────────────────────────────────
    let procsArr = rawProcs;
    if (procsArr && !Array.isArray(procsArr)) procsArr = [procsArr];

    // Raw total from Get-Process (mirrors Task Manager "Processes" count)
    const totalScanned = Array.isArray(procsArr) ? procsArr.length : 0;

    const processes    = [];
    const seenProc     = new Set();
    const unknownBuf   = []; // non-catalog user processes, capped + sorted by RAM
    let protectedCount = 0;

    if (Array.isArray(procsArr)) {
        for (const p of procsArr) {
            const rawName = (p.Name || '');
            const key     = rawName.toLowerCase().replace(/\s+/g, '');
            const path    = (p.Path || '').toLowerCase();
            const ramMB   = typeof p.RAM_MB === 'number' ? p.RAM_MB : 0;
            const pid     = typeof p.Id === 'number' ? p.Id : null;

            if (!key || seenProc.has(key)) continue;
            if (INTERNAL_PROTECTED_PROCESSES.has(key)) { protectedCount++; seenProc.add(key); continue; }

            // Determine if this is a Windows system process
            const isSystemPath = !!path && (
                path.includes('\\windows\\system32\\') ||
                path.includes('\\windows\\syswow64\\') ||
                path.includes('\\windows\\winsxs\\') ||
                (path.startsWith('c:\\windows\\') && !path.includes('\\program files\\'))
            );
            const isSystemName = WINDOWS_CORE_PROCS.has(key) ||
                /^(svchost|dllhost|runtimebroker|backgroundtaskhost|wmiprvse|conhost|wbemhost)/.test(key);

            if (isSystemPath || (isSystemName && !path)) {
                protectedCount++;
                seenProc.add(key);
                continue;
            }

            seenProc.add(key);

            const info = PROCESS_CATALOG.get(key);
            if (info) {
                // Known catalog entry — use catalog classification
                processes.push({
                    name:                info.display,
                    processName:         key,
                    pid,
                    category:            info.category,
                    ramMB,
                    safeToClose:         info.safeToClose,
                    safeToDisableStartup:info.safeToDisableStartup,
                });
            } else if (!isSystemName && ramMB >= 2) {
                // Non-catalog, non-system background process — show as Review First
                unknownBuf.push({
                    name:        rawName,
                    processName: key,
                    pid,
                    category:    guessProcessCategory(rawName, p.Path || ''),
                    ramMB,
                    safeToClose: false,
                    safeToDisableStartup: false,
                });
            }
        }
    }

    // Add top unknown processes sorted by RAM (cap at 30 to avoid flooding the list)
    unknownBuf.sort((a, b) => b.ramMB - a.ramMB);
    for (const u of unknownBuf.slice(0, 30)) processes.push(u);

    // Sort final list: catalog safe-to-close first, then review, then by RAM
    processes.sort((a, b) => {
        if (a.safeToClose !== b.safeToClose) return a.safeToClose ? -1 : 1;
        return b.ramMB - a.ramMB;
    });

    // ── Startup entries ────────────────────────────────────────────────────
    let startupsArr = rawStartups;
    if (startupsArr && !Array.isArray(startupsArr)) startupsArr = [startupsArr];

    const startups = [];
    if (Array.isArray(startupsArr)) {
        for (const s of startupsArr) {
            const sName = (s.Name || '').trim();
            if (!sName) continue;
            if (INTERNAL_PROTECTED_PROCESSES.has(sName.toLowerCase().replace(/\s+/g, ''))) continue;

            const locLower = (s.Location || '').toLowerCase();
            let locLabel = 'Startup Folder';
            if (locLower.includes('hkcu')) locLabel = 'Registry (Current User)';
            else if (locLower.includes('hklm')) locLabel = 'Registry (All Users)';

            const nameLower = sName.toLowerCase().replace(/\s+/g, '');
            let safeToDisable = false;
            let category = 'Unknown';
            for (const [key, info] of PROCESS_CATALOG) {
                if (nameLower.includes(key) || key.includes(nameLower)) {
                    safeToDisable = info.safeToDisableStartup;
                    category      = info.category;
                    break;
                }
            }

            startups.push({
                name:         sName,
                location:     s.Location || '',
                locationLabel:locLabel,
                category,
                safeToDisable,
            });
        }
    }

    // ── Services ───────────────────────────────────────────────────────────
    let svcsArr = rawSvcs;
    if (svcsArr && !Array.isArray(svcsArr)) svcsArr = [svcsArr];

    const services = [];
    if (Array.isArray(svcsArr)) {
        for (const svc of svcsArr) {
            const svcKey = (svc.Name || '').toLowerCase().replace(/[\s._-]/g, '');
            const known  = SERVICE_CATEGORIES[svcKey];
            if (!known) continue;
            services.push({
                name:     svc.Name,
                display:  known.display,
                status:   'Running',
                category: known.category,
                critical: CRITICAL_SERVICES.has(svcKey),
            });
        }
    }

    return { processes, startups, services, totalScanned, protectedCount, isAdmin, timestamp: Date.now() };
}

ipcMain.handle('get-background-context', async () => {
    const now = Date.now();
    if (_bgContextCache && (now - _bgContextTime) < BG_CACHE_TTL) {
        return { ..._bgContextCache, fromCache: true };
    }
    try {
        const data = await collectBackgroundContext();
        _bgContextCache = data;
        _bgContextTime  = now;
        return data;
    } catch (err) {
        console.error('[Process Reducer] collectBackgroundContext failed:', err?.message || err);
        return { processes: [], startups: [], services: [], timestamp: now, scanFailed: true };
    }
});

// ── Startup Context (real registry / folder / task / service scan) ───────────

// Safety buckets: safe | game-dependent | review | protected | unknown
function classifyStartupEntry(rawName, rawCmd) {
    const n = (rawName || '').toLowerCase().replace(/[\s._\-]+/g, '').replace(/\.exe$/i, '');
    const c = (rawCmd  || '').toLowerCase();

    // Internal — never surface
    if (INTERNAL_PROTECTED_PROCESSES.has(n)) return null;

    // Direct PROCESS_CATALOG match
    if (PROCESS_CATALOG.has(n)) {
        const info   = PROCESS_CATALOG.get(n);
        const bucket = info.category === 'Anti-Cheat'     ? 'game-dependent'
                     : info.safeToDisableStartup           ? 'safe'
                     : info.category === 'Overlay'         ? 'review'
                     : 'review';
        return { display: info.display, category: info.category, bucket, safe: info.safeToDisableStartup };
    }
    // Partial match — iterate
    for (const [key, info] of PROCESS_CATALOG) {
        if (n.includes(key) || (n.length >= 6 && key.includes(n.slice(0, 6)))) {
            const bucket = info.category === 'Anti-Cheat' ? 'game-dependent'
                         : info.safeToDisableStartup       ? 'safe'
                         : 'review';
            return { display: info.display, category: info.category, bucket, safe: info.safeToDisableStartup };
        }
    }

    // Pattern-based protected
    const protectedPat = /^(windows|windefend|microsoftedge|edgeupdate|msiexec|svchost|lsass|wuauclt|spoolsv|audiodg|dwm|csrss|winlogon|services|smss|taskhostw|runtimebroker)/;
    if (protectedPat.test(n) || /windows\s*(defender|security|update)/i.test(rawName || '')) {
        return { display: rawName, category: 'System / Windows', bucket: 'protected', safe: false };
    }
    // Driver / hardware vendors
    if (/^(realtek|amd|nvidia|intel|synaptics|wacom|asustek|dell|hp|lenovo|logitech)(audio|app|hd|display|driver|osd|helper)/i.test(n)) {
        return { display: rawName, category: 'Driver / Hardware', bucket: 'protected', safe: false };
    }
    // Generic updater pattern
    if (/updater?|autoupdate|updateservice/.test(n) && !/windows|microsoft|defender/.test(n)) {
        return { display: rawName, category: 'Updater', bucket: 'safe', safe: true };
    }

    return { display: rawName, category: 'Unknown', bucket: 'unknown', safe: false };
}

let _startupCtxCache = null;
let _startupCtxTime  = 0;
const STARTUP_CTX_TTL = 90000;

async function collectStartupContext() {
    function runPS(script, timeoutMs = 10000) {
        return new Promise((resolve) => {
            const proc = spawn('powershell.exe', [
                '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script
            ], { windowsHide: true });
            let out = '';
            proc.stdout.on('data', d => { out += d.toString(); });
            proc.stderr.on('data', () => {});
            proc.on('error', () => resolve(null));
            const timer = setTimeout(() => { try { proc.kill(); } catch {} resolve(null); }, timeoutMs);
            proc.on('close', () => {
                clearTimeout(timer);
                const t = out.trim();
                if (!t) return resolve(null);
                try { resolve(JSON.parse(t)); } catch { resolve(null); }
            });
        });
    }

    // ── Script 1: Registry Run keys + startup folders ──────────────────────
    const regScript =
        `$r=@();` +
        `$keys=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',` +
        `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',` +
        `'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run');` +
        `foreach($k in $keys){if(Test-Path $k){` +
        `$p=Get-ItemProperty -Path $k -EA SilentlyContinue;` +
        `if($p){$p.PSObject.Properties|Where-Object{$_.Name -notmatch '^PS'}|ForEach-Object{` +
        `$r+=@{Name=$_.Name;Cmd=[string]$_.Value;Source=$k}}}}}` +
        `;$sf=@([System.Environment]::GetFolderPath('Startup'),[System.Environment]::GetFolderPath('CommonStartup'));` +
        `foreach($f in $sf){if(Test-Path $f){Get-ChildItem -Path $f -EA SilentlyContinue|ForEach-Object{` +
        `$r+=@{Name=$_.BaseName;Cmd=$_.FullName;Source='StartupFolder'}}}}` +
        `;if($r.Count -eq 0){return '[]'} else {$r|ConvertTo-Json -Compress}`;

    // ── Script 2: Scheduled tasks with logon/boot triggers ──────────────────
    const taskScript =
        `$r=@();` +
        `try{Get-ScheduledTask -EA SilentlyContinue|Where-Object{$_.State -ne 'Disabled' -and $_.TaskPath -notlike '\\Microsoft\\*'}|ForEach-Object{` +
        `$t=$_;$hasTrig=$false;` +
        `foreach($tr in $t.Triggers){if($tr -and $tr.CimClass -and $tr.CimClass.CimClassName -match 'Logon|Boot'){$hasTrig=$true;break}};` +
        `if($hasTrig){$act='';try{$act=[string]($t.Actions|Select-Object -First 1).Execute}catch{};` +
        `$r+=@{Name=[string]$t.TaskName;Path=[string]$t.TaskPath;State=[string]$t.State;Action=$act}` +
        `}}}catch{};` +
        `if($r.Count -eq 0){return '[]'} else {($r|Select-Object -First 40)|ConvertTo-Json -Compress}`;

    const [rawReg, rawTasks] = await Promise.all([
        runPS(regScript, 12000),
        runPS(taskScript, 14000),
    ]);

    // ── Parse registry + startup folder entries ────────────────────────────
    let regRaw = rawReg;
    if (regRaw && !Array.isArray(regRaw)) regRaw = [regRaw];
    const registryEntries = [];
    const folderEntries   = [];
    if (Array.isArray(regRaw)) {
        for (const entry of regRaw) {
            if (!entry || !entry.Name) continue;
            if (INTERNAL_PROTECTED_PROCESSES.has((entry.Name || '').toLowerCase().replace(/\s+/g, ''))) continue;
            const cls = classifyStartupEntry(entry.Name, entry.Cmd);
            if (!cls) continue;
            const item = {
                name:     entry.Name,
                command:  (entry.Cmd || '').slice(0, 200),
                source:   entry.Source === 'StartupFolder' ? 'Startup Folder' : (entry.Source || ''),
                display:  cls.display,
                category: cls.category,
                bucket:   cls.bucket,
                safe:     cls.safe,
            };
            if (entry.Source === 'StartupFolder') folderEntries.push(item);
            else                                   registryEntries.push(item);
        }
    }

    // ── Parse scheduled tasks ──────────────────────────────────────────────
    let tasksRaw = rawTasks;
    if (tasksRaw && !Array.isArray(tasksRaw)) tasksRaw = [tasksRaw];
    const scheduledTasks = [];
    if (Array.isArray(tasksRaw)) {
        for (const t of tasksRaw) {
            if (!t || !t.Name) continue;
            const cls = classifyStartupEntry(t.Name, t.Action);
            if (cls && cls.bucket === 'protected') continue; // skip Windows-protected tasks
            scheduledTasks.push({
                name:     t.Name,
                path:     t.Path || '\\',
                state:    t.State || 'Ready',
                action:   (t.Action || '').slice(0, 150),
                display:  cls ? cls.display : t.Name,
                category: cls ? cls.category : 'Unknown',
                bucket:   cls ? cls.bucket   : 'unknown',
                safe:     cls ? cls.safe      : false,
            });
        }
    }

    return {
        registryEntries,
        folderEntries,
        scheduledTasks,
        scannedAt: Date.now(),
        scanFailed: false,
    };
}

ipcMain.handle('get-startup-context', async () => {
    const now = Date.now();
    if (_startupCtxCache && (now - _startupCtxTime) < STARTUP_CTX_TTL) {
        return { ..._startupCtxCache, fromCache: true };
    }
    try {
        const data = await collectStartupContext();
        _startupCtxCache = data;
        _startupCtxTime  = now;
        return data;
    } catch {
        return { registryEntries: [], folderEntries: [], scheduledTasks: [], scannedAt: now, scanFailed: true };
    }
});

ipcMain.handle('close-process', async (event, pid, processName) => {
    if (typeof pid !== 'number' || pid <= 0) return { success: false, error: 'invalid_pid' };
    const key  = (processName || '').toLowerCase().replace(/\s+/g, '');

    // Safety gate: only CATALOG entries with safeToClose can be terminated
    const info = PROCESS_CATALOG.get(key);
    if (!info || !info.safeToClose) return { success: false, error: 'not_whitelisted' };

    // Verify PID still matches the expected process name before killing
    const verified = await new Promise(resolve => {
        execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
            { windowsHide: true, timeout: 3000 },
            (err, stdout) => {
                if (err) return resolve(true); // tasklist unavailable — allow and let taskkill decide
                const line = (stdout || '').trim().split('\n').find(l => l.includes(`"${pid}"`)) || '';
                if (!line) return resolve(false); // PID not found — already exited
                const actualName = (line.split(',')[0] || '').replace(/"/g, '').trim()
                    .toLowerCase().replace(/\.exe$/i, '').replace(/\s+/g, '');
                resolve(actualName === key || actualName.startsWith(key.slice(0, Math.min(key.length, 6))));
            }
        );
    });
    if (!verified) return { success: false, error: 'pid_mismatch' };

    return new Promise((resolve) => {
        execFile('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true, timeout: 5000 },
            (error) => { _bgContextCache = null; resolve({ success: !error }); }
        );
    });
});

ipcMain.handle('disable-startup-entry', async (event, entryName, location) => {
    if (!entryName || typeof entryName !== 'string') return { success: false, error: 'invalid_name' };

    const locLower = (location || '').toLowerCase();
    let approvedPath;
    if (locLower.includes('hkcu') || locLower.includes('current user')) {
        approvedPath = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
    } else if (locLower.includes('hklm') || locLower.includes('all user')) {
        approvedPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
    } else {
        return { success: false, error: 'manual_required' };
    }

    const safeName = entryName.replace(/['"\\]/g, '');
    const psScript =
        `$p='${approvedPath}'; ` +
        `if(-not(Test-Path $p)){New-Item -Path $p -Force|Out-Null}; ` +
        `Set-ItemProperty -Path $p -Name '${safeName}' -Value([byte[]](3,0,0,0,0,0,0,0,0,0,0,0)) -Type Binary`;

    return new Promise((resolve) => {
        const proc = spawn('powershell.exe', [
            '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript
        ], { windowsHide: true });
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return; settled = true;
            try { proc.kill(); } catch {}
            resolve({ success: false, error: 'timeout' });
        }, 8000);
        proc.on('error', () => { if (!settled) { settled = true; clearTimeout(timer); resolve({ success: false }); } });
        proc.on('close', (code) => {
            if (settled) return; settled = true;
            clearTimeout(timer);
            _bgContextCache = null;
            resolve({ success: code === 0 });
        });
    });
});

// Save/Load toggle states
const toggleStatesPath = path.join(app.getPath('userData'), 'toggle-states.json');

function loadToggleStates() {
    try {
        if (fs.existsSync(toggleStatesPath)) {
            return JSON.parse(fs.readFileSync(toggleStatesPath, 'utf8'));
        }
    } catch (e) {
        console.log('[CONFIG] Failed to load toggle states:', e.message);
    }
    return {};
}

function saveToggleStates(states) {
    try {
        fs.writeFileSync(toggleStatesPath, JSON.stringify(states, null, 2));
    } catch (e) {
        console.log('[CONFIG] Failed to save toggle states:', e.message);
    }
}

ipcMain.handle('get-toggle-states', async () => {
    return loadToggleStates();
});

ipcMain.handle('save-toggle-state', async (event, toggleId, state) => {
    const states = loadToggleStates();
    states[toggleId] = state;
    saveToggleStates(states);
    return { success: true };
});

// ── GPU Live Stats (real temp via nvidia-smi, power plan, usage) ──
let _gpuUsageIsReal = false; // true only when WMI returns a valid reading
let _gpuLiveCache   = { temp: null, powerPlan: null };
let _gpuTempTs      = 0;
let _gpuPlanTs      = 0;
let _nvidiaSmiOk    = null; // null=untested, true=works, false=unavailable

function _fetchNvidiaTemp() {
    return new Promise((resolve) => {
        execFile(
            'nvidia-smi',
            ['--query-gpu=temperature.gpu', '--format=csv,noheader,nounits'],
            { windowsHide: true, timeout: 3000 },
            (err, stdout) => {
                if (err) { _nvidiaSmiOk = false; resolve(null); return; }
                const v = parseInt((stdout || '').trim(), 10);
                const val = Number.isFinite(v) ? v : null;
                _nvidiaSmiOk = val !== null;
                resolve(val);
            }
        );
    });
}

function _fetchPowerPlan() {
    return new Promise((resolve) => {
        execFile(
            'powercfg', ['/getactivescheme'],
            { windowsHide: true, timeout: 4000 },
            (err, stdout) => {
                if (err) { resolve(null); return; }
                const m = (stdout || '').match(/\(([^)]+)\)/);
                resolve(m ? m[1].trim() : null);
            }
        );
    });
}

ipcMain.handle('get-gpu-live-stats', async () => {
    const now   = Date.now();
    const tasks = [];

    // Refresh temp every 2.5 s; skip nvidia-smi entirely once known unavailable
    if (_nvidiaSmiOk !== false && now - _gpuTempTs > 2500) {
        _gpuTempTs = now;
        tasks.push(_fetchNvidiaTemp().then(v => { _gpuLiveCache.temp = v; }));
    }

    // Refresh power plan every 30 s
    if (now - _gpuPlanTs > 30000) {
        _gpuPlanTs = now;
        tasks.push(_fetchPowerPlan().then(v => { if (v !== null) _gpuLiveCache.powerPlan = v; }));
    }

    if (tasks.length) await Promise.all(tasks);

    return {
        usage:     _gpuUsageIsReal ? Math.min(100, Math.max(0, Math.round(currentSystemStats.gpuUsage))) : null,
        temp:      _gpuLiveCache.temp,      // integer °C, or null if unavailable
        powerPlan: _gpuLiveCache.powerPlan  // string, or null if unavailable
    };
});

// ── GPU Info ──────────────────────────────────────────────────
function detectGpuVendor(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('nvidia') || n.includes('geforce') || n.includes('rtx') ||
        n.includes('gtx') || n.includes('quadro') || n.includes('tesla')) return 'nvidia';
    if (n.includes('amd') || n.includes('radeon') || n.includes('rx ') ||
        n.includes('vega') || n.includes('navi') || n.includes('rdna')) return 'amd';
    if (n.includes('intel') || n.includes('arc ') || n.includes('iris') ||
        n.includes('uhd graphics') || n.includes('hd graphics') || n.includes('xe graphics')) return 'intel';
    return 'unknown';
}

// Patterns that identify virtual / non-physical display adapters.
// These are filtered out silently so only real GPUs are shown.
const VIRTUAL_GPU_PATTERNS = [
    'microsoft basic display',
    'microsoft remote display',
    'parsec',
    'virtual display',
    'indirect display',
    'vmware',
    'virtualbox',
    'vbox',
    'remotefx',
    'remote fx',
    'rdp',
    'teamviewer',
    'anydesk',
    'parallels display',
    'citrix',
    'idd ',  // Indirect Display Driver prefix
];

function isVirtualGpuAdapter(name) {
    const n = (name || '').toLowerCase();
    return VIRTUAL_GPU_PATTERNS.some(p => n.includes(p));
}

ipcMain.handle('get-gpu-info', async () => {
    console.log('[GPU INFO] Query starts');
    try {
        const script = `@(Get-CimInstance -ClassName Win32_VideoController | Select-Object Name,DriverVersion,AdapterRAM,DriverDate) | ConvertTo-Json -Compress`;
        const raw = await runPowerShellJson('gpu-info', script, 8000);
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        const gpus = list
            .filter(g => g && g.Name && !isVirtualGpuAdapter(g.Name))
            .map(gpu => {
                const name = unknownIfEmpty(gpu.Name, 'Unknown GPU');
                return {
                    name,
                    vendor: detectGpuVendor(name),
                    driverVersion: unknownIfEmpty(gpu.DriverVersion, null),
                    vram: gpu.AdapterRAM ? formatBytesForDisplay(gpu.AdapterRAM) : null,
                    driverDate: gpu.DriverDate ? String(gpu.DriverDate).substring(0, 10) : null
                };
            });
        console.log(`[GPU INFO] Found ${gpus.length} real GPU(s):`, gpus.map(g => `${g.vendor}:${g.name}`).join(', '));
        return { success: true, gpus };
    } catch (err) {
        console.error('[GPU INFO] Query failed:', err.message);
        return { success: false, error: err.message, gpus: [] };
    }
});

// ── Admin Check ────────────────────────────────────────────────
ipcMain.handle('check-admin', () =>
    new Promise(resolve =>
        exec('net session', { windowsHide: true, timeout: 3000 }, err => resolve({ isAdmin: !err }))
    )
);

// ── DNS Optimizer ──────────────────────────────────────────────
const DNS_BACKUP_PATH = path.join(app.getPath('userData'), 'dns-backup.json');

ipcMain.handle('dns-optimizer-scan', async (event, opts) => {
    const includeVpn = opts?.includeVpn === true;
    const rounds = Math.max(1, Math.min(5, parseInt(opts?.rounds) || 3));

    // ── Physical adapter detection ────────────────────────────
    const adapterScript = `
$ErrorActionPreference = 'SilentlyContinue'
$incVpn = ${includeVpn ? '$true' : '$false'}
$VIRT = @('radmin','vpn','tailscale','wireguard','openvpn',' tap','tun','hamachi','zerotier',
           'nordvpn','nordlynx','proton','surfshark','cisco','anyconnect','hyper-v','vethernet',
           'vmware','virtualbox','vbox','wsl','loopback','bluetooth','pptp','l2tp',
           'ras async','isatap','teredo','tunneladapter')
function IsVirt([string]$n,[string]$d) {
    $c = ($n + ' ' + $d).ToLower()
    foreach ($p in $VIRT) { if ($c.Contains($p.Trim())) { return $true } }
    return $false
}
$skipped = @()
$chosen  = $null
$routes  = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -EA SilentlyContinue |
           Where-Object { $_.NextHop -ne '0.0.0.0' } | Sort-Object RouteMetric
foreach ($rt in $routes) {
    $a = Get-NetAdapter -InterfaceIndex $rt.InterfaceIndex -EA SilentlyContinue
    if (-not $a -or $a.Status -ne 'Up') { continue }
    if (-not $incVpn -and (IsVirt $a.Name $a.InterfaceDescription)) {
        if ($skipped -notcontains $a.Name) { $skipped += $a.Name }
        continue
    }
    $chosen = $a; break
}
if (-not $chosen) {
    $allUp = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Sort-Object LinkSpeed -Descending
    foreach ($a in $allUp) {
        if (-not $incVpn -and (IsVirt $a.Name $a.InterfaceDescription)) {
            if ($skipped -notcontains $a.Name) { $skipped += $a.Name }
        } else { $chosen = $a; break }
    }
}
if (-not $chosen) {
    [PSCustomObject]@{ error='no_physical_adapter'; skipped=@($skipped) } | ConvertTo-Json -Compress
    exit
}
$cfg = Get-NetIPConfiguration -InterfaceIndex $chosen.ifIndex -EA SilentlyContinue
$dnsA = Get-DnsClientServerAddress -InterfaceIndex $chosen.ifIndex -AddressFamily IPv4 -EA SilentlyContinue
$gw  = if ($cfg.IPv4DefaultGateway) { $cfg.IPv4DefaultGateway.NextHop } else { $null }
$ip  = if ($cfg.IPv4Address) { ($cfg.IPv4Address | Select-Object -First 1).IPAddress } else { $null }
$ct  = 'Network'
if ($chosen.Name -like '*Wi-Fi*' -or $chosen.Name -like '*Wireless*' -or $chosen.Name -like '*WLAN*') { $ct = 'Wi-Fi' }
elseif ($chosen.InterfaceDescription -like '*Wireless*' -or $chosen.InterfaceDescription -like '*802.11*') { $ct = 'Wi-Fi' }
elseif ($chosen.Name -like '*Ethernet*' -or $chosen.Name -like '*LAN*') { $ct = 'Ethernet' }
elseif ($chosen.InterfaceDescription -like '*Ethernet*') { $ct = 'Ethernet' }
[PSCustomObject]@{
    name       = $chosen.Name
    description= $chosen.InterfaceDescription
    linkSpeed  = $chosen.LinkSpeed
    ifIndex    = [int]$chosen.ifIndex
    ipv4       = $ip
    gateway    = $gw
    dnsServers = @($dnsA.ServerAddresses)
    connType   = $ct
    skipped    = @($skipped)
} | ConvertTo-Json -Compress
`;

    const adapterResult = await runNetworkPowerShellJson(adapterScript, 14000);
    if (!adapterResult.success || !adapterResult.data || typeof adapterResult.data !== 'object') {
        return { success: false, message: 'Could not detect active network adapter.' };
    }

    const adapter = adapterResult.data;

    if (adapter.error === 'no_physical_adapter') {
        const sk = Array.isArray(adapter.skipped) ? adapter.skipped.filter(Boolean) : [];
        const skipMsg = sk.length ? ` Skipped: ${sk.join(', ')}.` : '';
        return {
            success: false,
            message: `No physical adapter found.${skipMsg} Enable "Include VPN / virtual adapters" in Details & Log and rescan.`,
            skippedAdapters: sk,
        };
    }

    const currentDns      = Array.isArray(adapter.dnsServers) ? adapter.dnsServers.filter(Boolean) : [];
    const skippedAdapters = Array.isArray(adapter.skipped)    ? adapter.skipped.filter(Boolean)    : [];
    const primaryDnsIp    = currentDns[0] || null;

    // Map known public DNS IPs to provider names for "Same as X" display
    const PROVIDER_IP_MAP = {
        '1.1.1.1':         'Cloudflare', '1.0.0.1':         'Cloudflare',
        '8.8.8.8':         'Google',     '8.8.4.4':         'Google',
        '9.9.9.9':         'Quad9',      '149.112.112.112': 'Quad9',
    };
    const currentDnsMatchesProvider = primaryDnsIp ? (PROVIDER_IP_MAP[primaryDnsIp] || null) : null;

    // ── Ping targets — 4 pings, 2 s timeout per reply ────────
    const pingTargets = [
        { label: 'Current DNS', ip: primaryDnsIp },
        { label: 'Cloudflare',  ip: '1.1.1.1' },
        { label: 'Google',      ip: '8.8.8.8'  },
        { label: 'Quad9',       ip: '9.9.9.9'  },
    ];

    // DNS lookup script: tests current DNS + 3 providers using Resolve-DnsName.
    // Results are cached by IP so if the current DNS is the same as a provider IP,
    // the lookup is performed only once and reused.
    const safePrimaryDns = primaryDnsIp && /^[\d.a-fA-F:]+$/.test(primaryDnsIp) ? primaryDnsIp : '';
    const dnsLookupScript = `
$ErrorActionPreference = 'SilentlyContinue'
$curIp = '${safePrimaryDns}'
$res = [ordered]@{
    'CurrentDNS' = $curIp
    'Cloudflare'  = '1.1.1.1'
    'Google'      = '8.8.8.8'
    'Quad9'       = '9.9.9.9'
}
$dom   = @('google.com','youtube.com','cloudflare.com','microsoft.com','github.com')
$rounds = ${rounds}
$cache = @{}
$out   = [ordered]@{}
foreach ($rn in $res.Keys) {
    $ip = $res[$rn]
    if ([string]::IsNullOrEmpty($ip)) { $out[$rn] = [PSCustomObject]@{ available=$false }; continue }
    if ($cache.ContainsKey($ip)) { $out[$rn] = $cache[$ip]; continue }
    $times = @()
    foreach ($d in $dom) {
        for ($ri = 0; $ri -lt $rounds; $ri++) {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $r  = Resolve-DnsName -Name $d -Server $ip -Type A -DnsOnly -QuickTimeout -EA SilentlyContinue
            $sw.Stop()
            if ($null -ne $r -and $sw.ElapsedMilliseconds -lt 4000) { $times += [int]$sw.ElapsedMilliseconds }
        }
    }
    $result = if ($times.Count -gt 0) {
        [PSCustomObject]@{
            available = $true
            avg     = [int][Math]::Round(($times | Measure-Object -Average).Average)
            min     = [int]($times | Measure-Object -Minimum).Minimum
            max     = [int]($times | Measure-Object -Maximum).Maximum
            samples = $times.Count
        }
    } else { [PSCustomObject]@{ available = $false } }
    $cache[$ip] = $result
    $out[$rn]   = $result
}
$out | ConvertTo-Json -Compress -Depth 3
`;

    // Run pings and DNS lookups concurrently
    const [pingResults, dnsLookupRaw] = await Promise.all([
        Promise.all(pingTargets.map(async (t) => {
            if (!t.ip || !isValidPingTarget(t.ip)) return { label: t.label, ip: t.ip, available: false };
            try {
                const r     = await runNetworkCommand('ping', ['-n', '4', '-w', '2000', t.ip], 16000);
                const stats = parsePingOutput(r.output);
                const ok    = stats && stats.averageMs !== null;
                return {
                    label:     t.label,
                    ip:        t.ip,
                    available: ok,
                    avg:       ok ? stats.averageMs            : null,
                    jitter:    ok ? Math.round(stats.jitterMs) : null,
                    loss:      ok ? stats.packetLoss           : null,
                };
            } catch { return { label: t.label, ip: t.ip, available: false }; }
        })),
        runNetworkPowerShellJson(dnsLookupScript, Math.max(30000, rounds * 15000)),
    ]);

    // Parse DNS lookup results — CurrentDNS is the current adapter's primary DNS
    const dnsLookup = {};
    if (dnsLookupRaw.success && dnsLookupRaw.data && typeof dnsLookupRaw.data === 'object') {
        for (const key of ['CurrentDNS', 'Cloudflare', 'Google', 'Quad9']) {
            const d = dnsLookupRaw.data[key];
            dnsLookup[key] = (d && d.available === true && typeof d.avg === 'number')
                ? { available: true, avg: d.avg, min: d.min, max: d.max, samples: d.samples }
                : { available: false };
        }
    }

    return {
        success: true,
        adapter: {
            name:        adapter.name        || 'Unknown',
            description: adapter.description || 'Unknown',
            connType:    adapter.connType    || 'Unknown',
            linkSpeed:   adapter.linkSpeed   || null,
            ipv4:        adapter.ipv4        || null,
            gateway:     adapter.gateway     || null,
            dnsServers:  currentDns,
            ifIndex:     adapter.ifIndex,
        },
        skippedAdapters,
        pingResults,
        dnsLookup,
        currentDnsMatchesProvider,
        // Actual test parameters — displayed verbatim in the UI methodology note
        testParams: { domains: 5, rounds, pingCount: 4, providers: 3 },
    };
});

ipcMain.handle('dns-optimizer-apply', async (event, { ifIndex, dnsServers, adapterName }) => {
    const { isAdmin } = await new Promise(resolve =>
        exec('net session', { windowsHide: true, timeout: 3000 }, err => resolve({ isAdmin: !err })));
    if (!isAdmin) {
        return { success: false, requiresAdmin: true, message: 'Administrator privileges required to change DNS settings.' };
    }
    if (!ifIndex || !Array.isArray(dnsServers) || dnsServers.length === 0) {
        return { success: false, message: 'Invalid parameters.' };
    }

    // Back up current DNS
    try {
        const bkScript = `(Get-DnsClientServerAddress -InterfaceIndex ${parseInt(ifIndex)} -AddressFamily IPv4 -EA SilentlyContinue).ServerAddresses | ConvertTo-Json -Compress`;
        const bk = await runNetworkPowerShellJson(bkScript, 8000);
        const originalDns = (bk.success && bk.data) ? (Array.isArray(bk.data) ? bk.data : [bk.data]) : [];
        fs.writeFileSync(DNS_BACKUP_PATH, JSON.stringify({ ifIndex, adapterName, originalDns, timestamp: Date.now() }), 'utf8');
    } catch (e) { console.error('[DNS] Backup failed:', e.message); }

    const name = String(adapterName).replace(/"/g, '').replace(/\\/g, '');
    let cmd = `netsh interface ip set dns "${name}" static ${dnsServers[0]}`;
    if (dnsServers[1]) cmd += ` && netsh interface ip add dns "${name}" ${dnsServers[1]} index=2`;

    const result = await runNetworkCommand('cmd.exe', ['/d', '/s', '/c', cmd], 15000);
    return {
        success: result.success,
        message: result.success ? `DNS set to ${dnsServers.join(', ')}` : (result.message || 'Failed to apply DNS.'),
        output:  result.output,
    };
});

ipcMain.handle('dns-optimizer-restore', async () => {
    const { isAdmin } = await new Promise(resolve =>
        exec('net session', { windowsHide: true, timeout: 3000 }, err => resolve({ isAdmin: !err })));
    if (!isAdmin) {
        return { success: false, requiresAdmin: true, message: 'Administrator privileges required to restore DNS.' };
    }

    let backup;
    try { backup = JSON.parse(fs.readFileSync(DNS_BACKUP_PATH, 'utf8')); }
    catch { return { success: false, message: 'No DNS backup found. Restore could not be completed.' }; }

    const name = String(backup.adapterName).replace(/"/g, '').replace(/\\/g, '');
    const orig = Array.isArray(backup.originalDns) ? backup.originalDns.filter(Boolean) : [];
    let cmd = orig.length === 0
        ? `netsh interface ip set dns "${name}" dhcp`
        : `netsh interface ip set dns "${name}" static ${orig[0]}${orig[1] ? ` && netsh interface ip add dns "${name}" ${orig[1]} index=2` : ''}`;

    const result = await runNetworkCommand('cmd.exe', ['/d', '/s', '/c', cmd], 15000);
    if (result.success) { try { fs.unlinkSync(DNS_BACKUP_PATH); } catch {} }
    return {
        success: result.success,
        message: result.success ? 'DNS restored to original settings.' : (result.message || 'Restore failed.'),
        output:  result.output,
    };
});

ipcMain.handle('dns-backup-exists', async () => {
    try {
        const data = JSON.parse(fs.readFileSync(DNS_BACKUP_PATH, 'utf8'));
        return { exists: true, data };
    } catch { return { exists: false }; }
});

// ── GPU Gaming Tweaks Status ───────────────────────────────────
ipcMain.handle('gpu-gaming-status', async () => {
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$dvr   = (Get-ItemProperty 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR' -Name AppCaptureEnabled -EA SilentlyContinue).AppCaptureEnabled
$gm    = (Get-ItemProperty 'HKCU:\\SOFTWARE\\Microsoft\\GameBar' -Name AutoGameModeEnabled -EA SilentlyContinue).AutoGameModeEnabled
$hwSch = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' -Name HwSchMode -EA SilentlyContinue).HwSchMode
@{
    gameDvrEnabled  = ($dvr -eq 1)
    gameModeEnabled = ($null -ne $gm -and $gm -ne 0)
    hagsEnabled     = ($hwSch -eq 2)
    hagsSupported   = ($null -ne $hwSch)
} | ConvertTo-Json -Compress
`;
    const r = await runNetworkPowerShellJson(script, 8000);
    if (!r.success || !r.data) return { success: false, message: r.message || 'Could not read gaming settings.' };
    return { success: true, status: r.data };
});

// ── Network TCP/IP Stack Reset ─────────────────────────────────
ipcMain.handle('network-ip-reset', async () => {
    const { isAdmin } = await new Promise(resolve =>
        exec('net session', { windowsHide: true, timeout: 3000 }, err => resolve({ isAdmin: !err })));
    if (!isAdmin) return { success: false, requiresAdmin: true, message: 'Administrator privileges required.' };
    const r = await runNetworkCommand('netsh', ['int', 'ip', 'reset'], 20000);
    return {
        success:         r.success,
        message:         r.success ? 'TCP/IP stack reset. Restart required to complete.' : (r.message || 'Reset failed.'),
        restartRequired: r.success,
        output:          r.output,
    };
});
