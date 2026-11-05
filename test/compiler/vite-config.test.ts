// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mergeConfig } from 'vitest/config';
import vite from '../../src/compiler/plugins/vite';


const HMR = '@esportsplus/template/hmr';


describe('compiler/vite config', () => {
    let root = process.cwd().replace(/\\/g, '/');

    // Vite merges a config hook's result into the user's config with mergeConfig, concatenating arrays
    it('adds the HMR runtime to the user\'s optimizeDeps.include while serving', () => {
        let user = { optimizeDeps: { exclude: ['b'], include: ['a'] } },
            added = vite({ root }).config(user, { command: 'serve' });

        expect(mergeConfig(user, added ?? {}).optimizeDeps).toEqual({ exclude: ['b'], include: ['a', HMR] });
        expect(user.optimizeDeps.include).toEqual(['a']);
    });

    it('adds it when the user lists no dependencies', () => {
        expect(vite({ root }).config({}, { command: 'serve' })).toEqual({ optimizeDeps: { include: [HMR] } });
    });

    it('adds nothing for a build, with HMR off, or when the user includes or excludes it already', () => {
        let instance = vite({ root });

        expect(instance.config({}, { command: 'build' })).toBeUndefined();
        expect(instance.config({ server: { hmr: false } }, { command: 'serve' })).toBeUndefined();
        expect(instance.config({ optimizeDeps: { include: [HMR] } }, { command: 'serve' })).toBeUndefined();
        expect(instance.config({ optimizeDeps: { exclude: [HMR] } }, { command: 'serve' })).toBeUndefined();
    });
});
