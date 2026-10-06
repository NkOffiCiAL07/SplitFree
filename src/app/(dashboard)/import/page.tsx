"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, Loader2, Sparkles, Upload } from "lucide-react";
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

type Step = "upload" | "match" | "review" | "done";
const STEPS: { id: Exclude<Step, "done">; label: string }[] = [{ id: "upload", label: "Upload" }, { id: "match", label: "Match" }, { id: "review", label: "Import" }];

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
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);

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

  const matchedCount = needed.filter((n) => mapping[n]).length;
  const people = new Set(rows.flatMap((r) => Object.keys(r.nets))).size;
  const destinationName = groupId === NO_GROUP ? "between you and your friends" : (groups ?? []).find((g) => g.id === groupId)?.name ?? "your group";
  const total = rows.filter((r) => !r.isPayment).reduce((a, r) => a + r.cost, 0);

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
    else setStep("match"); // straight on to matching people: drop the file and you're moving
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
      setStep("done");
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Settings
      </Link>

      {/* hero + progress */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-violet-500/20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-white/15 blur-2xl" />
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/80"><Sparkles className="size-3.5" /> Switching from Splitwise</p>
        <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Import from Splitwise</h2>
        <p className="mt-1 text-sm text-white/85">Bring your whole history over — and leave the drama behind.</p>
        {step !== "done" && (
          <ol className="mt-5 flex items-center gap-2" aria-label="Progress">
            {STEPS.map(({ id, label }, i) => {
              const at = STEPS.findIndex((x) => x.id === step);
              const state = i < at ? "done" : i === at ? "current" : "todo";
              return (
                <li key={id} aria-current={state === "current" ? "step" : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${state === "todo" ? "bg-white/20 text-white/80" : "bg-white text-violet-700"}`}>
                    {state === "done" ? <CheckCircle2 className="size-4" /> : i + 1}
                  </span>
                  <span className={`text-xs font-medium ${state === "todo" ? "text-white/70" : "text-white"}`}>{label}</span>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < at ? "bg-white" : "bg-white/30"}`} />}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* 1 · UPLOAD */}
      {step === "upload" && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void onFile(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "hover:bg-accent/50"}`}
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileUp className="size-7" /></span>
              <span className="text-base font-semibold">Drop your CSV here and leave the drama behind</span>
              <span className="text-sm text-muted-foreground">{fileName || "or tap to choose your Splitwise .csv export"}</span>
              <input type="file" accept=".csv,text/csv" aria-label="Splitwise CSV file" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {parsed?.warnings.map((w) => <p key={w} className="text-xs text-amber-600 dark:text-amber-400">{w}</p>)}
            <details className="rounded-xl border bg-muted/30 p-3 text-sm">
              <summary className="cursor-pointer font-medium">How do I get the file?</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>In Splitwise, open a group (or your account).</li>
                <li>Choose <b className="text-foreground">Export as spreadsheet</b>.</li>
                <li>Upload the CSV here — everything stays between you and Splitr Pro.</li>
              </ol>
            </details>
          </CardContent>
        </Card>
      )}

      {/* 2 · MATCH */}
      {step === "match" && parsed && parsed.rows.length > 0 && (
        <>
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-green-600" /> {fileName}</p>
              <p className="text-sm text-muted-foreground" data-testid="import-summary">
                Found {expenseCount} expense{expenseCount === 1 ? "" : "s"} and {paymentCount} payment{paymentCount === 1 ? "" : "s"}
                {dates.length > 0 && ` from ${dates[0]} to ${dates[dates.length - 1]}`}.
              </p>
              {parsed.warnings.map((w) => <p key={w} className="text-xs text-amber-600 dark:text-amber-400">{w}</p>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Where should they go?</CardTitle>
              <CardDescription>Into one of your groups, or as expenses between you and your friends.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <select aria-label="Destination" className={selectClass} value={groupId} onChange={(e) => { setGroupId(e.target.value); setResult(null); }}>
                <option value={NO_GROUP}>No group (between friends)</option>
                {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Who is who?</CardTitle>
              <CardDescription>Match each person in the file to someone here. Matches we were sure about are filled in.</CardDescription>
              <div className="pt-2" aria-label={`Matched ${matchedCount} of ${needed.length}`}>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500" style={{ width: `${needed.length ? (matchedCount / needed.length) * 100 : 0}%` }} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{matchedCount} of {needed.length} matched</p>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {needed.map((name) => (
                <div key={name} className="flex items-center gap-3">
                  <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${mapping[name] ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{mapping[name] ? <CheckCircle2 className="size-4" /> : "?"}</span>
                  <Label className="w-28 shrink-0 truncate text-sm" htmlFor={`map-${name}`}>{name}</Label>
                  <select id={`map-${name}`} className={selectClass} value={mapping[name] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [name]: e.target.value }))}>
                    <option value="">Choose…</option>
                    {candidates.map((c) => <option key={c.id} value={c.id}>{c.id === user?.id ? `${c.name} (you)` : c.name}</option>)}
                  </select>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => remap(groupId)}>Re-match automatically</Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {missing.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400" role="status">
                Choose who {missing.join(", ")} {missing.length === 1 ? "is" : "are"} to continue.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button variant="brand" className="flex-1 gap-2" disabled={missing.length > 0} onClick={() => setStep("review")}>Continue to review <ArrowRight className="size-4" /></Button>
            </div>
          </div>
        </>
      )}

      {/* 3 · REVIEW */}
      {step === "review" && parsed && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Ready to import</CardTitle><CardDescription>Have a last look — nothing has been saved yet.</CardDescription></CardHeader>
            <CardContent className="space-y-2 pt-0 text-sm" data-testid="import-review">
              {[
                ["From", fileName],
                ["Contents", `${expenseCount} expense${expenseCount === 1 ? "" : "s"} and ${paymentCount} payment${paymentCount === 1 ? "" : "s"}${dates.length > 0 ? `, ${dates[0]} to ${dates[dates.length - 1]}` : ""}`],
                ["Into", destinationName],
                ["People", `${people} matched`],
                ["Total of the expenses", rows.length ? formatCurrency(total, rows[0].currency) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b py-1.5 last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>
              ))}
            </CardContent>
          </Card>
          {busy && (
            <div role="status" className="space-y-1.5 rounded-xl border bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin" /> Importing {expenseCount} expense{expenseCount === 1 ? "" : "s"}… this can take a moment</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-[import-slide_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" /></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setStep("match")}>Back</Button>
            <Button variant="brand" className="flex-1 gap-2" disabled={busy || missing.length > 0} loading={busy} onClick={submit}>
              <Upload className="size-4" />
              Import {expenseCount} expense{expenseCount === 1 ? "" : "s"}
              {rows.length > 0 && ` (${formatCurrency(total, rows[0].currency)})`}
            </Button>
          </div>
        </>
      )}

      {/* 4 · DONE */}
      {step === "done" && result && (
        <Card data-testid="import-result" className="overflow-hidden">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="relative mx-auto flex size-20 items-center justify-center">
              <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-green-400/30" />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg"><CheckCircle2 className="size-10" /></span>
              <span aria-hidden="true" className="anim-float absolute -right-6 -top-2 text-2xl">🎉</span>
              <span aria-hidden="true" className="anim-float-slow absolute -left-7 top-3 text-xl">✨</span>
            </div>
            <div>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                Imported {result.imported} expense{result.imported === 1 ? "" : "s"}
                {result.settlements > 0 && ` and ${result.settlements} payment${result.settlements === 1 ? "" : "s"}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">You&apos;re all set — your history and balances are here, exactly as they were.</p>
            </div>
            {result.duplicates > 0 && <p className="text-xs text-muted-foreground">{result.duplicates} already existed and were skipped.</p>}
            {result.skippedCount > 0 && (
              <details className="text-left text-xs text-amber-600 dark:text-amber-400">
                <summary className="cursor-pointer">{result.skippedCount} row{result.skippedCount === 1 ? "" : "s"} couldn&apos;t be imported</summary>
                <ul className="mt-1 list-disc pl-4">{result.skipped.map((x) => <li key={x}>{x}</li>)}</ul>
              </details>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="brand" size="sm"><Link href="/expenses">View expenses</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/settle">See who owes whom</Link></Button>
              <Button size="sm" variant="ghost" onClick={() => { setParsed(null); setFileName(""); setResult(null); setStep("upload"); }}>Import another file</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
