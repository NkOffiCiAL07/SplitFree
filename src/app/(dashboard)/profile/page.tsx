"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Mail, User, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { getInitials, generateAvatarUrl } from "@/lib/utils";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.user_metadata?.name ?? "");

  const updateProfile = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const handleSave = () => updateProfile.mutate({ name });

  const displayName = user?.user_metadata?.name ?? user?.email ?? "User";
  const avatarUrl = user?.user_metadata?.avatar_url ?? generateAvatarUrl(displayName);

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your account details</p>
      </div>

      {/* Avatar section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar className="size-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-2xl">{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <button className="absolute -bottom-1 -right-1 w-7 h-7 gradient-brand rounded-full flex items-center justify-center shadow-md hover:opacity-90 transition-opacity">
                  <Camera className="size-3.5 text-white" />
                </button>
              </div>
              <div>
                <h3 className="font-semibold text-base">{displayName}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Member since {new Date(user?.created_at ?? "").getFullYear()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit profile */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Personal information</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                startIcon={<User />}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                value={user?.email ?? ""}
                disabled
                startIcon={<Mail />}
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>
            <Button variant="brand" onClick={handleSave} loading={updateProfile.isPending}>Save changes</Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Account actions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email verified</p>
                <p className="text-xs text-muted-foreground">
                  {user?.email_confirmed_at ? "Your email is verified" : "Please verify your email"}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${user?.email_confirmed_at ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700"}`}>
                {user?.email_confirmed_at ? "Verified" : "Pending"}
              </span>
            </div>
            <Separator />
            <Button
              variant="outline"
              className="gap-2 w-full"
              onClick={() => router.push("/reset-password")}
            >
              <KeyRound className="size-4" /> Change password
            </Button>
            <Button variant="outline" className="gap-2 w-full" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
