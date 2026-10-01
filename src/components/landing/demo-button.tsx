"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/demo-login", { method: "POST" });
      const json = await res.json();
      if (json.error) { toast.error("Demo not available right now"); return; }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: json.email, password: json.password });
      if (error) { toast.error("Demo login failed"); return; }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="xl"
      className="w-full sm:w-auto px-8 h-12 text-base gap-2"
      onClick={handleDemo}
      disabled={loading}
    >
      <Play className="size-4" />
      {loading ? "Loading demo…" : "Try demo — no signup"}
    </Button>
  );
}
