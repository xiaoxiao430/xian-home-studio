import {clone,type Floor,type Piece,type State} from './model';
import {rectRing,type MeasureSpec,type RegionSpec,type RouteSpec} from './measurement-model';
import {computeScene,intersection,multiArea,pieceShapes,measureSpec,type Dimension} from './geometry';

export type MasterSuiteKind='dry'|'window';
export const masterSuitePrefix='f2-suite-';
const id=(key:string)=>masterSuitePrefix+key;
const design='主卧套间概念方案；平面与高度为可调整方案值，设备未选型；结构、水电及安装条件待复核。';
const P=(key:string,name:string,type:Piece['type'],x:number,y:number,w:number,h:number,heightMm:number,extra:Partial<Piece>={}):Piece=>({id:id(key),name,type,x,y,w,h,rotation:0,baseW:w,baseH:h,heightMm,elevationMm:0,dimensionSource:'design',source:design,parts:[{id:'body',name,ring:rectRing(0,0,w,h)}],...extra});
const wall=(key:string,name:string,x:number,y:number,w:number,h:number,height=2600)=>P(key,name,'wall',x,y,w,h,height,{structural:'nonload',source:design+'新增轻质分隔意向，非结构认定。'});
const frontCab=(key:string,name:string,x:number,y:number,w:number,d:number,rotation=0):Piece=>P(key,name,'furniture',x,y,w,d,2600,{rotation,cabinet:{columns:Array.from({length:Math.max(1,Math.ceil(w/550))},(_,i)=>({width:w/Math.ceil(w/550),shelves:3,drawers:i===0?2:0,open:false,hinge:i%2?'right':'left'})),plinthMm:80,topGapMm:30,doorOpen:false},usage:{open:false,depth:550,side:'bottom'}});
/** Cabinet width remains facade width; rotated plan footprint is explicit. */
const sideCab=(key:string,name:string,x:number,y:number,length:number,face:'east'|'west')=>frontCab(key,name,x+(600-length)/2,y+(length-600)/2,length,600,face==='east'?270:90);
const opening=(key:string,name:string,x:number,y:number,w:number,h:number,host:string,extra:Partial<Piece>={})=>P(key,name,'opening',x,y,w,h,2200,{openingKind:'door',hostWallIds:[id(host)],...extra});
const zone=(key:string,name:string,x:number,y:number,w:number,h:number)=>P(key,name,'zone',x,y,w,h,10,{source:'使用范围示意，不计为固定家具；实际动作、设备与门扇范围待选型复核。',dimensionSource:'provisional',color:'#e9dfcd'});
const local=(key:string,point:[number,number])=>({kind:'local' as const,objectId:id(key),point});
const obj=(key:string,edge?:number)=>({kind:'object' as const,objectId:id(key),...(edge===undefined?{}:{edge})});
const point=(x:number,y:number)=>({kind:'point' as const,point:[x,y] as [number,number]});
function measurement(key:string,name:string,a:MeasureSpec['a'],b:MeasureSpec['b'],mode:MeasureSpec['mode']='shortest',pinned=true):MeasureSpec{return {id:id(key),name,a,b,mode,pinned};}
const roomNames:Record<string,string>={
 'f2-northwest-upper':'主卫 · 浴缸与照护','f2-northwest-lower':'主卫 · 独立淋浴 / 如厕','f2-north-center-wet':'连通洗漱干区','f2-north-storage':'套间衣帽收纳（原0.8㎡）','f2-north-center-room':'夫妻衣帽间','f2-east-upper-bedroom':'主卧睡眠','f2-upper-balcony':'主卧窗边区','f2-central-wet':'公共直饮与杂物区',
};
export function suiteComparison(kind:MasterSuiteKind){
 return {
  kind,title:kind==='dry'?'干区化妆版':'阳台化妆版',referenceAreas:{total:39.2,public:2,private:39.2,source:'七块原标面积39.2㎡全部归主卧；另有中部原标2㎡作公共直饮储物。原图标注与方案净面积分开。'},
  benefits:kind==='dry'?['洗漱后直接坐下化妆，台面连续但两种台高分开。','化妆位离床较远，可通过卧室移门分隔晨起与休息。','阳台端部保持空余，可继续安排阅读或临时照顾孩子。']:['化妆台放在用户确认的阳台下端墙垛阳台窗户侧，镜面对应原实墙；卧室床尾保留完整。','相同柜深下增加约1000 mm衣柜正面长度。','躺椅移至阳台上端，化妆台与躺椅之间留811长的进入带，经原洞口直接进入。'],
  tradeoffs:kind==='dry'?['比阳台版减少1000 mm衣柜正面长度；净容量还要扣除分格、五金与收口。','化妆椅后退进入衣帽间中部，需结合双人洗漱和取衣状态比较。']:['化妆在睡眠空间内，早起照明、吹风与座椅声音可能影响休息。','化妆椅后方至窗320 mm，暂按300后退范围研究；需侧向离座，不能作为宽敞连续走道。','化妆桌深450、椅子450×450为紧凑方案，须按真实坐姿与窗把手复核；墙垛结构、补光、遮光与防晒待深化。'],
  pending:['原内部墙结构性质和拆改专业复核；原图H/D/LH含义不自动换算。','双台盆、坐式化妆台、浴缸和床均为方案尺寸，需按最终产品外尺寸更新。','浴缸满水荷载、楼板条件、防水排水、热水容量与孩子照护动作待现场核实。','如厕门向干区外开，开启时局部临时占用浴缸前动线；淋浴玻璃门向内开启。','西侧衣柜纳入原0.8㎡并向北连通，常用抽屉与柜门开启仍需逐项检查。','公共直饮柜放在中部原2㎡小间西侧，北门和东侧卧室开口保留；取水/检修临时占用共同通行，需确认净水管、插座及散热。'],
 };
}

