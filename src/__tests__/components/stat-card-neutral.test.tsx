import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";

describe("StatCard", () => {
  it("a neutral card (nothing owed either way) uses no green or red", () => {
    render(<StatCard title="You Owe" value="₹0.00" icon={Wallet} variant="neutral" />);
    const value = screen.getByText("₹0.00");
    expect(value.className).toContain("text-foreground");
    expect(value.className).not.toMatch(/green|red/);
  });
  it("the money variants keep their meaning: green is owed to you, red is what you owe", () => {
    render(<><StatCard title="a" value="₹1" icon={Wallet} variant="green" /><StatCard title="b" value="₹2" icon={Wallet} variant="red" /></>);
    expect(screen.getByText("₹1").className).toContain("text-green-600");
    expect(screen.getByText("₹2").className).toContain("text-red-600");
  });
});
