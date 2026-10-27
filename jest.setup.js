require("@testing-library/jest-dom");

// next/navigation needs the App Router at runtime; tests only need to observe navigation.
jest.mock("next/navigation", () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }), usePathname: () => "/plan", __push: push };
});

// jsdom has no IntersectionObserver (next/link uses it for prefetch).
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
