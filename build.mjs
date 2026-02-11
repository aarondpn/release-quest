import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const jsOptions = {
  entryPoints: ['public/js/main.js'],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'public/js/main.min.js',
};

/** @type {esbuild.BuildOptions} */
const cssOptions = {
  entryPoints: ['public/css/styles.css', 'public/css/overview.css'],
  bundle: true,
  minify: true,
  outdir: 'public/css',
  outExtension: { '.css': '.min.css' },
};

if (watch) {
  const [jsCtx, cssCtx] = await Promise.all([
    esbuild.context(jsOptions),
    esbuild.context(cssOptions),
  ]);
  await Promise.all([jsCtx.watch(), cssCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([esbuild.build(jsOptions), esbuild.build(cssOptions)]);
  console.log('Build complete.');
}
