// Node environment on purpose: react-dom/server needs it.
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout, { metadata } from "../app/layout";

describe("root layout", () => {
  const html = renderToStaticMarkup(<RootLayout><p>hello</p></RootLayout>);
  it("declares the language, a skip link that targets the main landmark, and exactly one main", () => {
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('href="#main"');
    expect(html.match(/<main id="main"/g)).toHaveLength(1);
    expect(html).toContain("<header");
    expect(html).toContain("<footer");
    expect(html).toContain("hello");
  });
  it("sets a descriptive page title and description", () => {
    expect(metadata.title).toMatch(/Eventwise/);
    expect(metadata.description.length).toBeGreaterThan(40);
  });
});
