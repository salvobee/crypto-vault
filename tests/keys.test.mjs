import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { deriveKeyFromPassphrase, exportKeyToBase64, generateAesKey, importKeyFromBase64, randomBytes } from '../dist/keys.js';

const SAMPLE_SALT = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

describe('key management', () => {
    it('generates exportable AES keys', async () => {
        const key = await generateAesKey();
        assert.equal(key.algorithm.name, 'AES-GCM');
        const exported = await exportKeyToBase64(key);
        assert.match(exported, /^[A-Za-z0-9_-]+$/);
    });

    it('round-trips key export and import', async () => {
        const key = await generateAesKey();
        const serialized = await exportKeyToBase64(key);
        const restored = await importKeyFromBase64(serialized);
        const reserialized = await exportKeyToBase64(restored);
        assert.equal(reserialized, serialized);
    });

    it('derives deterministic keys from passphrases', async () => {
        const keyA = await deriveKeyFromPassphrase('passphrase', SAMPLE_SALT, 1000);
        const keyB = await deriveKeyFromPassphrase('passphrase', SAMPLE_SALT, 1000);
        const keyC = await deriveKeyFromPassphrase('different', SAMPLE_SALT, 1000);

        const serializedA = await exportKeyToBase64(keyA);
        const serializedB = await exportKeyToBase64(keyB);
        const serializedC = await exportKeyToBase64(keyC);

        assert.equal(serializedA, serializedB);
        assert.notEqual(serializedA, serializedC);
    });

    it('produces random bytes of requested length', () => {
        const bytes = randomBytes(32);
        assert.equal(bytes.length, 32);
        const second = randomBytes(32);
        assert.notDeepEqual(bytes, second);
    });
});
