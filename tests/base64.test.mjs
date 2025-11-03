import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { toBase64Url, fromBase64Url, textEncode, textDecode } from '../dist/base64.js';

const BROWSER_TEXT = 'Browser Path';

describe('base64 helpers', () => {
    it('encodes and decodes using Buffer fallback', () => {
        const input = new Uint8Array([0, 1, 2, 253, 254, 255]);
        const encoded = toBase64Url(input);
        const expected = Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        assert.equal(encoded, expected);
        const decoded = fromBase64Url(encoded);
        assert.deepEqual(decoded, input);
    });

    describe('browser polyfills', () => {
        let originalBuffer;
        let originalBtoa;
        let originalAtob;

        beforeEach(() => {
            originalBuffer = globalThis.Buffer;
            originalBtoa = globalThis.btoa;
            originalAtob = globalThis.atob;
        });

        afterEach(() => {
            globalThis.Buffer = originalBuffer;
            if (originalBtoa === undefined) {
                delete globalThis.btoa;
            } else {
                globalThis.btoa = originalBtoa;
            }
            if (originalAtob === undefined) {
                delete globalThis.atob;
            } else {
                globalThis.atob = originalAtob;
            }
        });

        it('round-trips using mocked browser APIs', () => {
            const bufferCtor = originalBuffer;
            globalThis.Buffer = undefined;
            globalThis.btoa = (input) => bufferCtor.from(input, 'binary').toString('base64');
            globalThis.atob = (input) => bufferCtor.from(input, 'base64').toString('binary');

            const encoded = toBase64Url(textEncode(BROWSER_TEXT));
            const decoded = textDecode(fromBase64Url(encoded));
            assert.equal(decoded, BROWSER_TEXT);
        });

        it('throws when neither Buffer nor browser APIs are available at evaluation time', async () => {
            const moduleUrl = new URL('../dist/base64.js', import.meta.url).href;
            const script = `
                delete globalThis.Buffer;
                delete globalThis.btoa;
                delete globalThis.atob;
                const mod = await import(${JSON.stringify(moduleUrl)});
                try {
                    mod.toBase64Url(new Uint8Array([1, 2, 3]));
                    console.log('encode:ok');
                } catch (error) {
                    console.log('encode:' + error.message);
                }
                try {
                    mod.fromBase64Url('AQID');
                    console.log('decode:ok');
                } catch (error) {
                    console.log('decode:' + error.message);
                }
            `;
            const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
                encoding: 'utf8',
            });
            assert.match(output, /encode:Buffer constructor not available/);
            assert.match(output, /decode:Base64 decoding not supported/);
        });
    });
});
