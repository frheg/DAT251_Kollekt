import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Light tactile confirmation for meaningful actions. No-op on web and never throws.
export async function tapFeedback(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics are best-effort; ignore unsupported devices.
  }
}
