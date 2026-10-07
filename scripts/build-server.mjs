import {build} from 'esbuild';
await build({entryPoints:['lib/project-model.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',outfile:'server/model.cjs'});
