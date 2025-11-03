import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { maybeCompress, maybeDecompress, __resetCompressionOverridesForTests } from '../dist/compression.js';
import { setCompressionBindingOverride } from '../dist/env/compression.js';

const sampleData = new Uint8Array([1, 2, 3, 4, 5]);

afterEach(() => {
    setCompressionBindingOverride(undefined);
    __resetCompressionOverridesForTests();
});

describe('compression toggles', () => {
    it('returns original data when compression disabled', async () => {
        const result = await maybeCompress(sampleData, false);
        assert.equal(result.compressed, false);
        assert.strictEqual(result.data, sampleData);
    });

    it('uses override binding when provided', async () => {
        setCompressionBindingOverride({
            type: 'browser',
            compress: async (data) => {
                const out = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i += 1) {
                    out[i] = (data[i] + 1) & 0xff;
                }
                return out;
            },
            decompress: async (data) => {
                const out = new Uint8Array(data.length);
                for (let i = 0; i < data.length; i += 1) {
                    out[i] = (data[i] + 0xff) & 0xff;
                }
                return out;
            },
        });

        const compressed = await maybeCompress(sampleData, true);
        assert.equal(compressed.compressed, true);
        assert.notStrictEqual(compressed.data, sampleData);

        const restored = await maybeDecompress(compressed.data, true);
        assert.deepEqual(restored, sampleData);
    });

    it('throws when decompression requested without binding', async () => {
        setCompressionBindingOverride(undefined);
        const compressed = new Uint8Array([9, 9, 9]);
        await assert.rejects(() => maybeDecompress(compressed, true), /Compression bindings not available/);
    });
});
