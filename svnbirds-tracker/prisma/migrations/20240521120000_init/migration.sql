-- Create releases table
CREATE TABLE "releases" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "primaryArtist" TEXT,
  "artists" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "releaseDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'planned',
  "platformLinks" JSONB NOT NULL,
  "coverArt" TEXT,
  "type" TEXT DEFAULT 'single',
  "notes" TEXT,
  "label" TEXT,
  "upc" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create collaborators table
CREATE TABLE "collaborators" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "role" TEXT,
  "payeeReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create royalty statements table
CREATE TABLE "royalty_statements" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "reference" TEXT,
  "periodLabel" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "statementDate" TIMESTAMP(3),
  "currency" TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalUnits" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create statement lines table
CREATE TABLE "statement_lines" (
  "id" TEXT PRIMARY KEY,
  "statementId" TEXT NOT NULL,
  "releaseId" TEXT,
  "sequence" INTEGER,
  "trackTitle" TEXT,
  "isrc" TEXT,
  "usageDate" TIMESTAMP(3),
  "service" TEXT,
  "territory" TEXT,
  "units" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossRevenue" DOUBLE PRECISION,
  "fee" DOUBLE PRECISION,
  "currency" TEXT NOT NULL,
  "payoutStatus" TEXT NOT NULL DEFAULT 'pending',
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "statement_lines_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "royalty_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "statement_lines_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create statement line splits table
CREATE TABLE "statement_line_splits" (
  "id" TEXT PRIMARY KEY,
  "statementLineId" TEXT NOT NULL,
  "collaboratorId" TEXT,
  "sharePercentage" DOUBLE PRECISION,
  "amount" DOUBLE PRECISION,
  "payoutStatus" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "statement_line_splits_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "statement_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "statement_line_splits_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create split agreements table
CREATE TABLE "split_agreements" (
  "id" TEXT PRIMARY KEY,
  "releaseId" TEXT NOT NULL,
  "collaboratorId" TEXT NOT NULL,
  "sharePercentage" DOUBLE PRECISION,
  "agreementType" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "split_agreements_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "split_agreements_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "split_agreements_release_collaborator_key" UNIQUE ("releaseId", "collaboratorId")
);

-- Create royalty import batches table
CREATE TABLE "royalty_import_batches" (
  "id" TEXT PRIMARY KEY,
  "statementId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importedBy" TEXT,
  "originalFilename" TEXT,
  "lineItemCount" INTEGER NOT NULL,
  "releaseCount" INTEGER NOT NULL,
  "collaboratorCount" INTEGER NOT NULL,
  "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "warnings" JSONB NOT NULL,
  "errors" JSONB NOT NULL,
  CONSTRAINT "royalty_import_batches_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "royalty_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Useful indexes
CREATE INDEX "statement_lines_statement_idx" ON "statement_lines"("statementId");
CREATE INDEX "statement_lines_release_idx" ON "statement_lines"("releaseId");
CREATE INDEX "statement_line_splits_collaborator_idx" ON "statement_line_splits"("collaboratorId");
CREATE INDEX "royalty_import_batches_statement_idx" ON "royalty_import_batches"("statementId");
