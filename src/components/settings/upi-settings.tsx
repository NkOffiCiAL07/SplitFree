"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { isValidUpiId } from "@/lib/settle-tools";

/** Save your UPI ID once; people who owe you get a one-tap "Pay via UPI" with the amount filled in. */
export function UpiSettings() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const saved: string = profile?.upiId ?? "";
  const [value, setValue] = useState("");
  const [syncedFrom, setSyncedFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Adopt the saved value once the profile loads (state adjusted during render, not in an effect)
  if (profile && syncedFrom !== saved) {
    setSyncedFrom(saved);
    setValue(saved);
  }

  const trimmed = value.trim();
  const invalid = trimmed !== "" && !isValidUpiId(trimmed);
  const unchanged = trimmed === saved;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upiId: trimmed }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(trimmed ? "UPI ID saved" : "UPI ID removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your UPI ID");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="upi-settings">
      <Label htmlFor="upi-id" className="text-sm">Your UPI ID</Label>
      <div className="flex gap-2">
        <Input
          id="upi-id"
          placeholder="name@bank"
          value={value}
          disabled={!profile}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid}
        />
        <Button variant="brand" size="sm" onClick={save} disabled={!profile || busy || invalid || unchanged} loading={busy}>
          Save
        </Button>
      </div>
      {invalid && <p className="text-xs text-destructive">Enter a valid UPI ID like name@bank</p>}
      <p className="text-xs text-muted-foreground">
        Friends who owe you will see a one-tap “Pay via UPI” button with the amount filled in.
      </p>
    </div>
  );
}
