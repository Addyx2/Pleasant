import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

// Integration credentials (API tokens, OAuth refresh tokens) are encrypted at
// rest with AES-256-GCM. The key is INTEGRATIONS_KEY (32 bytes, base64), or
// if unset, derived from AUTH_SECRET. Changing either key disconnects every
// integration: their credentials can no longer be read.

function key(): Buffer {
  const raw = process.env.INTEGRATIONS_KEY;
  if (raw) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
    // Any other string still works, hashed to 32 bytes.
    return createHash("sha256").update(raw).digest();
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Set INTEGRATIONS_KEY or AUTH_SECRET to store integration credentials");
  return Buffer.from(hkdfSync("sha256", secret, "pleasant", "integrations-v1", 32));
}

/** Encrypts a JSON value to "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Decrypts a sealed value. Returns null if it's missing, tampered with or the key changed. */
export function unseal<T>(sealed: string | null | undefined): T | null {
  if (!sealed) return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}
