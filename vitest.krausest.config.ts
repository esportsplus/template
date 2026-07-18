import { defineConfig } from 'vitest/config';
import path from 'path';


export default defineConfig({
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'src')
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['bench/krausest/index.ts'],
        testTimeout: 600000
    }
});
