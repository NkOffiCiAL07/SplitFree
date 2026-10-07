"use client";

import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setAccent, setOled, useAccent, useOled } from "@/components/shared/accent-provider";
import { ACCENTS } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** The app's theme (colours for the whole page) and "pure black" for dark mode. Saved on this device. */
export function ThemeSettings() {
  const current = useAccent();
  const oled = useOled();

  return (
    <div className="space-y-5" data-testid="theme-settings">
      <div className="space-y-2.5">
        <Label className="text-sm">Theme</Label>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {ACCENTS.map((a) => {
            const selected = a.id === current.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={a.name}
                onClick={() => setAccent(a.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all active:scale-95",
                  selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                )}
              >
                <span
                  aria-hidden="true"
                  className="relative flex size-9 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-background"
                  style={{ background: `linear-gradient(135deg, ${a.scale[600]}, ${a.gradientTo})` }}
                >
                  {selected && <Check className="size-4" />}
                </span>
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="pure-black" className="text-sm">Pure black</Label>
          <p className="text-xs text-muted-foreground">True black in dark mode — easier on the eyes at night and saves battery on OLED screens.</p>
        </div>
        <Switch id="pure-black" checked={oled} onCheckedChange={setOled} />
      </div>
    </div>
  );
}
