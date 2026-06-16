import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM-Verschlüsselung für Drittanbieter-API-Keys.
 * Der 32-Byte-Schlüssel wird deterministisch aus ENCRYPTION_KEY abgeleitet
 * (SHA-256), damit beliebige Schlüssel-Formate (base64, hex, Klartext) sicher
 * auf 32 Byte normalisiert werden.
 *
 * Format des Chiffrats: base64(iv).base64(authTag).base64(ciphertext)
 */
function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? "";
  if (!secret) throw new Error("ENCRYPTION_KEY ist nicht gesetzt.");
  return createHash("sha256").update(secret).digest();
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(
    ".",
  );
}

export function decryptApiKey(encrypted: string): string {
  const [ivB64, tagB64, dataB64] = encrypted.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Ungültiges Chiffrat-Format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
