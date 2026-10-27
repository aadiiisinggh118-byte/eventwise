# Eventwise: an event plan that survives changes

Eventwise turns a **budget**, a **guest count** and a **date** into a budget split, a dated checklist and vendor questions. When any of the three changes, the whole plan re-plans instantly. It is built for people organising their own wedding, birthday or community event in India.

**The idea in one line: code decides, Gemini explains.** Every number, date and trade-off is computed by tested pure functions. Gemini is used for exactly two things where language helps: ideas that fit the people involved, and plain-language trade-offs. It is never asked to do arithmetic, and it is technically blocked from stating a price.

## The problem, and why a chatbot isn't enough

Planning an event is a set of connected decisions: add guests and the food bill moves, move the date and every booking deadline moves, cut the budget and something has to give. A generic assistant gives a list of ideas, forgets constraints, and its sums can be wrong. Eventwise keeps the constraints, does the maths in code, and revises the plan when something changes instead of starting over.

**Who it is for:** a family or organiser planning one event with a fixed budget, headcount and date.

## What the brief asked for, and where it lives

| Requirement from the challenge | Feature | Where | Done by |
|---|---|---|---|
| Budgets | Split by weighted priorities. Categories always sum to the budget to the rupee. Marked as estimates. | `lib/budget.js`, `lib/money.js`, `components/BudgetView.jsx` | Code |
| Timelines | Tasks dated backwards from the event, with dependencies. A delay pushes dependents and names them. A short runway compresses all dates in order. | `lib/timeline.js`, `components/TimelineView.jsx` | Code |
| Vendor checklists | Per service: what to decide and what to ask. | `lib/occasions.js`, `lib/vendors.js`, `components/VendorsView.jsx` | Code |
| Compare vendor quotes | All-in cost, per-guest cost, headcount coverage, budget gap, and what each quote doesn't state. No vendor is recommended. | `lib/vendors.js` (`compareQuotes`) | Code |
| Personalised ideas | Asks about atmosphere, ages, culture, accessibility and venue limits. Refine with "cheaper" or "more kid-friendly". | `ai/ideas.js`, `components/IdeasView.jsx` | **Gemini** |
| "Expenses are 20% over": trade-offs, not blind cuts | Three worked-out ways to close the gap (protect priorities, spread evenly, fewer guests), then a neutral pros-and-cons explanation. | `lib/tradeoffs.js` (options), `ai/tradeoffs.js` (explanation) | Code computes, **Gemini** explains |
| Revise the plan after a change, not from scratch | Edit budget, guests or date. See a plain list of what changes before saving. Progress is kept. | `lib/plan.js`, `components/ChangesView.jsx` | Code |
| Don't invent prices or claim availability | No prices are generated anywhere. Gemini output containing any money amount is rejected and retried. | `lib/validateAI.js` | Code |
| Keep the user in control | Every change is previewed. Trade-offs are applied only on a click and can be undone. | `components/ChangesView.jsx` | Code |

## GenAI usage (explicit)

Gemini (`gemini-2.5-flash`, configurable with `GEMINI_MODEL`) is used in **two places and nowhere else**:

| # | Feature | Prompt | Call site | Output checks |
|---|---|---|---|---|
| 1 | Personalised event ideas | `ai/ideas.js` (`buildIdeasPrompt`) | `POST /api/ideas` | Exactly 3 ideas; `leansOn` must be one of this occasion's category ids; length limits; unique titles; **no money amounts** (`lib/validateAI.js`) |
| 2 | Plain-language trade-off explanation | `ai/tradeoffs.js` (`buildTradeoffPrompt`) | `POST /api/tradeoffs` | One entry per option id the engine produced (no invented options); 1-3 pros and cons; length limits; **no money amounts** |

Both go through one shared helper, `ai/runWithSelfHealingRetry.js`: one model call, then if the answer fails validation, exactly **one** corrective retry with the errors fed back, then a safe failure. A request never costs more than two model calls.

What Gemini never does: arithmetic, scheduling, deciding which options exist, or stating prices. The trade-off route rebuilds the options **on the server** from validated inputs. It never trusts client-supplied options.

## Architecture

```
Browser (all of this runs locally, no network)          Server (only the two AI features)
┌──────────────────────────────────────────┐            ┌────────────────────────────────────┐
│ Setup ─▶ computePlan()                   │            │ POST /api/ideas     POST /api/tradeoffs │
│   lib/budget.js    split, exact to rupee │            │   rate limit ▸ size cap ▸ validate  │
│   lib/timeline.js  dated, dependencies   │   ideas /  │   ▸ cache ▸ Gemini (1 call, ≤2)     │
│   lib/tradeoffs.js worked-out options    │  explain   │   ▸ validate output ▸ respond       │
│   lib/plan.js      "what changed" diff   │ ─────────▶ │   key lives only in this process    │
│ Plan saved in localStorage (re-validated)│ ◀───────── │                                     │
└──────────────────────────────────────────┘            └────────────────────────────────────┘
```

Planning knowledge (budget shares, task templates, vendor questions) is **data** in `lib/occasions.js`; the engines are pure functions over it.

## Evaluation criteria → evidence

