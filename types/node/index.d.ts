declare module "node:buffer" {
    const Buffer: {
        from(data: ArrayBuffer | ArrayBufferView | string, encoding?: string): Uint8Array;
        from(data: Uint8Array): Uint8Array;
        alloc(size: number, fill?: string | number): Uint8Array;
        isBuffer(value: unknown): value is Uint8Array;
    };
    class Blob extends globalThis.Blob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag);
    }
    export { Buffer, Blob };
}

declare module "node:crypto" {
    export interface webcrypto extends Crypto {}
}

declare module "node:zlib" {
    export function gzip(data: Uint8Array, callback: (err: Error | null, result: Uint8Array) => void): void;
    export function gunzip(data: Uint8Array, callback: (err: Error | null, result: Uint8Array) => void): void;
}
