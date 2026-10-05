import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 root:fileURLToPath(new URL('./standalone',import.meta.url)),
 base:process.env.PAGES_BASE||'/xian-home-studio/',
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 plugins:[react()],
 build:{outDir:fileURLToPath(new URL('./dist-pages',import.meta.url)),emptyOutDir:true},
});
