# Crypto Vault

Universal (browser + Node.js) crypto vault — zero deps, ESM.
Uses **AES-GCM-256** (Web Crypto API / Node WebCrypto), supports **strings** and **files/binary buffers** (small or large) with **chunked encryption**, optional **gzip** compression, and always serializes to **Base64URL** so you can store/send ciphertext as plain text (e.g. via APIs or DB).

* 🔐 AES-GCM 256 (authenticated encryption)
* 🧩 Chunked blobs for large files (images, videos, PDFs…)
* 🗜️ Optional gzip compression
* 🔤 Base64URL packaging (portable, DB/API-friendly)
* 🌐 Works in modern browsers *and* Node 18+ (uses Web Crypto & gzip in each environment)

---

## Install

```bash
npm i @salvobee/crypto-vault
# or
pnpm add @salvobee/crypto-vault
# or
yarn add @salvobee/crypto-vault
```

> This package is **ESM** and works in modern browsers (served over HTTPS / localhost) **and** Node.js ≥ 18.

---

## Quickstart

```html
<script type="module">
  import {
    generateAesKey,
    encryptString, decryptToString,
    encryptBlob,  decryptToBlob,
    exportKeyToBase64, importKeyFromBase64,
  } from "@salvobee/crypto-vault";

  // 1) Key (recommended: generate once, then export & store safely)
  const key = await generateAesKey();

  // 2) Encrypt / decrypt a string
  const packedText = await encryptString("Hello vault!", key, { compress: true });
  const plainText  = await decryptToString(packedText, key);

  // 3) Encrypt / decrypt a file/blob (e.g. from <input type="file">)
  const file = new File(["hello"], "hello.txt", { type: "text/plain" });
  const packedBlob = await encryptBlob(file, key, { compress: true, chunkSize: 1024 * 1024 });
  const decryptedBlob = await decryptToBlob(packedBlob, key);

  // 4) Export/import key as Base64URL JWK string (for download/backup)
  const keyB64 = await exportKeyToBase64(key);
  const key2   = await importKeyFromBase64(keyB64);
</script>
```

---

## TypeScript support & API docs

The published package includes full TypeScript declarations and rich TSDoc
comments for every exported function. Run `npm run build` to emit `dist/index.js`
alongside `dist/index.d.ts` locally, or install the package in a TypeScript
project to get inline documentation via your editor's hover tooltips.

