import { clearCompressionBindingOverride, getCompressionBinding } from "./env/compression.js";

/**
 * Outcome of a compression attempt.
 */
export interface CompressionResult {
    compressed: boolean;
    data: Uint8Array;
}

/**
 * Optionally compress a byte array if a compression binding is available.
 *
 * @param u8 - The data to compress.
 * @param enabled - When `false`, the input is returned without modification.
 * @returns The compression result, indicating whether compression occurred.
 */
export async function maybeCompress(u8: Uint8Array, enabled = true): Promise<CompressionResult> {
    if (!enabled) {
        return { compressed: false, data: u8 };
    }

    const binding = await getCompressionBinding();
    if (!binding) {
        return { compressed: false, data: u8 };
    }

    const data = await binding.compress(u8);
    return { compressed: true, data };
}

/**
 * Decompress a byte array if it was previously marked as compressed.
 *
 * @param u8 - The data to decompress.
 * @param compressed - Whether the payload is compressed.
 * @returns The original, uncompressed bytes.
 * @throws If decompression bindings are not available while `compressed` is true.
 */
export async function maybeDecompress(u8: Uint8Array, compressed: boolean): Promise<Uint8Array> {
    if (!compressed) {
        return u8;
    }

    const binding = await getCompressionBinding();
    if (!binding) {
        throw new Error("Compression bindings not available in this environment.");
    }

    return binding.decompress(u8);
}

// istanbul ignore next - allow tests to reset overrides without importing internals
/**
 * Reset the environment binding overrides (used internally by tests).
 */
export const __resetCompressionOverridesForTests = clearCompressionBindingOverride;
