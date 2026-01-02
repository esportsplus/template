import { defineConfig } from 'vite';
import { resolve } from 'path';
import { templatePlugin } from '../src//vite-plugin';


export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'templates.ts'),
            formats: ['es'],
            fileName: 'templates.compiled'
        },
        outDir: resolve(__dirname, 'build'),
        emptyOutDir: false,
        minify: false,
        rollupOptions: {
            external: [
                /^~\//,
                /^\.\.\/src/,
                '@esportsplus/reactivity',
                '@esportsplus/utilities'
            ]
        }
    },
    plugins: [
        templatePlugin()
    ],
    resolve: {
        alias: {
            '~': resolve(__dirname, '../src')
        }
    }
});
