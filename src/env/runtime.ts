/**
 * Detect whether the current runtime resembles a browser environment.
 *
 * @returns `true` when `window` and `document` are present.
 */
export function isBrowserEnvironment(): boolean {
    return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/**
 * Detect whether the current runtime is Node.js.
 *
 * @returns `true` when Node.js version metadata is present on `process`.
 */
export function isNodeEnvironment(): boolean {
    const globalProcess = (globalThis as { process?: { versions?: { node?: string } } }).process;
    return typeof globalProcess?.versions?.node === "string";
}