/** Pure, repeatable migration of the upstairs concept only; original first floor is untouched. */
export function applyMasterSuite(input:State,kind:MasterSuiteKind):State{
 if(kind!=='dry'&&kind!=='window')throw Error('未知的主卧化妆方案');
 const state=clone(input),f=state.floors.find(f=>f.id==='f2');if(!f)throw Error('缺少二楼原图');
 for(const key of ['f2-wall-06','f2-wall-22','f2-opening-13','f2-opening-14','f2-opening-11','f2-opening-12','f2-opening-10','f2-opening-15','f2-opening-16'])if(!f.pieces.some(p=>p.id===key))throw Error('二楼源图缺少关键对象：'+key+'；未套用未知底图。');
 f.pieces=f.pieces.filter(p=>!p.id.startsWith(masterSuitePrefix));
 f.measurements=(f.measurements||[]).filter(p=>!p.id.startsWith(masterSuitePrefix));f.routes=(f.routes||[]).filter(p=>!p.id.startsWith(masterSuitePrefix));f.regions=(f.regions||[]).filter(p=>!p.id.startsWith(masterSuitePrefix));
 for(const p of f.pieces){
  if(['f2-wall-17','f2-wall-18','f2-wall-19','f2-wall-20','f2-wall-21','f2-wall-23','f2-wall-24','f2-opening-08','f2-opening-09'].includes(p.id)){
   p.original??={x:p.x,y:p.y,w:p.w,h:p.h};p.visible=false;
   if(!p.name.includes('拟拆'))p.name+='（拟拆并入套间）';
   if(!p.source?.includes('方案拟拆'))p.source=(p.source||'')+'；方案拟拆，原结构性质保留，需专业复核后实施。';
  }
  if(p.id==='f2-wall-22'){
   p.original??={x:p.x,y:p.y,w:p.w,h:p.h};p.y=2390;p.h=919;p.baseW=p.w;p.baseH=p.h;p.parts=[{id:'body',name:'保留主卧收纳西侧分隔',ring:rectRing(0,0,p.w,p.h)}];p.name='主卧收纳西墙（上段拟拆）';
  }
  if(p.id==='f2-opening-13'){p.original??={x:p.x,y:p.y,w:p.w,h:p.h};p.visible=false;p.name='原西卧北门（拟封闭）';}
  if(p.id==='f2-opening-11'){p.original??={x:p.x,y:p.y,w:p.w,h:p.h};p.visible=false;p.name='原0.8㎡朝过厅门洞（拟封闭）';p.source=(p.source||'').replace('；保留朝过厅取用，柜体在原0.8㎡范围内。','');}
  if(p.id==='f2-opening-10'){p.name='睡眠区移门（隔开更衣洗漱）';if(!p.source?.includes('门扇沿卧室侧'))p.source=(p.source||'')+'；门扇沿卧室侧向下方滑移，轨道与隔音做法待深化。';}
  if(p.id==='f2-opening-12')p.name='主卧套间入口';
 }
 for(const r of f.rooms)if(roomNames[r.id])r.name=roomNames[r.id];
 const additions:Piece[]=[
  wall('old-door-infill','原西卧北门封补',2209,3413,781,198,3000),
  wall('private-hall-infill','原0.8㎡南门封补 · 主卧私密边界',3469,3309,781,121,3000),
  wall('shower-front','淋浴玻璃隔断',880,2030,1150,90,2200),
  wall('wet-divider','淋浴与如厕隔墙',2030,2030,90,1383,2600),
  wall('wc-front','独立如厕前隔墙',2120,2030,1159,90,2600),
  wall('wc-east','如厕东侧补齐隔墙',3279,2030,129,360,2600),
  opening('shower-door','淋浴门 · 向内开启',1030,2030,800,90,'shower-front',{usage:{open:false,depth:800,side:'bottom'}}),
  opening('wc-door','如厕门 · 向干区外开',2290,2030,800,90,'wc-front',{usage:{open:false,depth:800,side:'top'}}),
  P('tub','大浴缸','furniture',950,150,1800,800,600,{color:'#e7e1d7',usage:{open:false,depth:900,side:'bottom'},svg:'<rect width="1800" height="800" rx="180" fill="#eee8de" stroke="#8b8173" stroke-width="15"/><rect x="90" y="90" width="1620" height="620" rx="225" fill="#fcfaf6" stroke="#b4ac9f" stroke-width="15"/><circle cx="1550" cy="400" r="30" fill="#9d978b"/>'}),
  zone('tub-care','浴缸照护 / 进出 / 清洁范围',950,950,1800,900),
  P('shower','独立淋浴区','furniture',900,2130,1120,1250,60,{color:'#ded9ce',svg:'<rect width="1120" height="1250" fill="#e4e5df" stroke="#a4aaa3" stroke-width="12"/><path d="M0 0L1120 1250M1120 0L0 1250" stroke="#c3c7bf" stroke-width="8"/><circle cx="850" cy="1010" r="40" fill="#8b9690"/>',source:design+'淋浴地面为低位示意；路线终点设在门前，不把淋浴盘实体作为日常干区通道。'}),
  P('wc','独立如厕','furniture',2430,2730,400,650,760,{color:'#f0ece4',svg:'<rect width="400" height="170" y="480" rx="40" fill="#eeece5" stroke="#8d9891" stroke-width="12"/><ellipse cx="200" cy="265" rx="175" ry="240" fill="#fdfbf6" stroke="#8d9891" stroke-width="12"/><ellipse cx="200" cy="240" rx="110" ry="150" fill="#dcded8"/>'}),
  P('double-vanity','双人双台盆','furniture',3430,203,1800,600,850,{color:'#b8aa95',usage:{open:false,depth:450,side:'bottom'},svg:'<rect width="1800" height="600" fill="#c6baa6" stroke="#8b8173" stroke-width="12"/><rect x="170" y="95" width="560" height="390" rx="65" fill="#fcfaf6" stroke="#9b998f" stroke-width="12"/><rect x="1070" y="95" width="560" height="390" rx="65" fill="#fcfaf6" stroke="#9b998f" stroke-width="12"/><path d="M450 50V155M1350 50V155" stroke="#8b8173" stroke-width="24"/>'}),
  P('vanity-mirror','双台盆镜柜与面部照明','furniture',3460,208,1740,45,900,{elevationMm:1100,color:'#c5d0ce',source:design+'镜面/灯光位置为意向，调色温与显色、眩光需实物确认。'}),
  sideCab('wardrobe-west','原0.8㎡连通衣帽收纳',3408,2110,1199,'east'),
  sideCab('wardrobe-east','衣帽东侧封闭衣柜',6411,2010,1299,'west'),
  frontCab('wardrobe-north','衣帽北侧封闭衣柜',kind==='dry'?6230:5230,203,kind==='dry'?781:1781,600),
  P('bed','主卧床 · 暂按2米床垫','furniture',7710,2461,2100,2250,550,{rotation:180,color:'#d7cbbd',svg:'<rect width="2100" height="2250" rx="90" fill="#cfbfaf" stroke="#8a8075" stroke-width="14"/><rect x="55" y="50" width="1990" height="2150" rx="85" fill="#f0e8dc" stroke="#aaa194" stroke-width="10"/><rect x="160" y="150" width="780" height="400" rx="80" fill="#e1d5c8"/><rect x="1160" y="150" width="780" height="400" rx="80" fill="#e1d5c8"/><path d="M80 680H2020" stroke="#c1b5a7" stroke-width="18"/>',source:design+'名义床垫2000宽；床架外尺寸暂按2100×2250，需最终选型；按用户要求床头床尾对调，床头贴图纸下方f2-wall-35墙面y4711。'}),
  P('bedside-left','左床头柜','furniture',7260,4241,400,420,480,{rotation:180}),
  P('bedside-right','右床头柜','furniture',9860,4241,400,420,480,{rotation:180}),
  frontCab('public-water','公共杂物 · 直饮柜',5197,5130,980,450,270),
  zone('public-service','中部小间取水 / 检修范围',6012,5145,700,600),
 ];
 const water=additions.find(p=>p.id===id('public-water'))!;water.usage={open:false,depth:500,side:'bottom'};water.cabinet!.columns=[{width:490,shelves:3,drawers:1,open:true,hinge:'none'},{width:490,shelves:4,drawers:0,open:false,hinge:'right'}];water.source=design+'左列预留接净水管直饮机，模型下托板约918高、机位净宽约450，均按实际设备复核；开放机位，右列杂物收纳。电源、散热、漏水检测及抽出检修待确认。';
 additions.push(P('drinking-machine','接净水管直饮机（待选型）','furniture',5532,5410,310,380,420,{rotation:270,elevationMm:920,dimensionSource:'provisional',color:'#a19d92',source:'设备外形310×380×420为示意，底标高920；置于公共柜左列开放格。净水管与电源未确认，须按实际型号校核散热、接水、漏水防护与整机抽出空间。',svg:'<rect width="310" height="380" rx="28" fill="#8c918a" stroke="#515d56" stroke-width="10"/><rect x="40" y="220" width="230" height="120" rx="20" fill="#d8ded6"/><circle cx="155" cy="130" r="30" fill="#d7c4a0"/>'}));
 for(const p of additions.filter(p=>['public-water','drinking-machine','public-service'].some(k=>p.id===id(k))))p.groupId=id('water-storage-group');
 if(kind==='dry'){
  additions.push(P('makeup-desk','坐式化妆台','furniture',5230,203,1000,550,750,{source:design+'桌下净空保留腿部位置，抽屉设两侧/薄抽；实际腿部净高待选型。'}),P('makeup-mirror','化妆镜 · 可调面部光','furniture',5330,208,800,35,800,{elevationMm:1050,color:'#c6d0cc',source:design+'以面部照明为主，灯光显色与调色温待实物确认。'}),P('makeup-chair','化妆椅','furniture',5430,803,600,550,800,{usage:{chairs:'seated',open:false,depth:450,side:'bottom'},parts:[{id:'body',name:'化妆椅就座',ring:rectRing(0,0,600,550),when:'seated'},{id:'stored-body',name:'化妆椅收起（桌下叠放）',ring:rectRing(0,-330,600,550),when:'stored'}]}),zone('makeup-retreat','化妆椅后退范围',5430,1353,600,450));
 }else{
  additions.push(P('makeup-desk','坐式化妆台 · 阳台窗侧','furniture',10404,4036,900,450,750,{rotation:270,source:design+'用户再次明确化妆位在阳台下端墙垛的阳台窗户侧，不能放在卧室侧。桌面由独立桌腿承托，900长度比850墙垛向开口上方延伸50，镜面完整对应实墙；450桌深为紧凑意向，需按真实坐姿复核。'}),P('makeup-mirror','化妆镜 · 阳台墙垛面部光','furniture',10281.5,4243.5,700,35,800,{rotation:270,elevationMm:1050,color:'#c6d0cc',source:design+'镜面700长度对应原阳台下端墙垛y3911至4611的阳台窗户侧，位于原850实墙范围内；结构与安装灯光做法待复核。'}),P('makeup-chair','化妆椅 · 紧凑坐位','furniture',11129,4036,450,450,750,{rotation:90,usage:{chairs:'seated',open:false,depth:300,side:'top'},source:design+'450×450紧凑坐位，面向西侧化妆桌；后方至窗320，后退按300研究，主要从北侧离座；窗把手和真实坐姿尚待复核。',parts:[{id:'body',name:'化妆椅就座',ring:rectRing(0,0,450,450),when:'seated'},{id:'stored-body',name:'化妆椅收起（桌下叠放）',ring:rectRing(0,220,450,450),when:'stored'}]}),zone('makeup-retreat','化妆椅向窗侧后退 · 紧凑',11579,4036,300,450));
 }
 if(kind==='window'){
  additions.push(P('lounger','阳台柔软躺椅','furniture',11149,1100,700,1900,700,{dimensionSource:'provisional',color:'#cfc3b4',source:'700×1900为完全躺卧状态的方案外尺寸，型号与坐感待样品确认；靠窗预留50，距原阳台洞口内侧线540；该侧与卧室开口连通，不能把这条几何关系当作独立900连续通道。',svg:'<rect width="700" height="1900" rx="130" fill="#c6b7a4" stroke="#8e8171" stroke-width="14"/><rect x="45" y="65" width="610" height="1770" rx="115" fill="#e2d6c5" stroke="#b5a58f" stroke-width="10"/><rect x="95" y="110" width="510" height="340" rx="95" fill="#d0c1ac"/><path d="M60 650Q350 700 640 650M60 1350Q350 1380 640 1350" fill="none" stroke="#c5b49e" stroke-width="12"/>'}));
  const bearing=f.pieces.find(p=>p.id==='f2-wall-34');if(bearing){bearing.structural='candidate';if(!bearing.source?.includes('用户确认阳台下端墙垛'))bearing.source=(bearing.source||'')+'；用户确认阳台下端墙垛并称其承重，按保留处理；当前为结构候选，专业复核未完成。';}
 }
 for(const p of f.pieces)if(p.id==='f2-wall-08'&&p.source)p.source=p.source.replace('；用户称阳台承重墙，当前暂按床头一端研究，具体墙段待确认；原结构候选属性保留，专业复核未完成。','');
 for(const [group,keys] of [['makeup-group',['makeup-desk','makeup-mirror','makeup-chair','makeup-retreat']],['vanity-group',['double-vanity','vanity-mirror']],['tub-group',['tub','tub-care']],['sleeping-group',['bed','bedside-left','bedside-right']]] as const)for(const p of additions.filter(p=>keys.some(k=>p.id===id(k))))p.groupId=id(group);
 f.pieces.push(...additions);
 f.measurements!.push(
  measurement('bed-left','床架图纸左侧至卧室分隔墙',obj('bed',1),{kind:'object',objectId:'f2-wall-31',edge:1},'horizontal'),
  measurement('bed-right','床架图纸右侧至阳台原界面',obj('bed',3),{kind:'object',objectId:'f2-opening-18',edge:3},'horizontal'),
  measurement('bed-head-wall','床头贴图纸下侧墙',obj('bed',0),{kind:'object',objectId:'f2-wall-35',edge:0},'vertical'),
  measurement('bed-foot-open','床尾至图纸上侧墙（开敞区深度）',obj('bed',2),{kind:'object',objectId:'f2-wall-02',edge:2},'vertical'),
  measurement('wardrobe-aisle','两排衣柜关闭时净距',obj('wardrobe-west',2),obj('wardrobe-east',2),'horizontal'),
  measurement('tub-approach','浴缸边至淋浴隔断（使用带）',obj('tub',2),obj('shower-front',0),'vertical'),
  measurement('wc-front-clearance','马桶前沿至如厕门内侧',obj('wc',0),obj('wc-door',2),'vertical'),
  measurement('basin-makeup-height-relation','双台盆与化妆台位置关系',obj('double-vanity'),obj('makeup-desk'),'shortest',false),
  measurement('makeup-chair-retreat','化妆椅后退预留深度',local('makeup-chair',kind==='dry'?[300,550]:[225,0]),local('makeup-chair',kind==='dry'?[300,1000]:[225,-300]),kind==='dry'?'vertical':'horizontal'),
  measurement('public-cabinet-clearance','直饮柜前缘至中部小间东侧界面',obj('public-water',2),{kind:'object',objectId:'f2-opening-16',edge:3},'horizontal'),
  measurement('stair-hall-clearance','过厅分隔前缘 → 楼梯',obj('private-hall-infill',2),{kind:'object',objectId:'f2-stairs',edge:0},'vertical'),
 );
 if(kind==='window')f.measurements!.push(measurement('lounger-side-clearance','躺椅至阳台洞口内侧线（两区连通）',{kind:'object',objectId:'f2-opening-18',edge:1},obj('lounger',3),'horizontal'),measurement('lounger-window-setback','躺椅至窗内侧留缝',obj('lounger',1),{kind:'object',objectId:'f2-opening-05',edge:3},'horizontal',false),measurement('makeup-chair-window','化妆椅后至窗内侧（紧凑坐位）',obj('makeup-chair',0),{kind:'object',objectId:'f2-opening-05',edge:3},'horizontal'));
 const routes:RouteSpec[]=[
  {id:id('route-bedroom'),name:'公共过厅 → 衣帽间 → 新床尾进入区',points:[point(5710,4010),point(5710,2940),point(5700,1730),point(6710,1350),local('bed',[1050,2811])],target:900},
  {id:id('route-night-wc'),name:'床侧 → 夜间如厕门前',points:[local('bed',[2400,1197]),point(6750,1450),point(5700,1750),point(3900,1650),point(2700,1650),point(2700,1950)],target:800},
  {id:id('route-vanity'),name:'衣帽间 → 双人洗漱',points:[point(5700,2850),point(5700,1750),point(4350,1550),local('double-vanity',[870,1017])],target:800},
  {id:id('route-bath'),name:'洗漱干区 → 浴缸照护 / 淋浴入口',points:[point(3950,1550),point(2900,1550),point(1700,1550),local('tub',[500,1490])],target:800},
  {id:id('route-balcony'),name:kind==='window'?'床尾 → 阳台中部进入位置':'床尾 → 阳台主要通行',points:kind==='window'?[local('bed',[1050,2811]),point(10150,2000),point(10620,3400),point(11200,3400)]:[local('bed',[1050,2811]),point(10150,2000),point(10800,3000),point(11200,3000)],target:800},
  {id:id('route-water'),name:'公共过厅 → 直饮柜取用',points:[point(5710,4010),point(6495,4300),point(6495,5050),local('public-water',[490,1033])],target:800},
  {id:id('route-south-bedroom'),name:'公共过厅 → 中部取水区 → 东南卧室',points:[point(5710,4010),point(6495,4300),point(6495,5350),point(7330,5350)],target:800},
 ];if(kind==='window')routes.push({id:id('route-makeup'),name:'床尾 → 阳台化妆位进入带（起坐另看状态）',points:[local('bed',[1050,2811]),point(10150,2000),point(10620,3400),point(11250,3420)],target:800});f.routes!.push(...routes);
 const regions:RegionSpec[]=[
  {id:id('private-region'),name:'主卧套间圈定净区（原标39.2㎡）',closed:true,points:[[910,99],[4401,99],[4401,203],[10411,203],[10411,1001],[11899,1001],[11899,4711],[7110,4711],[7110,3309],[3408,3309],[3408,3413],[880,3413],[880,1950],[910,1950]]},
 ];f.regions!.push(...regions);
 f.note=`${suiteComparison(kind).title}：原39.2㎡标注范围全部归主卧，原0.8㎡与衣帽区连通、朝过厅旧门拟封闭；另将中部原2㎡小间作为公共直饮与杂物区，北门及东侧卧室开口保留。原图面积与方案圈定计算分开。床头床尾对调，2100×2250床架旋转180°且床头贴图纸下侧墙，方案高度未据现场确认。门扇/柜门/化妆椅使用状态可切换；所有净距仅反映当前几何，不代表结构或施工已核实。`;
 state.warnings=Array.from(new Set([...state.warnings,'主卧套间为可编辑概念研究：拟拆墙结构、湿区排水、防水、满水浴缸荷载和实际层高须专业复核；源图39.2㎡是原标注相加。']));
 return state;
}

