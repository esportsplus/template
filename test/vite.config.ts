import { defineConfig } from 'vite';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { templatePlugin } from '../src/vite-plugin';


export default defineConfig({
    build: {
        lib: {
            entry: {
                'constants': resolve(__dirname, 'constants.ts'),
                'effects': resolve(__dirname, 'effects.ts'),
                'events': resolve(__dirname, 'events.ts'),
                'imported-values': resolve(__dirname, 'imported-values.ts'),
                'nested': resolve(__dirname, 'nested.ts'),
                'slots': resolve(__dirname, 'slots.ts'),
                'spread': resolve(__dirname, 'spread.ts'),
                'static': resolve(__dirname, 'static.ts'),
                'templates': resolve(__dirname, 'templates.ts')
            },
            formats: ['es'],
            fileName: (_, entryName) => `${entryName}.js`
        },
        outDir: resolve(__dirname, 'build'),
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
            external: [
                /^~\//,
                /^\.\.\/src/,
                '@esportsplus/reactivity',
                '@esportsplus/utilities'
            ],
            output: {
                preserveModules: false,
                entryFileNames: '[name].js'
            }
        }
    },
    plugins: [
        tsconfigPaths(),
        templatePlugin()
    ],
    resolve: {
        alias: {
            '~': resolve(__dirname, '../src')
        }
    }
});
