"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { createGroupSchema, type CreateGroupInput } from "@/lib/validations/group";
import { useCreateGroup } from "@/hooks/use-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

const GROUP_CATEGORIES = [
  { value: "HOME", label: "🏠 Home" },
  { value: "TRIP", label: "✈️ Trip" },
  { value: "COUPLE", label: "💑 Couple" },
  { value: "FRIENDS", label: "👫 Friends" },
  { value: "WORK", label: "💼 Work" },
  { value: "OTHER", label: "📦 Other" },
];

const CURRENCIES = ["USD","EUR","GBP","INR","CAD","AUD","JPY"];

export function CreateGroupDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useCreateGroup();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateGroupInput>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { category: "OTHER", currency: "USD" },
  });

  const onSubmit = async (data: CreateGroupInput) => {
    await mutateAsync(data);
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="brand" size="sm" className="gap-1.5">
            <Plus className="size-4" /> New Group
          </Button>
        )}
      </DialogTrigger>
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
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brand" loading={isPending}>Create group</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
