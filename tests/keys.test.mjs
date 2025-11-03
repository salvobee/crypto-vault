import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    deriveKeyFromPassphrase,
    exportKeyToBase64,
    exportPrivateKeyToBase64,
    exportPublicKeyToBase64,
    generateAesKey,
    generateRsaKeyPair,
    importKeyFromBase64,
    importPrivateKeyFromBase64,
    importPublicKeyFromBase64,
    randomBytes,
    unwrapKeyForRecipient,
    wrapKeyForRecipient,
} from '../dist/keys.js';

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

    it('wraps and unwraps AES keys with RSA-OAEP between two parties', async () => {
        const dataKey = await generateAesKey();
        const alicePair = await generateRsaKeyPair();

        const alicePublicB64 = await exportPublicKeyToBase64(alicePair.publicKey);
        const alicePrivateB64 = await exportPrivateKeyToBase64(alicePair.privateKey);

        // Simulate Bob importing Alice's public key from the wire
        const importedPublic = await importPublicKeyFromBase64(alicePublicB64);
        const wrappedForAlice = await wrapKeyForRecipient(importedPublic, dataKey);

        // Alice restores her private key locally and unwraps the shared AES key
        const importedPrivate = await importPrivateKeyFromBase64(alicePrivateB64);
        const unwrapped = await unwrapKeyForRecipient(wrappedForAlice, importedPrivate);

        const originalSerialized = await exportKeyToBase64(dataKey);
        const unwrappedSerialized = await exportKeyToBase64(unwrapped);

        assert.equal(unwrappedSerialized, originalSerialized);
    });
});
