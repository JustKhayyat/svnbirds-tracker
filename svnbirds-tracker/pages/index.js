import { useState } from "react";
import Link from "next/link";
import styles from "../styles/Home.module.css";

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";

const rosterModules = [
  {
    name: "BIRDEYE",
    description: "Track Spotify artists with full details.",
    link: "/birdeye",
  },
  {
    name: "RELEASES",
    description: "View and manage upcoming releases.",
    link: "/releases",
  },
  {
    name: "MERCH",
    description: "Manage merchandise and sales.",
    link: "/merch",
  },
  {
    name: "TASKS",
    description: "Track tasks and deadlines for your team.",
    link: "/tasks",
  },
  {
    name: "ARTIST ROYALTIES",
    description: "View your statements, balances, and splits.",
    link: "/artist/dashboard",
  },
];

const adminModules = [
  {
    name: "ROYALTIES IMPORT",
    description: "Import distributor statements and reconcile payouts.",
    link: "/royalties/import",
  },
  {
    name: "VAULT",
    description: "Securely store important assets.",
    link: "#",
  },
];

export default function Dashboard() {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [adminAccessGranted, setAdminAccessGranted] = useState(false);
  const [adminError, setAdminError] = useState("");

  const renderModuleCard = (module, { locked = false } = {}) => {
    const content = (
      <>
        <h3>{module.name}</h3>
        <p>{module.description}</p>
        {locked ? <span className={styles.moduleBadge}>Locked</span> : null}
      </>
    );

    if (locked || module.link === "#") {
      return (
        <div key={module.name} className={`${styles.module} ${locked ? styles.moduleLocked : ""}`}>
          {content}
        </div>
      );
    }

    return (
      <Link key={module.name} href={module.link} className={styles.module}>
        {content}
      </Link>
    );
  };

  const handleAdminToggle = () => {
    if (adminAccessGranted) {
      setAdminAccessGranted(false);
    }
    setShowAdminForm((prev) => !prev);
    setAdminError("");
  };

  const handleAdminUnlock = (event) => {
    event.preventDefault();
    if (!ADMIN_TOKEN) {
      setAdminError("Admin token not configured. Set NEXT_PUBLIC_ADMIN_TOKEN to enable access.");
      return;
    }
    if (adminTokenInput.trim() === ADMIN_TOKEN) {
      setAdminAccessGranted(true);
      setAdminError("");
      setAdminTokenInput("");
      setShowAdminForm(false);
    } else {
      setAdminError("Invalid admin token.");
    }
  };

  const handleAdminSignOut = () => {
    setAdminAccessGranted(false);
    setAdminTokenInput("");
    setAdminError("");
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>SVNBIRDS CENTRAL</h1>
        <p className={styles.tagline}>Pick a module to jump into your roster or label workflows.</p>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Roster tools</h2>
            <p>Everything artists and managers need day-to-day.</p>
          </div>
          <div className={styles.modulesContainer}>
            {rosterModules.map((module) => renderModuleCard(module))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Admin tools</h2>
            {adminAccessGranted ? (
              <button type="button" className={styles.adminButton} onClick={handleAdminSignOut}>
                Sign out
              </button>
            ) : (
              <button type="button" className={styles.adminButton} onClick={handleAdminToggle}>
                {showAdminForm ? "Hide" : "Admin sign-in"}
              </button>
            )}
          </div>

          {showAdminForm && !adminAccessGranted ? (
            <form className={styles.adminForm} onSubmit={handleAdminUnlock}>
              <input
                type="password"
                placeholder="Enter admin token"
                value={adminTokenInput}
                onChange={(event) => setAdminTokenInput(event.target.value)}
              />
              <button type="submit">Unlock</button>
              {adminError ? <p className={styles.adminError}>{adminError}</p> : null}
            </form>
          ) : null}

          <div className={styles.modulesContainer}>
            {adminModules.map((module) =>
              renderModuleCard(module, { locked: !adminAccessGranted })
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>© 2025 SVNBIRDS Records</footer>
    </div>
  );
}
