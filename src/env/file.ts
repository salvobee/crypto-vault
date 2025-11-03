import { isNodeEnvironment } from "./runtime.js";

/**
 * Minimal Buffer-like shape used to avoid importing Node types in browsers.
 */
export type NodeBuffer = Uint8Array & {
    toString(encoding?: string): string;
    slice(start?: number, end?: number): NodeBuffer;
};

type BufferConstructor = {
    from(data: ArrayBuffer | ArrayBufferView | string, encoding?: string): NodeBuffer;
    from(data: Uint8Array): NodeBuffer;
    alloc(size: number, fill?: string | number): NodeBuffer;
    isBuffer(value: unknown): value is NodeBuffer;
};

type BlobConstructor = typeof Blob;

let BlobCtor: BlobConstructor | undefined = typeof globalThis.Blob !== "undefined" ? globalThis.Blob : undefined;
let BufferCtor: BufferConstructor | undefined = (globalThis as { Buffer?: BufferConstructor }).Buffer;

if (isNodeEnvironment()) {
    try {
        const bufferModule = (await import("node:buffer")) as {
            Blob: BlobConstructor;
            Buffer: BufferConstructor;
        };
        BlobCtor ??= bufferModule.Blob;
        BufferCtor ??= bufferModule.Buffer;
    } catch {
        // ignore
    }
}

/**
 * Supported inputs that can be treated as binary data.
 */
export type BinaryLike = Blob | ArrayBuffer | ArrayBufferView | Uint8Array | NodeBuffer;

/**
 * Normalized representation of binary data for chunked processing.
 */
export interface BinarySource {
    size: number;
    mime: string;
    isBlob: boolean;
    getChunk(start: number, end: number): Promise<Uint8Array>;
}

/**
 * Determine whether the current environment exposes a `Blob` constructor.
 */
export function hasBlobSupport(): boolean {
    return typeof BlobCtor !== "undefined";
}

/**
 * Determine whether the current environment exposes a Node.js `Buffer` implementation.
 */
export function hasBufferSupport(): boolean {
    return typeof BufferCtor !== "undefined";
}

/**
 * Create a `Blob` using the best available implementation.
 *
 * @param data - Blob parts or raw bytes to include.
 * @param options - Optional blob metadata.
 * @returns A constructed Blob instance.
 * @throws When `Blob` is unavailable in the environment.
 */
export function createBinaryBlob(data: BlobPart | BlobPart[] | Uint8Array, options?: BlobPropertyBag): Blob {
    if (!BlobCtor) {
        throw new Error("Blob constructor not available in this environment.");
    }
    const parts = (Array.isArray(data) ? data : [data]) as BlobPart[];
    return new BlobCtor(parts, options);
}

/**
 * Type guard that checks whether a value is a Blob instance for the current runtime.
 */
export function isBlobInstance(value: unknown): value is Blob {
    return !!BlobCtor && value instanceof BlobCtor;
}

/**
 * Type guard that checks whether a value is a Node.js `Buffer` instance.
 */
export function isBufferInstance(value: unknown): value is NodeBuffer {
    return !!BufferCtor && BufferCtor.isBuffer(value);
}

function ensureUint8Array(view: ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array {
    if (view instanceof Uint8Array) {
        return view;
    }
    if (ArrayBuffer.isView(view)) {
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    return new Uint8Array(view);
}

/**
 * Normalize supported binary inputs into a {@link BinarySource} abstraction.
 *
 * @param input - Supported binary data.
 * @param mimeType - Optional MIME type override.
 * @returns A normalized binary source with chunk access helpers.
 */
export function createBinarySource(input: BinaryLike, mimeType?: string): BinarySource {
    if (isBlobInstance(input)) {
        const blob = input;
        const mime = blob.type || mimeType || "application/octet-stream";
        return {
            size: blob.size,
            mime,
            isBlob: true,
            getChunk: async (start: number, end: number) => {
                const slice = blob.slice(start, end);
                const buffer = await slice.arrayBuffer();
                return new Uint8Array(buffer);
            },
        };
    }

    let data: Uint8Array;
    if (isBufferInstance(input)) {
        data = input as unknown as Uint8Array;
    } else if (input instanceof Uint8Array) {
        data = input;
    } else if (ArrayBuffer.isView(input)) {
        data = ensureUint8Array(input);
    } else if (input instanceof ArrayBuffer) {
        data = new Uint8Array(input);
    } else {
        throw new TypeError("Unsupported binary input type.");
    }

    const size = data.byteLength;
    const mime = mimeType || "application/octet-stream";
    return {
        size,
        mime,
        isBlob: false,
        getChunk: async (start: number, end: number) => data.subarray(start, Math.min(end, size)),
    };
}

/**
 * Convert a Blob into a `Uint8Array`.
 *
 * @param blob - The Blob to read.
 * @returns The blob contents as bytes.
 */
export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
}

/**
 * Convert a `Uint8Array` to a Node.js `Buffer`.
 *
 * @param data - Bytes to wrap in a Buffer.
 * @returns A Buffer instance containing the same bytes.
 * @throws If Buffer support is unavailable.
 */
export function toBuffer(data: Uint8Array): NodeBuffer {
    if (!BufferCtor) {
        throw new Error("Buffer not available in this environment.");
    }
    return BufferCtor.from(data);
}
