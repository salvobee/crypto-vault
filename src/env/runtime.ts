export function isBrowserEnvironment(): boolean {
    return typeof window !== "undefined" && typeof window.document !== "undefined";
}

export function isNodeEnvironment(): boolean {
    const globalProcess = (globalThis as { process?: { versions?: { node?: string } } }).process;
    return typeof globalProcess?.versions?.node === "string";
}
