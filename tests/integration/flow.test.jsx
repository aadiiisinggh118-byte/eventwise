/** @jest-environment jsdom */
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nav from "next/navigation";
import SetupForm from "../../components/SetupForm";
import BudgetView from "../../components/BudgetView";
import TimelineView from "../../components/TimelineView";
import ChangesView from "../../components/ChangesView";
import PlanShell from "../../components/PlanShell";
import { renderWithPlan, saved, KEY, SEED } from "../helpers/renderWithPlan";

beforeEach(() => { global.fetch = jest.fn(); nav.__push.mockClear(); });

describe("first-time journey: setup to budget and timeline", () => {
  it("builds a plan from four answers, saves it, and shows it across pages without any network call", async () => {
    const user = userEvent.setup();
    renderWithPlan(<><SetupForm /><BudgetView /><TimelineView /></>, { plan: null });

    // Before setup, the plan pages invite the user to set up instead of showing empty tables.
    expect(await screen.findAllByText(/haven.t set up an event yet/i)).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /wedding/i }));
    await user.type(screen.getByLabelText(/total budget/i), "8,00,000");
    expect(screen.getByText("That is ₹8 lakh.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/number of guests/i), "200");
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: "2027-02-21" } });
    await user.selectOptions(screen.getByLabelText("Decor and setup"), "high");
    await user.click(screen.getByRole("button", { name: /build my plan/i }));

    expect(nav.__push).toHaveBeenCalledWith("/plan/budget");
    const row = await screen.findByRole("row", { name: /catering/i });
    // With Decor on "Spend more" the weights total 106, so catering is 800000 x 30/106 = 2,26,415 (largest-remainder rounding).
    expect(within(row).getByText(/₹2,26,41[56]/)).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /decor and setup/i })).toHaveTextContent("Spend more");
    expect(screen.getByText("0 of 15")).toBeInTheDocument(); // timeline built too

    await waitFor(() => expect(saved()).toMatchObject({ occasion: "wedding", total: 800000, guests: 200, priorities: { decor: "high" } }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains what is wrong instead of failing silently, and does not navigate", async () => {
    const user = userEvent.setup();
    renderWithPlan(<SetupForm />, { plan: null });
    await user.click(await screen.findByRole("button", { name: /build my plan/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/need fixing/i);
    expect(screen.getByText(/between ₹5,000 and ₹5 crore/)).toBeInTheDocument();
    expect(screen.getByText(/pick the event date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/total budget/i)).toHaveAttribute("aria-invalid", "true");
    expect(nav.__push).not.toHaveBeenCalled();
    expect(saved()).toBeNull();
  });

  it("rejects a date in the past", async () => {
    const user = userEvent.setup();
    renderWithPlan(<SetupForm />, { plan: null });
    await user.type(await screen.findByLabelText(/total budget/i), "500000");
    await user.type(screen.getByLabelText(/number of guests/i), "100");
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: /build my plan/i }));
    expect(screen.getByText(/can.t be in the past/i)).toBeInTheDocument();
  });
});

describe("saved data is never trusted", () => {
  it.each([
    ["corrupt JSON", "{not json"],
    ["wrong types", JSON.stringify({ occasion: "wedding", total: "x", guests: 10, eventDate: "2027-02-21" })],
    ["unknown occasion", JSON.stringify({ ...SEED, occasion: "rave" })],
  ])("falls back to the empty state for %s", async (_n, raw) => {
    localStorage.setItem(KEY, raw);
    const { render } = require("@testing-library/react");
    const { PlanProvider } = require("../../components/PlanProvider");
    render(<PlanProvider initialToday="2026-10-24"><BudgetView /></PlanProvider>);
    expect(await screen.findByText(/haven.t set up an event yet/i)).toBeInTheDocument();
  });
});

