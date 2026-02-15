const { contextBridge, ipcRenderer } = require("electron");

console.log("[Preload] Script loaded successfully (CJS)");

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
  extQueue: (cmd) => ipcRenderer.invoke("nami:ext-queue", cmd),
  extStatus: () => ipcRenderer.invoke("nami:ext-status"),
  getScheduledPosts: () => ipcRenderer.invoke("nami:get-scheduled-posts"),
  addScheduledPost: (post) => ipcRenderer.invoke("nami:add-scheduled-post", post),
  on: (channel, func) => {
    const validChannels = ["nami:permissions-updated", "nami:networks-updated", "nami:permission-stuck", "nami:close-permission-alert", "nami:extension-heartbeat", "nami:task-result", "nami:ext-status-change", "nami:helper-status", "nami:log"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
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
