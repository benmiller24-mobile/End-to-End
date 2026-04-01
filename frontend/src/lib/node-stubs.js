/**
 * Node.js module stubs for browser builds.
 * engine-3d.js imports child_process, url, path — these are Node-only.
 * In the browser, the 3D engine functions are no-ops (Python bridge not available).
 */
export function execSync() { return '{}'; }
export function fileURLToPath() { return '/stub'; }
export function dirname() { return '/stub'; }
export function join(...args) { return args.join('/'); }
export default {};
