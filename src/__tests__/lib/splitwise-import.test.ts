import { describe, it, expect } from "vitest";
import {
  parseCsv, toCentsLoose, normaliseDate, parseSplitwiseCsv, mapCategory, rowToRecord, type SplitwiseRow,
} from "@/lib/splitwise-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines, CRLF and a BOM", () => {
    const text = '﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n"multi\nline",2,3\r\n';
    expect(parseCsv(text)).toEqual([["a", "b", "c"], ["1", "x, y", 'say "hi"'], ["multi\nline", "2", "3"]]);
  });
  it("drops blank lines and keeps a final row without a trailing newline", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("toCentsLoose", () => {
  it("parses money formats safely", () => {
    expect(toCentsLoose("1,234.56")).toBe(123456);
    expect(toCentsLoose("-20.00")).toBe(-2000);
    expect(toCentsLoose("(5.50)")).toBe(-550);
    expect(toCentsLoose("0.1")).toBe(10);
    expect(toCentsLoose("")).toBeNull();
    expect(toCentsLoose("abc")).toBeNull();
  });
});

describe("normaliseDate", () => {
  it("accepts ISO dates and timestamps", () => {
    expect(normaliseDate("2026-03-05")).toBe("2026-03-05");
    expect(normaliseDate("2026-03-05T10:00:00Z")).toBe("2026-03-05");
  });
  it("tells D/M/Y from M/D/Y when one part exceeds 12, and defaults to day-first", () => {
    expect(normaliseDate("25/12/2026")).toBe("2026-12-25");
    expect(normaliseDate("12/25/2026")).toBe("2026-12-25");
    expect(normaliseDate("05/03/2026")).toBe("2026-03-05");
    expect(normaliseDate("5.3.26")).toBe("2026-03-05");
  });
  it("rejects nonsense", () => {
    expect(normaliseDate("yesterday")).toBeNull();
    expect(normaliseDate("31/31/2026")).toBeNull();
  });
});

const SAMPLE = [
  "Date,Description,Category,Cost,Currency,Asha,Bhanu,Chitra",
  "2026-01-05,Dinner,Dining out,900.00,INR,600.00,-300.00,-300.00",
  '2026-01-06,"Cab, airport",Taxi,400.00,INR,-200.00,200.00,0.00',
  "2026-01-07,Hotel,Hotel,3000.00,INR,2000.00,-1000.00,-1000.00",
  "2026-01-09,Settle all balances,Payment,300.00,INR,-300.00,300.00,0.00",
  "2026-01-10,Souvenirs,General,50.00,EUR,25.00,-25.00,0.00",
  "2026-01-11,Weird,General,10.00,XYZ,5.00,-5.00,0.00",
  "",
  ",Total balance,,,INR,2100.00,-1100.00,-1000.00",
].join("\n");

describe("parseSplitwiseCsv", () => {
  const parsed = parseSplitwiseCsv(SAMPLE);

  it("reads the people from the header and skips the totals line", () => {
    expect(parsed.people).toEqual(["Asha", "Bhanu", "Chitra"]);
    expect(parsed.rows.map((r) => r.description)).toEqual(["Dinner", "Cab, airport", "Hotel", "Settle all balances", "Souvenirs"]);
  });

  it("converts amounts to cents and keeps only non-zero nets", () => {
    const dinner = parsed.rows[0];
    expect(dinner).toMatchObject({ date: "2026-01-05", cost: 90000, currency: "INR", isPayment: false });
    expect(dinner.nets).toEqual({ Asha: 60000, Bhanu: -30000, Chitra: -30000 });
    expect(parsed.rows[1].nets).toEqual({ Asha: -20000, Bhanu: 20000 }); // Chitra's 0.00 dropped
  });

  it("flags payments", () => {
    expect(parsed.rows[3].isPayment).toBe(true);
  });

  it("warns about rows it can't import instead of failing the whole file", () => {
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toMatch(/XYZ/);
  });

  it("rejects files that aren't Splitwise exports and empty files", () => {
    expect(parseSplitwiseCsv("foo,bar\n1,2").warnings[0]).toMatch(/doesn't look like a Splitwise export/);
    expect(parseSplitwiseCsv("").warnings[0]).toMatch(/empty/i);
    expect(parseSplitwiseCsv("Date,Description,Category,Cost,Currency\n").rows).toEqual([]);
  });
});

describe("mapCategory", () => {
  it("maps Splitwise categories onto ours, defaulting to OTHER", () => {
    expect(mapCategory("Dining out")).toBe("FOOD");
    expect(mapCategory("Groceries")).toBe("FOOD");
    expect(mapCategory("Taxi")).toBe("TRANSPORT");
    expect(mapCategory("Rent")).toBe("ACCOMMODATION");
    expect(mapCategory("Movies")).toBe("ENTERTAINMENT");
    expect(mapCategory("Electricity")).toBe("UTILITIES");
    expect(mapCategory("Clothing")).toBe("SHOPPING");
    expect(mapCategory("Medical expenses")).toBe("HEALTH");
    expect(mapCategory("Trip")).toBe("TRAVEL");
    expect(mapCategory("General")).toBe("OTHER");
    expect(mapCategory("")).toBe("OTHER");
  });
});

describe("rowToRecord", () => {
  const mapping = { Asha: "A", Bhanu: "B", Chitra: "C" };
  const row = (over: Partial<SplitwiseRow>): SplitwiseRow => ({
    date: "2026-01-05", description: "Dinner", category: "Dining out", cost: 90000, currency: "INR", isPayment: false, nets: {}, ...over,
  });

  it("single payer: debtors' shares are exact, the payer keeps the rest as their own share", () => {
    const r = rowToRecord(row({ nets: { Asha: 60000, Bhanu: -30000, Chitra: -30000 } }), mapping);
    expect(r).toMatchObject({ kind: "expense", expense: { paidById: "A", payers: [], amount: 90000, category: "FOOD" } });
    if (r.kind !== "expense") throw new Error();
    expect(r.expense.splits).toEqual([{ userId: "B", amount: 30000 }, { userId: "C", amount: 30000 }, { userId: "A", amount: 30000 }]);
    expect(r.expense.splits.reduce((a, s) => a + s.amount, 0)).toBe(90000); // splits always add up to the cost
  });

  it("payer who consumed nothing has no split of their own", () => {
    const r = rowToRecord(row({ nets: { Asha: 40000, Bhanu: -40000 }, cost: 40000 }), mapping);
    if (r.kind !== "expense") throw new Error();
    expect(r.expense.splits).toEqual([{ userId: "B", amount: 40000 }]);
  });

  it("several payers: payers' amounts add up to the cost and their shares are even", () => {
    // cost 1000: Asha +300, Bhanu +200 (payers), Chitra −500 (consumed 500) → payers consumed 500 → 250 each
    const r = rowToRecord(row({ cost: 100000, nets: { Asha: 30000, Bhanu: 20000, Chitra: -50000 } }), mapping);
    if (r.kind !== "expense") throw new Error();
    expect(r.expense.payers).toEqual([{ userId: "A", amount: 55000 }, { userId: "B", amount: 45000 }]);
    expect(r.expense.payers.reduce((a, p) => a + p.amount, 0)).toBe(100000);
    expect(r.expense.paidById).toBe("A");
    expect(r.expense.splits.reduce((a, s) => a + s.amount, 0)).toBe(100000);
    // net per person is preserved: paid − share equals the CSV net
    const net = (id: string) => (r.expense.payers.find((p) => p.userId === id)?.amount ?? 0) - (r.expense.splits.find((s) => s.userId === id)?.amount ?? 0);
    expect([net("A"), net("B"), net("C")]).toEqual([30000, 20000, -50000]);
  });

  it("splits the payers' leftover evenly to the cent (remainder to the first payer)", () => {
    const r = rowToRecord(row({ cost: 1000, nets: { Asha: 250, Bhanu: 250, Chitra: -500 } }), mapping);
    // payers consumed 500 → 250 each — exact. Try an odd leftover:
    const odd = rowToRecord(row({ cost: 1001, nets: { Asha: 250, Bhanu: 250, Chitra: -500 } }), mapping);
    if (r.kind !== "expense" || odd.kind !== "expense") throw new Error();
    expect(odd.expense.splits.reduce((a, s) => a + s.amount, 0)).toBe(1001);
    expect(odd.expense.payers.reduce((a, p) => a + p.amount, 0)).toBe(1001);
  });

  it("payment rows become settlements from the positive person to the negative one", () => {
    const r = rowToRecord(row({ isPayment: true, description: "Payment", cost: 30000, nets: { Bhanu: 30000, Asha: -30000 } }), mapping);
    expect(r).toMatchObject({ kind: "settlement", settlement: { fromUserId: "B", toUserId: "A", amount: 30000, currency: "INR" } });
  });

  it("skips rows with unmapped people, unbalanced nets, or shares larger than the cost", () => {
    expect(rowToRecord(row({ nets: { Asha: 100, Zed: -100 } }), mapping)).toMatchObject({ kind: "skip", reason: expect.stringMatching(/Zed/) });
    expect(rowToRecord(row({ nets: { Asha: 5000, Bhanu: -100 } }), mapping)).toMatchObject({ kind: "skip", reason: expect.stringMatching(/add up/) });
    expect(rowToRecord(row({ cost: 100, nets: { Asha: 5000, Bhanu: -5000 } }), mapping)).toMatchObject({ kind: "skip", reason: expect.stringMatching(/exceed/) });
    expect(rowToRecord(row({ nets: { Asha: 100, Bhanu: 100 } }), mapping)).toMatchObject({ kind: "skip" });
  });

  it("merges when two CSV names map to the same user", () => {
    const r = rowToRecord(row({ cost: 900, nets: { Asha: 600, Bhanu: -300, Chitra: -300 } }), { Asha: "A", Bhanu: "B", Chitra: "B" });
    if (r.kind !== "expense") throw new Error();
    expect(r.expense.splits).toContainEqual({ userId: "B", amount: 600 });
  });
});
