"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, SplitSquareHorizontal, Equal, Hash, Percent, Users, UserPlus, User, Zap } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { useGroups, useGroup } from "@/hooks/use-groups";
import { useFriendContacts } from "@/hooks/use-friends";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import type { GroupMember } from "@/types";
import { parseQuickExpense, matchPeople } from "@/lib/quick-add";

const CATEGORIES = ["FOOD","TRANSPORT","ACCOMMODATION","ENTERTAINMENT","UTILITIES","SHOPPING","HEALTH","TRAVEL","EDUCATION","OTHER"] as const;

const KEYWORD_CATEGORY: Array<[RegExp, typeof CATEGORIES[number]]> = [
  [/\b(food|eat|restaurant|dinner|lunch|breakfast|coffee|pizza|burger|sushi|kebab|cafe|snack|grocery|groceries|meal|biryani|thali)\b/i, "FOOD"],
  [/\b(uber|ola|taxi|cab|bus|train|metro|auto|petrol|fuel|gas|toll|parking|flight|lyft|ride)\b/i, "TRANSPORT"],
  [/\b(hotel|rent|airbnb|hostel|motel|accommodation|apartment|lease|pg|room)\b/i, "ACCOMMODATION"],
  [/\b(movie|cinema|concert|netflix|spotify|game|gaming|party|event|show|ticket|club|bar|pub)\b/i, "ENTERTAINMENT"],
  [/\b(electricity|water|internet|wifi|phone|bill|mobile|recharge|broadband|utility|cable|gas bill)\b/i, "UTILITIES"],
  [/\b(amazon|shopping|clothes|shirt|shoes|dress|mall|market|buy|purchase|flipkart|order)\b/i, "SHOPPING"],
  [/\b(doctor|medicine|pharmacy|hospital|clinic|health|medical|dentist|gym|fitness|yoga)\b/i, "HEALTH"],
  [/\b(travel|trip|vacation|holiday|tour|flight|resort|beach|trek|safari|cruise)\b/i, "TRAVEL"],
  [/\b(school|college|tuition|book|course|class|fee|exam|study|education|university)\b/i, "EDUCATION"],
];
const CATEGORY_EMOJI: Record<string, string> = {
  FOOD:"🍔",TRANSPORT:"🚗",ACCOMMODATION:"🏨",ENTERTAINMENT:"🎭",
  UTILITIES:"💡",SHOPPING:"🛒",HEALTH:"💊",TRAVEL:"✈️",EDUCATION:"📚",OTHER:"📦",
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY"] as const;

const schema = z.object({
  description: z.string().min(1, "Required"),
  amount: z.string().min(1, "Required"),
  currency: z.string(),
  category: z.enum(CATEGORIES),
  date: z.string(),
  notes: z.string().optional(),
  isRecurring: z.boolean(),
  recurringInterval: z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]).optional(),
  paidById: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

type SplitContext = "group" | "friends" | "personal";

interface Props {
  groupId?: string;
  groupCurrency?: string;
  members?: GroupMember[];
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddExpenseDialog({ groupId, groupCurrency = "USD", members = [], children, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [splitType, setSplitType] = useState<"EQUAL"|"EXACT"|"PERCENTAGE"|"SHARES">("EQUAL");
  const [participants, setParticipants] = useState<string[]>([]);
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  // Global mode state (no group/members pre-set)
  const isGlobalMode = !groupId && members.length === 0;
  const [splitContext, setSplitContext] = useState<SplitContext>("group");
  const [localGroupId, setLocalGroupId] = useState<string>("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const { user } = useAuth();
  const { mutateAsync, isPending } = useCreateExpense();
  const { data: groups } = useGroups();
  const { data: localGroupData } = useGroup(localGroupId);
  const { data: friendships } = useFriendContacts();

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      category: "OTHER",
      isRecurring: false,
      paidById: user?.id ?? "",
      currency: groupCurrency,
    },
  });

  // Auth may resolve after form mounts
  useEffect(() => {
    if (user?.id) setValue("paidById", user.id);
  }, [user?.id, setValue]);

  // Sync currency when a group is selected in global mode
  useEffect(() => {
    if (isGlobalMode && localGroupData?.currency) {
      setValue("currency", localGroupData.currency);
    }
  }, [isGlobalMode, localGroupData?.currency, setValue]);

  // Smart auto-categorization
  const description = watch("description");
  useEffect(() => {
    if (!description) return;
    for (const [pattern, cat] of KEYWORD_CATEGORY) {
      if (pattern.test(description)) { setValue("category", cat); break; }
    }
  }, [description, setValue]);

  const isRecurring = watch("isRecurring");
  const amountStr = watch("amount");
  const selectedCurrency = watch("currency");

  // Resolve the effective members list
  const resolvedMembers: GroupMember[] = useMemo(() => {
    if (members.length > 0) return members; // pre-set (group page or friend page)
    if (!isGlobalMode) return [];
    if (splitContext === "group" && localGroupData?.members) return localGroupData.members;
    if (splitContext === "friends" && user) {
      const placeholder = { avatarUrl: null, currency: "USD" as const, timezone: "UTC", createdAt: new Date() };
      const me: GroupMember = { id: "", groupId: "", userId: user.id, role: "MEMBER", joinedAt: new Date(), user: { ...placeholder, id: user.id, name: user.user_metadata?.name ?? "You", email: user.email ?? "" } };
      const friendMembers: GroupMember[] = (friendships ?? [])
        .filter((f) => selectedFriendIds.includes(f.friendId))
        .map((f) => ({ id: "", groupId: "", userId: f.friendId, role: "MEMBER" as const, joinedAt: new Date(), user: { ...placeholder, id: f.friendId, name: f.friend?.name ?? "Friend", email: "" } }));
      return [me, ...friendMembers];
    }
    // personal — just current user
    if (user) {
      const placeholder = { avatarUrl: null, currency: "USD" as const, timezone: "UTC", createdAt: new Date() };
      return [{ id: "", groupId: "", userId: user.id, role: "MEMBER", joinedAt: new Date(), user: { ...placeholder, id: user.id, name: user.user_metadata?.name ?? "You", email: user.email ?? "" } }];
    }
    return [];
  }, [members, isGlobalMode, splitContext, localGroupData, friendships, selectedFriendIds, user]);

  const resolvedGroupId = groupId ?? (isGlobalMode && splitContext === "group" ? localGroupId || null : null);

  const allMemberIds = resolvedMembers.map((m) => m.userId);
  const activeParticipants = participants.length > 0 ? participants : allMemberIds;

  const equalSplitPerPerson = (() => {
    const total = parseFloat(amountStr ?? "0") || 0;
    const count = activeParticipants.length || 1;
    if (total <= 0 || count === 0 || splitType !== "EQUAL") return null;
    return total / count;
  })();

  const toggleParticipant = (uid: string) => {
    setParticipants((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]);
  };

  const buildSplits = () => {
    if (splitType === "EQUAL") return undefined;
    const result: Record<string, number> = {};
    activeParticipants.forEach((uid) => { result[uid] = parseFloat(splitValues[uid] ?? "0") || 0; });
    return result;
  };

  const splitValidationError = (() => {
    if (splitType === "EQUAL" || activeParticipants.length === 0) return null;
    const total = parseFloat(amountStr ?? "0") || 0;
    const sum = activeParticipants.reduce((acc, uid) => acc + (parseFloat(splitValues[uid] ?? "0") || 0), 0);
    if (splitType === "EXACT" && total > 0 && Math.abs(sum - total) > 0.01)
      return `Split amounts must sum to ${total.toFixed(2)} (currently ${sum.toFixed(2)})`;
    if (splitType === "PERCENTAGE" && sum > 0 && Math.abs(sum - 100) > 0.01)
      return `Percentages must sum to 100% (currently ${sum.toFixed(1)}%)`;
    return null;
  })();

  // "Dinner 1200 with Rahul and Priya" → fills description, amount and the people
  const [quickText, setQuickText] = useState("");
  const applyQuickAdd = () => {
    const parsed = parseQuickExpense(quickText);
    if (!parsed.description && parsed.amount === null) return;
    if (parsed.description) setValue("description", parsed.description);
    if (parsed.amount !== null) setValue("amount", String(parsed.amount));
    if (parsed.names.length > 0) {
      const people = (friendships ?? []).map((f) => ({ id: f.friendId, name: f.friend?.name }));
      const { matched, unmatched } = matchPeople(parsed.names, people);
      if (matched.length > 0) {
        setSplitContext("friends");
        setParticipants([]);
        setSelectedFriendIds(matched.map((p) => p.id));
      }
      if (unmatched.length > 0) toast.info(`Couldn't find: ${unmatched.join(", ")}`);
    }
    setQuickText("");
  };

  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const first = Object.values(errs)[0] as { message?: string } | undefined;
    toast.error(first?.message ?? "Please fill in all required fields");
  };

  const onSubmit = async (values: FormValues) => {
    if (splitValidationError) return;
    if (isGlobalMode && splitContext === "group" && !localGroupId) {
      toast.error("Please select a group or change split context");
      return;
    }
    await mutateAsync({
      description: values.description,
      amount: parseFloat(values.amount),
      currency: values.currency,
      category: values.category,
      splitType,
      paidById: values.paidById,
      groupId: resolvedGroupId ?? null,
      date: new Date(values.date),
      notes: values.notes,
      isRecurring: values.isRecurring,
      recurringInterval: values.recurringInterval,
      participants: activeParticipants.length > 0 ? activeParticipants : [values.paidById],
      splits: buildSplits(),
    });
    setOpen(false);
    reset();
    setSplitValues({});
    setParticipants([]);
    setLocalGroupId("");
    setSelectedFriendIds([]);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset({ date: new Date().toISOString().split("T")[0], category: "OTHER", isRecurring: false, paidById: user?.id ?? "", currency: groupCurrency });
      setSplitValues({});
      setParticipants([]);
      setSplitType("EQUAL");
      setLocalGroupId("");
      setSelectedFriendIds([]);
      setSplitContext("group");
    }
  };

  const splitTabs = [
    { value: "EQUAL", label: "Equal", icon: Equal },
    { value: "EXACT", label: "Exact $", icon: SplitSquareHorizontal },
    { value: "PERCENTAGE", label: "Percent", icon: Percent },
    { value: "SHARES", label: "Shares", icon: Hash },
  ];

  const trigger = controlledOpen !== undefined ? null : (
    <DialogTrigger asChild>
      {children ?? (
        <Button variant="brand" size="sm" className="gap-1.5">
          <Plus className="size-4" /> Add expense
        </Button>
      )}
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5 mt-2">

          {/* ── Quick add (global mode): free-text shortcut ── */}
          {isGlobalMode && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="size-3" /> Quick add
              </Label>
              <Input
                placeholder="Dinner 1200 with Rahul and Priya  ↵"
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyQuickAdd(); }
                }}
                onBlur={() => { if (quickText.trim()) applyQuickAdd(); }}
              />
            </div>
          )}

          {/* ── Global mode: Split with picker ── */}
          {isGlobalMode && (
            <div className="space-y-3">
              <Label>Split with</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "group", label: "A group", icon: Users },
                  { key: "friends", label: "Friends", icon: UserPlus },
                  { key: "personal", label: "Just me", icon: User },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setSplitContext(key); setParticipants([]); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all",
                      splitContext === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Group selector */}
              {splitContext === "group" && (
                <Select value={localGroupId} onValueChange={setLocalGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a group…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Friend multi-select */}
              {splitContext === "friends" && (
                <div className="flex flex-wrap gap-2">
                  {(friendships ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No friends yet — add friends first.</p>
                  ) : (friendships ?? []).map((f) => (
                    <button
                      key={f.friendId}
                      type="button"
                      onClick={() => toggleFriend(f.friendId)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-all",
                        selectedFriendIds.includes(f.friendId)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Avatar className="size-4">
                        <AvatarFallback className="text-[8px]">{getInitials(f.friend?.name ?? "?")}</AvatarFallback>
                      </Avatar>
                      {f.friend?.name?.split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Dinner, Groceries, Rent…" {...register("description")} autoFocus />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* Paid by */}
          {resolvedMembers.length > 1 && (
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Controller
                name="paidById"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {resolvedMembers.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => field.onChange(m.userId)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-all",
                          field.value === m.userId
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <Avatar className="size-4">
                          <AvatarFallback className="text-[8px]">{getInitials(m.user?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        {m.userId === user?.id ? "You" : m.user?.name?.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" {...register("date")} />
          </div>

          {/* Split type + participants */}
          {resolvedMembers.length > 1 && (
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

              {/* Participant selector */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select participants</p>
                <div className="flex flex-wrap gap-2">
                  {resolvedMembers.map((m) => {
                    const isActive = participants.length === 0 || participants.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleParticipant(m.userId)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-all",
                          isActive ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                        )}
                      >
                        <Avatar className="size-4">
                          <AvatarFallback className="text-[8px]">{getInitials(m.user?.name ?? "?")}</AvatarFallback>
                        </Avatar>
                        {m.userId === user?.id ? "You" : m.user?.name?.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Equal split preview */}
              {splitType === "EQUAL" && equalSplitPerPerson !== null && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Split preview</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {activeParticipants.map((uid) => {
                      const m = resolvedMembers.find((x) => x.userId === uid);
                      const name = m?.user?.name?.split(" ")[0] ?? (uid === user?.id ? "You" : uid.slice(0, 6));
                      return (
                        <span key={uid} className="text-xs">
                          <span className="font-medium">{name}</span>
                          <span className="text-muted-foreground"> {equalSplitPerPerson.toFixed(2)} {selectedCurrency}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Non-equal split inputs */}
              <AnimatePresence>
                {splitType !== "EQUAL" && (
                  <m.div
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
                      const member = resolvedMembers.find((m) => m.userId === uid);
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
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}

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
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
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

          {splitValidationError && <p className="text-xs text-destructive">{splitValidationError}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="brand" className="flex-1" loading={isPending} disabled={!!splitValidationError}>
              Add expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
