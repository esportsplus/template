import { defineConfig } from 'vitest/config';
import path from 'path';
import { built, external } from './bench/built';


export default defineConfig({
    plugins: [built(import.meta.dirname)],
    resolve: {
        alias: {
            '~': path.resolve(import.meta.dirname, 'src')
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['bench/krausest/index.ts'],
        server: {
            deps: { external }
        },
        testTimeout: 600000
    }
});
