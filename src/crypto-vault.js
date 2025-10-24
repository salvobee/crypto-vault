// web-crypto-vault.js
// ESM - Browser only. No deps.
// Public API (named exports) at the bottom of the file.

const MAGIC = "WCV1"; // Web Crypto Vault v1 (magic header for future format upgrades)
const VERSION = 1;
const ALG = "AES-GCM";
const KEY_LENGTH = 256; // bits
const IV_BYTES = 12;    // 96-bit IV for GCM
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MiB for large files
const PBKDF2_ITERATIONS = 250_000; // passphrase-derived key (strong yet still OK in browsers)
const SALT_BYTES = 16;

// ---------- Utils: Base64URL <-> Uint8Array ----------
function toBase64Url(u8) {
    // Avoid spread: encode in chunks to not overflow fromCharCode arg list.
    const CHUNK = 0x8000; // 32 KB
    let binary = "";
    for (let i = 0; i < u8.length; i += CHUNK) {
        const sub = u8.subarray(i, i + CHUNK);
        binary += String.fromCharCode.apply(null, sub);
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
}
async function sha256(u8) {
    const buf = await crypto.subtle.digest("SHA-256", u8);
    return new Uint8Array(buf);
}
function concatU8(...parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return out;
}
function textEncode(str) { return new TextEncoder().encode(str); }
function textDecode(u8) { return new TextDecoder().decode(u8); }

// ---------- Utils: Compression (Gzip) ----------
async function maybeCompress(u8, enabled = true) {
    if (!enabled) return { compressed: false, data: u8 };
    if (typeof CompressionStream === "undefined") return { compressed: false, data: u8 };
    const cs = new CompressionStream("gzip");
    const compressed = await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
    return { compressed: true, data: new Uint8Array(compressed) };
}
async function maybeDecompress(u8, compressed) {
    if (!compressed) return u8;
    if (typeof DecompressionStream === "undefined") {
        throw new Error("DecompressionStream not available in this browser.");
    }
    const ds = new DecompressionStream("gzip");
    const decompressed = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(decompressed);
}

// ---------- Key Management ----------
async function generateAesKey() {
    const key = await crypto.subtle.generateKey(
        { name: ALG, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
    );
    return key;
}
async function exportKeyToBase64(key) {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    const json = JSON.stringify(jwk);
    return toBase64Url(textEncode(json));
}
async function importKeyFromBase64(b64) {
    const json = textDecode(fromBase64Url(b64));
    const jwk = JSON.parse(json);
    return crypto.subtle.importKey("jwk", jwk, { name: ALG }, true, ["encrypt", "decrypt"]);
}

// Optional: derive key from passphrase using PBKDF2 (portable)
async function deriveKeyFromPassphrase(passphrase, saltU8, iterations = PBKDF2_ITERATIONS) {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        textEncode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: saltU8, iterations, hash: "SHA-256" },
        baseKey,
        { name: ALG, length: KEY_LENGTH },
        true,
        ["encrypt", "decrypt"]
    );
}
function randomBytes(n) {
    const u = new Uint8Array(n);
    crypto.getRandomValues(u);
    return u;
}

// ---------- AES-GCM helpers ----------
function randomIv() { return randomBytes(IV_BYTES); }
async function aesGcmEncrypt(key, ivU8, dataU8, additionalDataU8) {
    const ct = await crypto.subtle.encrypt(
        { name: ALG, iv: ivU8, additionalData: additionalDataU8 || undefined },
        key,
        dataU8
    );
    return new Uint8Array(ct); // includes tag
}
async function aesGcmDecrypt(key, ivU8, cipherU8, additionalDataU8) {
    const pt = await crypto.subtle.decrypt(
        { name: ALG, iv: ivU8, additionalData: additionalDataU8 || undefined },
        key,
        cipherU8
    );
    return new Uint8Array(pt);
}

