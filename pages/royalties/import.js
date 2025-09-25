import { useEffect, useRef, useState } from 'react';

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function formatCurrency(value, currency) {
  if (value === null || value === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value));
  } catch (error) {
    return Number(value).toFixed(2);
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function RoyaltiesImportPage() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);
  const [lastWarnings, setLastWarnings] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const tokenMissing = !ADMIN_TOKEN;

  useEffect(() => {
    if (tokenMissing) {
      setHistory([]);
      setHistoryError('Admin token not configured. Set NEXT_PUBLIC_ADMIN_TOKEN to load history.');
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch('/api/royalties/import', {
          headers: {
            'x-admin-token': ADMIN_TOKEN,
          },
        });
        if (!response.ok) {
          throw new Error('Unable to load import history.');
        }
        const payload = await response.json();
        if (!isMounted) return;
        setHistory(payload.history || []);
        setHistoryError('');
      } catch (error) {
        if (!isMounted) return;
        setHistory([]);
        setHistoryError(error.message);
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
        }
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [tokenMissing]);

  const refreshHistory = async () => {
    if (tokenMissing) return;
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/royalties/import', {
        headers: {
          'x-admin-token': ADMIN_TOKEN,
        },
      });
      if (!response.ok) {
        throw new Error('Unable to refresh import history.');
      }
      const payload = await response.json();
      setHistory(payload.history || []);
      setHistoryError('');
    } catch (error) {
      setHistory([]);
      setHistoryError(error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile || null);
    setLastSummary(null);
    setLastWarnings([]);
    setParseErrors([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Choose a CSV file before importing.' });
      return;
    }
    if (tokenMissing) {
      setStatus({ type: 'error', message: 'Admin token missing. Set NEXT_PUBLIC_ADMIN_TOKEN to import.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'loading', message: 'Importing statement…' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/royalties/import', {
        method: 'POST',
        body: formData,
        headers: {
          'x-admin-token': ADMIN_TOKEN,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Import failed.');
      }

      setStatus({ type: 'success', message: 'Import completed successfully.' });
      setLastSummary(payload.summary || null);
      setLastWarnings((payload.summary && payload.summary.warnings) || []);
      setParseErrors((payload.summary && payload.summary.parseErrors) || []);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await refreshHistory();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (!status.message) return null;
    const statusClass = `status ${status.type}`;
    return <p className={statusClass}>{status.message}</p>;
  };

  const renderSummary = () => {
    if (!lastSummary) return null;
    return (
      <div className="summary">
        <h3>Last Import Summary</h3>
        <ul>
          <li>
            <strong>Line items:</strong> {lastSummary.lineItems}
          </li>
          <li>
            <strong>Releases:</strong> {lastSummary.releases}
          </li>
          <li>
            <strong>Collaborators:</strong> {lastSummary.collaborators}
          </li>
          <li>
            <strong>Total amount:</strong> {formatCurrency(lastSummary.totalAmount, lastSummary.currency)}
          </li>
        </ul>
        {lastWarnings.length > 0 && (
          <div className="warnings">
            <strong>Warnings:</strong>
            <ul>
              {lastWarnings.map((warning, index) => (
                <li key={`warning-${index}`}>
                  {warning.message}
                  {warning.row ? ` (Row ${warning.row})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {parseErrors.length > 0 && (
          <div className="warnings">
            <strong>Parser notes:</strong>
            <ul>
              {parseErrors.map((error, index) => (
                <li key={`parse-${index}`}>
                  {error.message}
                  {error.row ? ` (Row ${error.row})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <h1>Royalty Statement Import</h1>

      <section className="card">
        <h2>Upload CSV</h2>
        <p className="helper">
          Upload EMPIRE statements as CSV files. Data will be normalized into statements, releases, line items, and
          collaborator payouts.
        </p>
        <form onSubmit={handleSubmit} className="form">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={isSubmitting || tokenMissing}
          />
          <button type="submit" disabled={!file || isSubmitting || tokenMissing}>
            {isSubmitting ? 'Importing…' : 'Import Statement'}
          </button>
        </form>
        {tokenMissing && (
          <p className="status warning">
            Set NEXT_PUBLIC_ADMIN_TOKEN (and ADMIN_API_TOKEN for the API) in your environment to enable imports.
          </p>
        )}
        {renderStatus()}
        {renderSummary()}
      </section>

      <section className="card">
        <div className="history-header">
          <h2>Import History</h2>
          <button type="button" onClick={refreshHistory} disabled={loadingHistory || tokenMissing}>
            {loadingHistory ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {historyError && <p className="status error">{historyError}</p>}
        {!historyError && !history.length && !loadingHistory && (
          <p className="empty">No imports have been recorded yet.</p>
        )}
        {!historyError && history.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Imported</th>
                  <th>Source</th>
                  <th>File</th>
                  <th>Line Items</th>
                  <th>Releases</th>
                  <th>Collaborators</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.importedAt)}</td>
                    <td>{item.source || '—'}</td>
                    <td>{item.originalFilename || '—'}</td>
                    <td>{item.lineItemCount}</td>
                    <td>{item.releaseCount}</td>
                    <td>{item.collaboratorCount}</td>
                    <td>{formatCurrency(item.totalRevenue, item.currency)}</td>
                    <td className="status-text">{item.status || 'completed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          max-width: 960px;
          margin: 0 auto;
          padding: 2rem 1.5rem 4rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        h1 {
          margin-bottom: 2rem;
          font-size: 2rem;
        }
        .card {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          padding: 1.75rem;
          margin-bottom: 2rem;
        }
        .card h2 {
          margin: 0 0 0.5rem;
        }
        .helper {
          color: #475569;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .form {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        input[type='file'] {
          flex: 1;
          min-width: 220px;
        }
        button {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }
        button[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .status {
          margin: 0.5rem 0;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          font-size: 0.95rem;
        }
        .status.success {
          background: #ecfdf5;
          color: #047857;
        }
        .status.error {
          background: #fee2e2;
          color: #b91c1c;
        }
        .status.warning {
          background: #fef3c7;
          color: #92400e;
        }
        .status.loading {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .summary ul {
          margin: 0;
          padding-left: 1rem;
        }
        .summary li {
          margin-bottom: 0.35rem;
        }
        .warnings {
          margin-top: 1rem;
          background: #fff7ed;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          color: #9a3412;
        }
        .warnings ul {
          margin: 0.5rem 0 0;
          padding-left: 1.2rem;
        }
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .history-header button {
          padding: 0.5rem 1.25rem;
        }
        .table-wrapper {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          text-align: left;
          padding: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.95rem;
          white-space: nowrap;
        }
        th {
          background: #f8fafc;
          font-weight: 600;
        }
        .empty {
          color: #475569;
        }
        .status-text {
          text-transform: capitalize;
        }
        @media (max-width: 640px) {
          .form {
            flex-direction: column;
            align-items: stretch;
          }
          button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
