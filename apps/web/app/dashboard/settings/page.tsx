"use client";

import { useState, useEffect } from "react";
import { Save, RefreshCw, AlertTriangle, CheckCircle, Clock, Hash, Globe, Shield, Activity } from "lucide-react";

type ConnectorConfig = {
  enabled: boolean;
  webhook?: string;
  profileUrl?: string;
  format?: string;
};

type MarketingConfig = {
  channels: string[];
  webhookUrl: string;
  intervalMinutes: number;
  template: string;
  contentType: "story" | "classic" | "video";
  autopostEnabled: boolean;
  autopostVideoReelsTikTokDefault: boolean;
  hashtags: string[];
  networkIntervals: Record<string, number>;
  antiBot: {
    jitterMin: number;
    jitterMax: number;
  };
  connectors: Record<string, ConnectorConfig>;
  email?: string;
};

export default function SettingsPage() {
  const [config, setConfig] = useState<MarketingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      setAdminToken(token);
      fetchConfig(token);
    } else {
      setError("Admin token missing. Please go to dashboard home and enter your token.");
    }
  }, []);

  const fetchConfig = async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/marketing/config", {
        headers: { "Content-Type": "application/json" } // Token is usually passed via cookie or header in legacy, but let's try standard fetch
        // Note: Legacy requires cookie 'admin_session' or query param '?token='.
        // Let's retry with token in query if cookie fails.
      });

      if (res.status === 403) {
         // Retry with token in query
         const res2 = await fetch(`/api/admin/marketing/config?token=${token}`);
         if (!res2.ok) throw new Error("Access denied. Invalid token.");
         const data = await res2.json();
         setConfig(data);
         return;
      }

      if (!res.ok) throw new Error("Failed to fetch configuration");
      const data = await res.json();
      setConfig(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem("admin_token") || adminToken;
      const res = await fetch(`/api/admin/marketing/config?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (!res.ok) throw new Error("Failed to save configuration");
      
      setSuccess("Configuration saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConnector = (network: string, field: keyof ConnectorConfig, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      connectors: {
        ...config.connectors,
        [network]: {
          ...config.connectors[network],
          [field]: value
        }
      }
    });
  };

  if (!config && isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading configuration...</div>;
  }

  if (!config && error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl border border-red-200">
        <h3 className="font-bold">Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
           <p className="text-gray-500 dark:text-gray-400">Configure automation rules and network connectors</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => fetchConfig(adminToken)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                title="Refresh"
            >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-medium disabled:opacity-50 shadow-sm"
            >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
            </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {config && (
        <>
            {/* Global Automation Settings */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-semibold text-lg">Global Automation</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Global Interval (minutes)</label>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <input 
                                    type="number" 
                                    value={config.intervalMinutes} 
                                    onChange={(e) => setConfig({...config, intervalMinutes: parseInt(e.target.value) || 60})}
                                    className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Base frequency for automated checks and posts.</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div>
                                <span className="block font-medium">Autopost Enabled</span>
                                <span className="text-xs text-gray-500">Allow system to post automatically</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={config.autopostEnabled} 
                                    onChange={(e) => setConfig({...config, autopostEnabled: e.target.checked})}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div>
                                <span className="block font-medium">Video/Reels Default</span>
                                <span className="text-xs text-gray-500">Prefer video content for autoposts</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={config.autopostVideoReelsTikTokDefault} 
                                    onChange={(e) => setConfig({...config, autopostVideoReelsTikTokDefault: e.target.checked})}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium mb-1">Webhook URL</label>
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    value={config.webhookUrl || ""} 
                                    onChange={(e) => setConfig({...config, webhookUrl: e.target.value})}
                                    className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm font-mono"
                                    placeholder="https://hooks.slack.com/..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Global Hashtags</label>
                            <div className="flex items-start gap-2">
                                <Hash className="w-4 h-4 text-gray-400 mt-2" />
                                <textarea 
                                    value={config.hashtags.join(", ")} 
                                    onChange={(e) => setConfig({...config, hashtags: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                                    className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm h-24"
                                    placeholder="surf, ocean, waves..."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Anti-Bot Settings */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                 <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <h2 className="font-semibold text-lg">Anti-Bot Protection</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-medium mb-1">Jitter Minimum (minutes)</label>
                        <input 
                            type="number" 
                            value={config.antiBot.jitterMin} 
                            onChange={(e) => setConfig({...config, antiBot: {...config.antiBot, jitterMin: parseInt(e.target.value)}})}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Minimum random delay added to interval.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Jitter Maximum (minutes)</label>
                        <input 
                            type="number" 
                            value={config.antiBot.jitterMax} 
                            onChange={(e) => setConfig({...config, antiBot: {...config.antiBot, jitterMax: parseInt(e.target.value)}})}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Maximum random delay added to interval.</p>
                    </div>
                </div>
            </section>

            {/* Network Connectors */}
            <section>
                <h2 className="text-xl font-bold mb-4 px-1">Network Connectors</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(config.connectors).map(([network, conn]) => (
                        <div key={network} className={`p-6 rounded-xl border ${conn.enabled ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold capitalize text-lg">{network}</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={conn.enabled} 
                                        onChange={(e) => updateConnector(network, "enabled", e.target.checked)}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            
                            <div className={`space-y-3 transition-opacity ${conn.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <div>
                                    <label className="block text-xs font-medium mb-1 uppercase text-gray-500">Webhook / Endpoint</label>
                                    <input 
                                        type="text" 
                                        value={conn.webhook || ""} 
                                        onChange={(e) => updateConnector(network, "webhook", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                                        placeholder={`Webhook for ${network}...`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 uppercase text-gray-500">Profile URL</label>
                                    <input 
                                        type="text" 
                                        value={conn.profileUrl || ""} 
                                        onChange={(e) => updateConnector(network, "profileUrl", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                                        placeholder={`https://${network}.com/...`}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </>
      )}
    </div>
  );
}
