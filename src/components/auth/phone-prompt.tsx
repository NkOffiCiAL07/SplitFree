"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneField } from "@/components/ui/phone-field";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";
import { mustAddPhone, normalizePhone } from "@/lib/phone";
import { browserCountry } from "@/lib/region";

/**
 * A new account needs a mobile number. People who sign up with email give it on the sign-up form; people who arrive
 * through Google skip that form, so this asks once, right after, and can't be dismissed until a valid number is saved.
 */
export function PhonePrompt() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  if (!mustAddPhone(profile)) return null;

  const normalized = normalizePhone(value);
  const invalid = value.trim() !== "" && !normalized;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("All set — welcome aboard!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your number — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        showClose={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="phone-prompt"
      >
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl gradient-brand text-white">
            <Phone className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>One last step</DialogTitle>
          <DialogDescription>Add your mobile number to finish setting up your account. It stays private — never shown to other people.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="prompt-phone">Mobile number</Label>
            <PhoneField id="prompt-phone" autoFocus defaultCountry={browserCountry()} onChange={setValue} invalid={invalid} />
            {invalid && <p role="alert" className="text-xs text-destructive">Enter a valid mobile number, like 98765 43210</p>}
          </div>
          <Button type="submit" variant="brand" className="w-full" disabled={!normalized} loading={busy}>
            Continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
