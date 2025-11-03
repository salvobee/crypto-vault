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

/**
 * Access the active `Crypto` implementation for the current environment.
 *
 * @returns The global `Crypto` instance.
 * @throws If Web Crypto is not available.
 */
export function getCrypto(): Crypto {
    if (!cryptoProvider) {
        throw new Error("WebCrypto API not available in this environment.");
    }
    return cryptoProvider;
}

/**
 * Convenience accessor for the `SubtleCrypto` interface.
 *
 * @returns The `subtle` property of the active {@link getCrypto} instance.
 */
export function getSubtleCrypto(): SubtleCrypto {
    return getCrypto().subtle;
}

/**
 * Fill an `ArrayBufferView` with cryptographically secure random values.
 *
 * @param array - The buffer to populate with random data.
 * @returns The same buffer instance for chaining.
 */
export function getRandomValues<T extends ArrayBufferView>(array: T): T {
    return getCrypto().getRandomValues(array);
}