| Criterion | Evidence |
|---|---|
| **Code quality** | Pure engines in `lib/` (no I/O, no secrets, enforced by `tests/architecture.test.js`). AI code isolated in `ai/`. One shared retry helper and one shared API handler (`lib/handleApi.js`) instead of per-route copies. Planning data separated from logic. JSDoc on every engine function. No dead code. |
| **Security** | `npm audit`: **0 vulnerabilities** (Next.js 15.5.28, patched Tailwind parser override). API key read only server-side, sent in a header (never in a URL), redacted from logs, never in prompts (tested). Strict CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, no `X-Powered-By`. Every input validated and sanitised on client and server. Body-size cap, per-client rate limit, generic error messages that never leak internals. Prompt-injection hardening: user text is passed as JSON data inside delimiters with an explicit ignore-instructions rule. Saved browser data is re-validated on load. |
| **Efficiency** | See the numbers below. |
| **Testing** | **206 tests, 13 suites, 99.8% statement coverage** (`npm run test:coverage`): randomised property tests (budgets sum exactly across 500 random cases), data-integrity tests of every task graph, engine tests, validator tests, Gemini client tests (timeout, retry, no key in URL), API route tests (400/413/429/500, cache, redaction), integration tests that click through real pages, axe audits, and architecture tests that fail if the AI/secret boundary is broken. |
| **Accessibility** | axe audit on every page **and** every state that appears after an action (errors, results, AI output, quote table): `tests/integration/accessibility.test.jsx`. Contrast ratios are computed, not eyeballed: `tests/colorContrast.test.js` (all text pairs ≥ 4.5:1, input borders ≥ 3:1). Skip link, one `<main>`, labelled inputs with `aria-describedby` errors, `aria-live` status regions, `aria-current` navigation, tables with captions and header scopes, status never conveyed by colour alone, visible focus, reduced-motion support. |
| **Problem-statement alignment** | The feature table above maps each requirement raised in the challenge explainer to a file. |
| **Google services** | Gemini API powers both AI features (`ai/callGemini.js`). |

### Efficiency evidence (measured)

| Measure | Result |
|---|---|
| Re-planning after a change (budget, guests, date, trade-offs) | **0 network calls**, runs in the browser; asserted by tests (`tests/integration/flow.test.jsx`, `tests/architecture.test.js`) |
| Full plan computation | **~0.2 ms** per plan (1,500 plans in ~285 ms, `tests/architecture.test.js`) |
| Model calls | **1 per AI request, never more than 2**; identical requests answered from a server cache and a client cache; Gemini "thinking" disabled for these short structured tasks; 20 s timeout; sizes capped (`maxOutputTokens` 900) |
| Only two AI routes | Fewer tools and routes than a typical chatbot design; asserted by a test |
| Landing page JavaScript | **162 B** of its own JS (a server component); 106 kB first load, almost all of it React/Next's shared runtime |
| Plan pages | 1.5 to 4 kB of page JS each (116 to 119 kB first load including the shared runtime) |
| CSS | 17 kB raw, **4.2 kB gzipped** |
| Dependencies | Runtime: `next`, `react`, `react-dom` only. No UI library, no chart library, no icon package (a handful of inline SVG paths), no document parser |
| Data | No database, no login. The plan lives in `localStorage` |

## Assumptions and limitations (stated plainly)

- **Amounts are shares of your own budget, not predicted prices.** Nothing here knows what a venue or caterer costs. The share table (`lib/occasions.js`) and the "minimum per guest" warning levels (₹2,000 wedding, ₹600 birthday, ₹250 community) are planning assumptions, editable in one file.
- Three occasion templates: wedding, birthday, community event. Dates assume one event date, not multi-day ceremonies.
- Ideas are suggestions. They don't include prices or check vendor availability, and the app never claims either.
- The rate limiter and server cache are in memory, so they are **per server instance**. On serverless hosting a determined client could spread requests across instances. It still stops accidental floods and repeated identical calls.
- The "fewer guests" option scales only costs marked guest-driven (catering, guest travel, cake). Real vendors may price differently, which is why every figure is labelled an estimate.
- Quote comparison does arithmetic on what you type. It can't know whether a quote is fair.
- Indian number formatting is hand-written so server and browser always agree.

## How this was built (AI tools and prompts)

- **Claude (Anthropic)** was used as an AI pair-programmer to implement and test the design, working from the problem-statement explainer's requirements. The design decisions are recorded in this README: split deterministic logic from AI, keep the AI to two features, bound every AI call, and make the architecture rules testable.
- **Gemini API** is the runtime model (above).
- **Prompt flow for the two runtime prompts:** (1) a system prompt fixing the role and rules, with the user's text supplied separately as JSON inside `<event_data>` delimiters; (2) a strict JSON schema in the prompt; (3) code-side validation of the reply; (4) one retry that quotes the validation errors back to the model. Prompt excerpts are in `ai/ideas.js` and `ai/tradeoffs.js`.
- **Design rule:** a prompt can ask, but only code can guarantee. Every rule the model is given (no prices, only known ids, exactly three ideas, one entry per option) is also enforced by a validator. The tests prove the validator rejects each violation and that the single retry then corrects it.

## Run it

```bash
npm install
cp .env.example .env.local      # then put your Gemini key in .env.local
npm run dev                     # http://localhost:3000
npm test                        # 206 tests
npm run test:coverage
npm run build && npm start
```

Deploy on Vercel: import the repo and add `GEMINI_API_KEY` under Environment Variables. Never commit `.env.local` (it is gitignored; `.env.example` is the safe template).

## Project layout

```
lib/          pure engines + validators (no network, no secrets)
ai/           Gemini client, the two prompts, shared retry helper (server only)
app/          pages and the two API routes
components/   UI (client components for the plan views)
tests/        unit, API, integration, accessibility, architecture
```