// ---------- Packaging ----------
// Textual (Base64URL) wrapper of a binary container:
// [MAGIC(4 ASCII bytes)][VERSION(1 byte)][flags(1 byte)][algId(1 byte)][metaLen(4 bytes BE)][metaJSON(u8)][payload(u8)]
// flags bit0 = compressed, bit1 = isChunked
// algId: 0x01 = AES-GCM-256
// metaJSON includes: { mime?:string, iv?:b64u, salt?:b64u, chunkSize?:number, chunkCount?:number, ivs?:string[], sha256?:b64u }
// payload:
//  - non-chunked: ciphertext (ct+tag) binary
//  - chunked: concatenation of chunks: [len(4 bytes BE)][iv(12)][ct+tag] * N
function u32be(n) {
    const b = new Uint8Array(4);
    b[0] = (n >>> 24) & 0xff;
    b[1] = (n >>> 16) & 0xff;
    b[2] = (n >>> 8) & 0xff;
    b[3] = n & 0xff;
    return b;
}
function readU32be(u8, off) {
    return ((u8[off] << 24) | (u8[off+1] << 16) | (u8[off+2] << 8) | u8[off+3]) >>> 0;
}
function packContainer({ compressed, isChunked, meta, payloadU8 }) {
    const magic = textEncode(MAGIC);
    const version = new Uint8Array([VERSION]);
    const flags =
        (compressed ? 1 : 0) |
        (isChunked ? 2 : 0);
    const flagsU8 = new Uint8Array([flags]);
    const algId = new Uint8Array([0x01]); // AES-GCM-256
    const metaU8 = textEncode(JSON.stringify(meta));
    const metaLen = u32be(metaU8.length);
    const bin = concatU8(magic, version, flagsU8, algId, metaLen, metaU8, payloadU8);
    return toBase64Url(bin);
}
function unpackContainer(b64u) {
    const bin = fromBase64Url(b64u);
    let off = 0;
    const magic = textDecode(bin.subarray(off, off+4)); off += 4;
    if (magic !== MAGIC) throw new Error("Unrecognized container format (magic).");
    const version = bin[off++]; if (version !== VERSION) throw new Error("Container version not supported.");
    const flags = bin[off++];
    const compressed = !!(flags & 1);
    const isChunked = !!(flags & 2);
    const algId = bin[off++]; if (algId !== 0x01) throw new Error("Algorithm not supported.");
    const metaLen = readU32be(bin, off); off += 4;
    const meta = JSON.parse(textDecode(bin.subarray(off, off+metaLen))); off += metaLen;
    const payloadU8 = bin.subarray(off);
    return { compressed, isChunked, meta, payloadU8 };
}

// ---------- API: String encryption/decryption ----------
async function encryptString(plainText, key, { compress = true } = {}) {
    const preU8 = textEncode(plainText);
    const { compressed, data } = await maybeCompress(preU8, compress);
    const iv = randomIv();
    // AAD: logical header to bind metadata into authentication
    const aad = textEncode(`${ALG}|text|v${VERSION}`);
    const ct = await aesGcmEncrypt(key, iv, data, aad);
    const meta = {
        type: "text",
        alg: ALG,
        iv: toBase64Url(iv),
        compressed
    };
    return packContainer({ compressed, isChunked: false, meta, payloadU8: ct });
}

async function decryptToString(packedB64u, key) {
    const { compressed, isChunked, meta, payloadU8 } = unpackContainer(packedB64u);
    if (isChunked) throw new Error("Content is chunked (file). Use decryptToBlob().");
    if (meta.type !== "text") throw new Error("Content type is not text.");
    const iv = fromBase64Url(meta.iv);
    const aad = textEncode(`${ALG}|text|v${VERSION}`);
    const pt = await aesGcmDecrypt(key, iv, payloadU8, aad);
    const u8 = await maybeDecompress(pt, compressed);
    return textDecode(u8);
}

