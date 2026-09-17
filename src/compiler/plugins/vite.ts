import { readFileSync } from 'node:fs';
import { plugin } from '@esportsplus/typescript/compiler';
import reactivity from '@esportsplus/reactivity/compiler';
import template from '..';
import { transform as transformHMR } from '../hmr';
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

const RELOAD_WINDOW = 100;

const TEMPLATE_PATTERNS = ['html`', 'html.reactive'];


let base = plugin.vite({
        name: PACKAGE_NAME,
        plugins: [reactivity, template]
    });


export default ({ root }: { root?: string } = {}) => {
    let isDev = false,
        lastReload = 0,
        vitePlugin = base({ root });

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
            let { file, modules, server } = ctx;

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
                let source = readFileSync(file, 'utf8');

                for (let i = 0, n = TEMPLATE_PATTERNS.length; i < n; i++) {
                    if (source.includes(TEMPLATE_PATTERNS[i])) {
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
            let result = vitePlugin.transform(code, id);

            if (result === null || !isDev || options?.ssr === true) {
                return result;
            }

            let hmr = transformHMR(result.code, id.replace(/\\/g, '/'));

            if (!hmr.selfAccept) {
                return result;
            }

            return { code: hmr.code, map: result.map };
        }
    } satisfies VitePlugin;
};
