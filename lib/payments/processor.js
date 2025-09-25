/**
 * Minimal stub for integrating with an external payment processor. In a real
 * deployment this module would call Stripe Connect, Trolley, etc. and return
 * the processor's identifiers and error payloads.
 */
export async function submitPayoutBatch({ batch, payouts }) {
  const processorBatchId = `stub-${Date.now()}`;

  const results = payouts.map((payout) => {
    if (payout.amount <= 0) {
      return {
        payoutId: payout.id,
        status: 'failed',
        failureReason: 'Amount must be greater than zero.',
      };
    }

    if (!payout.collaborator?.payeeReference) {
      return {
        payoutId: payout.id,
        status: 'failed',
        failureReason: 'Missing payee reference for collaborator.',
      };
    }

    return {
      payoutId: payout.id,
      status: 'paid',
      externalId: `${processorBatchId}-${payout.id}`,
    };
  });

  return {
    processorBatchId,
    results,
  };
}

const processor = { submitPayoutBatch };

export default processor;
