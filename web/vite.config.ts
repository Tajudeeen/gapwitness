import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

function releaseMetadata() {
  let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  let dirty: boolean | null = null;
  try {
    if (!commit) commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {encoding: 'utf8'}).trim() !== '';
  } catch { /* Source-only builds must not invent a Git revision. */ }
  return {format: 'gapwitness/release/v1', commit: /^[a-f0-9]{40}$/i.test(commit) ? commit : null,
    dirty, builtAt: new Date().toISOString()};
}

export default defineConfig({
  // MWP core 0.4 publishes a CJS-only main field beside its ESM build. Select ESM
  // explicitly so dynamic imports retain SessionStore and WebSocketTransport.
  resolve: {alias: {'@metamask/mobile-wallet-protocol-core': fileURLToPath(new URL('./node_modules/@metamask/mobile-wallet-protocol-core/dist/index.mjs', import.meta.url))}},
  optimizeDeps: {include: ['eciesjs']},
  plugins: [react(), {name: 'gapwitness-release', generateBundle() {
    this.emitFile({type: 'asset', fileName: 'release.json', source: JSON.stringify(releaseMetadata(), null, 2) + '\n'});
  }}],
  server:{fs:{allow:[fileURLToPath(new URL('.',import.meta.url)),fileURLToPath(new URL('../data/corpus',import.meta.url))]}},
});
