export const MAGIC = "WCV1"; // Web Crypto Vault v1 (magic header for future format upgrades)
export const VERSION = 1;
export const ALG = "AES-GCM";
export const KEY_LENGTH = 256; // bits
export const IV_BYTES = 12; // 96-bit IV for GCM
export const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MiB for large files
export const PBKDF2_ITERATIONS = 250_000; // passphrase-derived key (strong yet still OK in browsers)
export const SALT_BYTES = 16;
