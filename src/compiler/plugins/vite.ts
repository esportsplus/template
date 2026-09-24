import { plugin } from '@esportsplus/typescript/compiler';
import type { SourceMapV3 } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import template from '..';
import { apply, plugin as hmr } from '../hmr';
import type { HmrState } from '../hmr';
import { PACKAGE_NAME } from '../constants';


type VitePlugin = {
    configResolved: (config: any) => void;
    enforce: 'pre';
    handleHotUpdate: (ctx: any) => any;
    name: string;
    transform: (code: string, id: string, options?: { ssr?: boolean }) => { code: string; map: unknown } | null;
    watchChange: (id: string) => void;
};


const FILE_REGEX = /\.[tj]sx?$/;

const PATTERNS = [...(reactivity.patterns ?? []), ...template.patterns];

const REGEX_PATH_SEPARATOR = /\\/g;

const RELOAD_WINDOW = 100;


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        lastReload = 0,
        state: HmrState = { id: null, plan: null },
        vitePlugin = plugin.vite({
            name: PACKAGE_NAME,
            plugins: [hmr(state, PATTERNS), reactivity, template]
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
        async handleHotUpdate(ctx: any) {
            let { file, modules, read, server } = ctx;

            // CSS/SCSS and non-script assets keep Vite's default HMR path.
            if (!FILE_REGEX.test(file) || file.includes('node_modules')) {
                return;
            }

            // A supported component self-accepts; let Vite apply the update normally.
            for (let i = 0, n = modules.length; i < n; i++) {
                if (modules[i].isSelfAccepting) {
                    return;
                }
            }

            // Unsupported/unsafe template modules must not be re-imported blindly: request one
            // full reload and stop Vite from walking the import chain.
            try {
                let patterns = template.patterns,
                    source: string = await read();

                for (let i = 0, n = patterns.length; i < n; i++) {
                    if (source.includes(patterns[i])) {
                        reload(server);
                        return [];
                    }
                }
            }
            catch {
                return;
            }
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
