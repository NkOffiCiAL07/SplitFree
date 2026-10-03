import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Reveal } from "@/components/landing/reveal";
import { RotatingWords } from "@/components/landing/rotating-words";

type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
let trigger: IOCallback | null = null;
const disconnect = vi.fn();

function stubIO() {
  vi.stubGlobal("IntersectionObserver", class { constructor(cb: IOCallback) { trigger = cb; } observe() {} disconnect = disconnect; });
}
const rectTop = (top: number) => vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top, toJSON() {} });
const reducedMotion = (on: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));

beforeEach(() => { trigger = null; disconnect.mockReset(); Object.defineProperty(window, "innerHeight", { value: 800, configurable: true }); reducedMotion(false); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Reveal", () => {
  it("leaves content already on screen alone (no flash of hidden content)", () => {
    stubIO(); rectTop(100);
    render(<Reveal><p>hello</p></Reveal>);
    expect(screen.getByText("hello").parentElement).not.toHaveClass("reveal-armed");
  });

  it("hides content below the fold, then reveals it when it scrolls into view, once", () => {
    stubIO(); rectTop(2000);
    render(<Reveal delay={160}><p>later</p></Reveal>);
    const el = screen.getByText("later").parentElement!;
    expect(el).toHaveClass("reveal-armed");
    expect(el).not.toHaveClass("is-visible");
    expect(el.style.transitionDelay).toBe("160ms");
    act(() => trigger!([{ isIntersecting: false }]));
    expect(el).not.toHaveClass("is-visible");
    act(() => trigger!([{ isIntersecting: true }]));
    expect(el).toHaveClass("is-visible");
    expect(disconnect).toHaveBeenCalled(); // stops watching once shown
  });

  it("never hides anything for people who prefer reduced motion, or where IntersectionObserver is missing", () => {
    stubIO(); rectTop(2000); reducedMotion(true);
    const { unmount } = render(<Reveal><p>a</p></Reveal>);
    expect(screen.getByText("a").parentElement).not.toHaveClass("reveal-armed");
    unmount();
    reducedMotion(false);
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal><p>b</p></Reveal>);
    expect(screen.getByText("b").parentElement).not.toHaveClass("reveal-armed");
  });
});

describe("RotatingWords", () => {
  it("cycles with a timer and wraps around", () => {
    vi.useFakeTimers();
    render(<RotatingWords words={["a", "b", "c"]} intervalMs={1000} />);
    const word = () => screen.getByTestId("rotating-word").textContent;
    expect(word()).toBe("a");
    act(() => { vi.advanceTimersByTime(1000); }); expect(word()).toBe("b");
    act(() => { vi.advanceTimersByTime(1000); }); expect(word()).toBe("c");
    act(() => { vi.advanceTimersByTime(1000); }); expect(word()).toBe("a");
  });

  it("stays on the first phrase with reduced motion, or when there's only one", () => {
    vi.useFakeTimers();
    reducedMotion(true);
    render(<RotatingWords words={["a", "b"]} intervalMs={1000} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId("rotating-word")).toHaveTextContent("a");
  });

  it("stops its timer on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(<RotatingWords words={["a", "b"]} intervalMs={1000} />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
