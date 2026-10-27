import Link from "next/link";
import Icon from "../components/Icons";
import { buildBudget } from "../lib/budget";
import { formatINR, formatCompactINR } from "../lib/money";
import { OCCASIONS } from "../lib/occasions";

// The hero card is produced by the real engines, so it can never drift from what the app does.
const EXAMPLE = { occasion: "wedding", total: 800000, guests: 200 };
const example = buildBudget(EXAMPLE);
const topLines = [...example.lines].sort((a, b) => b.amount - a.amount).slice(0, 5);
const nextTasks = OCCASIONS.wedding.tasks.filter((t) => ["w-venue", "w-caterer", "w-confirm"].includes(t.id));

const FEATURES = [
  { icon: "rupee", title: "A budget that always adds up", text: "Your total is split by what matters to you. Every category is calculated by code, so the parts equal the whole to the rupee." },
  { icon: "calendar", title: "A timeline worked backwards", text: "Every task gets a date counted back from the event. Delay one and you see exactly which others it pushes." },
  { icon: "checklist", title: "Vendor questions ready to ask", text: "For each vendor, what to decide first and what to ask. Compare quotes side by side, with what each one leaves unsaid." },
  { icon: "sparkles", title: "Ideas that fit your people", text: "Tell it who is coming and what the place allows. Gemini suggests ideas that respect your priorities and never quotes a price." },
  { icon: "refresh", title: "Re-planning, not starting over", text: "Budget cut, guests added, date moved earlier? See what changes before you commit. Costs over by 20%? Get worked-out ways to close the gap." },
];

const STEPS = [
  ["Tell us the basics", "Occasion, budget, guest count, date, and what matters most."],
  ["Review your plan", "A budget split, a dated checklist and vendor questions appear immediately."],
  ["Change anything, any time", "Edit a number and see the whole plan adjust, with a plain list of what changed."],
];

export default function Home() {
  return (
    <>
      <section className="on-dark bg-plum text-white">
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <h1 className="text-4xl leading-[1.1] sm:text-5xl">An event plan that survives <span className="text-marigold">changes</span>.</h1>
            <p className="mt-5 max-w-prose text-lg text-on-dark">
              Give Eventwise your <strong className="text-white">budget</strong>, <strong className="text-white">guest count</strong> and <strong className="text-white">date</strong>.
              You get a budget split, a dated checklist and vendor questions. Change any of the three and the whole plan adjusts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/plan" className="inline-flex rounded-md bg-marigold px-5 py-3 font-bold text-ink hover:bg-marigold-light">Start planning</Link>
              <a href="#how" className="inline-flex rounded-md border border-on-dark px-5 py-3 font-semibold text-white hover:bg-plum-mid">See how it works</a>
            </div>
          </div>

          <div aria-hidden="true" className="rounded-xl bg-white p-5 text-ink shadow-xl">
            <p className="text-sm text-ink-soft">Example: a wedding for {EXAMPLE.guests} guests</p>
            <p className="num text-3xl font-extrabold">{formatCompactINR(EXAMPLE.total)}</p>
            <ul className="mt-4 space-y-2">
              {topLines.map((l) => (
                <li key={l.id}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{l.label}</span><span className="num">{formatINR(l.amount)}</span></div>
                  <div className="mt-1 h-2 rounded bg-line"><div className="h-2 rounded bg-plum" style={{ width: `${Math.round(l.share * 100 * 2.5)}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-line pt-3 text-sm font-semibold text-ink-soft">First bookings to make</p>
            <ul className="mt-1 space-y-1 text-sm">
              {nextTasks.map((t) => (
                <li key={t.id} className="flex justify-between gap-3"><span>{t.title}</span><span className="num shrink-0 font-semibold text-plum">{t.offsetDays} days out</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-page px-5 py-16">
        <h2 className="max-w-prose text-3xl sm:text-4xl">Everything in an event is connected, and that is what makes it stressful.</h2>
        <p className="mt-4 max-w-prose text-lg text-ink-soft">
          Add guests and the <strong className="text-ink">food bill</strong> moves. Move the date and every <strong className="text-ink">booking deadline</strong> moves with it.
          Cut the budget and something has to give. A list of party ideas doesn&rsquo;t help with any of that. A plan that adjusts does.
        </p>

        <ul className="m-0 mt-10 grid list-none gap-x-12 gap-y-8 p-0 md:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4 border-t border-line pt-5">
              <span className="mt-1 text-plum"><Icon name={f.icon} size={28} /></span>
              <div>
                <h3 className="text-xl">{f.title}</h3>
                <p className="mt-1 text-ink-soft">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="on-dark bg-plum-dark text-white">
        <div className="mx-auto max-w-page px-5 py-16">
          <h2 className="max-w-prose text-3xl sm:text-4xl">Why not just ask a chatbot?</h2>
          <p className="mt-4 max-w-prose text-lg text-on-dark">A chatbot gives you ideas. It also forgets your constraints, and its arithmetic can be wrong. Eventwise is built the other way round.</p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-xl text-marigold">The numbers are code, not guesses</h3>
              <p className="mt-2 text-on-dark">Budget splits, dates and trade-offs are calculated by tested functions. The AI never does arithmetic, so it can&rsquo;t get it wrong.</p>
            </div>
            <div>
              <h3 className="text-xl text-marigold">Changes don&rsquo;t mean starting over</h3>
              <p className="mt-2 text-on-dark">Edit the budget, guests or date and the plan recalculates instantly on your device. You see what changed before you save it.</p>
            </div>
            <div>
              <h3 className="text-xl text-marigold">It is honest about what it knows</h3>
              <p className="mt-2 text-on-dark">Amounts are shares of your own budget, never invented vendor prices. The AI is blocked from stating prices at all, and its answers are checked before you see them.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-page px-5 py-16">
        <h2 className="text-3xl sm:text-4xl">How it works</h2>
        <ol className="m-0 mt-8 grid list-none gap-8 p-0 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title}>
              <span aria-hidden="true" className="num text-5xl font-extrabold text-marigold">{i + 1}</span>
              <h3 className="mt-2 text-xl">{title}</h3>
              <p className="mt-1 text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12">
          <Link href="/plan" className="inline-flex rounded-md bg-plum px-5 py-3 font-bold text-white hover:bg-plum-mid">Plan your first event</Link>
        </div>
      </section>
    </>
  );
}
