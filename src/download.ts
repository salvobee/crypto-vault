import { textEncode } from "./base64.js";
import { createBinaryBlob, hasBufferSupport, toBuffer, type NodeBuffer } from "./env/file.js";

export function downloadText(filename: string, text: string): Blob | Uint8Array | NodeBuffer | void {
    const encoded = textEncode(text);

    if (typeof document === "undefined" || typeof URL === "undefined") {
        if (hasBufferSupport()) {
            return toBuffer(encoded);
        }
        return encoded;
    }

    const blob = createBinaryBlob(encoded, { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    return blob;
}
