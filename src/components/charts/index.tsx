// One module for every Recharts-based chart. Pages import their charts from here (lazily), so the
// ~340 KB charting library is built into a single shared chunk instead of one copy per page.
export { BalanceChart } from "@/components/dashboard/balance-chart";
export { MonthlyBarChart, CategoryPieChart } from "@/components/analytics/analytics-charts";
