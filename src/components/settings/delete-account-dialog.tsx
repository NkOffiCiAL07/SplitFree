"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, cn } from "@/lib/utils";

interface Blocker { userId: string; name: string; currency: string; net: number }

/**
 * Account deletion with a confirmation that can't be clicked through by accident: it explains exactly what happens,
 * needs your email typed, and if you still have balances it lists who to settle with instead of failing vaguely.
 */
export function DeleteAccountDialog() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const email = user?.email ?? "";
  const matches = !!email && confirmEmail.trim().toLowerCase() === email.toLowerCase();

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) { setConfirmEmail(""); setBlockers([]); }
  };

  const submit = async () => {
    setBusy(true);
    setBlockers([]);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(json.blockers)) {
        setBlockers(json.blockers);
        return;
      }
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Couldn't delete your account — please try again");
        return;
      }
      toast.success("Your account has been deleted");
      await signOut();
      window.location.href = "/";
    } catch {
      toast.error("You seem to be offline — connect to the internet to delete your account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" /> Delete account
      </Button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Delete your account?
            </DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
            <li>Your name, email, photo, UPI ID, comments and notifications are erased, and you&apos;re removed from every group and friends list.</li>
            <li>Expenses you shared with others stay, showing &ldquo;Deleted user&rdquo;, so everyone else&apos;s balances remain correct.</li>
            <li>You can only delete once you&apos;re settled up with everyone.</li>
            <li>Tip: download your data first from the Data section.</li>
          </ul>

          {blockers.length > 0 && (
            <div role="alert" data-testid="delete-blockers" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="mb-2 font-medium text-destructive">Settle up first — you still have balances:</p>
              <ul className="space-y-1.5">
                {blockers.map((b) => (
                  <li key={`${b.userId}-${b.currency}`} className="flex items-center justify-between gap-3">
                    <Link href={`/friends/${b.userId}`} onClick={() => reset(false)} className="min-w-0 truncate font-medium underline-offset-2 hover:underline">
                      {b.name}
                    </Link>
                    <span className={cn("shrink-0 font-semibold", b.net > 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                      {b.net > 0 ? "owes you " : "you owe "}{formatCurrency(Math.abs(b.net), b.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="confirm-email">Type your email to confirm</Label>
            <Input id="confirm-email" type="email" autoComplete="off" placeholder={email} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => reset(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" disabled={!matches} loading={busy} onClick={submit}>Delete my account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
