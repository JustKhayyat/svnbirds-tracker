import { useState } from "react";
import Link from "next/link";
import styles from "../styles/Home.module.css";

export default function Dashboard() {
  const [activeModule, setActiveModule] = useState(null);

  const modules = [
    { 
      name: "BIRDEYE", 
      description: "Track Spotify artists with full details.", 
      link: "/birdeye" 
    },
    { 
      name: "RELEASES", 
      description: "View and manage upcoming releases.", 
      link: "#" 
    },
    { 
      name: "MERCH", 
      description: "Manage merchandise and sales.", 
      link: "#" 
    },
    { 
      name: "TASKS", 
      description: "Track tasks and deadlines for your team.", 
      link: "#" 
    },
    { 
      name: "VAULT", 
      description: "Securely store important assets.", 
      link: "#" 
    },
  ];

  const handleModuleClick = (mod) => {
    if (mod.link !== "#") {
      window.location.href = mod.link; // Open module page directly
    } else {
      setActiveModule(mod.name);
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <h1>SVNBIRDS CENTRAL</h1>
      </header>

      {/* Main Modules Area */}
      <main className={styles.main}>
        <div className={styles.modulesContainer}>
          {modules.map((mod) => (
            <div
              key={mod.name}
              className={styles.module}
              onClick={() => handleModuleClick(mod)}
            >
              <h2>{mod.name}</h2>
              <p>{mod.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>© 2025 SVNBIRDS Records</footer>
    </div>
  );
}
