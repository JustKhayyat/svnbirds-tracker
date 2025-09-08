import styles from "../styles/Home.module.css";

export default function Layout({ children }) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.logo}>SVNBIRDS Tracker</h1>
        <nav className={styles.nav}>
          <a href="/">Home</a>
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
