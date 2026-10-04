// Dev server for the girl games QA (OWNER: games-girl): the project's config without HMR, so edits by other
// agents never reload the page in the middle of an automated run.  npx vite --config tools/games-girl-vite.config.mjs
import base from '../vite.config.js';
export default { ...base, server: { host: '127.0.0.1', port: 5205, strictPort: true, hmr: false } };
