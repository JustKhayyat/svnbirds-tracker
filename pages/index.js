import Link from "next/link";
import styles from "../styles/Home.module.css";

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
    link: "/vault", // Changed from "#" to "/vault"
  },
];

export default function Dashboard() {
  const renderModuleCard = (module) => {
    return (
      <Link key={module.name} href={module.link} className={styles.module}>
        <h3>{module.name}</h3>
        <p>{module.description}</p>
      </Link>
    );
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
            <p>Internal label operations and financial management.</p>
          </div>
          <div className={styles.modulesContainer}>
            {adminModules.map((module) => renderModuleCard(module))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>© 2026 SVNBIRDS Records</footer>
    </div>
  );
}
