import { clearCompressionBindingOverride, getCompressionBinding } from "./env/compression.js";

export interface CompressionResult {
    compressed: boolean;
    data: Uint8Array;
}

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
export const __resetCompressionOverridesForTests = clearCompressionBindingOverride;
