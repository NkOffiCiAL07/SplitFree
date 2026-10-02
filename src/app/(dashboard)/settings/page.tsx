"use client";

import Link from "next/link";
import { CURRENCY_CODES as CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { useTheme } from "next-themes";
import { useState } from "react";
import { m } from "framer-motion";
import { Moon, Sun, Monitor, Download, Trash2, Shield } from "lucide-react";
import { APP_NAME } from "@/lib/app-config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { UpiSettings } from "@/components/settings/upi-settings";


export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [savingCurrency, setSavingCurrency] = useState(false);
  // Adopt the saved currency once the profile loads (state adjusted during render, not in an effect)
  const [syncedCurrency, setSyncedCurrency] = useState<string | undefined>(undefined);
  if (profile?.currency && profile.currency !== syncedCurrency) {
    setSyncedCurrency(profile.currency);
    setCurrency(profile.currency);
  }

  const handleCurrencyChange = async (val: string) => {
    setCurrency(val);
    setSavingCurrency(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: val }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Default currency updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save currency");
    } finally {
      setSavingCurrency(false);
    }
  };

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your preferences</p>
      </div>

      {/* Appearance */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose your preferred color theme</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-3">
              {themes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                    theme === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <Icon className="size-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </m.div>

      {/* Notifications */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Choose how you hear about activity in your groups</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <NotificationSettings />
          </CardContent>
        </Card>
      </m.div>

      {/* Get paid */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Get paid faster</CardTitle>
            <CardDescription>Add your UPI ID so friends can settle up in one tap</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <UpiSettings />
          </CardContent>
        </Card>
      </m.div>

      {/* Import */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Import</CardTitle>
            <CardDescription>Moving from Splitwise? Bring your history with you</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/import" className="text-sm font-medium text-primary hover:underline">Import from Splitwise →</Link>
          </CardContent>
        </Card>
      </m.div>

      {/* Default currency */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Currency</CardTitle>
            <CardDescription>Default currency for your dashboard display</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={currency} onValueChange={handleCurrencyChange} disabled={savingCurrency}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              This sets how amounts are displayed on the dashboard.
            </p>
          </CardContent>
        </Card>
      </m.div>

      {/* Data */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Data</CardTitle>
            <CardDescription>Export or delete your data</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={() => window.location.href = "/api/export"}>
              <Download className="size-4" /> Export all expenses (CSV)
            </Button>
            <Separator />
            <div>
              <p className="text-sm font-medium text-destructive">Danger zone</p>
              <p className="text-xs text-muted-foreground mb-3">These actions are permanent and cannot be undone.</p>
              <Button
                variant="outline"
                className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => toast.error("Account deletion requires email confirmation")}
              >
                <Trash2 className="size-4" /> Delete account
              </Button>
            </div>
          </CardContent>
        </Card>
      </m.div>

      {/* Privacy */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-green-500" />
              <CardTitle className="text-base">Privacy &amp; Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {APP_NAME} does not sell your data. All data is encrypted at rest and in transit via Supabase.
            </p>
          </CardContent>
        </Card>
      </m.div>
    </div>
  );
}
