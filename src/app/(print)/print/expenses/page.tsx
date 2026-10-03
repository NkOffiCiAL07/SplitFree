import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { APP_NAME } from "@/lib/app-config";
import { format } from "date-fns";
import { homeCurrencyOf, loadConverter } from "@/lib/convert";
import { reportTotals } from "@/lib/report-totals";
import { expensePayments } from "@/lib/ledger";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

function fmt(cents: number, currency: string = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

export default async function PrintExpensesPage() {
  const { user, error } = await requireAuth();
  if (error || !user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Please sign in to view this page.</p>
      </div>
    );
  }

  const expenses = await prisma.expense.findMany({
    where: { splits: { some: { userId: user.id } } },
    include: { paidBy: true, splits: true, payers: true, group: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  // Totals are in the home currency (other currencies converted, marked ≈); each row shows its own currency
  const home = await homeCurrencyOf(user.id);
  const conv = await loadConverter(home, expenses.some((e) => e.currency !== home));
  const { paid, share } = reportTotals(expenses, user.id, conv);
  const approx = paid.approximate || share.approximate;
  const missing = [...paid.skipped, ...share.skipped];
  const money = (t: { total: number; approximate: boolean }) => `${t.approximate ? "≈ " : ""}${fmt(t.total, home)}`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', () => window.print());" }} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{APP_NAME} — Expense Report</h1>
            <p style={{ fontSize: 12, color: "#666" }}>Generated on {format(new Date(), "PPP")}</p>
          </div>
          <button
            className="no-print"
            id="print-btn"
            style={{ padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
          >
            Print / Save PDF
          </button>
          <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print-btn').addEventListener('click', () => window.print());" }} />
        </div>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total expenses", value: expenses.length.toString() },
            { label: "Total you paid", value: money(paid) },
            { label: "Your total share", value: money(share) },
          ].map(({ label, value }) => (
            <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px" }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{value}</p>
            </div>
          ))}
        </div>

        {approx && (
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: -16, marginBottom: 20 }}>
            ≈ Amounts in other currencies are converted to {home} at rates of {conv.date}. Each row below shows its own currency.
          </p>
        )}
        {missing.length > 0 && (
          <p style={{ fontSize: 11, color: "#b45309", marginTop: -16, marginBottom: 20 }}>
            Not included in the totals (no exchange rate available): {[...new Set(missing.map((m) => m.currency))].join(", ")}
          </p>
        )}

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
              {["Date", "Description", "Category", "Group", "Paid By", "Total", "Your Share"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp, i) => {
              const myShare = exp.splits.find((s) => s.userId === user.id);
              const paidByMe = expensePayments(exp).filter((p) => p.userId === user.id).reduce((t, p) => t + p.amount, 0);
              const net = paidByMe - (myShare?.amount ?? 0); // + you are owed, − you owe (in the expense's own currency)
              return (
                <tr key={exp.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{format(new Date(exp.date), "MMM d, yyyy")}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, maxWidth: 200 }}>{exp.description}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12 }}>{CATEGORY_EMOJI[exp.category]} {exp.category.charAt(0) + exp.category.slice(1).toLowerCase()}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>{exp.group?.name ?? "—"}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12 }}>{exp.paidBy.name}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{fmt(exp.amount, exp.currency)}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: net > 0 ? "#16a34a" : net < 0 ? "#dc2626" : "#6b7280", fontWeight: 500 }}>
                    {net > 0 ? `lent ${fmt(net, exp.currency)}` : net < 0 ? `owe ${fmt(-net, exp.currency)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p style={{ marginTop: 24, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
          {APP_NAME} · Exported {format(new Date(), "PPpp")} · {expenses.length} expenses shown
        </p>
      </div>
    </>
  );
}
