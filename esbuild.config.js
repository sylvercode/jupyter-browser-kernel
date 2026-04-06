// @ts-check
'use strict';

/**
 * esbuild configuration for the Jupyter Browser Kernel VS Code extension.
 *
 * Output format: CommonJS
 * Rationale: Runtime interop with external transport dependencies is more
 * reliable in the current extension-host environment.
 */

const esbuild = require('esbuild');

const args = process.argv.slice(2);
const watch = args.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode', 'chrome-remote-interface', 'ws'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    tsconfig: 'tsconfig.json',
    sourcemap: true,
    minify: false,
    logLevel: 'info',
};

if (watch) {
    esbuild.context(buildOptions).then((ctx) => {
        ctx.watch();
        console.log('[esbuild] Watching for changes...');
    }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
} else {
    esbuild.build(buildOptions).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
