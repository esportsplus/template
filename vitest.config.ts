import { defineConfig } from 'vitest/config';
import path from 'path';


export default defineConfig({
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'src')
        }
    },
    test: {
        coverage: {
            include: ['src/**/*.ts'],
            provider: 'v8',
            reporter: ['text', 'html']
        },
        environment: 'jsdom',
        globals: true,
        include: ['test/**/*.test.ts']
    }
});
