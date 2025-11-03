import { isNodeEnvironment } from "./runtime.js";
import { createBinaryBlob } from "./file.js";

export interface CompressionBinding {
    type: "browser" | "node";
    compress(data: Uint8Array): Promise<Uint8Array>;
    decompress(data: Uint8Array): Promise<Uint8Array>;
}

let overrideBinding: CompressionBinding | null = null;
let hasOverride = false;
let nodeBindingPromise: Promise<CompressionBinding | undefined> | undefined;

async function createBrowserBinding(): Promise<CompressionBinding> {
    const compress = async (data: Uint8Array): Promise<Uint8Array> => {
        const cs = new CompressionStream("gzip");
        const blob = createBinaryBlob(data);
        const stream = blob.stream().pipeThrough(cs);
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
    };

    const decompress = async (data: Uint8Array): Promise<Uint8Array> => {
        const ds = new DecompressionStream("gzip");
        const blob = createBinaryBlob(data);
        const stream = blob.stream().pipeThrough(ds);
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
    };

    return { type: "browser", compress, decompress };
}

async function createNodeBinding(): Promise<CompressionBinding | undefined> {
    if (!isNodeEnvironment()) {
        return undefined;
    }

    try {
        const zlib = (await import("node:zlib")) as {
            gzip(data: Uint8Array, callback: (err: Error | null, result: Uint8Array) => void): void;
            gunzip(data: Uint8Array, callback: (err: Error | null, result: Uint8Array) => void): void;
        };

        const compress = (data: Uint8Array): Promise<Uint8Array> =>
            new Promise((resolve, reject) => {
                zlib.gzip(data, (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(new Uint8Array(result));
                });
            });

        const decompress = (data: Uint8Array): Promise<Uint8Array> =>
            new Promise((resolve, reject) => {
                zlib.gunzip(data, (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(new Uint8Array(result));
                });
            });

        return { type: "node", compress, decompress };
    } catch {
        return undefined;
    }
}

export async function getCompressionBinding(): Promise<CompressionBinding | undefined> {
    if (hasOverride) {
        return overrideBinding ?? undefined;
    }

    if (typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined") {
        return createBrowserBinding();
    }

    if (!nodeBindingPromise) {
        nodeBindingPromise = createNodeBinding();
    }
    return nodeBindingPromise;
}

export function setCompressionBindingOverride(binding: CompressionBinding | undefined): void {
    overrideBinding = binding ?? null;
    hasOverride = true;
}

export function clearCompressionBindingOverride(): void {
    overrideBinding = null;
    hasOverride = false;
}
