export default function OfflinePage() {
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center bg-black text-center px-6 font-sans select-none">
      <p className="font-mono text-[#E50914] text-sm mb-2">/// NO CONNECTION</p>
      <h1 className="text-white text-2xl font-semibold mb-2">You're offline</h1>
      <p className="text-[#a3a3a3] max-w-sm mb-6 text-sm leading-relaxed font-sans">
        Quark still has your local message history and downloaded files. Live
        peer connections will resume once you're back on a network.
      </p>
      <a
        href="/"
        className="bg-[#E50914] hover:bg-[#f40612] text-white px-5 py-2 rounded text-sm font-medium transition-colors"
      >
        View local history
      </a>
    </main>
  );
}
