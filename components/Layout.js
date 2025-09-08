import Link from "next/link";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-inter">
      {/* Navbar */}
      <nav className="bg-black border-b border-gray-800">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4">
          <Link href="/" className="text-2xl font-bebas tracking-wide text-white">
            SVNBIRDS TRACKER
          </Link>
          <div className="space-x-6 text-sm uppercase">
            <Link href="/" className="hover:text-gray-400">
              Home
            </Link>
            <Link href="/artist" className="hover:text-gray-400">
              Artist Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 text-gray-500 text-center py-4 mt-8 text-sm">
        <p>© {new Date().getFullYear()} SVNBIRDS Records</p>
      </footer>
    </div>
  );
}