// ---------- API: File/blob encryption/decryption (chunked) ----------
async function encryptBlob(blob, key, {
    compress = true,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,         // (info) => void
    signal              // AbortSignal
} = {}) {
    const mime = blob.type || "application/octet-stream";
    const size = blob.size;
    const CHUNK_COMPRESS_THRESHOLD = 64 * 1024 * 1024;
    const isLarge = size > CHUNK_COMPRESS_THRESHOLD;
    const aad = textEncode(`${ALG}|blob|v${VERSION}|${mime}`);

    const report = (processed) => {
        if (typeof onProgress === "function") {
            const percent = size ? Math.min(100, Math.round((processed / size) * 100)) : 100;
            onProgress({ processed, total: size, percent });
        }
    };
    const checkAbort = () => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    };

    // Strategy:
    // - If large: stream in chunks, optionally compress per chunk, encrypt each chunk with a fresh random IV.
    // - If small: read into memory, optionally compress whole buffer, encrypt once.
    if (!isLarge) {
        checkAbort();
        report(0);
        const buf = new Uint8Array(await blob.arrayBuffer());
        const { compressed, data } = await maybeCompress(buf, compress);
        const iv = randomIv();
        const ct = await aesGcmEncrypt(key, iv, data, aad);
        const meta = { type: "blob", alg: ALG, mime, compressed, single: true, iv: toBase64Url(iv), size };
        report(size);
        return packContainer({ compressed, isChunked: false, meta, payloadU8: ct });
    }

    // Large: chunked
    const supportsCompression = typeof CompressionStream !== "undefined";
    const useCompression = compress && supportsCompression;
    const chunkCount = Math.ceil(size / chunkSize);
    const payloadParts = [];

    let processed = 0;
    report(0);

    for (let i = 0; i < chunkCount; i++) {
        checkAbort();
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, size);
        const u8 = new Uint8Array(await blob.slice(start, end).arrayBuffer());
        const { data } = useCompression ? await maybeCompress(u8, true) : { data: u8 };
        const iv = randomIv();
        const ct = await aesGcmEncrypt(key, iv, data, aad);
        const lenU8 = u32be(ct.length);
        payloadParts.push(lenU8, iv, ct);

        processed = end;
        report(processed);
    }

    const meta = {
        type: "blob",
        alg: ALG,
        mime,
        compressed: useCompression,
        chunked: true,
        chunkSize,
        size
    };
    const payloadU8 = concatU8(...payloadParts);
    report(size);
    return packContainer({ compressed: useCompression, isChunked: true, meta, payloadU8 });
}

async function decryptToBlob(packedB64u, key, {
    onProgress,        // (info) => void
    signal             // AbortSignal
} = {}) {
    const { compressed, isChunked, meta, payloadU8 } = unpackContainer(packedB64u);
    if (meta.type !== "blob") throw new Error("Content type is not blob.");
    const mime = meta.mime || "application/octet-stream";
    const aad = textEncode(`${ALG}|blob|v${VERSION}|${mime}`);

    const total = typeof meta.size === "number" ? meta.size : 0;
    const report = (processed) => {
        if (typeof onProgress === "function") {
            const percent = total ? Math.min(100, Math.round((processed / total) * 100)) : (processed ? 100 : 0);
            onProgress({ processed, total, percent });
        }
    };
    const checkAbort = () => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    };

    // Single-chunk (small)
    if (!isChunked && meta.single) {
        checkAbort();
        report(0);
        const iv = fromBase64Url(meta.iv);
        const pt = await aesGcmDecrypt(key, iv, payloadU8, aad);
        const u8 = await maybeDecompress(pt, meta.compressed);
        // processed ~ meta.size (se presente), altrimenti usiamo byte decompattati
        report(total || u8.length);
        return new Blob([u8], { type: mime });
    }

    // Chunked (large)
    let off = 0;
    let processed = 0;
    report(0);

    const outParts = [];
    while (off < payloadU8.length) {
        checkAbort();

        if (off + 4 > payloadU8.length) throw new Error("Corrupted chunk container (len).");
        const clen = readU32be(payloadU8, off); off += 4;
        if (off + IV_BYTES + clen > payloadU8.length) throw new Error("Corrupted chunk container (data).");

        const iv = payloadU8.subarray(off, off + IV_BYTES); off += IV_BYTES;
        const ct = payloadU8.subarray(off, off + clen); off += clen;

        const pt = await aesGcmDecrypt(key, iv, ct, aad);
        const u8 = await maybeDecompress(pt, compressed);

        outParts.push(u8);
        processed += u8.length;
        report(Math.min(processed, total || processed)); // clamp se total=0
    }

    const merged = concatU8(...outParts);
    report(total || merged.length);
    return new Blob([merged], { type: mime });
}

// ---------- Optional UX helpers ----------
function downloadText(filename, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// ---------- Public API ----------
export {
    // key management
    generateAesKey,
    exportKeyToBase64,
    importKeyFromBase64,
    deriveKeyFromPassphrase,

    // high-level primitives
    encryptString,
    decryptToString,
    encryptBlob,
    decryptToBlob,

    // utils
    downloadText,
    toBase64Url,
    fromBase64Url,
};
