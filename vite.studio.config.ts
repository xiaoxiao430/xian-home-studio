import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./studio',import.meta.url)),base:'/xian-home/',publicDir:fileURLToPath(new URL('./public',import.meta.url)),plugins:[react()],build:{outDir:fileURLToPath(new URL('./dist-studio',import.meta.url)),emptyOutDir:true},server:{host:'127.0.0.1',proxy:{'/xian-home/api':'http://127.0.0.1:18892'}}});
