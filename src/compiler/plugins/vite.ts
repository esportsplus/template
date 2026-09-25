import { plugin } from '@esportsplus/typescript/compiler';
import type { SourceMapV3 } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import template from '..';
import { apply, plugin as hmr } from '../hmr';
import type { HmrState } from '../hmr';
import { PACKAGE_NAME, UNCOMPILED } from '../constants';


type VitePlugin = {
    configResolved: (config: any) => void;
    enforce: 'pre';
    handleHotUpdate: (ctx: any) => any;
    name: string;
    transform: (code: string, id: string, options?: { ssr?: boolean }) => { code: string; map: unknown } | null;
    watchChange: (id: string) => void;
};


const FILE_REGEX = /\.[tj]sx?$/;

const REGEX_PATH_SEPARATOR = /\\/g;

const RELOAD_WINDOW = 100;


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        lastReload = 0,
        state: HmrState = { id: null, plan: null, templates: new Set() },
        vitePlugin = plugin.vite({
            name: PACKAGE_NAME,
            plugins: [hmr(state), reactivity, template],
            uncompiled: [UNCOMPILED]
        })({ root });

    const reload = (server: any) => {
        let now = Date.now();

        if (now - lastReload < RELOAD_WINDOW) {
            return;
        }

        lastReload = now;
        (server.hot ?? server.ws).send({ type: 'full-reload' });
    };

    return {
        ...vitePlugin,
        configResolved(config: any) {
            vitePlugin.configResolved(config);
            isDev = config?.command === 'serve' && config?.server?.hmr !== false;
        },
        handleHotUpdate(ctx: any) {
            let { file, modules, server } = ctx,
                // Modules compiled against the changed file are updated with it
                result = vitePlugin.handleHotUpdate(ctx);

            // CSS/SCSS and non-script assets keep Vite's default HMR path.
            if (!FILE_REGEX.test(file) || file.includes('node_modules')) {
                return result;
            }

            // A supported component self-accepts; let Vite apply the update normally.
            for (let i = 0, n = modules.length; i < n; i++) {
                if (modules[i].isSelfAccepting) {
                    return result;
                }
            }

            // Unsupported/unsafe template modules must not be re-imported blindly: request one
            // full reload and stop Vite from walking the import chain.
            if (state.templates.has(file.replace(REGEX_PATH_SEPARATOR, '/'))) {
                reload(server);
                return [];
            }

            return result;
        },
        transform(code: string, id: string, options?: { ssr?: boolean }) {
            // The pipeline runs synchronously, so this handshake cannot interleave across modules
            state.id = isDev && options?.ssr !== true ? id.replace(REGEX_PATH_SEPARATOR, '/') : null;
            state.plan = null;

            let result = vitePlugin.transform(code, id);

            if (result === null || state.id === null || state.plan === null) {
                return result;
            }

            return apply(result.code, result.map as SourceMapV3, state.id, state.plan) ?? result;
        }
    } satisfies VitePlugin;
};
