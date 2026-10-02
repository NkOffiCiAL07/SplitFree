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
