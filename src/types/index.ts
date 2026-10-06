import type { CurrencyCode } from "@/lib/currencies";
import type { GroupStats } from "@/lib/group-stats";

export type Currency = CurrencyCode;

export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";

export type ExpenseCategory =
  | "FOOD"
  | "TRANSPORT"
  | "ACCOMMODATION"
  | "ENTERTAINMENT"
  | "UTILITIES"
  | "SHOPPING"
  | "HEALTH"
  | "TRAVEL"
  | "EDUCATION"
  | "OTHER";

export type GroupCategory =
  | "HOME"
  | "TRIP"
  | "COUPLE"
  | "FRIENDS"
  | "WORK"
  | "OTHER";

export type NotificationType =
  | "EXPENSE_ADDED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "SETTLEMENT_ADDED"
  | "GROUP_JOINED"
  | "GROUP_LEFT"
  | "FRIEND_ADDED"
  | "PAYMENT_REMINDER"
  | "EXPENSE_COMMENTED";

export type BudgetPeriod = "WEEKLY" | "MONTHLY" | "YEARLY";

export type ActivityType =
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "SETTLEMENT_CREATED"
  | "GROUP_CREATED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED";

/* ─── API Response wrappers ──────────────────────────────── */
export interface ApiSuccess<T> {
  data: T;
  error: null;
}
export interface ApiError {
  data: null;
  error: { message: string; code?: string };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/* ─── User ────────────────────────────────────────────────── */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** Payment address people can pay to (INR) */
  upiId?: string | null;
  phone?: string | null;
  currency: Currency;
  timezone: string;
  createdAt: Date;
}

/* ─── Group ───────────────────────────────────────────────── */
export interface Group {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: GroupCategory;
  currency: Currency;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  members?: GroupMember[];
  _count?: { expenses: number; members: number };
  /** Set when the group has been archived (read-only history) */
  archivedAt?: string | Date | null;
}

/** A member's net balance with the current user inside one group (cents; + they owe you) */
export interface MemberBalance {
  userId: string;
  name: string;
  avatarUrl: string | null;
  balance: number;
}

/** Group as returned by /api/groups/[id] */
export interface GroupDetail extends Group {
  expenses?: Expense[];
  memberBalances?: MemberBalance[];
  stats?: GroupStats;
}

/** One payment suggested by the debt-simplification algorithm */
export interface SimplifiedDebt {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency?: string;
  fromUser?: { id: string; name: string; avatarUrl: string | null; upiId?: string | null };
  toUser?: { id: string; name: string; avatarUrl: string | null; upiId?: string | null };
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: Date;
  user?: UserProfile;
}

/* ─── Expense ─────────────────────────────────────────────── */
export interface Expense {
  id: string;
  groupId: string | null;
  description: string;
  amount: number; // in cents
  currency: Currency;
  category: ExpenseCategory;
  splitType: SplitType;
  paidById: string;
  date: Date;
  isRecurring: boolean;
  recurringInterval: string | null;
  notes: string | null;
  receiptUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidBy?: UserProfile;
  splits?: ExpenseSplit[];
  /** Present only when several people paid; otherwise `paidById` paid it all */
  payers?: ExpensePayer[];
  group?: Group;
  /** emoji reactions (counts per emoji; `mine` = you gave it) */
  reactions?: { emoji: string; count: number; mine: boolean }[];
}

export interface ExpensePayer {
  id?: string;
  expenseId?: string;
  userId: string;
  amount: number; // cents
  user?: UserProfile;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  amount: number; // in cents
  percentage: number | null;
  shares: number | null;
  isPaid: boolean;
  user?: UserProfile;
}

/* ─── Settlement ──────────────────────────────────────────── */
export interface Settlement {
  id: string;
  groupId: string | null;
  fromUserId: string;
  toUserId: string;
  amount: number; // in cents
  currency: Currency;
  note: string | null;
  createdAt: Date;
  fromUser?: UserProfile;
  toUser?: UserProfile;
}

/* ─── Friendship ──────────────────────────────────────────── */
export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  createdAt: Date;
  friend?: UserProfile;
  /** true for people who share a group with you but aren't formal friends */
  fromGroup?: boolean;
}

/* ─── Debt ────────────────────────────────────────────────── */
export interface Debt {
  fromUserId: string;
  toUserId: string;
  amount: number; // in cents
  fromUser?: UserProfile;
  toUser?: UserProfile;
}

/* ─── Balance ─────────────────────────────────────────────── */
export interface Balance {
  userId: string;
  totalOwed: number;   // amount others owe you (positive)
  totalOwing: number;  // amount you owe others (negative)
  net: number;         // totalOwed - totalOwing
  debts: Debt[];
}

/* ─── Notification ────────────────────────────────────────── */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: Date;
}

/* ─── Comment ─────────────────────────────────────────────── */
export interface ExpenseComment {
  id: string;
  expenseId: string;
  userId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserProfile;
}

/* ─── Budget ──────────────────────────────────────────────── */
export interface Budget {
  id: string;
  groupId: string | null;
  userId: string;
  category: ExpenseCategory | null;
  amount: number; // in cents
  period: BudgetPeriod;
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Activity ────────────────────────────────────────────── */
export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  groupId: string | null;
  expenseId: string | null;
  settlementId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  user?: UserProfile;
  group?: Group;
}

/* ─── Analytics ───────────────────────────────────────────── */
export interface MonthlySpending {
  month: string; // "2024-01"
  total: number;
  byCategory: Record<ExpenseCategory, number>;
}

export interface GroupBalance {
  groupId: string;
  groupName: string;
  balance: number;
}

/* ─── Forms ───────────────────────────────────────────────── */
export interface ExpenseFormValues {
  description: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  splitType: SplitType;
  paidById: string;
  date: Date;
  groupId?: string;
  notes?: string;
  participants: string[]; // user IDs
  splits?: Record<string, number>; // userId -> amount/percentage/shares
  isRecurring: boolean;
  recurringInterval?: string;
}

export interface GroupFormValues {
  name: string;
  description?: string;
  category: GroupCategory;
  currency: Currency;
  memberEmails?: string[];
}

/** Notification / activity row as serialised by the API (dates arrive as ISO strings) */
export interface ApiNotification {
  id: string;
  type: NotificationType | ActivityType;
  title?: string;
  body?: string;
  isRead: boolean;
  data?: ActivityMetadata | null;
  metadata?: ActivityMetadata | null;
  createdAt: string;
  user?: { name: string; avatarUrl: string | null };
  source?: "activity" | "notification";
}

/** Shape of Activity.metadata / Notification.data JSON (all fields optional, set per event type) */
export interface ActivityMetadata {
  description?: string;
  amount?: number;
  /** Currency of `amount` (older records may lack it; the API fills it in) */
  currency?: string;
  groupName?: string;
  memberName?: string;
  memberId?: string;
  action?: string;
  role?: string;
  toUserId?: string;
  removedUserId?: string;
  pending?: boolean;
  userId?: string;
  [key: string]: unknown;
}

/** Incoming/outgoing friend request as returned by /api/friends?pending|sent */
export interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  createdAt: string | Date;
  user?: UserProfile;
  friend?: UserProfile;
}
