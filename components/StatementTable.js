import styles from "../styles/StatementTable.module.css";

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

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfDocument(lines) {
  const encoder = new TextEncoder();
  const parts = [];
  let lengthSoFar = 0;
  const offsets = new Array(6).fill(0);

  const pushPart = (part) => {
    parts.push(part);
    lengthSoFar += encoder.encode(part).length;
  };

  pushPart("%PDF-1.4\n");

  const addObject = (id, content) => {
    offsets[id] = lengthSoFar;
    pushPart(`${id} 0 obj\n${content}\nendobj\n`);
  };

  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
  );

  const textLines = lines.length ? lines : ["Statement overview"];
  const textCommands = ["BT", "/F1 12 Tf", "16 TL", "72 720 Td"];

  textLines.forEach((line, index) => {
    const escaped = escapePdfText(line);
    if (index === 0) {
      textCommands.push(`(${escaped}) Tj`);
    } else {
      textCommands.push("T*");
      textCommands.push(`(${escaped}) Tj`);
    }
  });
  textCommands.push("ET");

  const streamContent = textCommands.join("\n");
  const streamLength = encoder.encode(streamContent).length;
  pushPart(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

  addObject(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = lengthSoFar;
  pushPart("xref\n0 6\n");
  const xrefEntries = ["0000000000 65535 f \n"];
  for (let id = 1; id <= 5; id += 1) {
    xrefEntries.push(`${offsets[id].toString().padStart(10, "0")} 00000 n \n`);
  }
  pushPart(xrefEntries.join(""));
  pushPart(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return encoder.encode(parts.join(""));
}

function downloadBlob(filename, blob) {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function buildCsv(statements) {
  const header = [
    "Statement ID",
    "Period",
    "Provider",
    "Statement Date",
    "Currency",
    "Total Amount",
    "Total Units",
    "Your Earnings",
  ];

  const rows = statements.map((statement) => [
    statement.id,
    statement.periodLabel || "",
    statement.provider,
    formatDate(statement.statementDate),
    statement.currency,
    statement.totalAmount,
    statement.totalUnits,
    statement.contributorEarnings,
  ]);

  return [header, ...rows]
    .map((columns) => columns.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function StatementTable({ statements = [], currency }) {
  const hasStatements = statements.length > 0;

  const handleDownloadCsv = (statement) => {
    const csv = buildCsv([statement]);
    const blob = new Blob([csv], { type: "text/csv" });
    downloadBlob(`statement-${statement.id}.csv`, blob);
  };

  const handleDownloadPdf = (statement) => {
    const lines = [
      `Statement: ${statement.periodLabel || statement.id}`,
      `Provider: ${statement.provider}`,
      `Statement Date: ${formatDate(statement.statementDate)}`,
      `Currency: ${statement.currency}`,
      `Total Statement Amount: ${formatCurrency(statement.totalAmount, statement.currency)}`,
      `Your Earnings on Statement: ${formatCurrency(
        statement.contributorEarnings,
        statement.currency
      )}`,
      `Units: ${statement.totalUnits}`,
    ];

    const pdfBytes = createPdfDocument(lines);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlob(`statement-${statement.id}.pdf`, blob);
  };

  return (
    <div className={styles.wrapper}>
      {hasStatements ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Provider</th>
              <th scope="col">Statement Date</th>
              <th scope="col">Total</th>
              <th scope="col">Your Earnings</th>
              <th scope="col" className={styles.actionsHeader}>
                Files
              </th>
            </tr>
          </thead>
          <tbody>
            {statements.map((statement) => (
              <tr key={statement.id}>
                <td data-title="Period">{statement.periodLabel || "—"}</td>
                <td data-title="Provider">{statement.provider}</td>
                <td data-title="Statement Date">{formatDate(statement.statementDate)}</td>
                <td data-title="Total">{formatCurrency(statement.totalAmount, statement.currency)}</td>
                <td data-title="Your Earnings">
                  {formatCurrency(statement.contributorEarnings, currency || statement.currency)}
                </td>
                <td className={styles.actions}>
                  <button type="button" onClick={() => handleDownloadCsv(statement)}>
                    CSV
                  </button>
                  <button type="button" onClick={() => handleDownloadPdf(statement)}>
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>No royalty statements are available yet.</p>
      )}
    </div>
  );
}

