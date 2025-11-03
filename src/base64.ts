const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function toBase64Url(u8: Uint8Array): string {
    const CHUNK = 0x8000; // 32 KB
    let binary = "";
    for (let i = 0; i < u8.length; i += CHUNK) {
        const sub = u8.subarray(i, i + CHUNK);
        binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(str: string): Uint8Array {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
        u8[i] = bin.charCodeAt(i);
    }
    return u8;
}

export function textEncode(str: string): Uint8Array {
    return textEncoder.encode(str);
}

export function textDecode(u8: Uint8Array): string {
    return textDecoder.decode(u8);
}
