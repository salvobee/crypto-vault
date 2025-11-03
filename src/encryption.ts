import { DEFAULT_CHUNK_SIZE, VERSION, ALG, IV_BYTES } from "./constants.js";
import { maybeCompress, maybeDecompress } from "./compression.js";
import { packContainer, unpackContainer } from "./container.js";
import { randomIv } from "./keys.js";
import { concatU8, readU32be, u32be } from "./binary.js";
import { fromBase64Url, textDecode, textEncode, toBase64Url } from "./base64.js";

interface ProgressInfo {
    processed: number;
    total: number;
    percent: number;
}

interface ProgressOptions {
    onProgress?: (info: ProgressInfo) => void;
    signal?: AbortSignal;
}

export interface EncryptStringOptions {
    compress?: boolean;
}

export interface EncryptBlobOptions extends ProgressOptions {
    compress?: boolean;
    chunkSize?: number;
}

export interface DecryptBlobOptions extends ProgressOptions {}

async function aesGcmEncrypt(
    key: CryptoKey,
    ivU8: Uint8Array,
    dataU8: Uint8Array,
    additionalDataU8?: Uint8Array
): Promise<Uint8Array> {
    const ct = await crypto.subtle.encrypt(
        { name: ALG, iv: ivU8 as BufferSource, additionalData: additionalDataU8 as BufferSource | undefined },
        key,
        dataU8 as BufferSource
    );
    return new Uint8Array(ct);
}

async function aesGcmDecrypt(
    key: CryptoKey,
    ivU8: Uint8Array,
    cipherU8: Uint8Array,
    additionalDataU8?: Uint8Array
): Promise<Uint8Array> {
    const pt = await crypto.subtle.decrypt(
        { name: ALG, iv: ivU8 as BufferSource, additionalData: additionalDataU8 as BufferSource | undefined },
        key,
        cipherU8 as BufferSource
    );
    return new Uint8Array(pt);
}

function ensureNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
    }
}

function reportProgress(
    onProgress: ProgressOptions["onProgress"],
    processed: number,
    total: number
): void {
    if (typeof onProgress === "function") {
        const percent = total
            ? Math.min(100, Math.round((processed / total) * 100))
            : processed
            ? 100
            : 0;
        onProgress({ processed, total, percent });
    }
}

export async function encryptString(
    plainText: string,
    key: CryptoKey,
    { compress = true }: EncryptStringOptions = {}
): Promise<string> {
    const preU8 = textEncode(plainText);
    const { compressed, data } = await maybeCompress(preU8, compress);
    const iv = randomIv();
    const aad = textEncode(`${ALG}|text|v${VERSION}`);
    const ct = await aesGcmEncrypt(key, iv, data, aad);
    const meta = {
        type: "text" as const,
        alg: ALG,
        iv: toBase64Url(iv),
        compressed,
    };
    return packContainer({ compressed, isChunked: false, meta, payloadU8: ct });
}

export async function decryptToString(packedB64u: string, key: CryptoKey): Promise<string> {
    const { compressed, isChunked, meta, payloadU8 } = unpackContainer(packedB64u);
    if (isChunked) {
        throw new Error("Content is chunked (file). Use decryptToBlob().");
    }
    if (meta.type !== "text") {
        throw new Error("Content type is not text.");
    }
    if (!meta.iv) {
        throw new Error("Missing IV in container metadata.");
    }
    const iv = fromBase64Url(meta.iv);
    const aad = textEncode(`${ALG}|text|v${VERSION}`);
    const pt = await aesGcmDecrypt(key, iv, payloadU8, aad);
    const u8 = await maybeDecompress(pt, compressed);
    return textDecode(u8);
}

