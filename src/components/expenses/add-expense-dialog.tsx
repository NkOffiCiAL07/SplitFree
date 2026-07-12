"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, SplitSquareHorizontal, Equal, Hash, Percent } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, getInitials, toCents } from "@/lib/utils";
import type { GroupMember } from "@/types";

const CATEGORIES = ["FOOD","TRANSPORT","ACCOMMODATION","ENTERTAINMENT","UTILITIES","SHOPPING","HEALTH","TRAVEL","EDUCATION","OTHER"] as const;
const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

const schema = z.object({
  description: z.string().min(1, "Required"),
  amount: z.string().min(1, "Required"),
  category: z.enum(CATEGORIES),
  date: z.string(),
  notes: z.string().optional(),
  isRecurring: z.boolean(),
  recurringInterval: z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  groupId?: string;
  members?: GroupMember[];
  children?: React.ReactNode;
}

export function AddExpenseDialog({ groupId, members = [], children }: Props) {
  const [open, setOpen] = useState(false);
  const [splitType, setSplitType] = useState<"EQUAL"|"EXACT"|"PERCENTAGE"|"SHARES">("EQUAL");
  const [participants, setParticipants] = useState<string[]>([]);
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { mutateAsync, isPending } = useCreateExpense();

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split("T")[0], category: "OTHER", isRecurring: false },
  });

  const isRecurring = watch("isRecurring");
  const amountStr = watch("amount");

  const allMemberIds = members.length > 0
    ? members.map((m) => m.userId)
    : user ? [user.id] : [];

  const activeParticipants = participants.length > 0 ? participants : allMemberIds;

  const toggleParticipant = (uid: string) => {
    setParticipants((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const buildSplits = () => {
    if (splitType === "EQUAL") return undefined;
    const result: Record<string, number> = {};
    activeParticipants.forEach((uid) => {
      result[uid] = parseFloat(splitValues[uid] ?? "0") || 0;
    });
    return result;
  };

  const onSubmit = async (values: FormValues) => {
    const paidById = user?.id ?? "";
    await mutateAsync({
      description: values.description,
      amount: parseFloat(values.amount),
      currency: "USD",
      category: values.category,
      splitType,
      paidById,
      groupId: groupId ?? null,
      date: new Date(values.date),
      notes: values.notes,
      isRecurring: values.isRecurring,
      recurringInterval: values.recurringInterval,
      participants: activeParticipants.length > 0 ? activeParticipants : [paidById],
      splits: buildSplits(),
    });
    setOpen(false);
    reset();
    setSplitValues({});
    setParticipants([]);
  };

  const splitTabs = [
    { value: "EQUAL", label: "Equal", icon: Equal },
    { value: "EXACT", label: "Exact $", icon: SplitSquareHorizontal },
    { value: "PERCENTAGE", label: "Percent", icon: Percent },
    { value: "SHARES", label: "Shares", icon: Hash },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="brand" size="sm" className="gap-1.5">
            <Plus className="size-4" /> Add expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Dinner, Groceries, Rent…" {...register("description")} autoFocus />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {/* Amount + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_EMOJI[c]} {c.charAt(0) + c.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" {...register("date")} />
          </div>

          {/* Split type */}
          <div className="space-y-3">
            <Label>Split type</Label>
            <Tabs value={splitType} onValueChange={(v) => setSplitType(v as typeof splitType)}>
              <TabsList className="w-full grid grid-cols-4">
                {splitTabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-1 text-xs">
                    <Icon className="size-3" />
                    <span className="hidden sm:inline">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Participant selector for group expenses */}
            {members.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select participants</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const isActive = participants.length === 0 || participants.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleParticipant(m.userId)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-all",
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        <Avatar className="size-4">
                          <AvatarFallback className="text-[8px]">
                            {getInitials(m.user?.name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        {m.user?.name?.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Split input fields (for non-equal splits) */}
            <AnimatePresence>
              {splitType !== "EQUAL" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <p className="text-xs text-muted-foreground">
                    {splitType === "EXACT" ? "Enter each person's exact amount" :
                     splitType === "PERCENTAGE" ? "Enter percentage for each (must sum to 100%)" :
                     "Enter shares for each person"}
                  </p>
                  {activeParticipants.map((uid) => {
                    const member = members.find((m) => m.userId === uid);
                    const name = member?.user?.name ?? (uid === user?.id ? "You" : uid.slice(0, 8));
                    return (
                      <div key={uid} className="flex items-center gap-2">
                        <span className="text-xs w-24 truncate">{name}</span>
                        <Input
                          type="number"
                          step={splitType === "SHARES" ? "1" : "0.01"}
                          min="0"
                          placeholder={splitType === "PERCENTAGE" ? "%" : splitType === "SHARES" ? "shares" : "0.00"}
                          value={splitValues[uid] ?? ""}
                          onChange={(e) => setSplitValues((p) => ({ ...p, [uid]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                        {splitType === "PERCENTAGE" && <span className="text-xs text-muted-foreground">%</span>}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input placeholder="Add a note…" {...register("notes")} />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Recurring expense</Label>
              <p className="text-xs text-muted-foreground">Repeat this expense automatically</p>
            </div>
            <Controller
              name="isRecurring"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          {isRecurring && (
            <Controller
              name="recurringInterval"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select interval" /></SelectTrigger>
                  <SelectContent>
                    {["DAILY","WEEKLY","MONTHLY","YEARLY"].map((v) => (
                      <SelectItem key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brand" className="flex-1" loading={isPending}>Add expense</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
