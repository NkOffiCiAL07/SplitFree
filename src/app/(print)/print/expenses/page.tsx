import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { format } from "date-fns";
import { fromCents } from "@/lib/utils";

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

function fmt(cents: number, currency = "USD") {
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
    include: { paidBy: true, splits: true, group: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  const totalPaid = expenses
    .filter((e) => e.paidById === user.id)
    .reduce((s, e) => s + fromCents(e.amount), 0);

  const totalOwed = expenses
    .filter((e) => e.paidById !== user.id)
    .reduce((s, e) => s + fromCents(e.splits.find((sp) => sp.userId === user.id)?.amount ?? 0), 0);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', () => window.print());" }} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>SplitFree — Expense Report</h1>
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
            { label: "Total you paid", value: `$${totalPaid.toFixed(2)}` },
            { label: "Total you owe", value: `$${totalOwed.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px" }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{value}</p>
            </div>
          ))}
        </div>

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
              const isPayer = exp.paidById === user.id;
              return (
                <tr key={exp.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{format(new Date(exp.date), "MMM d, yyyy")}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, maxWidth: 200 }}>{exp.description}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12 }}>{CATEGORY_EMOJI[exp.category]} {exp.category.charAt(0) + exp.category.slice(1).toLowerCase()}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>{exp.group?.name ?? "—"}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12 }}>{exp.paidBy.name}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{fmt(exp.amount, exp.group?.currency ?? exp.currency)}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: isPayer ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                    {isPayer ? `+${fmt(exp.amount - (myShare?.amount ?? 0), exp.group?.currency ?? exp.currency)}` : myShare ? `-${fmt(myShare.amount, exp.group?.currency ?? exp.currency)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p style={{ marginTop: 24, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
          SplitFree · Exported {format(new Date(), "PPpp")} · {expenses.length} expenses shown
        </p>
      </div>
    </>
  );
}
