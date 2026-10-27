// Small shared building blocks, so every page looks and behaves the same.

export const btn = "inline-flex items-center justify-center rounded-md px-4 py-2.5 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
export const btnPrimary = `${btn} bg-plum text-white hover:bg-plum-mid`;
export const btnAccent = `${btn} bg-marigold text-ink hover:bg-marigold-light`;
export const btnGhost = `${btn} border border-plum text-plum hover:bg-info-bg`;
export const inputCls = "block w-full rounded-md border border-edge bg-white px-3 py-2 text-ink";

export function PageHeading({ title, children }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl text-ink">{title}</h1>
      {children && <p className="mt-2 max-w-prose text-ink-soft">{children}</p>}
    </header>
  );
}

export function Panel({ children, className = "", ...rest }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 sm:p-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** Label + hint + error wired to the input via aria-describedby. `children` receives the props to spread on the input. */
export function Field({ id, label, hint, error, children }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">{label}</label>
      {hint && <p id={`${id}-hint`} className="mb-1 text-sm text-ink-soft">{hint}</p>}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}

const TONES = { ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", bad: "bg-bad-bg text-bad", info: "bg-info-bg text-info" };

export function Badge({ tone = "info", children }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${TONES[tone]}`}>{children}</span>;
}

const NOTICE = { info: "border-plum-mid bg-info-bg text-info", warn: "border-warn bg-warn-bg text-warn", bad: "border-bad bg-bad-bg text-bad", ok: "border-ok bg-ok-bg text-ok" };

export function Notice({ tone = "info", children, ...rest }) {
  return <div className={`rounded-r-md border-l-4 px-4 py-3 text-sm font-medium ${NOTICE[tone]}`} {...rest}>{children}</div>;
}
