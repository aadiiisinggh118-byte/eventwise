import { render } from "@testing-library/react";
import { PlanProvider, STORAGE_KEY } from "../../components/PlanProvider";

export const TODAY = "2026-10-24";
export const KEY = STORAGE_KEY;
// 120 days out: exactly the wedding template's lead time.
export const SEED = { occasion: "wedding", total: 800000, guests: 200, eventDate: "2027-02-21", priorities: {}, preferences: {}, done: [], delays: {}, overrides: null };

export const saved = () => JSON.parse(localStorage.getItem(KEY));

/** Renders `ui` inside the real PlanProvider with a fixed "today"; pass plan=null for a first-time visitor. */
export function renderWithPlan(ui, { plan = SEED } = {}) {
  localStorage.clear();
  if (plan) localStorage.setItem(KEY, JSON.stringify(plan));
  return render(<PlanProvider initialToday={TODAY}>{ui}</PlanProvider>);
}

export const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });
