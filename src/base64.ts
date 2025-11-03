const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type BufferLike = Uint8Array & { toString(encoding?: string): string };

interface BufferConstructorLike {
    from(data: Uint8Array): BufferLike;
    from(data: string, encoding: string): BufferLike;
}

const BufferCtor: BufferConstructorLike | undefined = (globalThis as {
    Buffer?: BufferConstructorLike;
}).Buffer;

function bufferFrom(data: Uint8Array): BufferLike {
    if (!BufferCtor) {
        throw new Error("Buffer constructor not available in this environment.");
    }
    return BufferCtor.from(data);
}

function bufferFromBase64(str: string): Uint8Array {
    if (!BufferCtor) {
        throw new Error("Base64 decoding not supported in this environment.");
    }
    const buf = BufferCtor.from(str, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Convert a binary buffer into a Base64URL string without padding.
 *
 * The function prefers the native `btoa` implementation when available and
 * falls back to Node.js `Buffer` semantics when running outside the browser.
 *
 * @param u8 - The bytes to encode.
 * @returns A Base64URL string (no padding characters).
 */
export function toBase64Url(u8: Uint8Array): string {
    if (typeof btoa === "function") {
        const CHUNK = 0x8000; // 32 KB
        let binary = "";
        for (let i = 0; i < u8.length; i += CHUNK) {
            const sub = u8.subarray(i, i + CHUNK);
            binary += String.fromCharCode.apply(null, Array.from(sub));
        }
        const b64 = btoa(binary);
        return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    const buf = bufferFrom(u8);
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

/**
 * Decode a Base64URL string back into a `Uint8Array`.
 *
 * Both browser (`atob`) and Node.js (`Buffer`) implementations are supported.
 *
 * @param str - The Base64URL string to decode.
 * @returns The decoded bytes.
 */
export function fromBase64Url(str: string): Uint8Array {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    if (typeof atob === "function") {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) {
            u8[i] = bin.charCodeAt(i);
        }
        return u8;
    }

    return bufferFromBase64(b64);
}

/**
 * Encode a UTF-8 string to a `Uint8Array`.
 *
 * @param str - The string to encode as UTF-8.
 * @returns The encoded UTF-8 bytes.
 */
export function textEncode(str: string): Uint8Array {
    return textEncoder.encode(str);
}

/**
 * Decode a `Uint8Array` that contains UTF-8 data into a string.
 *
 * @param u8 - The UTF-8 encoded bytes.
 * @returns The decoded string.
 */
export function textDecode(u8: Uint8Array): string {
    return textDecoder.decode(u8);
}
