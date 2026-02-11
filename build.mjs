import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const cssOptions = {
  entryPoints: ['public/css/styles.css', 'public/css/overview.css'],
  bundle: true,
  minify: true,
  outdir: 'public/css',
  outExtension: { '.css': '.min.css' },
};

if (watch) {
  const cssCtx = await esbuild.context(cssOptions);
  await cssCtx.watch();
  console.log('Watching for CSS changes...');
} else {
  await esbuild.build(cssOptions);
  console.log('Build complete.');
}
