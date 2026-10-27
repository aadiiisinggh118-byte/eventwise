/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import PlanLayout from "../../app/plan/layout";
import SetupPage, { metadata as setupMeta } from "../../app/plan/page";
import BudgetPage, { metadata as budgetMeta } from "../../app/plan/budget/page";
import TimelinePage, { metadata as timelineMeta } from "../../app/plan/timeline/page";
import VendorsPage, { metadata as vendorsMeta } from "../../app/plan/vendors/page";
import IdeasPage, { metadata as ideasMeta } from "../../app/plan/ideas/page";
import ChangesPage, { metadata as changesMeta } from "../../app/plan/changes/page";
import { renderWithPlan } from "../helpers/renderWithPlan";

describe("every route renders its page and has its own title", () => {
  it.each([
    ["setup", SetupPage, setupMeta, /set up your event/i],
    ["budget", BudgetPage, budgetMeta, /your budget/i],
    ["timeline", TimelinePage, timelineMeta, /your timeline/i],
    ["vendors", VendorsPage, vendorsMeta, /vendor checklist/i],
    ["ideas", IdeasPage, ideasMeta, /ideas that fit you/i],
    ["changes", ChangesPage, changesMeta, /when things change/i],
  ])("%s", async (_n, Page, meta, heading) => {
    renderWithPlan(<Page />);
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(meta.title).toMatch(/Eventwise$/);
  });

  it("the plan layout provides the plan to its pages and shows the section navigation", async () => {
    localStorage.clear();
    render(<PlanLayout><BudgetPage /></PlanLayout>);
    expect(await screen.findByRole("navigation", { name: /plan sections/i })).toBeInTheDocument();
    expect(await screen.findByText(/haven.t set up an event yet/i)).toBeInTheDocument();
  });
});
