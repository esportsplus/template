import { plugin } from '@esportsplus/typescript/compiler';
import type { SourceMapV3 } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import { compiler } from '..';
import { apply, plugin as hmr } from '../hmr';
import type { HmrState } from '../hmr';
import { PACKAGE_NAME, UNCOMPILED } from '../constants';


type VitePlugin = {
    configResolved: (config: any) => void;
    enforce: 'pre';
    handleHotUpdate: (ctx: any) => any;
    name: string;
    transform: {
        filter: { id: { exclude: RegExp[]; include: RegExp } };
        handler: (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => { code: string; map: unknown } | null;
    };
    watchChange: (id: string) => void;
};


// Query parameters of Vite asset imports: the code such a module is given is not the file's own source
const ASSETS = new Set(['inline', 'init', 'no-inline', 'raw', 'sharedworker', 'url', 'worker']);

const FILE_REGEX = /\.[cm]?[tj]sx?$/;

const REGEX_NODE_MODULES = /[\\/]node_modules[\\/]/;

const REGEX_PATH_SEPARATOR = /\\/g;

// A script module's id, with or without a query
const REGEX_SCRIPT = /\.[cm]?[tj]sx?(?:\?|$)/;

const REGEX_VIRTUAL = /^\0/;

const RELOAD_WINDOW = 100;


function isAsset(query: string): boolean {
    for (let key of new URLSearchParams(query).keys()) {
        if (ASSETS.has(key)) {
            return true;
        }
    }

    return false;
}


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        lastReload = 0,
        state: HmrState = { id: null, plan: null, templates: new Set() },
        vitePlugin = plugin.vite({
            name: PACKAGE_NAME,
            plugins: [hmr(state), reactivity, compiler(true)],
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
        transform: {
            // Lets Vite skip every other module without calling in
            filter: { id: { exclude: [REGEX_NODE_MODULES, REGEX_VIRTUAL], include: REGEX_SCRIPT } },
            handler(this: unknown, code: string, id: string, options?: { ssr?: boolean }) {
                let query = id.indexOf('?'),
                    path = query === -1 ? id : id.slice(0, query);

                // The filter again, for a host that does not apply it; a queried module is the file's own source
                // (`?worker_file`) unless it is an asset import
                if (
                    REGEX_VIRTUAL.test(id) ||
                    REGEX_NODE_MODULES.test(path) ||
                    !FILE_REGEX.test(path) ||
                    (query !== -1 && isAsset(id.slice(query + 1)))
                ) {
                    return null;
                }

                // The pipeline runs synchronously, so this handshake cannot interleave across modules. HMR wraps a
                // module under its own id only. A build answered from the host's result cache runs no plugin, leaving
                // `state.templates` (dev only, where nothing is cached) as it was; the host reports the compile's
                // removal warnings through this context either way.
                state.id = isDev && options?.ssr !== true && query === -1 ? path.replace(REGEX_PATH_SEPARATOR, '/') : null;
                state.plan = null;

                let result = vitePlugin.transform.handler.call(this, code, path);

                if (result === null || state.id === null || state.plan === null) {
                    return result;
                }

                return apply(result.code, result.map as SourceMapV3, state.id, state.plan) ?? result;
            }
        }
    } satisfies VitePlugin;
};
