"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Check } from "lucide-react";
import { createGroupSchema, type CreateGroupInput } from "@/lib/validations/group";
import { useCreateGroup } from "@/hooks/use-groups";
import { useFriends } from "@/hooks/use-friends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GROUP_CATEGORIES = [
  { value: "HOME", label: "🏠 Home" },
  { value: "TRIP", label: "✈️ Trip" },
  { value: "COUPLE", label: "💑 Couple" },
  { value: "FRIENDS", label: "👫 Friends" },
  { value: "WORK", label: "💼 Work" },
  { value: "OTHER", label: "📦 Other" },
];

const CURRENCIES = ["USD","EUR","GBP","INR","CAD","AUD","JPY"];

export function CreateGroupDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { mutateAsync, isPending } = useCreateGroup();
  const { data: friends } = useFriends();
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { category: "OTHER", currency: "USD" },
  });

  const toggleFriend = (id: string) =>
    setSelectedFriendIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const onSubmit = async (data: CreateGroupInput) => {
    const memberEmails = (friends ?? [])
      .filter((f) => selectedFriendIds.includes(f.friendId))
      .map((f) => f.friend?.email)
      .filter(Boolean) as string[];
    await mutateAsync({ ...data, memberEmails: memberEmails.length ? memberEmails : undefined });
    setOpen(false);
    reset();
    setSelectedFriendIds([]);
  };

  const trigger = controlledOpen !== undefined ? null : (
    <DialogTrigger asChild>
      {children ?? (
        <Button variant="brand" size="sm" className="gap-1.5">
          <Plus className="size-4" /> New Group
        </Button>
      )}
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Group name</Label>
            <Input placeholder="Weekend Trip, Our Apartment…" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input placeholder="Add a description…" {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select defaultValue="OTHER" onValueChange={(v) => setValue("category", v as CreateGroupInput["category"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUP_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select defaultValue="USD" onValueChange={(v) => setValue("currency", v as CreateGroupInput["currency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {friends && friends.length > 0 && (
            <div className="space-y-2">
              <Label>Add members (optional)</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {friends.map((f) => {
                  const selected = selectedFriendIds.includes(f.friendId);
                  const initials = (f.friend?.name ?? f.friend?.email ?? "?").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={f.friendId}
                      type="button"
                      onClick={() => toggleFriend(f.friendId)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input bg-background text-foreground hover:border-primary/50"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {f.friend?.avatarUrl
                          ? <img src={f.friend.avatarUrl} className="w-5 h-5 rounded-full object-cover" alt="" />
                          : initials}
                      </span>
                      {f.friend?.name ?? f.friend?.email}
                      {selected && <Check className="size-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brand" loading={isPending}>Create group</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
