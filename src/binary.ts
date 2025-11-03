/**
 * Concatenate multiple `Uint8Array` instances into a single buffer.
 *
 * @param parts - Arrays to concatenate in order.
 * @returns A new `Uint8Array` containing the merged bytes.
 */
export function concatU8(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

/**
 * Encode an unsigned 32-bit integer as big-endian bytes.
 *
 * @param n - The number to encode.
 * @returns A 4-byte big-endian representation of `n`.
 */
export function u32be(n: number): Uint8Array {
    const b = new Uint8Array(4);
    b[0] = (n >>> 24) & 0xff;
    b[1] = (n >>> 16) & 0xff;
    b[2] = (n >>> 8) & 0xff;
    b[3] = n & 0xff;
    return b;
}

/**
 * Read an unsigned 32-bit integer from big-endian encoded bytes.
 *
 * @param u8 - Source buffer containing the number.
 * @param offset - Byte offset where the number begins.
 * @returns The decoded unsigned integer.
 */
export function readU32be(u8: Uint8Array, offset: number): number {
    return (
        ((u8[offset] << 24) | (u8[offset + 1] << 16) | (u8[offset + 2] << 8) | u8[offset + 3]) >>> 0
    );
}
