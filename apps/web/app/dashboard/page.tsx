"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Key, Server, Activity } from "lucide-react";

type RobotStatus = {
  status: string;
  details: string;
  icon: string;
  time: number;
};

type MarketingStatus = {
  running: boolean;
  intervalMinutes: number;
  nextRunAt: number;
  lastRunAt: number;
  failureCount: number;
  reason: string;
};

export default function DashboardPage() {
  const [robots, setRobots] = useState<Record<string, RobotStatus>>({});
  const [marketing, setMarketing] = useState<MarketingStatus | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) setAdminToken(token);
    else setShowTokenInput(true);
  }, []);

  const saveToken = () => {
    localStorage.setItem("admin_token", adminToken);
    setShowTokenInput(false);
    fetchStatus();
  };

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem("admin_token") || adminToken;
    
    try {
      // Fetch Robots
      const resRobots = await fetch("/api/admin/robots/snapshot?token=" + token, {
        method: "POST", // Legacy server uses POST for snapshot but expects token in query or body
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }) 
      });
      
      if (resRobots.status === 403) throw new Error("Invalid Admin Token");
      if (!resRobots.ok) throw new Error("Failed to fetch robots");
      
      const robotsData = await resRobots.json();
      setRobots(robotsData);

      // Fetch Marketing Status
      const resMarketing = await fetch("/api/admin/marketing/status?token=" + token);
      if (resMarketing.ok) {
        const marketingData = await resMarketing.json();
        setMarketing(marketingData);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not connect to API.";
      setError(message);
      if (message === "Invalid Admin Token") setShowTokenInput(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) fetchStatus();
  }, [adminToken]);

  const formatTime = (ts: number) => {
    if (!ts) return "Never";
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-gray-500 dark:text-gray-400">Real-time monitoring of automation bots</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowTokenInput(!showTokenInput)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors text-sm"
          >
            <Key className="w-4 h-4" />
            {showTokenInput ? "Hide Token" : "Token"}
          </button>
          <button 
            onClick={fetchStatus}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors text-sm font-medium disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {showTokenInput && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <label className="block text-sm font-medium mb-1">Admin Token</label>
          <div className="flex gap-2">
            <input 
              type="password" 
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent"
              placeholder="Enter your admin token..."
            />
            <button onClick={saveToken} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">Save</button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Marketing Status Card */}
      {marketing && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${marketing.running ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Marketing Automator</h3>
                <p className="text-sm text-gray-500">
                  {marketing.running ? "Running" : "Stopped"} • Interval: {marketing.intervalMinutes}m
                </p>
              </div>
            </div>
            <div className="text-right">
               <div className="text-sm text-gray-500">Next Run</div>
               <div className="font-mono font-medium">{formatTime(marketing.nextRunAt)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
             <div>
               <div className="text-xs text-gray-500 uppercase">Last Run</div>
               <div className="font-medium">{formatTime(marketing.lastRunAt)}</div>
             </div>
             <div>
               <div className="text-xs text-gray-500 uppercase">Failures</div>
               <div className={`font-medium ${marketing.failureCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{marketing.failureCount}</div>
             </div>
             <div>
               <div className="text-xs text-gray-500 uppercase">Status</div>
               <div className="font-medium capitalize">{marketing.reason.replace('_', ' ')}</div>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(robots).map(([name, bot]) => (
          <div key={name} className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{bot.icon}</span>
                <h3 className="font-semibold text-lg truncate" title={name}>{name}</h3>
              </div>
              {bot.status === "OK" ? <CheckCircle className="w-5 h-5 text-green-500" /> : 
               bot.status === "ERROR" ? <XCircle className="w-5 h-5 text-red-500" /> : 
               <AlertTriangle className="w-5 h-5 text-yellow-500" />}
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                  bot.status === "OK" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : 
                  bot.status === "ERROR" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : 
                  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}>
                  {bot.status}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Updated</span>
                <span className="font-medium text-xs">{formatTime(bot.time)}</span>
              </div>
              
              {bot.details && (
                <div className="mt-3 text-xs p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700">
                  {bot.details}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {Object.keys(robots).length === 0 && !isLoading && !error && (
           <div className="col-span-full p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
             <Server className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p>No robot status available. Check if the backend is running.</p>
           </div>
        )}
      </div>
    </div>
  );
}
