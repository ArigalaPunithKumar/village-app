import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';

export const NATIVE_AUTH_REDIRECT = 'com.pallenestam.app://auth/callback';

async function completeNativeAuth(url: string) {
  if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;
  const { error } = await supabase.auth.exchangeCodeForSession(url);
  if (error) {
    console.error('Could not complete Google sign-in in the native app', error.message);
  }
  await Browser.close().catch(() => undefined);
}

export function setupNativeAuthDeepLinks() {
  if (!Capacitor.isNativePlatform()) return () => undefined;

  let active = true;
  let listener: PluginListenerHandle | null = null;
  void App.addListener('appUrlOpen', ({ url }) => void completeNativeAuth(url)).then((handle) => {
    listener = handle;
    if (!active) void handle.remove();
  });
  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) return completeNativeAuth(launch.url);
  }).catch((error: unknown) => {
    console.warn('Could not read the initial app link', error);
  });

  return () => {
    active = false;
    if (listener) void listener.remove();
  };
}

export async function startGoogleSignIn() {
  const native = Capacitor.isNativePlatform();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: native ? NATIVE_AUTH_REDIRECT : window.location.origin,
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;
  if (native) {
    if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');
    await Browser.open({ url: data.url });
  }
}
