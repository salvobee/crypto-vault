import { ALG, IV_BYTES, KEY_LENGTH, PBKDF2_ITERATIONS } from "./constants.js";
import { fromBase64Url, textDecode, textEncode, toBase64Url } from "./base64.js";
import { getRandomValues, getSubtleCrypto } from "./env/crypto.js";

/**
 * Generate a new AES-GCM-256 key that can be exported and used for
 * encryption/decryption.
 *
 * @returns A Web Crypto `CryptoKey` configured for AES-GCM encryption.
 */
export async function generateAesKey(): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    return subtle.generateKey(
        { name: ALG, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Serialize an AES-GCM key to a Base64URL encoded JWK string.
 *
 * @param key - The key to export.
 * @returns A Base64URL string representation of the key material.
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
    const subtle = getSubtleCrypto();
    const jwk = await subtle.exportKey("jwk", key);
    const json = JSON.stringify(jwk);
    return toBase64Url(textEncode(json));
}

/**
 * Restore an AES-GCM key from a Base64URL encoded JWK string.
 *
 * @param b64 - The Base64URL string previously produced by `exportKeyToBase64`.
 * @returns The reconstructed `CryptoKey` instance.
 */
export async function importKeyFromBase64(b64: string): Promise<CryptoKey> {
    const json = textDecode(fromBase64Url(b64));
    const jwk = JSON.parse(json);
    const subtle = getSubtleCrypto();
    return subtle.importKey("jwk", jwk, { name: ALG }, true, ["encrypt", "decrypt"]);
}

/**
 * Derive an AES-GCM key from a textual passphrase using PBKDF2-SHA256.
 *
 * @param passphrase - The passphrase to derive the key from.
 * @param saltU8 - Salt bytes used during derivation (must match when re-deriving).
 * @param iterations - Optional iteration count (defaults to `PBKDF2_ITERATIONS`).
 * @returns The derived AES-GCM `CryptoKey`.
 */
export async function deriveKeyFromPassphrase(
    passphrase: string,
    saltU8: Uint8Array,
    iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    const baseKey = await subtle.importKey(
        "raw",
        textEncode(passphrase) as BufferSource,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return subtle.deriveKey(
        { name: "PBKDF2", salt: saltU8 as BufferSource, iterations, hash: "SHA-256" },
        baseKey,
        { name: ALG, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Generate cryptographically secure random bytes.
 *
 * @param length - Number of bytes to produce.
 * @returns A buffer filled with random data.
 */
export function randomBytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    getRandomValues(out);
    return out;
}

/**
 * Generate a random initialization vector suitable for AES-GCM operations.
 *
 * @returns A byte array with the required IV length.
 */
export function randomIv(): Uint8Array {
    return randomBytes(IV_BYTES);
}
