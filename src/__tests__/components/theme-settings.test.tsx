import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSettings } from "@/components/settings/theme-settings";

const html = document.documentElement;
beforeEach(() => { html.removeAttribute("data-accent"); html.removeAttribute("data-oled"); localStorage.clear(); });

describe("ThemeSettings", () => {
  it("offers the six colours, violet selected by default", () => {
    render(<ThemeSettings />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Violet" })).toBeChecked();
  });

  it("choosing a colour applies it to the page at once and remembers it on this device", async () => {
    render(<ThemeSettings />);
    await userEvent.click(screen.getByRole("radio", { name: "Ocean" }));
    expect(html.getAttribute("data-accent")).toBe("ocean");
    expect(localStorage.getItem("splitr-accent")).toBe("ocean");
    expect(screen.getByRole("radio", { name: "Ocean" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Violet" })).not.toBeChecked();
  });

  it("starts from the colour already on the page (set before it painted)", () => {
    html.setAttribute("data-accent", "sunset");
    render(<ThemeSettings />);
    expect(screen.getByRole("radio", { name: "Sunset" })).toBeChecked();
  });

  it("pure black switches on and off, on the page and in storage", async () => {
    render(<ThemeSettings />);
    const toggle = screen.getByRole("switch", { name: /pure black/i });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(html.hasAttribute("data-oled")).toBe(true);
    expect(localStorage.getItem("splitr-oled")).toBe("1");
    await userEvent.click(toggle);
    expect(html.hasAttribute("data-oled")).toBe(false);
    expect(localStorage.getItem("splitr-oled")).toBe("0");
  });

  it("still works when storage is blocked (the choice just isn't remembered)", async () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
    try {
      render(<ThemeSettings />);
      await userEvent.click(screen.getByRole("radio", { name: "Teal" }));
      expect(html.getAttribute("data-accent")).toBe("teal");
    } finally { Storage.prototype.setItem = orig; }
  });
});
