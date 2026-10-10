// Bundles the service modules with Vite-compatible import.meta.env defines,
// then runs the Phase 3 suite against real browsers-free globals.
import { build } from 'esbuild';

await build({
  entryPoints: ['tools/pipeline-test.mjs'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: 'tools/.pipeline-test.bundle.mjs',
  define: {
    'import.meta.env.VITE_GROQ_API_KEY': JSON.stringify(process.env.VITE_GROQ_API_KEY || ''),
  },
  logLevel: 'warning',
});

await import('./.pipeline-test.bundle.mjs');
