import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const ACCESS_TOKEN_KEY = 'kollekt-access-token';
const REFRESH_TOKEN_KEY = 'kollekt-refresh-token';
const tokenKeys = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY] as const;

let migration: Promise<void> | null = null;

function migrateLegacyNativeTokens(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (migration) return migration;

  migration = Promise.all(
    tokenKeys.map(async (key) => {
      const legacyToken = localStorage.getItem(key);
      if (!legacyToken) return;
      if (!await SecureStorage.getItem(key)) {
        await SecureStorage.setItem(key, legacyToken);
      }
      localStorage.removeItem(key);
    }),
  ).then(() => undefined);

  return migration;
}

async function getToken(key: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return localStorage.getItem(key);
  await migrateLegacyNativeTokens();
  return SecureStorage.getItem(key);
}

async function setToken(key: string, value: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(key, value);
    return;
  }
  await migrateLegacyNativeTokens();
  await SecureStorage.setItem(key, value);
}

async function removeToken(key: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    localStorage.removeItem(key);
    return;
  }
  await migrateLegacyNativeTokens();
  await SecureStorage.removeItem(key);
}

export const authStorage = {
  getAccessToken: () => getToken(ACCESS_TOKEN_KEY),
  setAccessToken: (token: string) => setToken(ACCESS_TOKEN_KEY, token),
  getRefreshToken: () => getToken(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => setToken(REFRESH_TOKEN_KEY, token),
  clearAccessToken: () => removeToken(ACCESS_TOKEN_KEY),
  clearRefreshToken: () => removeToken(REFRESH_TOKEN_KEY),
};
