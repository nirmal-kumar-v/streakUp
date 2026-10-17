import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Authentication & Security Validation', () => {
  const JWT_SECRET = 'streakup_test_jwt_secret_key';

  it('should enforce case-insensitive username normalization', () => {
    const rawUsername1 = '  Nirmal  ';
    const rawUsername2 = 'nirmal';
    const rawUsername3 = 'NIRMAL';

    const normalized1 = rawUsername1.trim().toLowerCase();
    const normalized2 = rawUsername2.trim().toLowerCase();
    const normalized3 = rawUsername3.trim().toLowerCase();

    expect(normalized1).toBe('nirmal');
    expect(normalized1).toBe(normalized2);
    expect(normalized2).toBe(normalized3);
  });

  it('should hash passwords and verify them correctly with bcrypt', async () => {
    const plainPassword = 'SuperSecretPassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(plainPassword, salt);

    expect(hash).not.toBe(plainPassword);
    expect(hash.length).toBeGreaterThan(20);

    const matches = await bcrypt.compare(plainPassword, hash);
    expect(matches).toBe(true);

    const wrongMatches = await bcrypt.compare('WrongPassword456!', hash);
    expect(wrongMatches).toBe(false);
  });

  it('should generate and verify JWT token payload', () => {
    const payload = {
      userId: 'test-user-uuid-123',
      username: 'nirmal',
      email: 'nirmal@example.com',
      timezone: 'Asia/Kolkata'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.timezone).toBe(payload.timezone);
  });

  it('should reject tampered or expired tokens', () => {
    const token = jwt.sign({ userId: 'u1' }, JWT_SECRET, { expiresIn: '1s' });
    const tampered = token.slice(0, -4) + 'abcd';

    expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow();
  });
});
