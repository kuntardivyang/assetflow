import bcrypt from "bcryptjs";

// Central cost factor so hashing is consistent across signup + seed.
// 12 rounds ≈ 250ms/hash — strong without hurting login UX.
export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A pre-computed valid hash used to equalise timing when a login email
 * doesn't exist — so an attacker can't tell "no such user" from "wrong
 * password" by measuring response time (user enumeration).
 */
export const DUMMY_HASH = bcrypt.hashSync("timing-safe-placeholder", BCRYPT_ROUNDS);
