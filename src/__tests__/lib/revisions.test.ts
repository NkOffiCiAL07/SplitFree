import { describe, it, expect } from "vitest";
import { snapshotExpense, diffSnapshots, describeChange } from "@/lib/revisions";

const base = {
  description: "Dinner", amount: 30000, currency: "INR", category: "FOOD", date: "2026-03-01T10:00:00.000Z",
  notes: null, splitType: "EQUAL", paidById: "a", isRecurring: false, recurringInterval: null,
  splits: [{ userId: "b", amount: 15000 }, { userId: "a", amount: 15000 }],
};
const names: Record<string, string> = { a: "Asha", b: "Bhanu", c: "Chitra" };
const nameOf = (id: string) => names[id] ?? "Someone";

describe("snapshotExpense", () => {
  it("normalises dates and orders participants deterministically", () => {
    const s = snapshotExpense(base);
    expect(s.date).toBe("2026-03-01");
    expect(s.participants).toEqual(["a", "b"]);
    expect(s.shares).toEqual({ a: 15000, b: 15000 });
    expect(s.payers).toEqual([]);
  });
});

describe("diffSnapshots", () => {
  it("is empty when nothing changed (even if split order differs)", () => {
    const a = snapshotExpense(base);
    const b = snapshotExpense({ ...base, splits: [...base.splits].reverse() });
    expect(diffSnapshots(a, b)).toEqual({});
  });

  it("reports changed fields with before and after", () => {
    const before = snapshotExpense(base);
    const after = snapshotExpense({ ...base, description: "Dinner at Taj", category: "ENTERTAINMENT", notes: "birthday" });
    expect(diffSnapshots(before, after)).toEqual({
      description: { from: "Dinner", to: "Dinner at Taj" },
      category: { from: "FOOD", to: "ENTERTAINMENT" },
      notes: { from: null, to: "birthday" },
    });
  });

  it("an amount change doesn't also list the implied share changes", () => {
    const before = snapshotExpense(base);
    const after = snapshotExpense({ ...base, amount: 40000, splits: [{ userId: "a", amount: 20000 }, { userId: "b", amount: 20000 }] });
    const d = diffSnapshots(before, after);
    expect(Object.keys(d)).toEqual(["amount"]);
  });

  it("detects added participants and payer changes", () => {
    const before = snapshotExpense(base);
    const after = snapshotExpense({
      ...base, paidById: "b", payers: [{ userId: "b", amount: 20000 }, { userId: "a", amount: 10000 }],
      splits: [{ userId: "a", amount: 10000 }, { userId: "b", amount: 10000 }, { userId: "c", amount: 10000 }],
    });
    const d = diffSnapshots(before, after);
    expect(d.paidBy).toEqual({ from: "a", to: "b" });
    expect(d.participants).toEqual({ from: ["a", "b"], to: ["a", "b", "c"] });
    expect(d.payers?.to).toHaveLength(2);
  });
});

describe("describeChange", () => {
  it("formats money in the expense currency", () => {
    expect(describeChange("amount", { from: 50000, to: 65000 }, nameOf, "INR")).toBe("Amount: ₹500.00 → ₹650.00");
  });
  it("names people instead of ids", () => {
    expect(describeChange("paidBy", { from: "a", to: "b" }, nameOf)).toBe("Paid by: Asha → Bhanu");
    expect(describeChange("participants", { from: ["a", "b"], to: ["a", "c"] }, nameOf)).toBe("Split between: added Chitra; removed Bhanu");
  });
  it("describes payers, recurrence and plain text fields", () => {
    expect(describeChange("payers", { from: [], to: [{ userId: "a", amount: 10000 }, { userId: "b", amount: 5000 }] }, nameOf, "INR"))
      .toBe("Payers: single payer → Asha ₹100.00, Bhanu ₹50.00");
    expect(describeChange("isRecurring", { from: false, to: true }, nameOf)).toBe("Recurring: turned on");
    expect(describeChange("notes", { from: null, to: "hi" }, nameOf)).toBe("Notes: — → hi");
  });
});
