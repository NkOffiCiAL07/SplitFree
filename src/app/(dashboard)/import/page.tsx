"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useGroups, useGroup } from "@/hooks/use-groups";
import { useFriendContacts } from "@/hooks/use-friends";
import { parseSplitwiseCsv, type ParsedSplitwise } from "@/lib/splitwise-import";
import { suggestMapping, unmappedNames, usedNames } from "@/lib/import-mapping";
import { formatCurrency } from "@/lib/utils";

interface ImportResult { imported: number; settlements: number; duplicates: number; skipped: string[]; skippedCount: number }

const NO_GROUP = "__none__";
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export default function ImportPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: groups } = useGroups();
  const [parsed, setParsed] = useState<ParsedSplitwise | null>(null);
  const [fileName, setFileName] = useState("");
  const [groupId, setGroupId] = useState<string>(NO_GROUP);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: group } = useGroup(groupId === NO_GROUP ? "" : groupId);
  const { data: contacts } = useFriendContacts();
  const myName: string | undefined = user?.user_metadata?.name;

  // Who the Splitwise names can be matched to: the group's members, or your friends and group-mates
  const candidates = useMemo(() => {
    const me = { id: user?.id ?? "", name: myName ?? user?.email ?? "You" };
    const others = groupId === NO_GROUP
      ? (contacts ?? []).map((f) => ({ id: f.friendId, name: f.friend?.name ?? "Friend" }))
      : (group?.members ?? []).map((m) => ({ id: m.userId, name: m.user?.name ?? "Member" }));
    const seen = new Set<string>();
    return [me, ...others].filter((c) => c.id && !seen.has(c.id) && seen.add(c.id));
  }, [groupId, group, contacts, user, myName]);

  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);
  const needed = useMemo(() => usedNames(rows), [rows]);
  const missing = unmappedNames(rows, mapping);
  const expenseCount = rows.filter((r) => !r.isPayment).length;
  const paymentCount = rows.length - expenseCount;
  const dates = rows.map((r) => r.date).sort();

  const remap = (nextGroup: string, nextParsed = parsed) => {
    // Re-suggest whenever the destination (and so the candidate list) changes
    if (!nextParsed || !user) return;
    setMapping(suggestMapping(usedNames(nextParsed.rows), candidates, { id: user.id, name: myName }));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = parseSplitwiseCsv(text);
    setParsed(result);
    setFileName(file.name);
    setResult(null);
    if (user) setMapping(suggestMapping(usedNames(result.rows), candidates, { id: user.id, name: myName }));
    if (result.rows.length === 0) toast.error(result.warnings[0] ?? "Nothing to import in this file");
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/import/splitwise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: groupId === NO_GROUP ? null : groupId,
          mapping: Object.fromEntries(needed.map((n) => [n, mapping[n]])),
          rows,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setResult(json.data);
      for (const key of ["expenses", "dashboard", "balances", "balance", "groups", "analytics", "settlements", "friends"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      toast.success(`Imported ${json.data.imported} expenses`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Settings
      </Link>
      <div>
        <h2 className="text-xl font-bold">Import from Splitwise</h2>
        <p className="text-sm text-muted-foreground">
          In Splitwise, open a group (or your account) → Export as spreadsheet, then upload the CSV here.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">1. Choose the file</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 hover:bg-accent/50">
            <FileUp className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm">{fileName || "Select a Splitwise .csv export"}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Splitwise CSV file"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {parsed && parsed.rows.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="import-summary">
              Found {expenseCount} expense{expenseCount === 1 ? "" : "s"} and {paymentCount} payment{paymentCount === 1 ? "" : "s"}
              {dates.length > 0 && ` from ${dates[0]} to ${dates[dates.length - 1]}`}.
            </p>
          )}
          {parsed?.warnings.map((w) => <p key={w} className="text-xs text-amber-600 dark:text-amber-400">{w}</p>)}
        </CardContent>
      </Card>

      {parsed && parsed.rows.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Where should they go?</CardTitle>
              <CardDescription>Into one of your groups, or as expenses between you and your friends.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <select
                aria-label="Destination"
                className={selectClass}
                value={groupId}
                onChange={(e) => { setGroupId(e.target.value); setResult(null); }}
              >
                <option value={NO_GROUP}>No group (between friends)</option>
                {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Who is who?</CardTitle>
              <CardDescription>Match each person in the file to someone here. Matches we were sure about are filled in.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {needed.map((name) => (
                <div key={name} className="flex items-center gap-3">
                  <Label className="w-32 shrink-0 truncate text-sm" htmlFor={`map-${name}`}>{name}</Label>
                  <select
                    id={`map-${name}`}
                    className={selectClass}
                    value={mapping[name] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [name]: e.target.value }))}
                  >
                    <option value="">Choose…</option>
                    {candidates.map((c) => <option key={c.id} value={c.id}>{c.id === user?.id ? `${c.name} (you)` : c.name}</option>)}
                  </select>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => remap(groupId)}>Re-match automatically</Button>
            </CardContent>
          </Card>

          {result ? (
            <Card data-testid="import-result">
              <CardContent className="p-4 space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400">
                  <CheckCircle2 className="size-4" /> Imported {result.imported} expense{result.imported === 1 ? "" : "s"}
                  {result.settlements > 0 && ` and ${result.settlements} payment${result.settlements === 1 ? "" : "s"}`}
                </p>
                {result.duplicates > 0 && <p className="text-xs text-muted-foreground">{result.duplicates} already existed and were skipped.</p>}
                {result.skippedCount > 0 && (
                  <details className="text-xs text-amber-600 dark:text-amber-400">
                    <summary>{result.skippedCount} row{result.skippedCount === 1 ? "" : "s"} couldn&apos;t be imported</summary>
                    <ul className="mt-1 list-disc pl-4">{result.skipped.map((s) => <li key={s}>{s}</li>)}</ul>
                  </details>
                )}
                <Button asChild size="sm" variant="outline"><Link href="/expenses">View expenses</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {missing.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
                  Choose who {missing.join(", ")} {missing.length === 1 ? "is" : "are"} to continue.
                </p>
              )}
              <Button variant="brand" className="w-full gap-2" disabled={busy || missing.length > 0} loading={busy} onClick={submit}>
                <Upload className="size-4" />
                Import {expenseCount} expense{expenseCount === 1 ? "" : "s"}
                {rows.length > 0 && ` (${formatCurrency(rows.filter((r) => !r.isPayment).reduce((a, r) => a + r.cost, 0), rows[0].currency)})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
