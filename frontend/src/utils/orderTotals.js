// Shared helpers for rendering an order's authoritative total.
//
// The server computes `totals` per currency (e.g. { USD: 45.00, CUP: 12000 })
// because a cart can mix products priced in different currencies. Every
// display of "what was charged" — the checkout confirmation, the receipt,
// the WhatsApp message, and the order history — should go through these
// helpers so they agree on what a total looks like.

// Renders the server-authoritative per-currency totals, e.g. "45.00 USD + 12000.00 CUP".
export const formatTotals = (totals) =>
  Object.entries(totals || {})
    .map(([currency, amount]) => `${Number(amount).toFixed(2)} ${currency}`)
    .join(' + ');

// Orders created before the server started returning `totals` (or, in principle,
// a response that somehow omitted it) have no per-currency breakdown available.
// Their stored `total` is a sum across currencies with no currency recorded
// anywhere, so it must NOT be labelled with a currency — that would assert
// something false (e.g. claiming "USD" for an order that was actually CUP).
export const getOrderTotalDisplay = (order) => {
  const totals = order?.totals;
  if (totals && Object.keys(totals).length > 0) {
    return formatTotals(totals);
  }
  return Number(order?.total || 0).toFixed(2);
};
