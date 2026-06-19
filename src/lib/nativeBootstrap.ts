import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

// One-time native shell setup: status bar styling over the dark theme, then hide
// the launch splash once the web layer is ready. No-op on the web build.
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#090C15' });
    }
  } catch {
    // Status bar plugin unavailable on this platform; ignore.
  } finally {
    await SplashScreen.hide().catch(() => undefined);
  }
}
