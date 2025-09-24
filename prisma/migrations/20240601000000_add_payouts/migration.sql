-- Create payout batches table
CREATE TABLE "payout_batches" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "processor" TEXT,
  "processorBatchId" TEXT,
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "payoutCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create payouts table
CREATE TABLE "payouts" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "collaboratorId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "externalId" TEXT,
  "failureReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payouts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payout_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payouts_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create payable items table
CREATE TABLE "payable_items" (
  "id" TEXT PRIMARY KEY,
  "payoutId" TEXT NOT NULL,
  "statementLineId" TEXT NOT NULL,
  "statementLineSplitId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "sharePercentage" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payable_items_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payable_items_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "statement_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payable_items_statementLineSplitId_fkey" FOREIGN KEY ("statementLineSplitId") REFERENCES "statement_line_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create payout audit logs table
CREATE TABLE "payout_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "payoutId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message" TEXT,
  "detail" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_audit_logs_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Helpful indexes
CREATE INDEX "payouts_batch_idx" ON "payouts"("batchId");
CREATE INDEX "payouts_collaborator_idx" ON "payouts"("collaboratorId");
CREATE INDEX "payable_items_statement_line_idx" ON "payable_items"("statementLineId");
CREATE INDEX "payable_items_split_idx" ON "payable_items"("statementLineSplitId");
CREATE INDEX "payout_audit_logs_payout_idx" ON "payout_audit_logs"("payoutId");
