export interface CompressionResult {
    compressed: boolean;
    data: Uint8Array;
}

export async function maybeCompress(u8: Uint8Array, enabled = true): Promise<CompressionResult> {
    if (!enabled) {
        return { compressed: false, data: u8 };
    }
    if (typeof CompressionStream === "undefined") {
        return { compressed: false, data: u8 };
    }
    const cs = new CompressionStream("gzip");
    const source = u8 as unknown as BlobPart;
    const compressed = await new Response(new Blob([source]).stream().pipeThrough(cs)).arrayBuffer();
    return { compressed: true, data: new Uint8Array(compressed) };
}

export async function maybeDecompress(u8: Uint8Array, compressed: boolean): Promise<Uint8Array> {
    if (!compressed) {
        return u8;
    }
    if (typeof DecompressionStream === "undefined") {
        throw new Error("DecompressionStream not available in this browser.");
    }
    const ds = new DecompressionStream("gzip");
    const source = u8 as unknown as BlobPart;
    const decompressed = await new Response(new Blob([source]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(decompressed);
}
