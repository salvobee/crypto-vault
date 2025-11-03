import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';

import {
    decryptToBlob,
    decryptToString,
    downloadText,
    encryptBlob,
    encryptString,
    generateAesKey,
} from '../dist/index.js';
import { maybeCompress, maybeDecompress, __resetCompressionOverridesForTests } from '../dist/compression.js';
import { setCompressionBindingOverride } from '../dist/env/compression.js';

const TEXT_SAMPLE = 'node parity test';

test('encrypt/decrypt string works in Node', async () => {
    const key = await generateAesKey();
    const packed = await encryptString(TEXT_SAMPLE, key, { compress: true });
    const plain = await decryptToString(packed, key);
    assert.equal(plain, TEXT_SAMPLE);
});

test('encrypt/decrypt buffer payloads', async () => {
    const original = Buffer.from('Buffer payload in Node.js');
    const key = await generateAesKey();
    const packed = await encryptBlob(original, key, { mimeType: 'text/plain' });
    const decrypted = await decryptToBlob(packed, key, { output: 'buffer' });
    assert.equal(Buffer.isBuffer(decrypted), true);
    assert.equal(decrypted.toString('utf8'), original.toString('utf8'));
});

test('chunked encryption for large buffers', async () => {
    const bigSize = 65 * 1024 * 1024 + 1024;
    const original = Buffer.alloc(bigSize, 7);
    const key = await generateAesKey();
    const packed = await encryptBlob(original, key, { compress: false, chunkSize: 2 * 1024 * 1024 });
    const decrypted = await decryptToBlob(packed, key, { output: 'uint8array' });
    assert.equal(decrypted.byteLength, original.length);
    const reconstructed = Buffer.from(decrypted);
    assert.equal(Buffer.compare(reconstructed, original), 0);
});

test('maybeCompress uses Node zlib fallback', async () => {
    const sample = Buffer.from('compress-me');
    const result = await maybeCompress(new Uint8Array(sample), true);
    assert.equal(result.compressed, true);
    const restored = await maybeDecompress(result.data, true);
    assert.deepEqual(restored, new Uint8Array(sample));
});

test('compression override simulates browser stream path', async (t) => {
    t.after(() => {
        setCompressionBindingOverride(undefined);
        __resetCompressionOverridesForTests();
    });

    setCompressionBindingOverride({
        type: 'browser',
        compress: async (data) => new Uint8Array(gzipSync(data)),
        decompress: async (data) => new Uint8Array(gunzipSync(data)),
    });

    const sample = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = await maybeCompress(sample, true);
    assert.equal(compressed.compressed, true);
    const restored = await maybeDecompress(compressed.data, true);
    assert.deepEqual(restored, sample);
});

test('downloadText returns Buffer in Node environments', () => {
    const result = downloadText('test.txt', TEXT_SAMPLE);
    assert.equal(Buffer.isBuffer(result), true);
    assert.equal(result.toString('utf8'), TEXT_SAMPLE);
});
