import Head from "next/head";

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>SVNBIRDS Tracker</title>
        <meta name="description" content="Track your favorite Spotify artists with SVNBIRDS" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen flex flex-col bg-gray-900 text-white font-sans">
        {/* Navbar */}
        <nav className="bg-black shadow-md">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bebas">SVNBIRDS</h1>
            <div className="space-x-4">
              <a href="/" className="hover:text-yellow-500 transition">Home</a>
              <a href="/artist" className="hover:text-yellow-500 transition">Artist</a>
              <a href="https://svnbirds.com" target="_blank" rel="noreferrer" className="hover:text-yellow-500 transition">Label</a>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-black mt-auto py-6">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} SVNBIRDS. All rights reserved.</p>
            <div className="space-x-4 mt-2 md:mt-0">
              <a href="https://twitter.com/svnbirds" target="_blank" rel="noreferrer" className="hover:text-yellow-500 transition">Twitter</a>
              <a href="https://instagram.com/svnbirds" target="_blank" rel="noreferrer" className="hover:text-yellow-500 transition">Instagram</a>
              <a href="https://facebook.com/svnbirds" target="_blank" rel="noreferrer" className="hover:text-yellow-500 transition">Facebook</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
