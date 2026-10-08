import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 root:fileURLToPath(new URL('./standalone',import.meta.url)),
 base:process.env.PAGES_BASE||'/xian-home-studio/',
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 plugins:[react()],
 define:{'import.meta.env.VITE_FAMILY_STATIC':JSON.stringify('true')},
 build:{outDir:fileURLToPath(new URL('./dist-pages',import.meta.url)),emptyOutDir:true},
});
