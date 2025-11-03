import { ALG, IV_BYTES, KEY_LENGTH, PBKDF2_ITERATIONS } from "./constants.js";
import { fromBase64Url, textDecode, textEncode, toBase64Url } from "./base64.js";

export async function generateAesKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: ALG, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const json = JSON.stringify(jwk);
    return toBase64Url(textEncode(json));
}

export async function importKeyFromBase64(b64: string): Promise<CryptoKey> {
    const json = textDecode(fromBase64Url(b64));
    const jwk = JSON.parse(json);
    return crypto.subtle.importKey("jwk", jwk, { name: ALG }, true, ["encrypt", "decrypt"]);
}

export async function deriveKeyFromPassphrase(
    passphrase: string,
    saltU8: Uint8Array,
    iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        textEncode(passphrase) as BufferSource,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: saltU8 as BufferSource, iterations, hash: "SHA-256" },
        baseKey,
        { name: ALG, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
    );
}

export function randomBytes(length: number): Uint8Array {
    const out = new Uint8Array(length);
    crypto.getRandomValues(out);
    return out;
}

export function randomIv(): Uint8Array {
    return randomBytes(IV_BYTES);
}
