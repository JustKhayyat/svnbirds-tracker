import { useState } from "react";
import styles from "../styles/SplitBreakdown.module.css";

function formatCurrency(value, currency) {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(Number(value));
  } catch (error) {
    return Number(value).toFixed(2);
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status) {
  const key = typeof status === "string" ? status.toLowerCase() : "";
  if (key === "paid") return styles.statusPaid;
  if (key === "processing") return styles.statusProcessing;
  return styles.statusPending;
}

export default function SplitBreakdown({ releases = [], currency }) {
  const [expanded, setExpanded] = useState(() =>
    releases.length ? releases[0].id || releases[0].title : null
  );

  if (!releases.length) {
    return <p className={styles.empty}>No release-level splits have been captured yet.</p>;
  }

  return (
    <div className={styles.grid}>
      {releases.map((release) => {
        const releaseKey = release.id || release.title;
        const isExpanded = expanded === releaseKey;
        const toggle = () => setExpanded(isExpanded ? null : releaseKey);

        return (
          <article key={releaseKey} className={styles.card}>
            <button type="button" className={styles.summary} onClick={toggle}>
              <div>
                <h3>{release.title}</h3>
                <p className={styles.meta}>
                  {release.primaryArtist ? `${release.primaryArtist} • ` : ""}
                  {release.releaseDate ? formatDate(release.releaseDate) : "No release date"}
                </p>
                {typeof release.agreementShare === "number" ? (
                  <p className={styles.meta}>Your contracted share: {release.agreementShare}%</p>
                ) : null}
              </div>
              <div className={styles.totals}>
                <span>{formatCurrency(release.totalEarned, currency)}</span>
                <small>Earned</small>
              </div>
            </button>
            {isExpanded ? (
              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <div>
                    <p className={styles.detailLabel}>Paid out</p>
                    <p className={styles.detailValue}>
                      {formatCurrency(release.totalPaid, currency)}
                    </p>
                  </div>
                  <div>
                    <p className={styles.detailLabel}>Outstanding</p>
                    <p className={styles.detailValue}>
                      {formatCurrency(release.outstandingBalance, currency)}
                    </p>
                  </div>
                </div>
                {release.splits.length ? (
                  <ul className={styles.splitList}>
                    {release.splits.map((split) => (
                      <li key={split.id} className={styles.splitItem}>
                        <div>
                          <p className={styles.trackTitle}>{split.trackTitle || "Unlabeled track"}</p>
                          <p className={styles.splitMeta}>
                            {split.service || "Unknown service"} • {formatDate(split.usageDate)}
                            {typeof split.sharePercentage === "number"
                              ? ` • ${split.sharePercentage}%`
                              : ""}
                          </p>
                        </div>
                        <div className={styles.splitAmount}>
                          <span>{formatCurrency(split.amount, currency)}</span>
                          <span className={`${styles.status} ${statusBadge(split.payoutStatus)}`}>
                            {split.payoutStatus || "pending"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.noSplits}>No usage lines recorded yet.</p>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

