/**
 * Secure client-side PIN and Security Question hashing and verification using Web Crypto API.
 * Never stores plaintext PINs or plaintext security answers in localStorage or sessionStorage.
 */

// Preset security questions for App Lock recovery
export const DEFAULT_SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'In what city was your first job or high school?',
  'What is the name of your favorite childhood pet?',
  'What is your all-time favorite book or movie?',
  'What was the model of your first car or bike?',
  'What is your favorite sports team or athlete?',
] as const;

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

/**
 * Hash normalized security answer (trimmed and lowercased) with salt and userId
 */
export async function hashSecurityAnswer(
  answer: string,
  salt: string,
  userId: string = 'global'
): Promise<string> {
  const normalized = answer.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(`streakup_sec_answer_v1:${salt}:${userId}:${normalized}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Verify an input security answer against stored salt and expected hash
 */
export async function verifySecurityAnswerHash(
  inputAnswer: string,
  salt: string,
  expectedHash: string,
  userId: string = 'global'
): Promise<boolean> {
  const calculatedHash = await hashSecurityAnswer(inputAnswer, salt, userId);
  return calculatedHash === expectedHash;
}
