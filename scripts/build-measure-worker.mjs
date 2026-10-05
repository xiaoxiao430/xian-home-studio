import {build} from 'esbuild';
await build({entryPoints:['app/route.worker.ts'],bundle:true,platform:'browser',format:'esm',target:'es2020',outfile:'public/route-worker.js',minify:true,logLevel:'silent'});
