import { APP_NAME } from "@/lib/app-config";

/** Friendly invite text for people who haven't signed up yet. */
export function buildInviteMessage(url: string, inviterName?: string, appName = APP_NAME): string {
  const who = inviterName ? `${inviterName} invited you to ${appName}` : `Join me on ${appName}`;
  return `${who} 👋 Split bills, trips and rent with friends — free, no ads. ${url}`;
}

/** wa.me deep link: opens WhatsApp (app on phones, WhatsApp Web on desktop) with the text prefilled. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Invite to one specific group (the link lets them join straight away). */
export function buildGroupInviteMessage(groupName: string, url: string, inviterName?: string, appName = APP_NAME): string {
  const who = inviterName ? `${inviterName} added you to` : "Join";
  return `${who} "${groupName}" on ${appName} 👋 Tap to join and split our expenses — free, no ads. ${url}`;
}

/**
 * A polite, specific nudge for WhatsApp — works for anyone, whether or not they have the app or notifications on.
 * Includes the creditor's UPI ID for rupee debts so paying is one copy away. `amountCents` is in stored units.
 */
export function buildReminderMessage(opts: {
  debtorName?: string;
  amountLabel: string; // already formatted, e.g. "₹1,200.00"
  currency: string;
  upiId?: string | null;
  note?: string;
  appName?: string;
}): string {
  const { debtorName, amountLabel, currency, upiId, note, appName = APP_NAME } = opts;
  const hi = debtorName ? `Hi ${debtorName.split(" ")[0]}` : "Hi";
  const lines = [`${hi}! 👋 Friendly reminder — you owe me ${amountLabel}${note ? ` for ${note}` : ""} (tracked on ${appName}).`];
  if (currency === "INR" && upiId?.trim()) lines.push(`You can pay me on UPI: ${upiId.trim()}`);
  lines.push("Thanks! 🙏");
  return lines.join("\n");
}
