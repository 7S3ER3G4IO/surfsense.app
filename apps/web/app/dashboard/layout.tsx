import { Zap, Activity, Settings, FileText, Send } from "lucide-react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold text-lg">Social Autopilot</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Activity className="w-5 h-5" />
            <span>Status</span>
          </Link>
          <Link href="/dashboard/compose" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Send className="w-5 h-5" />
            <span>New Post</span>
          </Link>
          <Link href="/dashboard/logs" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <FileText className="w-5 h-5" />
            <span>Activity Logs</span>
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 text-center">
          v1.0.0 • Connected to Legacy API
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
