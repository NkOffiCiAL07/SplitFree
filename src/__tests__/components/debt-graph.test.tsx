import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DebtGraph, type GraphDebt, type GraphPerson } from "@/components/groups/debt-graph";

const people: GraphPerson[] = [{ id: "me", name: "Nishant" }, { id: "a", name: "Asha" }, { id: "b", name: "Bhanu" }, { id: "c", name: "Chitra" }];
const debts: GraphDebt[] = [
  { fromUserId: "me", toUserId: "a", amount: 24000, currency: "INR" },
  { fromUserId: "b", toUserId: "me", amount: 11500, currency: "INR" },
  { fromUserId: "c", toUserId: "a", amount: 6000, currency: "INR" },
];
const format = (cents: number, cur: string) => `${cur === "INR" ? "₹" : "$"}${(cents / 100).toLocaleString("en-IN")}`;
const edges = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-edge]")) as HTMLElement[];
const nodes = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-node]")) as HTMLElement[];

describe("DebtGraph", () => {
  it("draws one circle per person and one arrow per payment, with the amounts on the arrows", () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    expect(nodes(container)).toHaveLength(4);
    expect(edges(container)).toHaveLength(3);
    expect(container.textContent).toContain("₹240");
    expect(container.textContent).toContain("₹115");
    expect(container.textContent).toContain("₹60");
  });

  it("marks you (a dashed ring) and puts you first; others are named", () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    expect(container.querySelector("[data-me]")).toHaveAttribute("data-node", "me");
    expect(container.textContent).toContain("You");
    expect(container.textContent).toContain("Asha");
  });

  it("colours what you pay red and what you receive green; everyone else's is neutral", () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    const stroke = (id: string) => edges(container).find((e) => e.getAttribute("data-edge") === id)!.querySelector(".edge-line")!.getAttribute("stroke");
    expect(stroke("me>a")).toBe("#ef4444");
    expect(stroke("b>me")).toBe("#22c55e");
    expect(stroke("c>a")).toBe("#a78bfa");
  });

  it("thicker arrows are bigger amounts", () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    const w = (id: string) => Number(edges(container).find((e) => e.getAttribute("data-edge") === id)!.querySelector(".edge-line")!.getAttribute("stroke-width"));
    expect(w("me>a")).toBeGreaterThan(w("b>me"));
    expect(w("b>me")).toBeGreaterThan(w("c>a"));
  });

  it("tapping an arrow lights it up (the others fade) and explains it", async () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    await userEvent.click(edges(container)[0]);
    const detail = screen.getByTestId("debt-detail");
    expect(detail).toHaveTextContent(/You pay Asha ₹240/);
    expect(edges(container)[0]).toHaveAttribute("aria-pressed", "true");
    expect(edges(container)[1].style.opacity).toBe("0.16");
    await userEvent.click(container.querySelector("svg")!); // tapping the background clears it
    expect(screen.queryByTestId("debt-detail")).toBeNull();
  });

  it("tapping a person shows everything they pay and get", async () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    await userEvent.click(nodes(container).find((n) => n.getAttribute("data-node") === "a")!);
    const detail = within(screen.getByTestId("debt-detail"));
    expect(detail.getByText("Asha")).toBeInTheDocument();
    expect(detail.getByText(/gets ₹240 from You/)).toBeInTheDocument();
    expect(detail.getByText(/gets ₹60 from Chitra/)).toBeInTheDocument();
  });

  it("works with the keyboard: Tab to an arrow, Enter selects it", async () => {
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    edges(container)[1].focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("debt-detail")).toHaveTextContent(/Bhanu pays You ₹115/);
  });

  it("offers Pay only on a payment YOU owe, and a link to the expenses between you and that person", async () => {
    const onPay = vi.fn();
    const { container } = render(<DebtGraph people={people} debts={debts} meId="me" format={format} onPay={onPay} personHref={(id) => `/friends/${id}`} />);
    await userEvent.click(edges(container)[0]); // me > a
    await userEvent.click(screen.getByRole("button", { name: /^pay asha/i }));
    expect(onPay).toHaveBeenCalledWith(debts[0]);
    expect(screen.getByRole("link", { name: /expenses between you/i })).toHaveAttribute("href", "/friends/a");
    await userEvent.click(edges(container)[1]); // b > me: owed to me, nothing to pay
    expect(screen.queryByRole("button", { name: /^pay /i })).toBeNull();
    expect(screen.getByRole("link", { name: /expenses between you/i })).toHaveAttribute("href", "/friends/b");
    await userEvent.click(edges(container)[2]); // c > a: nothing to do with me
    expect(screen.queryByRole("link", { name: /expenses between you/i })).toBeNull();
  });

  it("shows one currency at a time, with a switcher, so rupees and dollars are never mixed in one picture", async () => {
    const mixed = [...debts, { fromUserId: "a", toUserId: "b", amount: 5000, currency: "USD" }];
    const { container } = render(<DebtGraph people={people} debts={mixed} meId="me" format={format} />);
    expect(edges(container)).toHaveLength(3);
    await userEvent.click(screen.getByRole("tab", { name: "USD" }));
    expect(edges(container)).toHaveLength(1);
    expect(container.textContent).toContain("$50");
    expect(nodes(container)).toHaveLength(2);
  });

  it("draws nothing when there is nothing to pay, and says so plainly when a group is too big for a picture", () => {
    const { container, rerender } = render(<DebtGraph people={people} debts={[]} meId="me" format={format} />);
    expect(container).toBeEmptyDOMElement();
    const many = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    const chain = many.slice(1).map((p, i) => ({ fromUserId: many[i].id, toUserId: p.id, amount: 100, currency: "INR" }));
    rerender(<DebtGraph people={many} debts={chain} format={format} />);
    expect(screen.getByText(/too big to draw clearly/i)).toBeInTheDocument();
  });

  it("describes the whole picture to screen readers, and each arrow and person has its own label", () => {
    render(<DebtGraph people={people} debts={debts} meId="me" format={format} />);
    expect(screen.getByRole("group", { name: /3 payments between 4 people/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "You pay Asha ₹240" })).toBeInTheDocument(); // (not "You pays")
    expect(screen.getByRole("button", { name: "Bhanu pays You ₹115" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Asha: 0 to pay, 2 to receive/ })).toBeInTheDocument();
  });
});
