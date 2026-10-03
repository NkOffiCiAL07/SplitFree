import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativeApp } from "@/lib/native";

export type HapticKind = "light" | "success" | "warning" | "error";

/**
 * A small physical confirmation for money actions (expense added, payment recorded). Real haptics in the iPhone app,
 * a short vibration on Android browsers that support it, nothing elsewhere — and it can never throw.
 */
export async function haptic(kind: HapticKind = "light"): Promise<void> {
  try {
    if (isNativeApp()) {
      if (kind === "light") await Haptics.impact({ style: ImpactStyle.Light });
      else await Haptics.notification({ type: kind === "success" ? NotificationType.Success : kind === "warning" ? NotificationType.Warning : NotificationType.Error });
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "light" ? 10 : kind === "success" ? [12, 40, 12] : 40);
    }
  } catch { /* haptics are a nicety; never break the action they decorate */ }
}
