"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, Monitor, Bell, Download, Trash2, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [currency, setCurrency] = useState("USD");
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => { if (j.data?.currency) setCurrency(j.data.currency); })
      .catch(() => {});
  }, []);

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
      toast.success("Default currency updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save currency");
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
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Control what you&apos;re notified about</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {[
              { label: "Expense added", description: "When someone adds an expense to your group" },
              { label: "Settlement recorded", description: "When someone marks a payment to you" },
              { label: "Payment reminders", description: "Weekly reminder of outstanding balances" },
            ].map(({ label, description }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Default currency */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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
      </motion.div>

      {/* Data */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
      </motion.div>

      {/* Privacy */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-green-500" />
              <CardTitle className="text-base">Privacy &amp; Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              SplitFree does not sell your data. All data is encrypted at rest and in transit via Supabase.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
