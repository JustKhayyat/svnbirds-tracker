import Link from "next/link";
import styles from "../styles/Home.module.css";

export default function Layout({ children }) {
  const showAdminLink = Boolean(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.logo}>SVNBIRDS Tracker</h1>
        <nav className={styles.nav}>
          <Link href="/">Home</Link>
          <Link href="/artist/dashboard">Artist Dashboard</Link>
          {showAdminLink ? <Link href="/royalties/import">Royalties Import</Link> : null}
          <a href="https://open.spotify.com/" target="_blank" rel="noreferrer">
            Spotify
          </a>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} SVNBIRDS Records</p>
      </footer>
    </div>
  );
}
