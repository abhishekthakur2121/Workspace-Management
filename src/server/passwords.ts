import "server-only";
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Passwords are stored only as scrypt hashes with a per-password random salt:
//   scrypt$N$r$p$<salt base64>$<hash base64>
// The parameters are stored with each hash so they can be raised later
// without invalidating existing passwords.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keylen, { ...options, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: +n, r: +r, p: +p });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Equalises response time when an email doesn't exist, so timing can't reveal
// which emails have accounts.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(KEY_LENGTH).toString("base64");
export async function burnVerifyTime(password: string) {
  await verifyPassword(password, DUMMY_HASH);
}

// Readable temporary passwords (no 0/O/1/l/I), e.g. "hq7K-mz4W-p9rT".
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generatePassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return "That password is too long.";
  return null;
}
