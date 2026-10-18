/**
 * Secure client-side PIN hashing and verification using Web Crypto API.
 * Never stores plaintext PINs in localStorage or sessionStorage.
 */

// Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate cryptographically secure random salt
export function generateSalt(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash PIN with salt and optional userId using SHA-256 via Web Crypto
 */
export async function hashPin(pin: string, salt: string, userId: string = 'global'): Promise<string> {
  const encoder = new TextEncoder();
  // Salt + UserId + PIN ensures device/user separation
  const data = encoder.encode(`streakup_pin_v1:${salt}:${userId}:${pin}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Verify an input PIN against stored salt and expected hash
 */
export async function verifyPinHash(
  inputPin: string,
  salt: string,
  expectedHash: string,
  userId: string = 'global'
): Promise<boolean> {
  const calculatedHash = await hashPin(inputPin, salt, userId);
  return calculatedHash === expectedHash;
}
