import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export const GOOGLE_CALENDAR_MOBILE_RETURN_URL =
  'no.kollekt.app://google-calendar-connected';

export function isNativeGoogleCalendarOAuth(): boolean {
  return Capacitor.isNativePlatform();
}

export async function openNativeGoogleCalendarOAuth(url: string): Promise<void> {
  await Browser.open({ url });
}

function isSuccessfulReturn(url: string): boolean {
  const parsed = new URL(url);
  return (
    parsed.protocol === 'no.kollekt.app:' &&
    parsed.hostname === 'google-calendar-connected' &&
    parsed.searchParams.get('googleCalendarConnected') === 'true'
  );
}

export function listenForGoogleCalendarReturn(onConnected: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  let disposed = false;
  const handleUrl = async (url?: string) => {
    if (disposed || !url || !isSuccessfulReturn(url)) return;
    await Browser.close();
    onConnected();
  };

  const listener = App.addListener('appUrlOpen', ({ url }) => {
    void handleUrl(url);
  });
  void App.getLaunchUrl().then((result) => handleUrl(result?.url));

  return () => {
    disposed = true;
    void listener.then((handle) => handle.remove());
  };
}