describe("timeline", () => {
  it("ticking tasks updates progress and persists it", async () => {
    const user = userEvent.setup();
    renderWithPlan(<TimelineView />);
    expect(await screen.findByText("0 of 15")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Agree the budget and what matters most" }));
    expect(screen.getByText("1 of 15")).toBeInTheDocument();
    await waitFor(() => expect(saved().done).toEqual(["w-budget"]));
  });

  it("delaying a task visibly pushes exactly the tasks that depend on it", async () => {
    const user = userEvent.setup();
    renderWithPlan(<TimelineView />);
    await user.selectOptions(await screen.findByLabelText("Delay for Shortlist and book the venue"), "30");
    expect(screen.getAllByText(/pushed later because a task it depends on is delayed/i)).toHaveLength(2); // caterer and photographer
    await waitFor(() => expect(saved().delays).toEqual({ "w-venue": 30 }));
  });

  it("warns when the event is closer than the template assumes", async () => {
    renderWithPlan(<TimelineView />, { plan: { ...SEED, eventDate: "2026-12-23" } });
    expect(await screen.findByText(/only 60 days remain, against the usual 120/i)).toBeInTheDocument();
  });
});

describe("changes: instant re-planning", () => {
  it("shows exactly what a smaller budget, fewer guests and an earlier date change, with ZERO network calls", async () => {
    const user = userEvent.setup();
    renderWithPlan(<ChangesView />);
    const total = await screen.findByLabelText(/total budget/i);
    await user.clear(total); await user.type(total, "640000");
    const guests = screen.getByLabelText(/number of guests/i);
    await user.clear(guests); await user.type(guests, "150");
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: "2026-12-23" } });

    expect(screen.getByText(/Budget decreases by ₹1,60,000/)).toBeInTheDocument();
    expect(screen.getByText(/Guest count drops by 50/)).toBeInTheDocument();
    expect(screen.getByText(/moves 60 days earlier/)).toBeInTheDocument();
    expect(screen.getByText(/timeline is now compressed/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /apply these changes/i }));
    expect(screen.getByText(/nothing was sent to a server/i)).toBeInTheDocument();
    await waitFor(() => expect(saved()).toMatchObject({ total: 640000, guests: 150, eventDate: "2026-12-23" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps ticked tasks when the plan changes", async () => {
    const user = userEvent.setup();
    renderWithPlan(<ChangesView />, { plan: { ...SEED, done: ["w-budget", "w-venue"] } });
    const guests = await screen.findByLabelText(/number of guests/i);
    await user.clear(guests); await user.type(guests, "180");
    await user.click(screen.getByRole("button", { name: /apply these changes/i }));
    await waitFor(() => expect(saved()).toMatchObject({ guests: 180, done: ["w-budget", "w-venue"] }));
  });

  it("disables Apply when nothing changed or the input is invalid", async () => {
    const user = userEvent.setup();
    renderWithPlan(<ChangesView />);
    expect(await screen.findByRole("button", { name: /apply these changes/i })).toBeDisabled();
    const total = screen.getByLabelText(/total budget/i);
    await user.clear(total); await user.type(total, "12");
    expect(screen.getByText(/between ₹5,000 and ₹5 crore/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply these changes/i })).toBeDisabled();
  });
});

describe("changes: costs running over", () => {
  it("shows worked-out options instantly (no network), and applying one adjusts the budget", async () => {
    const user = userEvent.setup();
    renderWithPlan(<ChangesView />);
    expect(await screen.findByText("₹9,60,000")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Protect your priorities" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite fewer guests" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply: Spread the cut evenly" }));
    expect(await screen.findByText(/a trade-off is in effect/i)).toBeInTheDocument();
    await waitFor(() => {
      const o = saved().overrides;
      expect(Object.values(o).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(800000);
    });
    await user.click(screen.getByRole("button", { name: /clear the trade-off/i }));
    await waitFor(() => expect(saved().overrides).toBeNull());
  });

  it("applying the fewer-guests option updates the guest count too", async () => {
    const user = userEvent.setup();
    renderWithPlan(<ChangesView />);
    await user.click(await screen.findByRole("button", { name: "Apply: Invite fewer guests" }));
    await waitFor(() => expect(saved().guests).toBe(104));
  });

  it("asks Gemini to explain the options once, and reuses the answer for identical requests", async () => {
    const user = userEvent.setup();
    const opt = (id) => ({ id, pros: [`${id} pro`], cons: [`${id} con`], bestIf: `${id} bestIf` });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ narration: { summary: "Three ways to close the gap.", options: ["protect", "even", "guests"].map(opt) } }) });
    renderWithPlan(<ChangesView />);

    const explain = await screen.findByRole("button", { name: /explain the trade-offs/i });
    await user.click(explain);
    expect(await screen.findByText("Three ways to close the gap.")).toBeInTheDocument();
    expect(screen.getByText("protect pro")).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ occasion: "wedding", total: 800000, guests: 200, priorities: {}, overrides: null, overPct: 20 });

    await user.click(screen.getByRole("button", { name: /explain the trade-offs/i }));
    expect(fetch).toHaveBeenCalledTimes(1); // cached client-side
  });

  it("shows a clear message when the AI service fails, and the engine's options still work", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "The AI service is busy. Please try again in a minute." }) });
    renderWithPlan(<ChangesView />);
    await user.click(await screen.findByRole("button", { name: /explain the trade-offs/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/ai service is busy/i);
    expect(screen.getByRole("heading", { name: "Spread the cut evenly" })).toBeInTheDocument();
  });

  it("rejects a nonsense percentage without computing anything", async () => {
    const user = userEvent.setup();
    renderWithPlan(<ChangesView />);
    const pct = await screen.findByLabelText(/running over by/i);
    await user.clear(pct); await user.type(pct, "500");
    expect(screen.getByText(/between 1 and 100/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Spread the cut evenly" })).not.toBeInTheDocument();
  });
});

describe("plan shell", () => {
  it("shows the plan summary, marks the current section, and clears the plan only after confirmation", async () => {
    const user = userEvent.setup();
    renderWithPlan(<PlanShell><p>page content</p></PlanShell>);
    expect(await screen.findByText(/₹8 lakh/)).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Budget" })).not.toHaveAttribute("aria-current");

    await user.click(screen.getByRole("button", { name: /clear my plan/i }));
    expect(saved()).not.toBeNull(); // not yet
    await user.click(screen.getByRole("button", { name: /keep it/i }));
    expect(saved()).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /clear my plan/i }));
    await user.click(screen.getByRole("button", { name: /yes, clear it/i }));
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
  });
});
