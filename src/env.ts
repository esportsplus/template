// The production build. The package's './env' export maps the 'development' condition, which Vite, webpack, Rollup
// and esbuild set for development builds, to env.development; tooling without export conditions gets this one.
const DEV: boolean = false;


export { DEV };
