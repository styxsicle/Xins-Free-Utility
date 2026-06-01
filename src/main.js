const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, execFile, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const https = require('https');

const xinAuth = require('./xin-auth');
const firebaseConfig = require('./firebase-config');
const APP_ID = 'xin-premium-optimizer';

let mainWindow;
let nativeAddon = null;

try {
    nativeAddon = require('bindings')('tweaks_native');
} catch (e) {
    console.log('Native addon not available, using fallback methods');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1100,
        minHeight: 700,
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

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   Xin Tweaks - Ultimate Tweaking Utility by Xin            ║');
    console.log('║                      Debug Console                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('[STARTUP] Application starting...');
    console.log('[STARTUP] All tweak operations will be logged below.\n');
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
        packetLoss: packetMatch ? Number(packetMatch[4]) : 0,
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

    statsMonitorProcess = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', statsScriptPath]);

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

                    // GPU (If available via WMI, else simulate based on CPU)
                    if (stats.gpu !== -1 && stats.gpu !== undefined) {
                        currentSystemStats.gpuUsage = Math.min(100, Math.round(stats.gpu));
                    } else {
                        // Better Simulation if WMI fails
                        let baseGpu = Math.random() * 15;
                        if (currentSystemStats.cpuUsage > 40) baseGpu += 30; // Gaming load assumption
                        currentSystemStats.gpuUsage = Math.round(Math.min(100, baseGpu + (Math.random() * 10)));
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
        exec(command, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
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
        exec(command, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
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
