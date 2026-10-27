import Link from "next/link";

export default function Header() {
  return (
    <header className="on-dark bg-plum-dark text-white">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-marigold" />
          Eventwise
        </Link>
        <nav aria-label="Main">
          <Link href="/plan" className="rounded-md bg-marigold px-4 py-2 font-semibold text-ink hover:bg-marigold-light">
            Start planning
          </Link>
        </nav>
      </div>
    </header>
  );
}
