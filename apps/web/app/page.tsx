import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Social Autopilot</h1>
      <p className="text-xl text-gray-400 mb-8">
        La plateforme d'automatisation intelligente pour le surf.
      </p>
      <Link 
        href="/dashboard" 
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
      >
        Accéder au Dashboard
      </Link>
    </div>
  );
}
