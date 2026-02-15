import { contextBridge, ipcRenderer } from "electron";

console.log("[Preload] Script loaded successfully");

const api = {
  isSetup: () => ipcRenderer.invoke("nami:is-setup"),
  unlock: (pass) => ipcRenderer.invoke("nami:unlock", pass),
  lock: () => ipcRenderer.invoke("nami:lock"),
  getNetworks: () => ipcRenderer.invoke("nami:get-networks"),
  loginOpen: (net) => ipcRenderer.invoke("nami:login-open", net),
  loginCapture: (net) => ipcRenderer.invoke("nami:login-capture", net),
  setConfig: (cfg) => ipcRenderer.invoke("nami:set-config", cfg),
  getStatus: () => ipcRenderer.invoke("nami:get-status"),
  autoPublish: () => ipcRenderer.invoke("nami:auto-publish"),
  importCookies: (obj) => ipcRenderer.invoke("nami:import-cookies", obj),
  openPermissions: () => ipcRenderer.invoke("nami:open-permissions"),
  updateApp: () => ipcRenderer.invoke("nami:update-app"),
  resetPass: () => ipcRenderer.invoke("nami:reset-pass"),
  forcePermission: () => ipcRenderer.invoke("nami:force-permission"),
  clearCookies: () => ipcRenderer.invoke("nami:clear-cookies"),
  extStatus: () => ipcRenderer.invoke("nami:ext-status"),
  aiGenerateHook: (topic) => ipcRenderer.invoke("nami:ai-hook", topic),
  aiGenerateScript: (topic) => ipcRenderer.invoke("nami:ai-script", topic),
  on: (channel, func) => {
    const channelMap = {
      'networks-updated': 'nami:networks-updated',
      'permissions-updated': 'nami:permissions-updated',
      'permission-stuck': 'nami:permission-stuck',
      'close-permission-alert': 'nami:close-permission-alert',
      'log': 'nami:log',
      'task-result': 'nami:task-result',
      'ext-status-change': 'nami:ext-status-change'
    };
    const fullChannel = channelMap[channel] || channel;
    const validChannels = Object.values(channelMap);
    
    if (validChannels.includes(fullChannel)) {
      // Remove old listeners to avoid duplicates if re-registered
      ipcRenderer.removeAllListeners(fullChannel);
      ipcRenderer.on(fullChannel, (event, ...args) => func(...args));
    }
  }
};

try {
  contextBridge.exposeInMainWorld("nami", api);
  console.log("[Preload] Exposed via contextBridge");
} catch (e) {
  console.log("[Preload] contextBridge failed, attaching to window");
  window.nami = api;
}
