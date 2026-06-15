/**
 * AES-256-CBC encryption helpers for the Instagram session blob.
 *
 * The same ENCRYPTION_KEY is shared between the mobile app and the
 * Python automation worker on Railway. We never store the plaintext
 * Instagram session in Supabase.
 *
 * Key is read from EXPO_PUBLIC_ENCRYPTION_KEY so it ships inside the
 * Expo config / build. For a real production app, derive the key on
 * the server side and never embed it in the client.
 */
import CryptoJS from "crypto-js";

import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  encryptionKey?: string;
};

const ENCRYPTION_KEY =
  extra.encryptionKey ??
  process.env.EXPO_PUBLIC_ENCRYPTION_KEY ??
  "myfeed-dev-encryption-key-change-me-please-32b";

if (ENCRYPTION_KEY.length < 16) {
  // eslint-disable-next-line no-console
  console.warn("[encryption] ENCRYPTION_KEY is too short — use at least 16 chars.");
}

/**
 * Derive a 32-byte key + 16-byte IV from the passphrase using SHA-256 + first 16 bytes.
 * This is the same scheme the Python worker uses (see automation/crypto.py).
 */
function deriveKeyAndIv(passphrase: string): { key: CryptoJS.lib.WordArray; iv: CryptoJS.lib.WordArray } {
  const keyHash = CryptoJS.SHA256(passphrase);
  const key = CryptoJS.lib.WordArray.create(keyHash.words.slice(0, 4), 16);
  const iv = CryptoJS.lib.WordArray.create(keyHash.words.slice(4, 8), 16);
  return { key, iv };
}

export function encryptSession(plaintext: string): string {
  const { key, iv } = deriveKeyAndIv(ENCRYPTION_KEY);
  return CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

export function decryptSession(ciphertext: string): string {
  const { key, iv } = deriveKeyAndIv(ENCRYPTION_KEY);
  const bytes = CryptoJS.AES.decrypt(ciphertext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return bytes.toString(CryptoJS.enc.Utf8);
}
