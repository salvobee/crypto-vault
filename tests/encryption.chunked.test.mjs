import test from 'node:test';
import assert from 'node:assert/strict';

import { encryptBlob, decryptToBlob } from '../dist/encryption.js';
import { generateAesKey } from '../dist/keys.js';
import { packContainer } from '../dist/container.js';
import { ALG } from '../dist/constants.js';

const CHUNK_TEST_TIMEOUT = 120_000;
const RANDOM_SLICE = 65_536;

function fillRandom(target) {
    for (let offset = 0; offset < target.length; offset += RANDOM_SLICE) {
        const slice = target.subarray(offset, Math.min(offset + RANDOM_SLICE, target.length));
        globalThis.crypto.getRandomValues(slice);
    }
}

test('encrypts and decrypts large chunked payloads', { timeout: CHUNK_TEST_TIMEOUT }, async () => {
    try {
        const key = await generateAesKey();
        const size = 64 * 1024 * 1024 + 2048;
        const payload = new Uint8Array(size);
        fillRandom(payload);

        const packed = await encryptBlob(payload, key, { compress: false, chunkSize: 16 * 1024 * 1024 });
        const decrypted = await decryptToBlob(packed, key, { output: 'uint8array' });

        assert.equal(decrypted.byteLength, payload.length);
        assert.deepEqual(decrypted, payload);
    } catch (error) {
        console.error('chunked encryption error', error);
        throw error;
    }
});

test('detects corrupted chunk metadata', async () => {
    const key = await generateAesKey();
    const brokenPayload = new Uint8Array(4);
    const corrupted = packContainer({
        compressed: false,
        isChunked: true,
        meta: { type: 'blob', alg: ALG, mime: 'application/octet-stream', chunked: true, chunkSize: 1024, size: 4096 },
        payloadU8: brokenPayload,
    });

    await assert.rejects(() => decryptToBlob(corrupted, key, { output: 'uint8array' }), /Corrupted chunk container/);
});
