/** @jest-environment jsdom */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IdeasView from "../../components/IdeasView";
import VendorsView from "../../components/VendorsView";
import { renderWithPlan, saved, jsonResponse } from "../helpers/renderWithPlan";

const ideas = ["Courtyard lunch", "Garden evening", "Temple-side feast"].map((title, i) => ({
  title, concept: `Concept ${i}`, fit: `Fit ${i}`, leansOn: ["venue", "decor", "catering"][i], effort: ["low", "medium", "high"][i],
}));

beforeEach(() => { global.fetch = jest.fn(); });

describe("ideas", () => {
  it("sends the plan and preferences, shows three ideas with effort and category, and saves preferences", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue(jsonResponse({ ideas }));
    renderWithPlan(<IdeasView />);

    await user.type(await screen.findByLabelText(/atmosphere/i), "quiet and traditional");
    await user.type(screen.getByLabelText(/who is coming/i), "many elders");
    await user.click(screen.getByRole("button", { name: /get ideas/i }));

    expect(await screen.findByRole("heading", { name: "Courtyard lunch" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("High effort")).toBeInTheDocument();
    expect(screen.getAllByText(/leans mostly on your/i)).toHaveLength(3);
    expect(screen.getByText(/don.t include prices/i)).toBeInTheDocument();

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ occasion: "wedding", total: 800000, guests: 200, preferences: { vibe: "quiet and traditional", ages: "many elders" }, refine: "" });
    expect(body).not.toHaveProperty("eventDate");
    await waitFor(() => expect(saved().preferences.vibe).toBe("quiet and traditional"));
  });

  it("identical requests are served from the client cache; a refinement makes exactly one more call", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue(jsonResponse({ ideas }));
    renderWithPlan(<IdeasView />);
    await user.click(await screen.findByRole("button", { name: /get ideas/i }));
    await screen.findByRole("heading", { name: "Courtyard lunch" });

    await user.click(screen.getByRole("button", { name: /refine ideas/i }));
    expect(fetch).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText(/want something different/i), "cheaper");
    await user.click(screen.getByRole("button", { name: /refine ideas/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body).refine).toBe("cheaper");
  });

  it.each([
    ["a server error message", () => fetch.mockResolvedValue(jsonResponse({ error: "Too many requests. Please wait a moment and try again." }, false)), /too many requests/i],
    ["a network failure", () => fetch.mockRejectedValue(new TypeError("Failed to fetch")), /failed to fetch|connection/i],
  ])("shows %s without crashing", async (_n, arrange, pattern) => {
    const user = userEvent.setup();
    arrange();
    renderWithPlan(<IdeasView />);
    await user.click(await screen.findByRole("button", { name: /get ideas/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(pattern);
    expect(screen.getByRole("button", { name: /get ideas/i })).toBeEnabled();
  });
});

describe("vendors", () => {
  it("lists what to decide and what to ask for each service", async () => {
    renderWithPlan(<VendorsView />);
    expect(await screen.findByText("Confirmed date and time slot")).toBeInTheDocument();
    expect(screen.getByText(/is the quote per plate or a total/i)).toBeInTheDocument();
    expect(screen.queryByText("Contingency buffer")).not.toBeInTheDocument();
  });

  it("compares quotes: all-in cost, per-guest cost, headcount coverage, and what is not stated, with no recommendation", async () => {
    const user = userEvent.setup();
    renderWithPlan(<VendorsView />);
    await user.selectOptions(await screen.findByLabelText("Which service?"), "catering");
    const f = (label) => screen.getAllByLabelText(label);

    await user.type(f("Vendor name")[0], "Spice Route");
    await user.type(f("Quoted price (₹)")[0], "200000");
    await user.type(f("Guests it covers")[0], "150");
    await user.type(f("Extra charges (₹)")[0], "20000");
    await user.selectOptions(f("Taxes included")[0], "yes");
    await user.type(f("Vendor name")[1], "Royal Feast");
    await user.type(f("Quoted price (₹)")[1], "230000");
    await user.type(f("Guests it covers")[1], "200");
    await user.click(screen.getByRole("button", { name: /compare quotes/i }));

    expect(await screen.findByText(/your catering budget is ₹2,40,000 for 200 guests/i)).toBeInTheDocument();
    const rowA = screen.getByRole("row", { name: /spice route/i });
    expect(rowA).toHaveTextContent("₹2,20,000");
    expect(rowA).toHaveTextContent("No, short of your headcount");
    expect(rowA).toHaveTextContent("₹20,000 under");
    expect(rowA).toHaveTextContent(/not stated: setup and cleanup included/i);
    expect(screen.getByRole("row", { name: /royal feast/i })).toHaveTextContent("Yes");
    expect(screen.getByText("Lowest all-in")).toBeInTheDocument();
    expect(screen.queryByText(/recommend/i)).not.toBeInTheDocument();
  });

  it("asks for at least two priced quotes", async () => {
    const user = userEvent.setup();
    renderWithPlan(<VendorsView />);
    await user.type((await screen.findAllByLabelText("Quoted price (₹)"))[0], "200000");
    await user.click(screen.getByRole("button", { name: /compare quotes/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least two quotes/i);
  });
});
