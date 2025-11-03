import { ALG, IV_BYTES, KEY_LENGTH, PBKDF2_ITERATIONS } from "./constants.js";
import { fromBase64Url, textDecode, textEncode, toBase64Url } from "./base64.js";
import { getRandomValues, getSubtleCrypto } from "./env/crypto.js";

const RSA_OAEP_PARAMS: RsaHashedKeyGenParams = {
    name: "RSA-OAEP",
    modulusLength: 4096,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: "SHA-256",
};

const AES_KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt"];

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
        AES_KEY_USAGES
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
    return subtle.importKey("jwk", jwk, { name: ALG }, true, AES_KEY_USAGES);
}

/**
 * Generate an RSA-OAEP key pair suitable for wrapping AES keys.
 */
export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
    const subtle = getSubtleCrypto();
    return subtle.generateKey(RSA_OAEP_PARAMS, true, ["wrapKey", "unwrapKey"]);
}

/**
 * Wrap an AES key for a recipient using their RSA-OAEP public key.
 *
 * @param recipientPublicKey - The RSA-OAEP public key of the recipient.
 * @param keyToWrap - The AES key to wrap.
 * @returns The wrapped key as a Base64URL encoded string.
 */
export async function wrapKeyForRecipient(
    recipientPublicKey: CryptoKey,
    keyToWrap: CryptoKey
): Promise<string> {
    const subtle = getSubtleCrypto();
    const wrapped = await subtle.wrapKey("raw", keyToWrap, recipientPublicKey, RSA_OAEP_PARAMS);
    return toBase64Url(new Uint8Array(wrapped));
}

/**
 * Unwrap an AES key previously wrapped via `wrapKeyForRecipient`.
 *
 * @param wrappedKeyB64 - Base64URL representation of the wrapped key.
 * @param recipientPrivateKey - The recipient's RSA-OAEP private key.
 * @returns The restored AES-GCM key.
 */
export async function unwrapKeyForRecipient(
    wrappedKeyB64: string,
    recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    const wrappedBytes = fromBase64Url(wrappedKeyB64);
    const wrapped = new Uint8Array(wrappedBytes);
    return subtle.unwrapKey(
        "raw",
        wrapped,
        recipientPrivateKey,
        RSA_OAEP_PARAMS,
        { name: ALG, length: KEY_LENGTH },
        true,
        AES_KEY_USAGES
    );
}

/**
 * Export a CryptoKey to JWK.
 */
export async function exportPublicKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
    const subtle = getSubtleCrypto();
    return subtle.exportKey("jwk", key);
}

/**
 * Export a private RSA key to JWK.
 */
export async function exportPrivateKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
    const subtle = getSubtleCrypto();
    return subtle.exportKey("jwk", key);
}

/**
 * Import an RSA public key from JWK.
 */
export async function importPublicKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    return subtle.importKey("jwk", jwk, RSA_OAEP_PARAMS, true, ["wrapKey"]);
}

/**
 * Import an RSA private key from JWK.
 */
export async function importPrivateKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
    const subtle = getSubtleCrypto();
    return subtle.importKey("jwk", jwk, RSA_OAEP_PARAMS, true, ["unwrapKey"]);
}

/**
 * Convert a JWK to a Base64URL string.
 */
export function jwkToBase64Url(jwk: JsonWebKey): string {
    return toBase64Url(textEncode(JSON.stringify(jwk)));
}

/**
 * Convert a Base64URL string to a JWK.
 */
export function base64UrlToJwk(b64: string): JsonWebKey {
    return JSON.parse(textDecode(fromBase64Url(b64)));
}

export async function exportPublicKeyToBase64(key: CryptoKey): Promise<string> {
    const jwk = await exportPublicKeyToJwk(key);
    return jwkToBase64Url(jwk);
}

export async function exportPrivateKeyToBase64(key: CryptoKey): Promise<string> {
    const jwk = await exportPrivateKeyToJwk(key);
    return jwkToBase64Url(jwk);
}

export async function importPublicKeyFromBase64(b64: string): Promise<CryptoKey> {
    const jwk = base64UrlToJwk(b64);
    return importPublicKeyFromJwk(jwk);
}

export async function importPrivateKeyFromBase64(b64: string): Promise<CryptoKey> {
    const jwk = base64UrlToJwk(b64);
    return importPrivateKeyFromJwk(jwk);
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
        AES_KEY_USAGES
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
