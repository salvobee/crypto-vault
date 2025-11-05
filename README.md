# Crypto Vault

**Universal, zero-deps encryption for Browser + Node.js.**
Encrypt **strings** and **files** (small or huge) with **AES-GCM-256**, optional **gzip**, and ship the result as a single **Base64URL** string—perfect for APIs, DBs, and copy-paste sharing.

📚 **API docs:** [https://salvobee.github.io/crypto-vault/](https://salvobee.github.io/crypto-vault/)

---

## Why Crypto Vault?

Most apps don’t need a heavyweight crypto stack—they need something **portable**, **boring-reliable**, and **easy to ship**:

* 🔐 **Strong, authenticated encryption** (AES-GCM-256 via Web Crypto / Node WebCrypto)
* 🧩 **Large file support** with automatic chunking (images, videos, PDFs…)
* 🗜️ **Optional compression** (gzip) when it helps; silently skipped if not supported
* 🔤 **Base64URL packaging** so ciphertext travels as plain text anywhere
* 🌐 **One library** for modern browsers **and** Node 18+

**Concept:**
*Crypto Vault turns any input into an opaque, versioned, self-described blob you can store as text and decrypt only with the right key—on any modern runtime.*

---

## Common use cases

* **End-to-end encrypted notes & messages** (store as text in your DB)
* **Secure media vaults** (photos, videos, PDFs) with streaming-friendly chunks
* **Client-side encryption before upload** (privacy by default)
* **Sharing secrets across devices/teammates** (wrap keys or use passphrase+salt)
* **Portable encrypted backups** (download a key, keep data anywhere)

---

## At a glance (benefits)

* **Zero deps** (lean, audit-friendly)
* **Stable format** with magic header + version (future-proof)
* **Simple APIs** for strings & blobs
* **TypeScript** typings + TSDoc
* **Works offline**—no external services needed

---

## Table of contents

* [Install](#install)
* [Quickstart (30 seconds)](#quickstart-30-seconds)
* [How it works (high level)](#how-it-works-high-level)
* [API overview](#api-overview)
* [Guides & recipes](#guides--recipes)

  * [Passphrase-derived keys](#passphrase-derived-keys)
  * [Show decrypted image/video in a page](#show-decrypted-imagevideo-in-a-page)
  * [Persist & reload keys](#persist--reload-keys)
  * [Encrypt/Decrypt buffers in Node](#encryptdecrypt-buffers-in-node)
  * [Share AES keys (RSA-OAEP wrap/unwrap)](#share-aes-keys-rsa-oaep-wrapunwrap)
* [Performance tips](#performance-tips)
* [Security notes](#security-notes)
* [Container format](#container-format)
* [Troubleshooting](#troubleshooting)
* [License & Acknowledgements](#license--acknowledgements)

---

## Install

```bash
npm i @salvobee/crypto-vault
# or
pnpm add @salvobee/crypto-vault
# or
yarn add @salvobee/crypto-vault
```

> **ESM only.** Works in modern browsers (HTTPS/localhost) and Node.js ≥ 18.

---

## Quickstart (30 seconds)

```html
<script type="module">
  import {
    generateAesKey,
    encryptString, decryptToString,
    encryptBlob,  decryptToBlob,
  } from "@salvobee/crypto-vault";

  // 1) Generate a key (do this once, store it safely)
  const key = await generateAesKey();

  // 2) Encrypt / decrypt a string
  const packed = await encryptString("Hello vault!", key, { compress: true });
  const text   = await decryptToString(packed, key);

  // 3) Encrypt / decrypt a file/blob
  const file = new File(["hello"], "hello.txt", { type: "text/plain" });
  const packedBlob = await encryptBlob(file, key);             // Base64URL
  const blob       = await decryptToBlob(packedBlob, key);     // Blob
</script>
```

That’s it. You now have ciphertext you can safely store/send as **plain text**.

---

## How it works (high level)

* **AES-GCM-256** for confidentiality + integrity.
* Fresh **random IV per message/chunk** (GCM best practice).
* Optional **gzip** (Compression Streams in browsers, `zlib` in Node).
* A compact **binary container** (with magic bytes, version, flags, JSON meta, payload) is **Base64URL-encoded** so you can store it anywhere as text.

---

## API overview

> Full signatures & details: **API docs** → [https://salvobee.github.io/crypto-vault/](https://salvobee.github.io/crypto-vault/)

* **Key management**

  * `generateAesKey()`
  * `exportKeyToBase64(key) / importKeyFromBase64(b64)`
  * `deriveKeyFromPassphrase(passphrase, saltU8, iterations?)`
  * RSA helpers for sharing: `generateRsaKeyPair()`, `wrapKeyForRecipient()`, `unwrapKeyForRecipient()`, and RSA import/export helpers
* **High-level primitives**

  * `encryptString() / decryptToString()`
  * `encryptBlob() / decryptToBlob()` (Blob | ArrayBuffer | Buffer, auto-chunking)
* **Utilities**

  * `downloadText(filename, text)` (browser download / Node Buffer)
  * `toBase64Url(u8) / fromBase64Url(b64u)`

---

## Guides & recipes

### Passphrase-derived keys

If you can’t persist a random AES key, derive it from a passphrase **+ a stable salt**. Store the salt with the ciphertext as Base64URL.

```js
import {
  SALT_BYTES,
  deriveKeyFromPassphrase,
  encryptString,
  decryptToString,
  toBase64Url,
  fromBase64Url,
} from "@salvobee/crypto-vault";

const passphrase = "correct horse battery staple";

// Generate once, store alongside ciphertext
const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
const saltB64 = toBase64Url(salt);

// Derive & encrypt
const key = await deriveKeyFromPassphrase(passphrase, salt);
const ciphertext = await encryptString("Hello vault!", key);

// Later: restore salt & derive again to decrypt
const keyAgain = await deriveKeyFromPassphrase(passphrase, fromBase64Url(saltB64));
const plain = await decryptToString(ciphertext, keyAgain);
```

> 🔁 Same **passphrase + salt** → same AES key. Keep both to re-derive; share both if collaborators decrypt with a shared passphrase.

---

### Show decrypted image/video in a page

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

  const packed = await encryptBlob(file, key, { compress: true });
  const blob = await decryptToBlob(packed, key);
  const url = URL.createObjectURL(blob);

  const img = document.getElementById("img");
  const vid = document.getElementById("vid");
  img.style.display = vid.style.display = "none";

  if (blob.type.startsWith("image/")) { img.src = url; img.style.display = "block"; }
  else if (blob.type.startsWith("video/")) { vid.src = url; vid.style.display = "block"; }
});
</script>
```

---

### Persist & reload keys

```js
import { generateAesKey, exportKeyToBase64, importKeyFromBase64 } from "@salvobee/crypto-vault";

const key  = await generateAesKey();
const b64  = await exportKeyToBase64(key);   // save (IndexedDB, download, server…)
const key2 = await importKeyFromBase64(b64); // restore later
```

---

### Encrypt/Decrypt buffers in Node

```js
import { generateAesKey, encryptBlob, decryptToBlob } from "@salvobee/crypto-vault";
import { readFileSync, writeFileSync } from "node:fs";

const key = await generateAesKey();

const input = readFileSync("input.pdf");
const packed = await encryptBlob(input, key, { compress: true });
const outBuf = await decryptToBlob(packed, key, { output: "buffer" });

writeFileSync("output.pdf", outBuf);
```

---

### Share AES keys (RSA-OAEP wrap/unwrap)

Use RSA only to **wrap the AES key**—not for bulk data.

```js
import {
  generateAesKey,
  generateRsaKeyPair,
  wrapKeyForRecipient,
  unwrapKeyForRecipient,
  exportPublicKeyToBase64, importPublicKeyFromBase64,
  exportPrivateKeyToBase64, importPrivateKeyFromBase64,
  exportKeyToBase64,
} from "@salvobee/crypto-vault";

// Alice
const alicePair = await generateRsaKeyPair();
const alicePubB64 = await exportPublicKeyToBase64(alicePair.publicKey);
const alicePrivB64 = await exportPrivateKeyToBase64(alicePair.privateKey);

// Bob wraps an AES key for Alice
const dataKey = await generateAesKey();
const alicePub = await importPublicKeyFromBase64(alicePubB64);
const wrappedForAlice = await wrapKeyForRecipient(alicePub, dataKey);

// Alice unwraps
const alicePriv = await importPrivateKeyFromBase64(alicePrivB64);
const aliceDataKey = await unwrapKeyForRecipient(wrappedForAlice, alicePriv);

// Sanity check
console.assert(
  (await exportKeyToBase64(dataKey)) === (await exportKeyToBase64(aliceDataKey))
);
```

**Trade-offs:** extractable RSA private keys make backups easy; RSA-OAEP-4096 is heavy → use it only for key exchange; rotate keys for better forward secrecy.

---

## Performance tips

* **Base64URL overhead** ≈ 33%. For very large media, consider splitting at the **application level** (e.g., 1–5 MB slices).
* **Compression** mainly helps text and some binaries; most images/videos are already compressed. It’s skipped automatically if the runtime lacks support.

---

## Security notes

* **AES-GCM** = confidentiality **+** integrity.
* **Never reuse IVs** with the same key (the library generates fresh 96-bit IVs per message/chunk).
* Prefer **random keys** (`generateAesKey`) for maximum entropy; use **passphrase-derived keys** only when necessary.
* Keep keys out of logs/analytics; never hard-code secrets.
* For multi-user sharing, **wrap the AES key** with public-key crypto rather than sharing the AES key in the clear.

---

## Container format

Every ciphertext is a **Base64URL** string wrapping a compact binary container:

```
[MAGIC "WCV1"][VERSION 1B][FLAGS 1B][ALG_ID 1B][META_LEN 4B BE][META JSON][PAYLOAD]
```

* **FLAGS**: bit0=compressed, bit1=chunked
* **ALG_ID**: `0x01` = AES-GCM-256
* **META JSON** (examples):

  * text: `{ type:"text", alg:"AES-GCM", iv, compressed }`
  * blob (single): `{ type:"blob", alg:"AES-GCM", mime, size, single:true, iv, compressed }`
  * blob (chunked): `{ type:"blob", alg:"AES-GCM", mime, size, chunked:true, chunkSize, compressed }`
* **PAYLOAD**:

  * non-chunked: raw `ct+tag`
  * chunked: repeated `[len 4B BE][iv 12B][ct+tag]` per chunk

This keeps ciphertext **versioned, portable, and self-describing**.

---

## Troubleshooting

* **`RangeError: too many function arguments`**
  Likely attempted to Base64-encode a massive buffer using spread. Use the built-in `toBase64Url` which is chunk-safe.

* **`DecompressionStream not available`**
  Your browser doesn’t support Compression Streams; encryption still works (without gzip).

* **`Operation is not supported`**
  Web Crypto often requires **HTTPS** or **localhost**.

---

## License & Acknowledgements

**MIT** — see [LICENSE](./LICENSE).

Built with ❤️ on standard **Web Crypto API** and **Compression Streams API** so your encrypted content stays portable—and easy to store as text.
