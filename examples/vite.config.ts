import path from 'path';
import { defineConfig } from 'vite';
import compiler from '@esportsplus/frontend/compiler/vite';


export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'index.ts'),
            fileName: 'test',
            formats: ['es']
        },
        minify: false,
        outDir: path.resolve(__dirname, 'dist'),
        rollupOptions: {
            external: []
        },
        sourcemap: true
    },
    plugins: [
        compiler({ root: path.resolve(__dirname, '..') })
    ]
});
