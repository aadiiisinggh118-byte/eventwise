const { CATEGORIES } = require("./occasions");

const INCLUSIONS = [
  { id: "taxes", label: "Taxes included" },
  { id: "setup", label: "Setup and cleanup included" },
  { id: "cancellation", label: "Cancellation terms in writing" },
];

/** Checklist (what to define, what to ask) for each budget category that has one. */
function vendorGuide(budget) {
  return budget.lines
    .filter((l) => CATEGORIES[l.id].guide)
    .map((l) => ({ id: l.id, label: l.label, amount: l.amount, ...CATEGORIES[l.id].guide }));
}

/**
 * Lays quotes side by side with the arithmetic done for you. It never
 * recommends a vendor: it shows all-in cost, cost per guest, whether the
 * headcount is covered, and what the quote does not say.
 * @param {Array<{name:string, price:number, guestsCovered:number|null, extra:number, taxes:string, setup:string, cancellation:string}>} quotes
 */
function compareQuotes(quotes, { guests, categoryAmount }) {
  const rows = quotes.map((q, i) => {
    const allIn = q.price + (q.extra || 0);
    const covered = q.guestsCovered > 0 ? q.guestsCovered : null;
    return {
      index: i,
      name: q.name || `Quote ${i + 1}`,
      allIn,
      perGuest: covered ? Math.round(allIn / covered) : null,
      coversAllGuests: covered === null ? null : covered >= guests,
      vsBudget: allIn - categoryAmount,
      notStated: INCLUSIONS.filter((k) => !["yes", "no"].includes(q[k.id])).map((k) => k.label),
      notIncluded: INCLUSIONS.filter((k) => q[k.id] === "no").map((k) => k.label),
    };
  });
  const lowest = rows.reduce((best, r) => (best === null || r.allIn < rows[best].allIn ? r.index : best), null);
  return { rows, lowestAllInIndex: lowest };
}

module.exports = { vendorGuide, compareQuotes, INCLUSIONS };
