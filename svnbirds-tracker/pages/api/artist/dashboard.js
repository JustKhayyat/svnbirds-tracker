import prisma from "../../../lib/prisma";

const ARTIST_PORTAL_TOKEN =
  process.env.ARTIST_PORTAL_TOKEN || process.env.NEXT_PUBLIC_ARTIST_PORTAL_TOKEN || "";

function readHeader(req, key) {
  const value = req.headers[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isAuthorized(req) {
  if (!ARTIST_PORTAL_TOKEN) {
    return false;
  }

  const headerToken = readHeader(req, "x-artist-token");
  return typeof headerToken === "string" && headerToken === ARTIST_PORTAL_TOKEN;
}

function coerceNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function coerceDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatIso(value) {
  const date = coerceDate(value);
  return date ? date.toISOString() : null;
}

function payoutStatusKey(status) {
  return typeof status === "string" ? status.toLowerCase() : "";
}

function determineCurrency(splits) {
  for (const split of splits) {
    const line = split.statementLine;
    if (line?.currency) {
      return line.currency;
    }
    if (line?.statement?.currency) {
      return line.statement.currency;
    }
  }
  return "USD";
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res
      .status(401)
      .json({ error: "Unauthorized: missing or invalid artist access token." });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const { collaboratorId, payeeReference } = req.query;

  if (!collaboratorId && !payeeReference) {
    res
      .status(400)
      .json({ error: "Provide a collaboratorId or payeeReference to view dashboard data." });
    return;
  }

  try {
    const collaborator = await prisma.collaborator.findFirst({
      where: {
        ...(collaboratorId ? { id: String(collaboratorId) } : {}),
        ...(payeeReference ? { payeeReference: String(payeeReference) } : {}),
      },
      include: {
        splits: {
          orderBy: { createdAt: "desc" },
          include: {
            statementLine: {
              include: {
                release: true,
                statement: true,
              },
            },
          },
        },
        agreements: {
          include: {
            release: true,
          },
        },
      },
    });

    if (!collaborator) {
      res.status(404).json({ error: "No collaborator matched the supplied identifier." });
      return;
    }

    const splits = collaborator.splits ?? [];
    const currency = determineCurrency(splits);

    let totalEarned = 0;
    let totalPaid = 0;

    const upcomingPayouts = [];
    const releaseMap = new Map();
    const statementMap = new Map();

    splits.forEach((split) => {
      const amount = coerceNumber(split.amount);
      totalEarned += amount;

      if (payoutStatusKey(split.payoutStatus) === "paid") {
        totalPaid += amount;
      }

      const line = split.statementLine;
      const release = line?.release ?? null;
      const releaseKey = release?.id ?? `unassigned-${line?.id ?? split.id}`;

      if (!releaseMap.has(releaseKey)) {
        releaseMap.set(releaseKey, {
          id: release?.id ?? null,
          title: release?.title ?? "Unassigned Usage",
          primaryArtist: release?.primaryArtist ?? collaborator.name ?? "",
          coverArt: release?.coverArt ?? null,
          label: release?.label ?? null,
          releaseDate: release?.releaseDate ? formatIso(release.releaseDate) : null,
          upc: release?.upc ?? null,
          totalEarned: 0,
          totalPaid: 0,
          agreementShare: null,
          splits: [],
        });
      }

      const releaseEntry = releaseMap.get(releaseKey);
      releaseEntry.totalEarned += amount;
      if (payoutStatusKey(split.payoutStatus) === "paid") {
        releaseEntry.totalPaid += amount;
      }

      const statement = line?.statement ?? null;

      releaseEntry.splits.push({
        id: split.id,
        statementLineId: split.statementLineId,
        amount,
        sharePercentage:
          typeof split.sharePercentage === "number" && Number.isFinite(split.sharePercentage)
            ? split.sharePercentage
            : null,
        payoutStatus: split.payoutStatus ?? "pending",
        usageDate: formatIso(line?.usageDate),
        service: line?.service ?? null,
        territory: line?.territory ?? null,
        trackTitle: line?.trackTitle ?? null,
        statement: statement
          ? {
              id: statement.id,
              provider: statement.provider,
              periodLabel: statement.periodLabel,
              statementDate: formatIso(statement.statementDate),
            }
          : null,
      });

      const payoutKey = payoutStatusKey(split.payoutStatus);
      if (payoutKey === "pending" || payoutKey === "processing") {
        upcomingPayouts.push({
          id: split.id,
          amount,
          currency,
          payoutStatus: split.payoutStatus ?? "pending",
          releaseTitle: release?.title ?? "Unassigned Usage",
          trackTitle: line?.trackTitle ?? null,
          service: line?.service ?? null,
          usageDate: formatIso(line?.usageDate),
          statementId: statement?.id ?? null,
          statementPeriod: statement?.periodLabel ?? null,
        });
      }

      if (statement) {
        if (!statementMap.has(statement.id)) {
          statementMap.set(statement.id, {
            id: statement.id,
            provider: statement.provider,
            periodLabel: statement.periodLabel,
            statementDate: formatIso(statement.statementDate),
            currency: statement.currency,
            totalAmount: coerceNumber(statement.totalAmount),
            totalUnits: coerceNumber(statement.totalUnits),
            contributorEarnings: 0,
          });
        }
        const statementEntry = statementMap.get(statement.id);
        statementEntry.contributorEarnings += amount;
      }
    });

    collaborator.agreements?.forEach((agreement) => {
      const releaseKey = agreement.releaseId ?? `agreement-${agreement.id}`;
      if (!releaseMap.has(releaseKey)) {
        releaseMap.set(releaseKey, {
          id: agreement.releaseId,
          title: agreement.release?.title ?? "Unreleased Split",
          primaryArtist: agreement.release?.primaryArtist ?? collaborator.name ?? "",
          coverArt: agreement.release?.coverArt ?? null,
          label: agreement.release?.label ?? null,
          releaseDate: agreement.release?.releaseDate
            ? formatIso(agreement.release.releaseDate)
            : null,
          upc: agreement.release?.upc ?? null,
          totalEarned: 0,
          totalPaid: 0,
          agreementShare: null,
          splits: [],
        });
      }

      const releaseEntry = releaseMap.get(releaseKey);
      if (
        typeof agreement.sharePercentage === "number" &&
        Number.isFinite(agreement.sharePercentage)
      ) {
        releaseEntry.agreementShare = agreement.sharePercentage;
      }
    });

    const releases = Array.from(releaseMap.values()).map((release) => ({
      ...release,
      outstandingBalance: release.totalEarned - release.totalPaid,
      splits: release.splits.sort((a, b) => {
        const dateA = coerceDate(a.usageDate)?.getTime() ?? 0;
        const dateB = coerceDate(b.usageDate)?.getTime() ?? 0;
        return dateB - dateA;
      }),
    }));

    releases.sort((a, b) => {
      const earnedDiff = b.totalEarned - a.totalEarned;
      if (earnedDiff !== 0) return earnedDiff;
      const dateA = coerceDate(a.releaseDate)?.getTime() ?? 0;
      const dateB = coerceDate(b.releaseDate)?.getTime() ?? 0;
      return dateB - dateA;
    });

    const statements = Array.from(statementMap.values()).sort((a, b) => {
      const dateA = coerceDate(a.statementDate)?.getTime() ?? 0;
      const dateB = coerceDate(b.statementDate)?.getTime() ?? 0;
      return dateB - dateA;
    });

    upcomingPayouts.sort((a, b) => {
      const dateA = coerceDate(a.usageDate)?.getTime() ?? 0;
      const dateB = coerceDate(b.usageDate)?.getTime() ?? 0;
      return dateB - dateA;
    });

    res.status(200).json({
      collaborator: {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        role: collaborator.role,
        payeeReference: collaborator.payeeReference,
      },
      summary: {
        totalEarned,
        totalPaid,
        outstandingBalance: totalEarned - totalPaid,
        currency,
        upcomingPayouts: upcomingPayouts.slice(0, 8),
      },
      releases,
      statements,
      agreements: collaborator.agreements.map((agreement) => ({
        id: agreement.id,
        releaseId: agreement.releaseId,
        sharePercentage: agreement.sharePercentage,
        agreementType: agreement.agreementType,
        effectiveDate: formatIso(agreement.effectiveDate),
        release: agreement.release
          ? {
              id: agreement.release.id,
              title: agreement.release.title,
              primaryArtist: agreement.release.primaryArtist,
            }
          : null,
      })),
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load artist dashboard data", error);
    res.status(500).json({ error: "Unexpected error while loading dashboard data." });
  }
}

