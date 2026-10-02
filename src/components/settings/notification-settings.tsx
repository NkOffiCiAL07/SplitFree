"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { disablePush, enablePush, getPushSubscription, isPushSupported } from "@/lib/push-client";

/** Real delivery controls: push on this device, and email (stored on the account). */
export function NotificationSettings() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [supported, setSupported] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = isPushSupported();
      const sub = ok ? await getPushSubscription() : null;
      if (cancelled) return;
      setSupported(ok);
      setPushOn(!!sub && Notification.permission === "granted");
    })();
    return () => { cancelled = true; };
  }, []);

  const togglePush = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        const r = await enablePush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
        if (r.ok) { setPushOn(true); toast.success("Push notifications enabled on this device"); }
        else toast.error(
          r.reason === "denied" ? "Notifications are blocked — allow them in your browser settings"
          : r.reason === "unsupported" ? "This browser doesn't support push notifications"
          : r.reason === "not-configured" ? "Push isn't configured on the server yet"
          : "Couldn't enable push notifications"
        );
      } else {
        await disablePush();
        setPushOn(false);
        toast.success("Push notifications turned off on this device");
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleEmail = async (next: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: next }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(next ? "Email notifications on" : "Email notifications off");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the preference");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="notification-settings">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="push-toggle" className="text-sm">Push notifications</Label>
          <p className="text-xs text-muted-foreground">
            {supported
              ? "Alerts on this device for new expenses, payments, reminders and invites"
              : "Not supported in this browser (on iPhone, add the app to your Home Screen first)"}
          </p>
        </div>
        <Switch id="push-toggle" checked={pushOn} disabled={!supported || busy} onCheckedChange={togglePush} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="email-toggle" className="text-sm">Email notifications</Label>
          <p className="text-xs text-muted-foreground">Payment reminders, payments you receive, and group or friend invites</p>
        </div>
        <Switch
          id="email-toggle"
          checked={profile?.emailNotifications ?? true}
          disabled={busy || !profile}
          onCheckedChange={toggleEmail}
        />
      </div>
    </div>
  );
}
