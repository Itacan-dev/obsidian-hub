import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const out = 'build/app';
await rm(out, { recursive: true, force: true });
await mkdir(out + '/public', { recursive: true });
const { name, productName, version, main, description } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(out + '/package.json', JSON.stringify({ name, productName, version, main, description }, null, 2));
await Promise.all([
  cp('main', out + '/main', { recursive: true }),
  cp('assets', out + '/public/assets', { recursive: true }),
  cp('renderer/index.html', out + '/public/index.html')
]);
const result = await build({
  entryPoints: ['renderer/app.js'], outdir: out + '/public', bundle: true, format: 'esm', splitting: true,
  chunkNames: 'chunks/[name]-[hash]', assetNames: 'fonts/[name]-[hash]',
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  external: ['/assets/*'], minify: true, metafile: true, legalComments: 'eof', logLevel: 'warning'
});
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
