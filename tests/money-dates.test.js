const { formatINR, formatCompactINR, allocateByWeights } = require("../lib/money");
const { parseISO, addDays, daysBetween, formatDate } = require("../lib/dates");

describe("formatINR / formatCompactINR (Indian grouping)", () => {
  it.each([
    [0, "₹0"], [999, "₹999"], [1000, "₹1,000"], [100000, "₹1,00,000"],
    [800000, "₹8,00,000"], [1234567, "₹12,34,567"], [50000000, "₹5,00,00,000"], [-250000, "-₹2,50,000"],
  ])("formats %p as %p", (n, expected) => expect(formatINR(n)).toBe(expected));

  it.each([[800000, "₹8 lakh"], [150000, "₹1.5 lakh"], [20000000, "₹2 crore"], [45000, "₹45,000"]])(
    "compacts %p as %p", (n, expected) => expect(formatCompactINR(n)).toBe(expected)
  );
});

describe("allocateByWeights", () => {
  it("always sums to exactly the total, for 500 random budgets and weights", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let n = 0; n < 500; n++) {
      const total = Math.floor(rnd() * 50000000);
      const weights = Array.from({ length: 2 + Math.floor(rnd() * 9) }, () => 0.1 + rnd() * 40);
      const out = allocateByWeights(total, weights);
      const sum = out.reduce((a, b) => a + b, 0);
      expect(sum).toBe(total);
      out.forEach((v, i) => {
        expect(Number.isInteger(v) && v >= 0).toBe(true);
        expect(Math.abs(v - (total * weights[i]) / weights.reduce((a, b) => a + b, 0))).toBeLessThan(1);
      });
    }
  });
  it("gives zero to zero-weight entries and rejects all-zero weights", () => {
    expect(allocateByWeights(100, [0, 1, 1])).toEqual([0, 50, 50]);
    expect(() => allocateByWeights(100, [0, 0])).toThrow();
  });
});

describe("dates (time-zone independent)", () => {
  it("parses only real calendar dates", () => {
    expect(parseISO("2027-02-29")).toBeNull();
    expect(parseISO("2028-02-29")).not.toBeNull();
    expect(parseISO("27-02-01")).toBeNull();
    expect(parseISO(null)).toBeNull();
  });
  it("adds days across month and year boundaries and counts days between", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(daysBetween("2026-10-24", "2027-02-21")).toBe(120);
    expect(daysBetween("2027-02-21", "2026-10-24")).toBe(-120);
  });
  it("formats dates without locale differences", () => expect(formatDate("2027-02-21")).toBe("21 Feb 2027"));
});
