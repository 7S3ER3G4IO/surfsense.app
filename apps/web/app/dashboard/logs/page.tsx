"use client";

import { useState, useEffect } from "react";
import { RefreshCw, FileText, Calendar, Search } from "lucide-react";

type LogEntry = {
  id: number;
  spot_name: string;
  ip: string;
  ts: string;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      setAdminToken(token);
      fetchLogs(token);
    }
  }, []);

  const fetchLogs = async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Default to last 24h
      const end = new Date().toISOString();
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const res = await fetch(`/api/admin/logs/range?token=${token}&start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      
      const data = await res.json();
      setLogs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (ts: string) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
           <p className="text-gray-500 dark:text-gray-400">Recent user interactions and spot clicks</p>
        </div>
        <button 
          onClick={() => fetchLogs(adminToken)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-medium uppercase text-xs">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Spot Name</th>
                <th className="px-6 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-400">#{log.id}</td>
                    <td className="px-6 py-4">{formatTime(log.ts)}</td>
                    <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{log.spot_name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{log.ip}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    {isLoading ? "Loading logs..." : "No logs found for the last 24 hours."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