If you need static API pages, you can generate them from the emitted
declarations (for example with [TypeDoc](https://typedoc.org/)):

```bash
npm run build
npx typedoc --tsconfig tsconfig.docs.json --out docs/api dist/index.d.ts
```

---

## Runtime requirements

### Browsers

* **Web Crypto API** (`crypto.subtle`) — widely supported on modern browsers when served over **HTTPS** or **localhost**.
* **Compression Streams API** (`CompressionStream`/`DecompressionStream`) — optional; if unavailable, compression is silently skipped during encryption and decryption.

### Node.js

* Node **18+** (ships with `globalThis.crypto`, WHATWG streams, and `Blob`).
* Gzip compression uses `node:zlib` when browser streams are not available.

For **very large outputs**, Base64URL strings can be huge; consider chunking at the application level if you need to stream/store in slices.

---

## API Reference

All functions are **async** unless noted.

### Key management

#### `generateAesKey(): Promise<CryptoKey>`

Generates a new **AES-GCM-256** symmetric key (`["encrypt","decrypt"]`, extractable).

```js
const key = await generateAesKey();
```

#### `exportKeyToBase64(key: CryptoKey): Promise<string>`

Exports a `CryptoKey` to a **Base64URL** string containing a JWK JSON.
Use this to **download/backup** the key or move it between devices.

```js
const b64 = await exportKeyToBase64(key); // e.g. store it or let user download it
```

#### `importKeyFromBase64(b64: string): Promise<CryptoKey>`

Imports a `CryptoKey` previously exported with `exportKeyToBase64`.

```js
const key = await importKeyFromBase64(b64);
```

#### `deriveKeyFromPassphrase(passphrase: string, saltU8: Uint8Array, iterations?: number): Promise<CryptoKey>`

Derives an AES-GCM key from a **passphrase** via **PBKDF2-SHA256** (default 250k iterations).

* You must provide a **random salt** (`Uint8Array`, recommended 16 bytes).
* Store the salt alongside the ciphertext if you plan to reproduce the key later.

```js
// one-time setup
const salt = crypto.getRandomValues(new Uint8Array(16));
// later you can re-derive the same key with the same passphrase+salt
const key = await deriveKeyFromPassphrase("correct horse battery staple", salt);
```

> Passphrase-derived keys are convenient but generally weaker than random keys; prefer `generateAesKey()` for best security and wrap it with public-key crypto if you need sharing.

---

### High-level primitives

All ciphertexts are returned as **Base64URL** strings that contain a compact binary container (see “Container format”).

#### `encryptString(plainText: string, key: CryptoKey, opts?: { compress?: boolean }): Promise<string>`

Encrypts a UTF-8 string.

* `compress` (default `true`): gzip before encrypting (saves space for text).

```js
const packed = await encryptString("Hello!", key, { compress: true });
// -> "WCV1..." (Base64URL string)
```

#### `decryptToString(packedB64u: string, key: CryptoKey): Promise<string>`

Decrypts a `packed` Base64URL produced by `encryptString`.

```js
const text = await decryptToString(packed, key);
```

#### `encryptBlob(blob: Blob | ArrayBuffer | ArrayBufferView | Buffer, key: CryptoKey, opts?: { compress?: boolean, chunkSize?: number, mimeType?: string }): Promise<string>`

Encrypts binary data from browsers (`Blob`/`File`) or Node (`Buffer`/`Uint8Array`).

* Small files are encrypted as a single chunk.
* Large files (default threshold 64 MiB) are **chunked**; each chunk is encrypted with a fresh IV.
* `compress` (default `true`) uses gzip **if** `CompressionStream` is available:

    * For small files: compress whole buffer.
    * For large files: compress **per chunk**.
* `chunkSize` (default 1 MiB) controls chunk granularity for large files.
* `mimeType` lets you provide a MIME type when the input is not a `Blob` (e.g. Node buffers).

```js
const packed = await encryptBlob(file, key, { compress: true, chunkSize: 2 * 1024 * 1024 });
```

#### `decryptToBlob(packedB64u: string, key: CryptoKey, opts?: { output?: "blob" | "uint8array" | "buffer" }): Promise<Blob | Uint8Array | Buffer>`

Decrypts a `packed` Base64URL produced by `encryptBlob`.

* Default output is a `Blob` (browser-friendly).
* `output: "uint8array"` returns the raw bytes.
* `output: "buffer"` (Node only) returns a `Buffer`.

```js
const blob = await decryptToBlob(packed, key);
const url = URL.createObjectURL(blob);
```

---

### Utilities

#### `downloadText(filename: string, text: string): Blob | Uint8Array | Buffer | void`

Tiny helper to trigger a download of a text string. In browsers it triggers the download and returns the generated `Blob`. In Node it returns a `Buffer` (or `Uint8Array` if `Buffer` is unavailable) so you can persist the data manually.

```js
downloadText("vault-key.jwk.b64u.txt", await exportKeyToBase64(key));
```

#### `toBase64Url(u8: Uint8Array): string` / `fromBase64Url(b64u: string): Uint8Array`

Robust Base64URL encode/decode for binary data (chunk-safe, browser-friendly).
Exposed in case you need consistent Base64URL conversion elsewhere in your app.

---

## Usage examples

### Show decrypted image/video in the page

```html
<input type="file" id="pick" accept="image/*,video/*" />
<img id="img" style="display:none;max-width:100%" />
<video id="vid" controls style="display:none;max-width:100%"></video>

<script type="module">
import { generateAesKey, encryptBlob, decryptToBlob } from "@salvobee/crypto-vault";

const key = await generateAesKey();

document.getElementById("pick").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Encrypt -> store packed string somewhere (DB/API)
  const packed = await encryptBlob(file, key, { compress: true });

  // Later: decrypt to Blob and preview
  const blob = await decryptToBlob(packed, key);
  const url = URL.createObjectURL(blob);

  const img = document.getElementById("img");
  const vid = document.getElementById("vid");
  img.style.display = vid.style.display = "none";

  if (blob.type.startsWith("image/")) {
    img.src = url; img.style.display = "block";
  } else if (blob.type.startsWith("video/")) {
    vid.src = url; vid.style.display = "block";
  }
});
</script>
```

### Persist and reload keys

```js
import { generateAesKey, exportKeyToBase64, importKeyFromBase64 } from "@salvobee/crypto-vault";

const key = await generateAesKey();
const b64 = await exportKeyToBase64(key);
// Save `b64` (e.g., IndexedDB, download, secure server)

const key2 = await importKeyFromBase64(b64); // Restore later
```

### Derive a key from passphrase

```js
import { deriveKeyFromPassphrase } from "@salvobee/crypto-vault";

const salt = crypto.getRandomValues(new Uint8Array(16));
// store salt somewhere safe with the ciphertext
const key = await deriveKeyFromPassphrase(prompt("passphrase"), salt);
```

---

## Container format (high level)

Every ciphertext is a **Base64URL string** wrapping a compact binary container:

```
[MAGIC "WCV1"][VERSION 1B][FLAGS 1B][ALG_ID 1B][META_LEN 4B BE][META JSON][PAYLOAD]
```

* **FLAGS**: bit0=compressed, bit1=chunked
* **ALG_ID**: `0x01` = AES-GCM-256
* **META JSON** (examples):

    * text: `{ type: "text", alg: "AES-GCM", iv, compressed }`
    * blob (single): `{ type:"blob", alg:"AES-GCM", mime, size, single:true, iv, compressed }`
    * blob (chunked): `{ type:"blob", alg:"AES-GCM", mime, size, chunked:true, chunkSize, compressed }`
* **PAYLOAD**:

    * non-chunked: raw `ct+tag`
    * chunked: repeated `[len 4B BE][iv 12B][ct+tag]` for each chunk

This lets you **store, transport, and version** the ciphertext cleanly across systems.

---

## Security notes

* **AES-GCM** provides confidentiality + integrity. Without the key, decryption is computationally infeasible.
* A fresh **random IV** (96-bit) is used per message/chunk; **do not reuse** IV with the same key.
* Optional **AAD** binds content kind and version to the authentication tag to prevent format confusion.
* For sharing across users/devices, consider wrapping the symmetric key with **public-key** crypto and distributing encrypted key material (not part of this package yet).
* Keep keys out of logs / analytics and **never** hard-code them.

---

## Performance & size tips

* **Base64URL overhead** ≈ 33%. For very large media, the string will be big; if needed, split the string into **application-level segments** (e.g., 1–5 MB) to stream/upload progressively.
* **Compression** helps mostly with text and some binary formats; many images/videos are already compressed — enabling gzip won’t hurt, it’s skipped if the browser lacks support.

---

## Troubleshooting

* `RangeError: too many function arguments` — You likely tried to Base64-encode a massive buffer using spread. The package already uses **chunked encoding**, so if you copied custom code, use `toBase64Url` provided here.
* `DecompressionStream not available` — Your browser doesn’t support Compression Streams; encryption still works, just **without** gzip.
* `Operation is not supported` — Some Web Crypto features require **HTTPS** or **localhost** context.

---

## License

[MIT](./LICENSE)

---

## Acknowledgements

Built with ❤️ on top of standard **Web Crypto API** and **Compression Streams API** to keep your encrypted content portable and easy to store as text.
