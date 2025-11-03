import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { encryptString, decryptToString, encryptBlob, decryptToBlob } from '../dist/encryption.js';
import { generateAesKey } from '../dist/keys.js';
import { packContainer } from '../dist/container.js';
import { ALG } from '../dist/constants.js';
import { __resetCompressionOverridesForTests } from '../dist/compression.js';
import { setCompressionBindingOverride } from '../dist/env/compression.js';

const SAMPLE_TEXT = 'crypto vault string payload';

beforeEach(() => {
    setCompressionBindingOverride(undefined);
    __resetCompressionOverridesForTests();
});

afterEach(() => {
    setCompressionBindingOverride(undefined);
    __resetCompressionOverridesForTests();
});

describe('encryption primitives (string/blob)', () => {
    it('round-trips string payloads with compression override', async () => {
        setCompressionBindingOverride({
            type: 'browser',
            compress: async (data) => {
                const reversed = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i += 1) {
                    reversed[i] = data[data.length - 1 - i];
                }
                return reversed;
            },
            decompress: async (data) => {
                const reversed = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i += 1) {
                    reversed[i] = data[data.length - 1 - i];
                }
                return reversed;
            },
        });

        const key = await generateAesKey();
        const packed = await encryptString(SAMPLE_TEXT, key, { compress: true });
        const plain = await decryptToString(packed, key);
        assert.equal(plain, SAMPLE_TEXT);
    });

    it('rejects blob containers when decrypting to string', async () => {
        const key = await generateAesKey();
        const blobPayload = new Uint8Array([7, 8, 9]);
        const container = await encryptBlob(blobPayload, key, { compress: false });
        await assert.rejects(() => decryptToString(container, key), /Content type is not text/);
    });

    it('encrypts and decrypts small binary payloads without chunking', async () => {
        const key = await generateAesKey();
        const payload = new Uint8Array([1, 2, 3, 4, 5, 6]);
        const packed = await encryptBlob(payload, key, { compress: false, mimeType: 'application/octet-stream' });
        const decrypted = await decryptToBlob(packed, key, { output: 'uint8array' });
        assert.deepEqual(decrypted, payload);
    });

    it('throws when blob metadata is missing IV', async () => {
        const key = await generateAesKey();
        const fakeContainer = packContainer({
            compressed: false,
            isChunked: false,
            meta: { type: 'blob', alg: ALG, single: true, mime: 'application/octet-stream' },
            payloadU8: new Uint8Array([1, 2, 3, 4]),
        });
        await assert.rejects(() => decryptToBlob(fakeContainer, key, { output: 'uint8array' }), /Missing IV/);
    });
});
