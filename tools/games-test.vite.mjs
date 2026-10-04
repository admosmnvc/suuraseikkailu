/* Vite config for the minigame QA (OWNER: games-core): the project config + no HMR (other agents edit files while
   the tests run; a hot reload would kill the test page) + the games test page as a second build input.
   Dev:   npx vite --config tools/games-test.vite.mjs --host 127.0.0.1 --port 5204 --strictPort
   Build: npx vite build --config tools/games-test.vite.mjs --outDir ../build-v3-games --emptyOutDir
          (GAMES_ONLY=1 builds just the games test page – useful while another agent's file breaks the app build) */
import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from '../vite.config.js';

export default mergeConfig(base, defineConfig({
  server: { hmr: false },
  build: { rollupOptions: { input: process.env.GAMES_ONLY
    ? { games: resolve(process.cwd(), 'tools/games-test.html') }
    : { index: resolve(process.cwd(), 'index.html'), games: resolve(process.cwd(), 'tools/games-test.html') } } }
}));