export async function encryptBlob(
    blob: Blob,
    key: CryptoKey,
    { compress = true, chunkSize = DEFAULT_CHUNK_SIZE, onProgress, signal }: EncryptBlobOptions = {}
): Promise<string> {
    const mime = blob.type || "application/octet-stream";
    const size = blob.size;
    const CHUNK_COMPRESS_THRESHOLD = 64 * 1024 * 1024;
    const isLarge = size > CHUNK_COMPRESS_THRESHOLD;
    const aad = textEncode(`${ALG}|blob|v${VERSION}|${mime}`);

    const report = (processed: number): void => reportProgress(onProgress, processed, size);

    if (!isLarge) {
        ensureNotAborted(signal);
        report(0);
        const buf = new Uint8Array(await blob.arrayBuffer());
        const { compressed: wasCompressed, data } = await maybeCompress(buf, compress);
        const iv = randomIv();
        const ct = await aesGcmEncrypt(key, iv, data, aad);
        const meta = {
            type: "blob" as const,
            alg: ALG,
            mime,
            compressed: wasCompressed,
            single: true,
            iv: toBase64Url(iv),
            size,
        };
        report(size);
        return packContainer({ compressed: wasCompressed, isChunked: false, meta, payloadU8: ct });
    }

    const supportsCompression = typeof CompressionStream !== "undefined";
    const useCompression = compress && supportsCompression;
    const chunkCount = Math.ceil(size / chunkSize);
    const payloadParts: Uint8Array[] = [];

    let processed = 0;
    report(0);

    for (let i = 0; i < chunkCount; i += 1) {
        ensureNotAborted(signal);
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, size);
        const u8 = new Uint8Array(await blob.slice(start, end).arrayBuffer());
        const chunk = useCompression ? await maybeCompress(u8, true) : { data: u8, compressed: false };
        const { data } = chunk;
        const iv = randomIv();
        const ct = await aesGcmEncrypt(key, iv, data, aad);
        const lenU8 = u32be(ct.length);
        payloadParts.push(lenU8, iv, ct);

        processed = end;
        report(processed);
    }

    const meta = {
        type: "blob" as const,
        alg: ALG,
        mime,
        compressed: useCompression,
        chunked: true,
        chunkSize,
        size,
    };
    const payloadU8 = concatU8(...payloadParts);
    report(size);
    return packContainer({ compressed: useCompression, isChunked: true, meta, payloadU8 });
}

export async function decryptToBlob(
    packedB64u: string,
    key: CryptoKey,
    { onProgress, signal }: DecryptBlobOptions = {}
): Promise<Blob> {
    const { compressed, isChunked, meta, payloadU8 } = unpackContainer(packedB64u);
    if (meta.type !== "blob") {
        throw new Error("Content type is not blob.");
    }
    const mime = meta.mime || "application/octet-stream";
    const aad = textEncode(`${ALG}|blob|v${VERSION}|${mime}`);

    const total = typeof meta.size === "number" ? meta.size : 0;
    const report = (processed: number): void => reportProgress(onProgress, processed, total);

    if (!isChunked && meta.single) {
        ensureNotAborted(signal);
        report(0);
        if (!meta.iv) {
            throw new Error("Missing IV in container metadata.");
        }
        const iv = fromBase64Url(meta.iv);
        const pt = await aesGcmDecrypt(key, iv, payloadU8, aad);
        const u8 = await maybeDecompress(pt, meta.compressed ?? false);
        report(total || u8.length);
        const part = u8 as unknown as BlobPart;
        return new Blob([part], { type: mime });
    }

    let offset = 0;
    let processed = 0;
    report(0);

    const outParts: Uint8Array[] = [];
    while (offset < payloadU8.length) {
        ensureNotAborted(signal);

        if (offset + 4 > payloadU8.length) {
            throw new Error("Corrupted chunk container (len).");
        }
        const clen = readU32be(payloadU8, offset);
        offset += 4;
        if (offset + IV_BYTES + clen > payloadU8.length) {
            throw new Error("Corrupted chunk container (data).");
        }

        const iv = payloadU8.subarray(offset, offset + IV_BYTES);
        offset += IV_BYTES;
        const ct = payloadU8.subarray(offset, offset + clen);
        offset += clen;

        const pt = await aesGcmDecrypt(key, iv, ct, aad);
        const u8 = await maybeDecompress(pt, compressed);

        outParts.push(u8);
        processed += u8.length;
        report(Math.min(processed, total || processed));
    }

    const merged = concatU8(...outParts);
    report(total || merged.length);
    const part = merged as unknown as BlobPart;
    return new Blob([part], { type: mime });
}
