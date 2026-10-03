import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";
import { MARK, brandMarkSvg } from "@/lib/brand-mark";

describe("BrandMark", () => {
  it("is decorative by default (hidden from screen readers) and sized as asked", () => {
    render(<BrandMark size={40} />);
    const svg = screen.getByTestId("brand-mark");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "40");
    expect(svg).toHaveAttribute("height", "40");
  });

  it("is announced as an image when given a title", () => {
    render(<BrandMark title="Splitr Pro logo" />);
    expect(screen.getByRole("img", { name: "Splitr Pro logo" })).toBeInTheDocument();
  });

  it("draws the split coin: two halves, one shifted to open the gap", () => {
    render(<BrandMark />);
    const paths = [...screen.getByTestId("brand-mark").querySelectorAll("path")].map((p) => p.getAttribute("d"));
    expect(paths).toContain(MARK.halfA);
    expect(paths).toContain(MARK.halfB);
    const b = screen.getByTestId("brand-mark").querySelector(`path[d="${MARK.halfB}"]`)!;
    expect(b.getAttribute("transform")).toBe(`translate(${MARK.gap} ${MARK.gap})`);
  });

  it("two logos on one page never clash on gradient ids", () => {
    render(<><BrandMark /><BrandMark /></>);
    const ids = [...document.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("BrandLogo", () => {
  it("is named 'Splitr Pro' for assistive tech once, while the visual wordmark is decorative", () => {
    render(<BrandLogo />);
    expect(screen.getAllByText("Splitr Pro")).toHaveLength(1); // the sr-only name
    const visual = screen.getByText("Splitr");
    expect(visual.closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("light tone (for dark/colourful backgrounds) uses white text; dark tone follows the theme", () => {
    const { rerender } = render(<BrandLogo tone="light" />);
    expect(screen.getByText("Splitr")).toHaveClass("text-white");
    rerender(<BrandLogo tone="dark" />);
    expect(screen.getByText("Splitr")).toHaveClass("text-foreground");
  });

  it("scales the wordmark with the mark", () => {
    const { rerender } = render(<BrandLogo size={30} />);
    const px = () => parseInt((screen.getByText("Splitr").parentElement as HTMLElement).style.fontSize);
    const small = px();
    rerender(<BrandLogo size={60} />);
    expect(Math.abs(px() - small * 2)).toBeLessThanOrEqual(1); // proportional (rounded to whole pixels)
  });
});

describe("brandMarkSvg (used to generate the app icons)", () => {
  it("rounded variant has a squircle and glossy top; bleed variant fills the square for maskable icons", () => {
    const rounded = brandMarkSvg({ variant: "rounded" });
    const bleed = brandMarkSvg({ variant: "bleed" });
    expect(rounded).toContain('rx="13"');
    expect(rounded).toContain('fill="url(#gloss)"');
    expect(bleed).toContain('rx="0"');
    expect(bleed).not.toContain("gloss)");
    for (const svg of [rounded, bleed]) {
      expect(svg).toContain(MARK.halfA);
      expect(svg).toContain(MARK.halfB);
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    }
  });

  it("honours the requested size", () => {
    expect(brandMarkSvg({ size: 96 })).toContain('width="96" height="96"');
  });
});
