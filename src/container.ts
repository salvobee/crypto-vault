import { MAGIC, VERSION } from "./constants.js";
import { concatU8, readU32be, u32be } from "./binary.js";
import { fromBase64Url, textDecode, textEncode, toBase64Url } from "./base64.js";

/**
 * Metadata stored alongside encrypted payloads.
 */
export interface BaseMeta {
    type: "text" | "blob";
    alg: string;
    mime?: string;
    compressed?: boolean;
    single?: boolean;
    iv?: string;
    size?: number;
    chunkSize?: number;
    chunked?: boolean;
}

/**
 * Fully parsed representation of a serialized container.
 */
export interface PackedContainer {
    compressed: boolean;
    isChunked: boolean;
    meta: BaseMeta;
    payloadU8: Uint8Array;
}

/**
 * Serialize container metadata and payload into the Base64URL wire format.
 *
 * @param compressed - Whether the payload was compressed prior to encryption.
 * @param isChunked - Whether the payload contains chunked binary data.
 * @param meta - Metadata describing the encrypted content.
 * @param payloadU8 - The encrypted bytes.
 * @returns A Base64URL encoded container string.
 */
export function packContainer({
    compressed,
    isChunked,
    meta,
    payloadU8,
}: {
    compressed: boolean;
    isChunked: boolean;
    meta: BaseMeta;
    payloadU8: Uint8Array;
}): string {
    const magic = textEncode(MAGIC);
    const version = new Uint8Array([VERSION]);
    const flags = (compressed ? 1 : 0) | (isChunked ? 2 : 0);
    const flagsU8 = new Uint8Array([flags]);
    const algId = new Uint8Array([0x01]); // AES-GCM-256
    const metaU8 = textEncode(JSON.stringify(meta));
    const metaLen = u32be(metaU8.length);
    const bin = concatU8(magic, version, flagsU8, algId, metaLen, metaU8, payloadU8);
    return toBase64Url(bin);
}

/**
 * Parse a Base64URL container produced by {@link packContainer}.
 *
 * @param b64u - The serialized container string.
 * @returns The parsed metadata and payload bytes.
 * @throws If the input is not recognized as a compatible container.
 */
export function unpackContainer(b64u: string): PackedContainer {
    const bin = fromBase64Url(b64u);
    let offset = 0;

    const magic = textDecode(bin.subarray(offset, offset + 4));
    offset += 4;
    if (magic !== MAGIC) {
        throw new Error("Unrecognized container format (magic).");
    }

    const version = bin[offset++];
    if (version !== VERSION) {
        throw new Error("Container version not supported.");
    }

    const flags = bin[offset++];
    const compressed = (flags & 1) !== 0;
    const isChunked = (flags & 2) !== 0;

    const algId = bin[offset++];
    if (algId !== 0x01) {
        throw new Error("Algorithm not supported.");
    }

    const metaLen = readU32be(bin, offset);
    offset += 4;
    const meta = JSON.parse(textDecode(bin.subarray(offset, offset + metaLen))) as BaseMeta;
    offset += metaLen;
    const payloadU8 = bin.subarray(offset);

    return { compressed, isChunked, meta, payloadU8 };
}
