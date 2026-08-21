import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Modern browsers support top-level await natively, so we target esnext
// instead of pulling in vite-plugin-top-level-await — that plugin's SWC
// transform is currently broken (a known upstream bug, unrelated to this
// project) and unnecessary once the build target doesn't need to downlevel it.
export default defineConfig({
  plugins: [react(), wasm(), nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
  define: {
    global: 'globalThis',
  },
});
