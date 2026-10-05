"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { formatPhone, normalizePhone } from "@/lib/phone";

/** Your mobile number (required for accounts; it can be changed but not removed). Private — never shown to other people. */
export function PhoneSettings() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const saved: string = profile?.phone ?? "";
  const [value, setValue] = useState("");
  const [syncedFrom, setSyncedFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Adopt the saved value once the profile loads (state adjusted during render, not in an effect)
  if (profile && syncedFrom !== saved) {
    setSyncedFrom(saved);
    setValue(formatPhone(saved));
  }

  const normalized = normalizePhone(value);
  const invalid = value.trim() !== "" && !normalized;
  const unchanged = normalized === saved || (!saved && value.trim() === "");

  const save = async () => {
    if (!normalized) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Mobile number saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your number");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="phone-settings">
      <Label htmlFor="phone-number" className="text-sm">Mobile number</Label>
      <div className="flex gap-2">
        <Input
          id="phone-number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          value={value}
          disabled={!profile}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid}
        />
        <Button variant="brand" size="sm" onClick={save} disabled={!profile || busy || !normalized || unchanged} loading={busy}>
          Save
        </Button>
      </div>
      {invalid && <p className="text-xs text-destructive">Enter a valid mobile number, like 98765 43210</p>}
      <p className="text-xs text-muted-foreground">Kept private — never shown to other people. Outside India? Start with your country code, like +44.</p>
    </div>
  );
}
