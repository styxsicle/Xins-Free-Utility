const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    getFullSystemInfo: () => {
        console.log('[SYSTEM INFO] IPC request starts: preload get-full-system-info');
        return ipcRenderer.invoke('get-full-system-info');
    },
    getLiveStats: () => ipcRenderer.invoke('get-live-stats'),

    applyTweak: (tweakId, action) => ipcRenderer.invoke('apply-tweak', tweakId, action),
    getToggleStates: () => ipcRenderer.invoke('get-toggle-states'),
    saveToggleState: (toggleId, state) => ipcRenderer.invoke('save-toggle-state', toggleId, state),
    runCleanup: (type) => ipcRenderer.invoke('run-cleanup', type),

    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