/** Live facts only: comparisons do not silently turn a provisional use zone into clearance approval. */
export function inspectMasterSuite(state:State){
 const floor=state.floors.find(f=>f.id==='f2');if(!floor)return null;
 const desk=floor.pieces.find(p=>p.id===id('makeup-desk'));if(!desk)return null;
 const scene=computeScene(floor),kind:MasterSuiteKind=floor.pieces.some(p=>p.id===id('lounger'))||desk.name.includes('阳台窗侧')?'window':'dry';
 const wardrobes=floor.pieces.filter(p=>p.visible!==false&&p.id.startsWith(id('wardrobe-')));
 const physical=floor.pieces.filter(p=>p.visible!==false&&p.type==='furniture'&&p.id.startsWith(masterSuitePrefix)&&p.elevationMm===0);
 const overlaps:{a:string;b:string;areaMm2:number}[]=[];
 for(let a=0;a<physical.length;a++)for(let b=a+1;b<physical.length;b++){
  const A=pieceShapes(physical[a]).filter(s=>s.kind!=='operation'),B=pieceShapes(physical[b]).filter(s=>s.kind!=='operation');
  const area=A.reduce((sum,s)=>sum+B.reduce((v,t)=>v+multiArea(intersection([[s.ring]],[[t.ring]])),0),0);
  if(area>1)overlaps.push({a:physical[a].id,b:physical[b].id,areaMm2:area});
 }
 const dimensions:Dimension[]=(floor.measurements||[]).filter(m=>m.id.startsWith(masterSuitePrefix)).map(m=>measureSpec(floor,m,scene));
 return {kind,wardrobeFacadeMm:wardrobes.reduce((sum,p)=>sum+p.w,0),wardrobeFootprintM2:wardrobes.reduce((sum,p)=>sum+p.w*p.h/1e6,0),dimensions,overlaps,sceneValid:scene.valid,privateAreaM2:scene.rooms.find(r=>r.id===id('private-region'))?.area??null,pending:suiteComparison(kind).pending};
}
