import type { webcrypto } from "node:crypto";
import { isNodeEnvironment } from "./runtime.js";

let cryptoProvider: Crypto | undefined =
    typeof globalThis.crypto !== "undefined" ? (globalThis.crypto as Crypto) : undefined;

if (!cryptoProvider && isNodeEnvironment()) {
    try {
        const nodeCrypto = (await import("node:crypto")) as unknown as { webcrypto: webcrypto };
        cryptoProvider = nodeCrypto.webcrypto as Crypto;
    } catch {
        cryptoProvider = undefined;
    }
}

export function getCrypto(): Crypto {
    if (!cryptoProvider) {
        throw new Error("WebCrypto API not available in this environment.");
    }
    return cryptoProvider;
}

export function getSubtleCrypto(): SubtleCrypto {
    return getCrypto().subtle;
}

export function getRandomValues<T extends ArrayBufferView>(array: T): T {
    return getCrypto().getRandomValues(array);
}
