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
        benchmark: {
            include: ['bench/**/*.bench.ts']
        },
        environment: 'jsdom',
        globals: true,
        // The default reporter omits benchmark tables when stdout is not a TTY
        reporters: ['verbose'],
        server: {
            deps: { external }
        }
    }
});
