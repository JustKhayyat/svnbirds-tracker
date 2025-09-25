import styles from "../styles/RoyaltySummaryCard.module.css";

function formatCurrency(value, currency) {
  if (value === null || value === undefined) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch (error) {
    return Number(value).toFixed(2);
  }
}

export default function RoyaltySummaryCard({
  label,
  amount,
  currency,
  helperText,
  accent = "slate",
  isLoading = false,
  children,
  className,
}) {
  const accentClass = styles[accent] ?? styles.slate;
  const classes = [styles.card, accentClass, className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      <header className={styles.header}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{isLoading ? "—" : formatCurrency(amount, currency)}</p>
      </header>
      {helperText ? <p className={styles.helper}>{helperText}</p> : null}
      {children ? <div className={styles.content}>{children}</div> : null}
    </section>
  );
}

