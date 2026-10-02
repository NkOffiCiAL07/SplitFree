import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

// Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

// framer-motion — render as plain elements in tests
vi.mock("framer-motion", () => {
  const tags = ["div", "span", "button", "a", "ul", "li", "p", "h1", "h2", "h3", "section", "article", "nav"];
  const motion = Object.fromEntries(
    tags.map((tag) => [
      tag,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ children, animate, initial, exit, transition, variants, whileHover, whileTap, layout, ...rest }: any) =>
        React.createElement(tag, rest, children),
    ])
  );
  return {
    motion,
    m: motion,
    LazyMotion: ({ children }: { children: React.ReactNode }) => children,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
    useMotionValue: (v: unknown) => ({ get: () => v, set: vi.fn() }),
    useTransform: () => ({ get: () => 0 }),
  };
});

// qrcode.react
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) =>
    React.createElement("svg", { "data-testid": "qr-code", "data-value": value }),
  QRCodeCanvas: ({ value }: { value: string }) =>
    React.createElement("canvas", { "data-testid": "qr-canvas", "data-value": value }),
}));
