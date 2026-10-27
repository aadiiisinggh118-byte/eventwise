const { contrastRatio, meetsAA } = require("../lib/colorContrast");

// Every pair is a real text/background combination used in the UI (see tailwind.config.js).
describe("WCAG AA contrast, computed for the actual palette", () => {
  it.each([
    ["body text on page", "#1B1626", "#F4F2F8"],
    ["secondary text on page", "#5A5368", "#F4F2F8"],
    ["secondary text on white", "#5A5368", "#FFFFFF"],
    ["plum links/headings on page", "#2B1B45", "#F4F2F8"],
    ["white on plum (primary button, dark bands)", "#FFFFFF", "#2B1B45"],
    ["light text on plum (dark band body)", "#E3D9F2", "#2B1B45"],
    ["marigold on plum (accents on dark)", "#F2A71B", "#2B1B45"],
    ["ink on marigold (accent button)", "#1B1626", "#F2A71B"],
    ["white on mid plum (hover)", "#FFFFFF", "#4A3170"],
    ["ok badge", "#1F5A33", "#E6F3EA"],
    ["warn badge", "#7A4A00", "#FCEFD2"],
    ["bad badge", "#8A2418", "#FBE7E3"],
    ["info badge", "#2B1B45", "#EEE8F7"],
    ["placeholder on white", "#6B6478", "#FFFFFF"],
  ])("%s meets 4.5:1", (_name, fg, bg) => expect(meetsAA(contrastRatio(fg, bg))).toBe(true));

  it("input borders meet the 3:1 non-text contrast minimum", () => {
    expect(contrastRatio("#8E86A0", "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });
  it("is symmetric and 1:1 for identical colours", () => {
    expect(contrastRatio("#1B1626", "#F4F2F8")).toBeCloseTo(contrastRatio("#F4F2F8", "#1B1626"), 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });
});
