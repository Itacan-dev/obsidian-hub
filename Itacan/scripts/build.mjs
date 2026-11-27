import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const out = 'build/app';
await rm(out, { recursive: true, force: true });
await mkdir(out + '/public', { recursive: true });
const { name, productName, version, main, description } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(out + '/package.json', JSON.stringify({ name, productName, version, main, description }, null, 2));
await Promise.all([
  cp('main', out + '/main', { recursive: true }),
  cp('contracts', out + '/contracts', { recursive:true }),
  cp('examples/Field Library', out + '/examples/Field Library', { recursive:true }),
  cp('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',out+'/public/pdf/pdf.worker.min.js'),
  ...['cmaps','standard_fonts','wasm','iccs'].map(folder=>cp('node_modules/pdfjs-dist/'+folder,out+'/public/pdf/'+folder,{recursive:true})),
  cp('assets', out + '/public/assets', { recursive: true }),
  cp('renderer/index.html', out + '/public/index.html')
]);
const result = await build({
  entryPoints: ['renderer/app.js'], outdir: out + '/public', bundle: true, format: 'esm', splitting: true,
  chunkNames: 'chunks/[name]-[hash]', assetNames: 'fonts/[name]-[hash]',
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  external: ['/assets/*'], minify: true, metafile: true, legalComments: 'eof', logLevel: 'warning'
});
// index.html loads this stylesheet for every screen, including the lazy document desk.
const styles = result.metafile.outputs[out + '/public/app.css'].inputs;
for (const file of await readdir('renderer', { recursive: true })) {
  const source = 'renderer/' + file.replaceAll('\\', '/');
  if (source.endsWith('.css') && !Object.hasOwn(styles, source)) {
    throw new Error('Renderer stylesheet missing from app.css: ' + source);
  }
}
// Carry license texts for the packages actually bundled, including the local fonts.
const packages = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = input.match(/^(.+\/node_modules\/|node_modules\/)(@[^/]+\/[^/]+|[^/]+)\//);
  if (match) packages.add(match[1] + match[2]);
}
const notices = [];
for (const directory of [...packages].sort()) {
  for (const file of await readdir(directory)) {
    if (/^(license|licence|ofl)(\.(txt|md))?$/i.test(file)) {
      notices.push(directory + '\n' + await readFile(directory + '/' + file, 'utf8'));
    }
  }
}
await writeFile(out + '/THIRD-PARTY-NOTICES.txt', notices.join('\n\n'));
