import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Layout from "../../components/Layout";
import RoyaltySummaryCard from "../../components/RoyaltySummaryCard";
import StatementTable from "../../components/StatementTable";
import SplitBreakdown from "../../components/SplitBreakdown";
import styles from "../../styles/ArtistDashboard.module.css";

const expectedTokenHint =
  process.env.NEXT_PUBLIC_ARTIST_PORTAL_TOKEN?.slice(0, 4) ?? "";

const fetcher = async ([url, token]) => {
  const response = await fetch(url, {
    headers: {
      "x-artist-token": token,
    },
  });

  if (!response.ok) {
    let message = "Unable to load dashboard data.";
    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch (error) {
      // ignore JSON parse error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
};

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export default function ArtistDashboardPage() {
  const [formState, setFormState] = useState({
    collaboratorId: "",
    payeeReference: "",
    token: "",
  });
  const [activeAuth, setActiveAuth] = useState(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("artist-dashboard-auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setFormState((prev) => ({
          ...prev,
          ...parsed,
        }));
        setActiveAuth(parsed);
      } catch (error) {
        // ignore corrupted payloads
      }
    }
  }, []);

  const isAuthenticated = Boolean(
    activeAuth?.token && (activeAuth?.collaboratorId || activeAuth?.payeeReference)
  );

  const queryString = useMemo(() => {
    if (!isAuthenticated) return null;
    const params = new URLSearchParams();
    if (activeAuth?.collaboratorId) {
      params.set("collaboratorId", activeAuth.collaboratorId);
    }
    if (activeAuth?.payeeReference) {
      params.set("payeeReference", activeAuth.payeeReference);
    }
    return `/api/artist/dashboard?${params.toString()}`;
  }, [activeAuth, isAuthenticated]);

  const { data, error, isValidating, mutate } = useSWR(
    isAuthenticated && queryString ? [queryString, activeAuth.token] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const currency = data?.summary?.currency ?? "USD";

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formState.token.trim()) {
      setFormError("Enter your artist access token to continue.");
      return;
    }
    if (!formState.collaboratorId.trim() && !formState.payeeReference.trim()) {
      setFormError("Provide a collaborator ID or payee reference.");
      return;
    }

    const payload = {
      token: formState.token.trim(),
      collaboratorId: formState.collaboratorId.trim(),
      payeeReference: formState.payeeReference.trim(),
    };

    setActiveAuth(payload);
    setFormError("");
    if (typeof window !== "undefined") {
      window.localStorage.setItem("artist-dashboard-auth", JSON.stringify(payload));
    }
  };

  const handleSignOut = () => {
    setActiveAuth(null);
    setFormError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("artist-dashboard-auth");
    }
  };

  const upcomingPayouts = data?.summary?.upcomingPayouts ?? [];

  return (
    <Layout>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>Artist Royalty Dashboard</h1>
            <p className={styles.subtitle}>
              Review your balances, upcoming payouts, and statements in one place.
            </p>
          </div>
          {isAuthenticated ? (
            <div className={styles.sessionControls}>
              <p className={styles.sessionMeta}>
                Viewing data for {data?.collaborator?.name || "your account"}
              </p>
              <button type="button" onClick={handleSignOut} className={styles.secondaryButton}>
                Sign out
              </button>
              <button
                type="button"
                onClick={() => mutate()}
                className={styles.refreshButton}
                disabled={isValidating}
              >
                {isValidating ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          ) : null}
        </header>

        {!isAuthenticated ? (
          <section className={styles.authCard}>
            <h2>Secure artist access</h2>
            <p>
              Enter the collaborator ID or payee reference provided by the label together with
              your access token. Tokens typically begin with
              {expectedTokenHint ? ` “${expectedTokenHint}”` : " a label-issued prefix"}.
            </p>
            <form className={styles.authForm} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span>Collaborator ID</span>
                <input
                  name="collaboratorId"
                  placeholder="e.g. seed-collaborator-1"
                  value={formState.collaboratorId}
                  onChange={handleInputChange}
                />
              </label>
              <label className={styles.field}>
                <span>Payee reference</span>
                <input
                  name="payeeReference"
                  placeholder="e.g. PAYEE-1001"
                  value={formState.payeeReference}
                  onChange={handleInputChange}
                />
              </label>
              <label className={styles.field}>
                <span>Artist access token</span>
                <input
                  name="token"
                  value={formState.token}
                  onChange={handleInputChange}
                  placeholder="Paste the token shared with you"
                  type="password"
                  required
                />
              </label>
              {formError ? <p className={styles.error}>{formError}</p> : null}
              <button type="submit" className={styles.primaryButton}>
                Launch dashboard
              </button>
            </form>
          </section>
        ) : null}

        {isAuthenticated ? (
          <>
            <section className={styles.summaryGrid}>
              <RoyaltySummaryCard
                label="Total earned"
                amount={data?.summary?.totalEarned}
                currency={currency}
                accent="emerald"
                isLoading={!data && isValidating}
              />
              <RoyaltySummaryCard
                label="Paid out"
                amount={data?.summary?.totalPaid}
                currency={currency}
                accent="sky"
                helperText="Cleared to your account"
                isLoading={!data && isValidating}
              />
              <RoyaltySummaryCard
                label="Outstanding"
                amount={data?.summary?.outstandingBalance}
                currency={currency}
                accent="amber"
                helperText="Pending payment"
                isLoading={!data && isValidating}
              />
            </section>

            <section className={styles.columns}>
              <div className={styles.columnPrimary}>
                <div className={styles.sectionHeader}>
                  <h2>Upcoming payouts</h2>
                </div>
                {upcomingPayouts.length ? (
                  <ul className={styles.upcomingList}>
                    {upcomingPayouts.map((item) => (
                      <li key={item.id}>
                        <div>
                          <p className={styles.upcomingTitle}>{item.releaseTitle}</p>
                          <p className={styles.upcomingMeta}>
                            {item.trackTitle || "Unassigned track"} • {item.service || "Unknown service"}
                          </p>
                        </div>
                        <div className={styles.upcomingAmount}>
                          <span>{formatCurrency(item.amount, currency)}</span>
                          <span className={styles.upcomingStatus}>{item.payoutStatus}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyState}>No pending payouts at the moment.</p>
                )}

                <div className={styles.sectionHeader}>
                  <h2>Statements</h2>
                </div>
                <StatementTable statements={data?.statements ?? []} currency={currency} />
              </div>

              <aside className={styles.columnSecondary}>
                <div className={styles.collaboratorCard}>
                  <h2>Collaborator profile</h2>
                  <dl>
                    <div>
                      <dt>Name</dt>
                      <dd>{data?.collaborator?.name || "—"}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{data?.collaborator?.role || "—"}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{data?.collaborator?.email || "—"}</dd>
                    </div>
                    <div>
                      <dt>Payee reference</dt>
                      <dd>{data?.collaborator?.payeeReference || "—"}</dd>
                    </div>
                  </dl>
                  <p className={styles.asOf}>Balances as of {formatDateTime(data?.asOf)}</p>
                </div>

                <div className={styles.agreementsCard}>
                  <h2>Active agreements</h2>
                  {data?.agreements?.length ? (
                    <ul>
                      {data.agreements.map((agreement) => (
                        <li key={agreement.id}>
                          <p className={styles.agreementTitle}>
                            {agreement.release?.title || agreement.releaseId || "Unassigned release"}
                          </p>
                          <p className={styles.agreementMeta}>
                            {agreement.agreementType || "Split"} • {agreement.sharePercentage || 0}% share
                          </p>
                          <p className={styles.agreementMeta}>
                            Effective {formatDateTime(agreement.effectiveDate) || "n/a"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyState}>No agreements on file.</p>
                  )}
                </div>
              </aside>
            </section>

            <section className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <h2>Release breakdown</h2>
                <p>Drill into each release to see how usage is translating to earnings.</p>
              </div>
              <SplitBreakdown releases={data?.releases ?? []} currency={currency} />
            </section>

            {error ? <p className={styles.errorBanner}>{error.message}</p> : null}
          </>
        ) : null}

        {error && !isAuthenticated ? (
          <p className={styles.errorBanner}>{error.message}</p>
        ) : null}
      </div>
    </Layout>
  );
}

