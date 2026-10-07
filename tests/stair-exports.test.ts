import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {PDFArray,PDFDict,PDFDocument,PDFName,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {bedHeadGeometry,dxfDrawing,pdfDrawing,stairExportGeometry,svgDrawing} from '../lib/designer-export';
import {computeScene,dimensionsFor} from '../lib/geometry';
import {getStairPlanSvg,getStairVolumes} from '../lib/stairs';
import type {Floor} from '../lib/model';

const makeFloor=(id:string):Floor=>({id,name:id==='f2'?'二楼':'一楼',outline:[[0,0],[6500,0],[6500,7000],[0,7000]],originalOutline:[[0,0],[6500,0],[6500,7000],[0,7000]],rooms:[],measurements:[],routes:[],regions:[],source:'synthetic stair export test',note:'',pieces:[{id:id+'-stairs',name:'原楼梯',type:'stair',x:2100,y:3200,w:1834,h:2252,rotation:0}]});
const entityRows=(dxf:string)=>{
 const section=dxf.split('0\nSECTION\n2\nENTITIES\n')[1].split('0\nENDSEC')[0].trimEnd().split('\n');
 const result:{kind:string;pairs:[number,string][]}[]=[];
 for(let i=0;i<section.length;i+=2){const code=Number(section[i]),value=section[i+1];if(code===0)result.push({kind:value,pairs:[]});else result.at(-1)!.pairs.push([code,value]);}
 return result;
};
const output=process.env.STAIR_EXPORT_OUT;
if(output)mkdirSync(output,{recursive:true,mode:0o700});
const lower=makeFloor('f1'),upper=makeFloor('f2');
for(const f of [lower,upper]){
 const scene=computeScene(f),source=JSON.stringify(f),geometry=stairExportGeometry(f)[0],svg=svgDrawing(f,scene,[],[],'test'),dxf=dxfDrawing(f,scene,[],[],'test');
 assert(svg.includes(getStairPlanSvg(f.pieces[0],f.id)),'SVG exports the same parametric stair drawing as the plan');
 assert(svg.includes('data-geometry="stair-study"'));
 assert(svg.includes(f.id==='f2'?'下行':'上行'),'legacy floor context determines direction without modifying stored data');
 assert(svg.includes('不作为施工踏步图'));
 assert.equal(geometry.label,f.id==='f2'?'下行 · U形示意':'上行 · U形示意');
 const volumes=getStairVolumes(f.pieces[0],f.id).filter(v=>!v.partId.startsWith('rail-post-'));
 assert.deepEqual(geometry.polylines,volumes.flatMap(v=>v.polygon),'PDF/DXF vectors are projected directly from shared stair solids');
 assert(geometry.polylines.length>=35,'export contains treads, landing and rails instead of only one footprint');
 assert(geometry.arrow.flat().every(Number.isFinite));
 const entities=entityRows(dxf),stairs=entities.filter(e=>e.pairs.some(([c,v])=>c===8&&v==='STAIRS'));
 assert.equal(stairs.filter(e=>e.kind==='LWPOLYLINE').length,geometry.polylines.length+2,'stair outlines, U direction and arrowhead remain CAD-editable polylines');
 assert(stairs.some(e=>e.kind==='TEXT'&&e.pairs.some(([c,v])=>c===1&&v===geometry.label)));
 assert(dxf.includes('9\n$INSUNITS\n70\n4\n'),'DXF remains millimetres');assert(dxf.includes('3\nmsyh.ttf\n'),'DXF keeps YaHei font style');
 assert(!stairs.some(e=>e.kind==='DIMENSION'),'schematic tread dimensions must not be exported as confirmed dimension entities');
 assert.equal(JSON.stringify(f),source,'export helpers do not migrate or mutate legacy source');
 if(output){writeFileSync(join(output,f.id+'-stairs.svg'),svg,{mode:0o600});writeFileSync(join(output,f.id+'-stairs.dxf'),dxf,{mode:0o600});}
}
assert.deepEqual(stairExportGeometry(upper)[0].arrow,stairExportGeometry(lower)[0].arrow.slice().reverse(),'up/down views describe the same stair in opposite directions');
const measuredScene=computeScene(upper),dimensions=dimensionsFor(upper,measuredScene,upper.pieces[0].id,false),measuredDxf=entityRows(dxfDrawing(upper,measuredScene,dimensions,[],1));
assert.equal(measuredDxf.filter(e=>e.kind==='DIMENSION').length,dimensions.filter(d=>d.value!==null).length,'existing editable dimensions are retained alongside stair detail');
const rotated=makeFloor('f2');rotated.pieces[0].rotation=90;
assert.deepEqual(stairExportGeometry(rotated)[0].polylines,getStairVolumes(rotated.pieces[0],'f2').filter(v=>!v.partId.startsWith('rail-post-')).flatMap(v=>v.polygon),'rotated export endpoints use world coordinates');
assert(svgDrawing(rotated,computeScene(rotated),[],[],1).includes('rotate(90 917 1126)'));
const hidden=makeFloor('f2');hidden.pieces[0].visible=false;assert.equal(stairExportGeometry(hidden).length,0);

const withBed=makeFloor('f2');
withBed.pieces.push({id:'f2-suite-bed',name:'主卧床 · 双人',type:'furniture',x:350,y:500,w:1600,h:2200,rotation:180,baseW:1500,baseH:2000},{id:'f2-bedside',name:'床头柜',type:'furniture',x:150,y:2500,w:200,h:300,rotation:0},{id:'not-a-bed',name:'床侧办公桌',type:'furniture',x:2100,y:1600,w:1200,h:500,rotation:0});
const southHead=bedHeadGeometry(withBed);assert.equal(southHead.length,1,'bedside furniture must not receive a bed-head marker');
assert(Math.abs(southHead[0].a[1]-2700)<.001&&Math.abs(southHead[0].b[1]-2700)<.001,'180 degree bed head is on the world south edge');
assert(southHead[0].labelAt[1]>500+2200/2,'bed-head label stays inside the head side after rotation');
assert(Math.abs(Math.abs(southHead[0].b[0]-southHead[0].a[0])-1600*.64)<.001,'resized beds are not scaled twice by old base dimensions');
const northBed=structuredClone(withBed);northBed.id='f1';northBed.pieces[1].rotation=0;const northHead=bedHeadGeometry(northBed)[0];assert.equal(northHead.a[1],500,'bed marker works on either floor');
const quarterBed=structuredClone(withBed);quarterBed.pieces[1].rotation=90;const eastHead=bedHeadGeometry(quarterBed)[0];assert(Math.abs(eastHead.a[0]-2250)<.001&&Math.abs(eastHead.b[0]-2250)<.001,'90 degree head line rotates onto world east side');
const bedScene=computeScene(withBed),bedSvg=svgDrawing(withBed,bedScene,[],[],'bed-head-test'),bedDxf=dxfDrawing(withBed,bedScene,[],[],'bed-head-test');
assert.equal((bedSvg.match(/data-geometry="bed-head"/g)||[]).length,1);assert(bedSvg.includes('>床头</text>'));
const headText=entityRows(bedDxf).filter(e=>e.kind==='TEXT'&&e.pairs.some(([c,v])=>c===1&&v==='床头'));assert.equal(headText.length,1);assert(headText[0].pairs.some(([c,v])=>c===20&&Math.abs(Number(v)+southHead[0].labelAt[1])<.001),'DXF marker keeps the expected inverted CAD Y axis');
assert(bedDxf.includes('9\n$INSUNITS\n70\n4\n'));assert(bedDxf.includes('3\nmsyh.ttf\n'));
if(output){writeFileSync(join(output,'f2-bed-head.svg'),bedSvg,{mode:0o600});writeFileSync(join(output,'f2-bed-head.dxf'),bedDxf,{mode:0o600});}

async function checkPdf(){
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input)=>{assert(String(input).endsWith('fonts/yahei.ttf'));return new Response(readFileSync('public/fonts/yahei.ttf') as unknown as BodyInit);};
 try{
  const bytes=await pdfDrawing(withBed,computeScene(withBed),[],[],'test'),doc=await PDFDocument.load(bytes),page=doc.getPage(0);
  assert.equal(doc.getPageCount(),1);assert(Math.abs(page.getWidth()-1190.55)<.01&&Math.abs(page.getHeight()-841.89)<.01,'PDF remains A3 landscape');
  const contents=page.node.Contents(),streams=contents instanceof PDFArray?contents.asArray().map(ref=>doc.context.lookup(ref)):contents?[doc.context.lookup(contents)]:[];
  const drawing=streams.filter((s):s is PDFRawStream=>s instanceof PDFRawStream).map(s=>Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
  assert((drawing.match(/\nS\n/g)||[]).length>100,'PDF contains editable vector treads, rails and direction lines instead of a solid rectangle');
  const fonts=page.node.Resources()!.lookup(PDFName.of('Font'),PDFDict);
  let embedded=false;
  for(const [,ref] of fonts.entries()){
   const font=doc.context.lookup(ref,PDFDict),descendants=font.lookup(PDFName.of('DescendantFonts'),PDFArray),cid=doc.context.lookup(descendants.get(0),PDFDict),descriptor=cid.lookup(PDFName.of('FontDescriptor'),PDFDict);
   assert(String(descriptor.get(PDFName.of('FontName'))).includes('MicrosoftYaHei'));
   const data=doc.context.lookup(descriptor.get(PDFName.of('FontFile2')));assert(data instanceof PDFRawStream&&data.contents.byteLength>1000);embedded=true;
  }
  assert(embedded,'PDF actually embeds YaHei');
  if(output)writeFileSync(join(output,'f2-stairs.pdf'),bytes,{mode:0o600});
 }finally{globalThis.fetch=originalFetch;}
}
checkPdf().then(()=>console.log('PASS stair/bed SVG/PDF/DXF exports: shared geometry, legacy f2 descent, rotated bed-head marker, CAD entities, A3 units and embedded Microsoft YaHei')).catch(error=>{console.error(error);process.exitCode=1;});
