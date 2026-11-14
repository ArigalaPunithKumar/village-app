import { Capacitor } from '@capacitor/core';

export const PASSWORD_RESET_REDIRECT_URL = 'com.pallenestam.app://auth/reset-password';

export function getPasswordResetRedirectUrl(): string {
  if (Capacitor.isNativePlatform()) return PASSWORD_RESET_REDIRECT_URL;
  return `${window.location.origin}/`;
}
