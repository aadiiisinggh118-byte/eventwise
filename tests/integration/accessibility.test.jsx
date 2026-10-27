/** @jest-environment jsdom */
import { render, screen, fireEvent, configure } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Home from "../../app/page";
import SetupForm from "../../components/SetupForm";
import BudgetView from "../../components/BudgetView";
import TimelineView from "../../components/TimelineView";
import VendorsView from "../../components/VendorsView";
import IdeasView from "../../components/IdeasView";
import ChangesView from "../../components/ChangesView";
import PlanShell from "../../components/PlanShell";
import { renderWithPlan, jsonResponse, SEED } from "../helpers/renderWithPlan";

expect.extend(toHaveNoViolations);
// axe walks the whole DOM; the first run in jsdom is slow, so allow generous time.
jest.setTimeout(30000);
configure({ asyncUtilTimeout: 5000 });
const audit = async (container) => expect(await axe(container)).toHaveNoViolations();

beforeEach(() => { global.fetch = jest.fn(); });

describe("axe audit: every page", () => {
  it("landing page", async () => { const { container } = render(<Home />); await audit(container); });

  it("setup form, empty and with validation errors showing", async () => {
    const user = userEvent.setup();
    const { container } = renderWithPlan(<SetupForm />, { plan: null });
    await screen.findByRole("button", { name: /build my plan/i });
    await audit(container);
    await user.click(screen.getByRole("button", { name: /build my plan/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await audit(container);
  });

  it("empty state before a plan exists", async () => {
    const { container } = renderWithPlan(<BudgetView />, { plan: null });
    await screen.findByText(/haven.t set up an event yet/i);
    await audit(container);
  });

  // Every row has 4 entries on purpose: a shorter row would make Jest pass its `done` callback as `plan`.
  it.each([
    ["budget", <BudgetView key="b" />, /your budget/i, null],
    ["budget with a tight per-guest warning", <BudgetView key="bt" />, /your budget/i, { ...SEED, total: 200000 }],
    ["timeline", <TimelineView key="t" />, /your timeline/i, null],
    ["timeline compressed with a delayed, pushed task", <TimelineView key="tc" />, /your timeline/i, { ...SEED, eventDate: "2026-12-23", delays: { "w-venue": 14 }, done: ["w-budget"] }],
    ["vendors", <VendorsView key="v" />, /vendor checklist/i, null],
    ["ideas", <IdeasView key="i" />, /ideas that fit you/i, null],
    ["changes", <ChangesView key="c" />, /when things change/i, null],
  ])("%s page", async (_name, ui, heading, plan) => {
    const { container } = renderWithPlan(ui, plan ? { plan } : undefined);
    await screen.findByRole("heading", { name: heading });
    await audit(container);
  });

  it("plan shell with navigation", async () => {
    const { container } = renderWithPlan(<PlanShell><h1>Page</h1></PlanShell>);
    await screen.findByText(/days to go/i);
    await audit(container);
  });
});

describe("axe audit: states that appear after the user acts", () => {
  it("AI-generated ideas", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue(jsonResponse({ ideas: ["A", "B", "C"].map((t) => ({ title: `Idea ${t}`, concept: "c", fit: "f", leansOn: "venue", effort: "low" })) }));
    const { container } = renderWithPlan(<IdeasView />);
    await user.click(await screen.findByRole("button", { name: /get ideas/i }));
    await screen.findByRole("heading", { name: "Idea A" });
    await audit(container);
  });

  it("trade-off options with Gemini's explanation", async () => {
    const user = userEvent.setup();
    const opt = (id) => ({ id, pros: ["pro"], cons: ["con"], bestIf: "when" });
    fetch.mockResolvedValue(jsonResponse({ narration: { summary: "Summary.", options: ["protect", "even", "guests"].map(opt) } }));
    const { container } = renderWithPlan(<ChangesView />);
    await user.click(await screen.findByRole("button", { name: /explain the trade-offs/i }));
    await screen.findByText("Summary.");
    await audit(container);
  });

  it("changes preview and the trade-off-applied state", async () => {
    const user = userEvent.setup();
    const { container } = renderWithPlan(<ChangesView />);
    fireEvent.change(await screen.findByLabelText(/number of guests/i), { target: { value: "150" } });
    expect(screen.getByText(/guest count drops by 50/i)).toBeInTheDocument();
    await audit(container);
    await user.click(screen.getByRole("button", { name: "Apply: Spread the cut evenly" }));
    await screen.findByText(/a trade-off is in effect/i);
    await audit(container);
  });

  it("quote comparison results", async () => {
    const user = userEvent.setup();
    const { container } = renderWithPlan(<VendorsView />);
    const price = await screen.findAllByLabelText("Quoted price (₹)");
    await user.type(price[0], "100000");
    await user.type(price[1], "120000");
    await user.click(screen.getByRole("button", { name: /compare quotes/i }));
    await screen.findByRole("table", { name: /quote comparison/i });
    await audit(container);
  });
});
