import {EXERCISES, MUSCLES, DAYS, DEFAULT_INVENTORY, STARTER_PLAN} from './catalog.js';
import {inventoryTotal} from './solver.js';
import {solveSeparated} from './pulley-solver.js';
import {fetchExerciseCatalog, EXERCISE_DB_SOURCE} from './exercise-db.js';
import {firebaseConfig} from '../firebase-config.js';

const $=selector=>document.querySelector(selector);
const root=$('#root');
const localKey='forgefit-local-v1';
const themeKey='forgefit-preferred-theme-v1';
const THEMES=[
 {id:'verde',name:'Verde oscuro',a:'#111b20',b:'#a6f1d9',mode:'dark'},
 {id:'azul',name:'Azul oscuro',a:'#111e32',b:'#93c8ff',mode:'dark'},
 {id:'rojo',name:'Rojo oscuro',a:'#28171c',b:'#ffa1a9',mode:'dark'},
 {id:'amarillo',name:'Amarillo oscuro',a:'#242016',b:'#ffe19c',mode:'dark'},
 {id:'rosa',name:'Rosa oscuro',a:'#281925',b:'#ffb3d9',mode:'dark'},
 {id:'morado',name:'Morado oscuro',a:'#211c33',b:'#c9b7ff',mode:'dark'},
 {id:'verde-claro',name:'Verde claro',a:'#ffffff',b:'#177a5b',mode:'light'},
 {id:'azul-claro',name:'Azul claro',a:'#ffffff',b:'#205fa9',mode:'light'},
 {id:'rojo-claro',name:'Rojo claro',a:'#ffffff',b:'#b52d46',mode:'light'},
 {id:'amarillo-claro',name:'Amarillo claro',a:'#ffffff',b:'#886000',mode:'light'},
 {id:'rosa-claro',name:'Rosa claro',a:'#ffffff',b:'#a82b73',mode:'light'},
 {id:'morado-claro',name:'Morado claro',a:'#ffffff',b:'#7044b2',mode:'light'},
 {id:'claro',name:'Blanco y negro',a:'#ffffff',b:'#19232d',mode:'light'}
];
const validTheme=v=>THEMES.some(t=>t.id===v)?v:'verde';
function applyTheme(id){
 const theme=validTheme(id);
 const mode=THEMES.find(t=>t.id===theme).mode;
 document.documentElement.dataset.theme=theme;
 document.documentElement.dataset.mode=mode;
 try{localStorage.setItem(themeKey,theme);}catch{}
 const meta=document.querySelector('meta[name=theme-color]');
 if(meta)meta.setAttribute('content',mode==='light'?'#ffffff':'#090d14');
}

const defaultAlloc=Object.fromEntries([[10,3],[5,4],[3,1],[2.5,3],[2,8],[1.5,2],[1.25,2],[1,12],[0.5,1]].map(([w,n])=>[String(w),n]));
const configured=Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value??0).toLocaleString('es-ES',{maximumFractionDigits:2});
const kg=value=>fmt(value)+' kg';
const uid=()=>crypto?.randomUUID?.() ?? ('id'+Math.random().toString(36).slice(2));
const toInt=(v,min=0,max=999)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
const toNum=(v,min=0,max=9999)=>Math.max(min,Math.min(max,Math.round((Number(v)||0)*100)/100));
const currentDay=()=>DAYS[(new Date().getDay()+6)%7];
const today=()=>new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
const stamp=()=>new Date().toISOString();
const defaultData=()=>({version:2,theme:'verde',profile:{name:'Deportista',goal:'Ganar fuerza'},inventory:clone(DEFAULT_INVENTORY),routine:clone(STARTER_PLAN),customExercises:[],pulleyAllocation:clone(defaultAlloc),savedLoads:[],bodyRecords:[],nutritionRecords:[]});
function normalize(data){
 const initial=defaultData();
 const d=(data && typeof data==='object')?data:{};
 const inventory=Array.isArray(d.inventory)?d.inventory:initial.inventory;
 const allocation={...initial.pulleyAllocation,...(d.pulleyAllocation||{})};
 for(const p of inventory) allocation[String(p.kg)]=toInt(allocation[String(p.kg)]??Math.floor(p.count/2),0,p.count);
 return {...initial,...d,theme:validTheme(d.theme),profile:{...initial.profile,...(d.profile||{})},inventory,
  routine:{...initial.routine,...(d.routine||{})},customExercises:Array.isArray(d.customExercises)?d.customExercises:[],
  pulleyAllocation:allocation,savedLoads:Array.isArray(d.savedLoads)?d.savedLoads:[],
  bodyRecords:Array.isArray(d.bodyRecords)?d.bodyRecords:[],
  nutritionRecords:Array.isArray(d.nutritionRecords)?d.nutritionRecords:[]};
}
function readDemo(){try{return normalize(JSON.parse(localStorage.getItem(localKey)||'null')?.data);}catch{return defaultData();}}
function readLogs(){try{return JSON.parse(localStorage.getItem(localKey)||'null')?.logs||[];}catch{return [];}}
const state={page:'inicio',day:currentDay(),muscle:'Todos',search:'',visibleCatalog:36,remoteExercises:[],remoteState:'loading',
 demo:!configured,user:null,authMode:'login',authBusy:false,
 data:readDemo(),logs:readLogs(),modal:null,toast:'',calcPole1:40,calcPole2:40,calcBusy:false,calcResult:null,
 training:false,draft:{},progressTab:'cuerpo',bodyMetric:'weight',nutritionMetric:'calories',loading:configured,cloudError:'',firebase:null,unsubs:[],saveTimer:null,savePending:false,
  remoteReady:false,syncedData:null,saveInFlight:false,saveQueued:false,currentSavePromise:null,writeLocked:false,saveError:'',authGeneration:0,saveRetryCount:0,syncIssue:''};

try{applyTheme(localStorage.getItem(themeKey)||'verde');}catch{applyTheme('verde');}

const paths={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
 dumbbell:'<path d="m6.5 6.5 11 11m-13-9 4-4m7 15 4-4M3 11l8-8m2 18 8-8"/>',
 calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2m4 0h2M8 14h2m4 0h2m-8 4h2m4 0h2"/>',
 chart:'<path d="M3 3v18h18M7 15l4-5 4 3 5-7"/>',
 settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 1.2 1.1-2 3.5-1.6-.5a8 8 0 0 1-2.2 1.3l-.4 1.6h-4l-.4-1.6A8 8 0 0 1 7.8 19l-1.6.5-2-3.5L5.4 15a8 8 0 0 1 0-2L4.2 12l2-3.5 1.6.5A8 8 0 0 1 10 7.7l.4-1.7h4l.4 1.7A8 8 0 0 1 17 9l1.6-.5 2 3.5-1.2 1.1a8 8 0 0 1 0 1.9Z" transform="translate(0 -2) scale(1 .95)"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>',
 trash:'<path d="M3 6h18m-2 0-1 15H6L5 6m3-3h8l1 3M10 10v7m4-7v7"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 logout:'<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5m5-4 5-5-5-5m5 5H9"/>',
 edit:'<path d="m4 16 11-11 4 4-11 11-5 1 1-5Z"/><path d="m13 7 4 4"/>',
 search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
 cloud:'<path d="M6 19h12a4 4 0 0 0 1-7.9 7 7 0 0 0-13.6-1A4.5 4.5 0 0 0 6 19Z"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 upload:'<path d="M12 17V5m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 spark:'<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v1"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 play:'<path d="m8 5 11 7-11 7z"/>',
 pause:'<path d="M8 5v14m8-14v14"/>',
 heart:'<path d="M20.8 4.8a5 5 0 0 0-7 0L12 6.5l-1.8-1.7a5 5 0 0 0-7 7l8.8 9 8.8-9a5 5 0 0 0 0-7Z"/>'
};
const I=(name,size=19)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.spark}</svg>`;
const nav=[['inicio','home','Inicio'],['rutina','calendar','Mi rutina'],['ejercicios','dumbbell','Ejercicios'],['calculadora','calculator','Calculadora'],['historial','chart','Progreso'],['ajustes','settings','Ajustes']];
// Biblioteca: fichas y GIFs SOLO de la misma entrada del repositorio.
// Los ejercicios editoriales anteriores siguen disponibles para las rutinas
// existentes, pero no se mezclan con los resultados del catálogo oficial.
function getCatalog(){
 const personal=state.data.customExercises||[];
 return state.remoteState==='ready' ? [...personal,...state.remoteExercises] : [...personal,...EXERCISES];
}
function textMatch(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function searchCatalog(query='',muscle='Todos'){
 const q=textMatch(query).trim();
 const words=q.split(/\s+/).filter(Boolean);
 return getCatalog().filter(ex=>{
   if(muscle!=='Todos'&&ex.muscle!==muscle)return false;
   const haystack=textMatch([ex.name,ex.muscle,ex.equipment,ex.keywords||''].join(' '));
   return words.every(w=>haystack.includes(w));
 });
}
function pool(pole){return state.data.inventory.map(p=>{const n=toInt(state.data.pulleyAllocation[String(p.kg)]??Math.floor(p.count/2),0,p.count);return {kg:p.kg,count:pole===1?n:p.count-n};});}
function poolTotal(pole){return inventoryTotal(pool(pole));}
function stockCount(pole){return pool(pole).reduce((n,p)=>n+p.count,0);}
function invalidateCalc(){state.calcResult=null;}
async function loadRemoteExercises(){
 try{state.remoteExercises=await fetchExerciseCatalog();state.remoteState='ready';}
 catch(e){state.remoteState='unavailable';}
 if((state.page==='ejercicios'||state.modal?.type==='add')&&!state.loading)render();
}
function getEx(id){
 const found=getCatalog().find(x=>x.id===id) || EXERCISES.find(x=>x.id===id);if(found)return found;
 const fallback=Object.values(state.data.routine||{}).flat().find(x=>x?.id===id&&x.snapshot)?.snapshot;
 return fallback?{id,...fallback}: {id,name:'Ejercicio no disponible sin conexión',muscle:'Otros',equipment:'Otro',type:'pull',tip:''};
}
function getList(day=state.day){return Array.isArray(state.data.routine[day])?state.data.routine[day]:[];}
function notify(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.classList.remove('show'),3500);}
// Evita descartar silenciosamente registros anteriores con un esquema distinto.
function validateStoredData(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Datos almacenados con un formato no reconocido. No se ha sobrescrito nada.');
 for(const key of ['inventory','customExercises','savedLoads','bodyRecords','nutritionRecords']){
  if(Object.hasOwn(raw,key)&&!Array.isArray(raw[key]))throw Error(`El campo ${key} tiene un formato inesperado. Se ha bloqueado la escritura para protegerlo.`);
 }
 for(const key of ['bodyRecords','nutritionRecords']){
  if((raw[key]||[]).some(x=>!x||typeof x!=='object'||typeof x.id!=='string'))
   throw Error(`El campo ${key} contiene registros antiguos o incompatibles. No se han eliminado.`);
 }
 if(raw.routine!==undefined){
  if(!raw.routine||typeof raw.routine!=='object'||Array.isArray(raw.routine))throw Error('La rutina tiene un formato inesperado.');
  if(Object.values(raw.routine).some(day=>!Array.isArray(day)))throw Error('Un día de la rutina tiene un formato inesperado.');
 }
 return normalize(raw);
}
// Firestore puede devolver las claves de un mapa en un orden diferente.
// El orden de los ejercicios (arrays) SI importa; el orden de las claves NO.
function canonicalData(value){
 if(Array.isArray(value))return value.map(canonicalData);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalData(value[key])]));
 return value;
}
const sameData=(a,b)=>JSON.stringify(canonicalData(a))===JSON.stringify(canonicalData(b));
// Cada día de rutina se considera independiente: editar el lunes no escribe el martes.
function dataChanges(before,after){
 const changes=[];
 for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){
  if(key==='routine'){
   const a=before?.routine||{},b=after?.routine||{};
   for(const day of new Set([...Object.keys(a),...Object.keys(b)])){
    if(!sameData(a[day],b[day]))changes.push({path:['routine',day],before:a[day],value:b[day]});
   }
  }else if(!sameData(before?.[key],after?.[key])){
   changes.push({path:[key],before:before?.[key],value:after?.[key]});
  }
 }
 return changes;
}
function readChange(data,path){return path.reduce((v,key)=>v?.[key],data);}
// Fusionar por intención: nunca enviar una copia obsoleta de una lista entera.
// Cada inserción nueva recibe un entryUid estable; para rutinas anteriores se usa
// id + ordinal para conservar compatibilidad con los documentos existentes.
function keyed(list,kind){
 const seen=new Map();const result=new Map();
 for(const item of (list||[])){
  if(!item||typeof item!=='object')continue;
  let key;
  if(kind==='routine'){
   if(typeof item.entryUid==='string'&&item.entryUid)key='uid:'+item.entryUid;
   else{const raw=String(item.id||'desconocido');const count=seen.get(raw)||0;seen.set(raw,count+1);key='legacy:'+raw+':'+count;}
  }else if(kind==='inventory')key='kg:'+String(item.kg);
  else if(typeof item.id==='string'&&item.id)key='id:'+item.id;
  else{const fingerprint=JSON.stringify(canonicalData(item));const count=seen.get(fingerprint)||0;seen.set(fingerprint,count+1);key='legacy:'+fingerprint+':'+count;}
  result.set(key,item);
 }
 return result;
}
function mergeProperties(before,desired,remote){
 const a=(before&&typeof before==='object'&&!Array.isArray(before))?before:{};
 const b=(desired&&typeof desired==='object'&&!Array.isArray(desired))?desired:{};
 const c=(remote&&typeof remote==='object'&&!Array.isArray(remote))?remote:{};
 const result=clone(c);
 for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
  if(sameData(a[key],b[key]))continue;
  if(!Object.hasOwn(b,key)){delete result[key];continue;}
  if(a[key]&&b[key]&&c[key]&&typeof a[key]==='object'&&!Array.isArray(a[key])&&typeof b[key]==='object'&&!Array.isArray(b[key])&&typeof c[key]==='object'&&!Array.isArray(c[key]))
   result[key]=mergeProperties(a[key],b[key],c[key]);
  else result[key]=clone(b[key]);
 }
 return result;
}
function mergeEntries(before,desired,remote,kind){
 const A=keyed(before,kind),B=keyed(desired,kind),C=keyed(remote,kind),result=new Map(C);
 for(const [id,old] of A){
  if(!B.has(id)){
   // Borrado explícito. Si otra sesión lo modificó, conservar sus cambios.
   if(C.has(id)&&sameData(old,C.get(id)))result.delete(id);
  }else if(!sameData(old,B.get(id))){
   // Una edición obsoleta nunca resucita algo que fue borrado en la nube.
   if(C.has(id))result.set(id,mergeProperties(old,B.get(id),C.get(id)));
  }
 }
 for(const [id,item] of B)if(!A.has(id)&&!C.has(id))result.set(id,clone(item));
 // Mantener el orden del servidor, añadiendo entradas nuevas sin descartar otras.
 let order=[...result.keys()];
 if(kind==='routine'){
  const baseOrder=[...A.keys()].filter(k=>B.has(k));
  const userOrder=[...B.keys()].filter(k=>A.has(k));
  if(!sameData(baseOrder,userOrder)){
   const affected=new Set(userOrder);
   let idx=0;
   order=order.map(k=>affected.has(k)?userOrder[idx++]:k);
  }
 }
 return order.filter(k=>result.has(k)).map(k=>clone(result.get(k)));
}
function mergeField(before,desired,remote,path){
 if(sameData(before,desired))return clone(remote);
 const field=path[0];
 if(path.length===2&&field==='routine')return mergeEntries(before,desired,remote,'routine');
 if(['customExercises','bodyRecords','nutritionRecords','savedLoads','inventory'].includes(field))
  return mergeEntries(before,desired,remote,field==='inventory'?'inventory':'id');
 if(before&&desired&&remote&&typeof before==='object'&&!Array.isArray(before)&&typeof desired==='object'&&!Array.isArray(desired)&&typeof remote==='object'&&!Array.isArray(remote))
  return mergeProperties(before,desired,remote);
 // Para un valor escalar editado por dos sesiones, vence la última edición confirmada.
 return clone(desired);
}
function mergeIntent(base,local,remote){
 const result=clone(remote);
 for(const change of dataChanges(base,local)){
  const value=mergeField(change.before,change.value,readChange(result,change.path),change.path);
  if(change.path.length===2){result[change.path[0]]??={};result[change.path[0]][change.path[1]]=value;}
  else result[change.path[0]]=value;
 }
 return result;
}
function lockWrites(message){
 state.writeLocked=true;state.saveError=message;state.syncIssue='';state.savePending=false;
 clearTimeout(state.saveTimer);render();
}
function retryableSaveError(e){
 const code=String(e?.code||'');
 return ['unavailable','deadline-exceeded','aborted','resource-exhausted','cancelled','network-request-failed'].some(x=>code.includes(x));
}
function saveData(){
 if(state.demo||!configured){localStorage.setItem(localKey,JSON.stringify({data:state.data,logs:state.logs}));return;}
 if(!state.user||!state.firebase||!state.remoteReady||state.writeLocked){
  notify('Guardado bloqueado para proteger tus datos. Exporta una copia y revisa la conexión.');return;
 }
 state.savePending=true;state.syncIssue='';state.saveRetryCount=0;clearTimeout(state.saveTimer);
 state.saveTimer=setTimeout(()=>{void flushData();},600);
}
async function flushData(){
 if(state.saveInFlight){state.saveQueued=true;return state.currentSavePromise;}
 if(!state.savePending||!state.user||!state.firebase||!state.remoteReady||state.writeLocked)return;
 const before=clone(state.syncedData),captured=clone(state.data),changes=dataChanges(before,captured);
 if(!changes.length){state.savePending=false;state.saveQueued=false;state.syncIssue='';state.saveRetryCount=0;render();return;}
 const generation=state.authGeneration,ownerUid=state.user.uid,{api,db}=state.firebase;
 const ref=api.doc(db,'users',ownerUid,'data','main');
 state.saveInFlight=true;state.syncIssue='';
 let planRetry=false;
 const task=api.runTransaction(db,async transaction=>{
  const snapshot=await transaction.get(ref);
  if(generation!==state.authGeneration||state.user?.uid!==ownerUid)throw Error('La sesión cambió durante el guardado.');
  if(!snapshot.exists())throw Error('El documento ha desaparecido del servidor. No se ha sobrescrito nada.');
  const server=validateStoredData(snapshot.data());
  const merged=mergeIntent(before,captured,server);
  const updates={};
  for(const change of dataChanges(server,merged)){
   if(change.value===undefined)continue;
   updates[change.path.join('.')]=change.value;
  }
  if(Object.keys(updates).length)transaction.update(ref,updates);
  return merged;
 });
 state.currentSavePromise=task;
 try{
  const saved=await task;
  if(generation!==state.authGeneration||state.user?.uid!==ownerUid)return;
  state.syncedData=clone(saved);
  state.data=mergeIntent(captured,state.data,saved);
  state.syncIssue='';state.saveRetryCount=0;
  if(!dataChanges(state.syncedData,state.data).length){state.savePending=false;state.saveQueued=false;}
  else{state.savePending=true;state.saveQueued=true;}
  render();
 }catch(e){
  if(generation===state.authGeneration){
   if(retryableSaveError(e)){
    state.savePending=true;
    state.saveRetryCount++;
    planRetry=state.saveRetryCount<=4;
    state.syncIssue='Firebase no ha confirmado el guardado: '+humanError(e)+'. '+(planRetry?'Se reintentará de forma segura.':'Pulsa Reintentar o exporta una copia antes de cerrar.');
    render();
   }else{
    lockWrites('No se han guardado cambios: '+humanError(e)+'. Los datos que ves pueden ser locales. Exporta una copia antes de recargar.');
   }
  }
 }finally{
  if(generation===state.authGeneration){
   state.saveInFlight=false;state.currentSavePromise=null;
   if(!state.writeLocked&&state.savePending){
    clearTimeout(state.saveTimer);
    if(planRetry){const ms=Math.min(state.saveRetryCount*1500,8000);state.saveTimer=setTimeout(()=>{void flushData();},ms);}
    else if(state.saveQueued&&!state.syncIssue){state.saveQueued=false;state.saveTimer=setTimeout(()=>{void flushData();},0);}
   }
  }
 }
}
async function saveLog(log){
 if(state.demo||!configured){state.logs=[log,...state.logs].slice(0,200);saveData();return true;}
 if(!state.user||!state.firebase||!state.remoteReady||state.writeLocked){notify('No se puede guardar el entrenamiento sin sincronización.');return false;}
 const {api,db}=state.firebase,ownerUid=state.user.uid;
 try{await api.setDoc(api.doc(db,'users',ownerUid,'logs',log.id),log);return true;}
 catch(e){notify('Error al guardar el entrenamiento: '+humanError(e));return false;}
}
function humanError(e){const c=e?.code||'';
 if(c.includes('invalid-email'))return 'Correo no válido';
 if(c.includes('email-already-in-use'))return 'Ese correo ya tiene una cuenta';
 if(c.includes('weak-password'))return 'Usa una contraseña más larga (mínimo 6 caracteres)';
 if(c.includes('invalid-credential'))return 'Correo o contraseña incorrectos';
 if(c.includes('permission-denied'))return 'Revisa las reglas de Firestore';
 if(c.includes('unauthorized-domain'))return 'Añade el dominio GitHub Pages a Firebase Authentication';
 if(c.includes('network'))return 'Comprueba tu conexión';
 return e?.message||'Error inesperado';
}

function header(){
 const label=state.page==='inicio'?'Tu espacio de entrenamiento':nav.find(x=>x[0]===state.page)?.[2]||'ForgeFit';
 return `<header class="topbar"><div><div class="eyebrow">${state.page==='inicio'?esc(today()):'FORGEFIT / ENTRENAMIENTO'}</div><h1>${esc(label)}</h1></div><div class="top-actions"><span class="cloud-state">${I(state.demo?'info':'cloud',15)} ${state.demo?'Local':state.writeLocked?'Guardado bloqueado':state.syncIssue?'Sin confirmar':(state.savePending||state.saveInFlight)?'Guardando…':state.remoteReady?'Sincronizado':'Conectando…'}</span><button class="avatar" title="Ajustes" data-nav="ajustes">${esc((state.data.profile.name||'T').slice(0,1).toUpperCase())}</button></div></header>`;
}
function sidebar(){return `<aside class="sidebar"><button class="brand" data-nav="inicio"><span class="brand-icon">${I('dumbbell',27)}</span><span><strong>FORGE<span>FIT</span></strong><small>TRAIN YOUR WAY</small></span></button><div class="sidebar-label">TU ESPACIO</div><nav class="desktop-nav">${nav.map(([page,ico,title])=>`<button class="navlink ${state.page===page?'active':''}" data-nav="${page}">${I(ico)}<span>${title}</span>${state.page===page?'<i></i>':''}</button>`).join('')}</nav><div class="sidebar-foot"><div class="sidebar-quote"><span>${I('bolt')}</span><strong>Cada repetición cuenta.</strong><small>Hazlo por ti.</small></div><small>v7 · Sincronización multisesión</small></div></aside>`;}
function mobileNav(){return `<nav class="mobile-nav" aria-label="Secciones">${nav.slice(0,5).map(([page,ico,title])=>`<button data-nav="${page}" class="${state.page===page?'active':''}">${I(ico,21)}<small>${page==='calculadora'?'Discos':page==='ejercicios'?'Buscar':title.replace('Mi ','')}</small></button>`).join('')}</nav>`;}
function stat(label,value,ico,detail){return `<div class="stat-card"><span class="stat-icon">${I(ico,20)}</span><small>${esc(label)}</small><strong>${esc(value)}</strong><span class="stat-detail">${esc(detail||'')}</span></div>`;}
function routineCard(item,index,day=state.day,editable=true){
 const ex=getEx(item.id);const isCable=ex.equipment==='Polea';
 return `<article class="routine-card"><div class="routine-pos">${index+1}</div>${art(ex,'tiny')}<div class="routine-info"><h3>${esc(ex.name)}</h3><p>${esc(ex.muscle)} <span>·</span> ${esc(ex.equipment)}</p><div class="chips"><span>${toInt(item.sets,1,20)} series</span><span>${toInt(item.reps,1,999)} reps</span><span>${fmt(item.kg)} kg</span>${isCable?'<span class="chip-accent">Polea</span>':''}</div></div>${editable?`<div class="routine-actions"><button title="Editar peso, series y repeticiones" aria-label="Editar ejercicio" data-action="edit-routine" data-day="${esc(day)}" data-index="${index}">${I('edit',17)}</button><button title="Cambiar por ejercicio con GIF correcto" aria-label="Cambiar ejercicio" data-action="replace-routine" data-day="${esc(day)}" data-index="${index}">${I('search',17)}</button><button aria-label="Subir ejercicio" title="Subir" ${index===0?'disabled':''} data-action="move" data-dir="-1" data-day="${esc(day)}" data-index="${index}">${I('up',17)}</button><button aria-label="Bajar ejercicio" title="Bajar" ${index===getList(day).length-1?'disabled':''} data-action="move" data-dir="1" data-day="${esc(day)}" data-index="${index}">${I('down',17)}</button><button aria-label="Eliminar ejercicio" title="Eliminar" data-action="delete-routine" data-day="${esc(day)}" data-index="${index}">${I('trash',17)}</button></div>`:`<button class="subtle-btn" data-action="detail" data-id="${esc(ex.id)}">Ver ${I('chevron',15)}</button>`}</article>`;
}
function art(ex,size='normal'){
 if(ex.media && /^https:\/\//i.test(ex.media))return `<div class="exercise-art ${size} media-art"><img loading="lazy" decoding="async" src="${esc(ex.media)}" alt="Demostración: ${esc(ex.name)}" referrerpolicy="no-referrer"/><span class="media-unavailable" hidden>GIF no disponible</span></div>`;
 const hash=[...ex.name].reduce((s,c)=>s+c.charCodeAt(0),0);
 const accents=['#7fcab4','#d5b7ff','#ffba92','#85adf8','#f1cf93'];
 const accent=accents[hash%accents.length];
 const pose=ex.type||'push';
 const arms=pose==='raise'?'<path d="M44 49 26 32M64 49 82 32"/>':pose==='curl'?'<path d="M44 49 30 65 23 49M64 49 78 65 85 49"/>':pose==='squat'?'<path d="M44 49 35 58M64 49 73 58"/>':pose==='core'?'<path d="M43 50 28 63M65 50 82 63"/>':'<path d="M44 49 25 55M64 49 83 55"/>';
 const legs=pose==='squat'?'<path d="M47 85 34 91 27 105M61 85 74 91 81 105"/>':pose==='core'?'<path d="M47 85 37 88 25 90M61 85 77 81 92 83"/>':'<path d="M47 85 42 106M61 85 66 106"/>';
 return `<div class="exercise-art ${size}" style="--art-accent:${accent}"><svg viewBox="0 0 108 112" role="img" aria-label="Ilustración de ejercicio"><circle cx="54" cy="29" r="12" fill="${accent}" opacity=".8"/><path d="M54 43v39 M43 50l11-5 11 5 M46 85h16 ${arms.replaceAll('M',' M')} ${legs.replaceAll('M',' M')}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="M19 107h70" stroke="${accent}" stroke-opacity=".2" stroke-width="2"/></svg><span class="art-shine"></span></div>`;
}
function dashboard(){const day=currentDay(),list=getList(day),count=DAYS.reduce((s,d)=>s+getList(d).length,0),weekSessions=state.logs.filter(x=>Date.now()-new Date(x.date).getTime()<7*86400000).length;
 return `<section class="hero"><div class="hero-copy"><div class="hero-kicker">${I('spark',17)} TU MEJOR VERSIÓN EMPIEZA HOY</div><h2>Más fuerte.<br/><em>A tu ritmo.</em></h2><p>Organiza tus entrenamientos, controla tus progresos y deja que la calculadora haga las cuentas.</p><button class="btn btn-bright" data-nav="rutina">Ver mi rutina ${I('arrow',19)}</button></div><div class="hero-graphic"><div class="hero-orbit one"></div><div class="hero-orbit two"></div><div class="hero-weight"><span class="bar"></span><span class="plate p1"></span><span class="plate p2"></span><span class="plate p3"></span><span class="plate p4"></span></div><span class="hero-badge">BUILD<br/>YOUR<br/>STRENGTH</span></div></section>
 <div class="metrics">${stat('Ejercicios en tu plan',String(count),'dumbbell','Tu semana actual')}${stat('Entrenos últimos 7 días',String(weekSessions),'calendar','Sesiones registradas')}${stat('Discos disponibles',kg(inventoryTotal(state.data.inventory)),'calculator','Inventario total')}</div>
 <div class="section-head"><div><div class="eyebrow">HOY · ${esc(day.toUpperCase())}</div><h2>Tu entrenamiento de hoy</h2></div><button class="text-link" data-nav="rutina">Organizar semana ${I('arrow',16)}</button></div>
 <div class="dashboard-grid"><div class="panel"><div class="panel-heading"><h3>${list.length?`${list.length} ejercicios preparados`:'Día de descanso'}</h3><span class="mini-icon">${I('target')}</span></div>${list.length?list.slice(0,4).map((e,i)=>routineCard(e,i,day,false)).join(''):`<div class="empty mini">${I('heart',26)}<h3>Recarga energía</h3><p>No tienes ejercicios planificados para hoy.</p></div>`}<div class="panel-bottom"><button class="btn btn-primary" data-action="start-today" data-day="${esc(day)}" ${!list.length?'disabled':''}>${I('play',17)} Empezar entrenamiento</button></div></div>
 <div class="quick-card"><div class="quick-icon">${I('calculator',26)}</div><div><span class="eyebrow">TU ASISTENTE DE CARGA</span><h3>¿Cuántos discos pongo?</h3><p>Equilibra automáticamente los 4 lados de tus dos poleas con los discos que tienes.</p></div><button class="btn btn-outline-light" data-nav="calculadora">Abrir calculadora ${I('arrow',17)}</button><div class="quick-lines"></div></div></div>`;}
function weekView(){return `<div class="section-intro"><div><p>PERSONALIZA TU PROGRAMA</p><h2>Tu semana, tus reglas.</h2><span>Organiza los ejercicios y el peso de cada día. Todo se guarda automáticamente.</span></div><button class="btn btn-primary" data-action="add" data-day="${esc(state.day)}">${I('plus',18)} Añadir ejercicio</button></div>
 <div class="days-tabs" role="group" aria-label="Elige el día de entrenamiento">${DAYS.map(d=>`<button type="button" data-dayselect="${esc(d)}" aria-pressed="${state.day===d}" class="day-tab ${state.day===d?'active':''}"><span class="day-name">${esc(d)}</span><small>${getList(d).length} ${getList(d).length===1?'ejercicio':'ejercicios'}</small></button>`).join('')}</div>
 <div class="mobile-day-navigation"><button type="button" data-action="day-step" data-value="-1" aria-label="Día anterior">${I('up',17)} Anterior</button><strong>${esc(state.day)}</strong><button type="button" data-action="day-step" data-value="1" aria-label="Día siguiente">Siguiente ${I('down',17)}</button></div>
 <div class="week-head"><div><div class="eyebrow">ENTRENAMIENTO</div><h2>${esc(state.day)} <span class="muted">/ ${getList().length} ejercicios</span></h2></div>${getList().length?`<button class="btn btn-secondary" data-action="start-today" data-day="${esc(state.day)}">${I('play',16)} Entrenar</button>`:''}</div>
 <div class="routine-list">${getList().length?getList().map((item,i)=>routineCard(item,i)).join(''):`<div class="empty">${I('calendar',36)}<h3>Hoy no hay ejercicios</h3><p>Añade un ejercicio para empezar a construir tu rutina.</p><button class="btn btn-primary" data-action="add" data-day="${esc(state.day)}">${I('plus',16)} Añadir ejercicio</button></div>`}</div>
 ${getList().length?`<button class="add-dashed" data-action="add" data-day="${esc(state.day)}">${I('plus',19)} Añadir otro ejercicio</button>`:''}`;}
function catalogCards(arr){return arr.map(ex=>`<article class="exercise-card">${art(ex)}<div class="exercise-card-body"><div class="exercise-topline">${esc(ex.muscle)} <span>·</span> ${esc(ex.equipment)}</div><h3>${esc(ex.name)}</h3><div class="exercise-card-actions"><button class="small-link" data-action="detail" data-id="${esc(ex.id)}">Ver detalles ${I('chevron',14)}</button><button class="circle-add" data-action="add-one" data-id="${esc(ex.id)}" title="Añadir a ${esc(state.day)}">${I('plus',17)}</button></div></div></article>`).join('');}
function library(){
 const options=searchCatalog(state.search,state.muscle);
 const shown=options.slice(0,state.visibleCatalog);
 return `<div class="section-intro"><div><p>ENCUENTRA TU SIGUIENTE EJERCICIO</p><h2>Ejercicios con su GIF real.</h2><span>${getCatalog().length} fichas para tus rutinas. Cada GIF corresponde a su ficha original.</span></div><button class="btn btn-primary" data-action="custom">${I('plus',18)} Crear mi ejercicio</button></div>
 <div class="catalog-tools"><label class="search-box">${I('search',19)}<input id="searchExercises" data-search="1" type="search" autocomplete="off" placeholder="Busca por nombre, músculo o material..." value="${esc(state.search)}" /></label><div class="filter-scroll">${MUSCLES.map(m=>`<button class="filter-pill ${state.muscle===m?'active':''}" data-muscle="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>
 <div class="catalog-count">${options.length} ejercicios encontrados ${state.remoteState==='loading'?'· Cargando GIFs del catálogo externo…':state.remoteState==='unavailable'?'· Sin conexión al catálogo; se muestran los ejercicios antiguos sin GIF verificado.':''}</div>
 <div id="catalogGrid" class="exercise-grid">${shown.length?catalogCards(shown):'<div class="empty"><h3>No hay coincidencias</h3><p>Prueba con otro nombre o crea tu propio ejercicio.</p></div>'}</div>
 <div id="catalogMore">${options.length>shown.length?`<button class="btn btn-secondary catalog-more" data-action="more-catalog">${I('plus',17)} Mostrar más (${options.length-shown.length} restantes)</button>`:''}</div>
 <p class="helper-note">${I('info',16)} Nombres y GIFs emparejados por el identificador exacto del ejercicio. Los GIFs se cargan desde <a href="${EXERCISE_DB_SOURCE}" target="_blank" rel="noopener noreferrer">ExerciseGymGifsDB</a>. Necesitas conexión para verlos. Los ejercicios personalizados se guardan en tu cuenta.</p>`;
}
function cableDiagram(bars){const positions=bars===4?[88,264]:[176];return `<svg class="machine-diagram" viewBox="0 0 352 190" role="img" aria-label="Máquina con ${bars===4?'dos poleas y cuatro barras':'una polea y dos barras'}"><defs><linearGradient id="steel" x1="0" x2="1"><stop stop-color="#78919b"/><stop offset=".5" stop-color="#c6d3d9"/><stop offset="1" stop-color="#61747d"/></linearGradient></defs>${positions.map((cx,index)=>`<g><rect x="${cx-49}" y="19" width="98" height="144" rx="9" fill="#192a32" stroke="#5c7780" stroke-opacity=".65" stroke-width="2"/><path d="M${cx} 19V162" stroke="url(#steel)" stroke-width="7"/><circle cx="${cx}" cy="37" r="11" fill="#718d95" stroke="#bbced1"/><path d="M${cx-70} 111H${cx+70}" stroke="url(#steel)" stroke-width="9" stroke-linecap="round"/>${[-1,1].map(d=>`<rect x="${cx+d*56-5}" y="90" width="10" height="44" rx="2" fill="#8de0c6"/><rect x="${cx+d*41-5}" y="96" width="10" height="32" rx="2" fill="#4f998c"/>`).join('')}<text x="${cx}" y="182" fill="#acbec3" font-size="12" text-anchor="middle">POLEA ${index+1}</text></g>`).join('')}</svg>`;}
function calcResultMarkup(){
 const r=state.calcResult;
 if(state.calcBusy)return `<div class="calc-placeholder">${I('clock',31)}<h3>Buscando una distribución…</h3><p>Comprobando los discos de cada soporte por separado.</p></div>`;
 if(!r)return `<div class="calc-placeholder">${I('target',34)}<h3>Prepara las dos poleas</h3><p>Indica la carga total de cada polea y pulsa calcular. Ninguna utilizará los discos de la otra.</p></div>`;
 if(!r.ok)return `<div class="calc-placeholder calc-error">${I('info',31)}<h3>No se puede equilibrar</h3><p>${esc(r.error)}</p></div>`;
 return `<div class="result-head"><div><span class="eyebrow">REPARTO EXACTO · INVENTARIOS SEPARADOS</span><h3>${kg(r.actualTotal)} <small>en total</small></h3><p>Polea 1: ${kg(r.totals[0])} · Polea 2: ${kg(r.totals[1])}</p></div><span class="success-tag">${I('check',16)} Equilibrado</span></div>
 <div class="pulley-results">${[0,1].map(p=>`<section class="pulley-result"><div class="pulley-result-title"><strong>Polea ${p+1}</strong><span>${kg(r.totals[p])} total · ${kg(r.totals[p]/2)} por lado</span></div>
 <div class="load-grid">${[0,1].map(b=>{const side=r.loads[p*2+b];return `<div class="load-box"><span class="load-index">${b===0?'⬅ Barra izquierda':'Barra derecha ➡'}</span><strong>${kg(r.totals[p]/2)}</strong><div class="load-plates">${side.length?side.map(x=>`<span>${x.count} × ${fmt(x.kg)} kg</span>`).join(''):'<span>Sin discos</span>'}</div><small>${r.plateCounts[p*2+b]} discos</small></div>`;}).join('')}</div>
 <div class="remaining-pool">En el soporte de la polea ${p+1} sobran ${kg(inventoryTotal(r.leftovers[p]))}${r.leftovers[p].length?`: ${r.leftovers[p].map(x=>`${x.count} × ${fmt(x.kg)} kg`).join(', ')}`:''}</div></section>`).join('')}</div>
 <div class="calc-actions"><button class="btn btn-secondary" data-action="save-load">${I('heart',17)} Guardar esta combinación</button></div>
 <div class="notice success">${I('check',18)} Cada polea usa solamente sus discos reservados. Izquierda y derecha tienen exactamente el mismo peso dentro de cada polea.</div>`;
}
function calculator(){
 const inv=state.data.inventory;const saved=state.data.savedLoads||[];
 return `<div class="section-intro"><div><p>CALCULADORA CON INVENTARIOS INDEPENDIENTES</p><h2>Tus discos, siempre equilibrados.</h2><span>Primero reparte tus discos entre los dos soportes fijos. Después calcula las dos barras de cada polea.</span></div></div>
 <div class="split-overview"><div><span>Inventario completo</span><strong>${kg(inventoryTotal(inv))}</strong><small>${inv.reduce((s,p)=>s+p.count,0)} discos en total</small></div><div><span>Soporte polea 1</span><strong>${kg(poolTotal(1))}</strong><small>${stockCount(1)} discos reservados</small></div><div><span>Soporte polea 2</span><strong>${kg(poolTotal(2))}</strong><small>${stockCount(2)} discos reservados</small></div></div>
 <div class="calc-grid split-layout"><div class="panel calc-controls"><div class="panel-heading"><h3>1. Elige los kilos de cada polea</h3><span class="mini-icon">${I('calculator')}</span></div>
 <div class="diagram-wrap">${cableDiagram(4)}</div>
 <div class="pulley-targets"><label>Polea 1 · total de ambas barras<div class="weight-input"><input id="calcPole1" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(state.calcPole1)}"/><span>kg</span></div><small>La mitad en cada barra · máximo reservado ${kg(poolTotal(1))}</small></label><label>Polea 2 · total de ambas barras<div class="weight-input"><input id="calcPole2" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(state.calcPole2)}"/><span>kg</span></div><small>La mitad en cada barra · máximo reservado ${kg(poolTotal(2))}</small></label></div>
 <div class="quick-weights">${[[20,20],[40,40],[60,60],[40,60],[94.5,94]].map(a=>`<button data-action="preset-two" data-first="${a[0]}" data-second="${a[1]}">${fmt(a[0])} + ${fmt(a[1])} kg</button>`).join('')}</div>
 <button class="btn btn-primary full" data-action="calculate" ${state.calcBusy?'disabled':''}>${I('bolt',18)} ${state.calcBusy?'Calculando…':'Calcular los cuatro lados'}</button>
 <p class="helper-note">El valor solicitado es el peso total colocado en cada polea. Se reparte entre su barra izquierda y derecha. Puedes pedir cargas distintas para ambas poleas.</p></div>
 <div class="panel calc-output"><div class="panel-heading"><h3>2. Discos que debes colocar</h3><span class="mini-icon">${I('target')}</span></div>${calcResultMarkup()}</div></div>
 <section class="panel stock-split-panel"><div class="panel-heading"><div><h3>3. Reparto fijo en los dos soportes</h3><p class="helper-note">Esta reserva se mantiene entre entrenamientos. Si cambias el reparto, la calculadora lo respetará al 100 %.</p></div><span class="mini-icon">${I('dumbbell')}</span></div>
 <div class="stock-table-wrap"><table class="stock-table"><thead><tr><th>Disco</th><th>Tienes</th><th>Soporte 1</th><th>Soporte 2</th></tr></thead><tbody>${inv.map(p=>{const n=toInt(state.data.pulleyAllocation[String(p.kg)],0,p.count);return `<tr><td><strong>${fmt(p.kg)} kg</strong></td><td>${p.count}</td><td><input aria-label="Discos de ${fmt(p.kg)} kg asignados a polea 1" data-split-weight="${p.kg}" type="number" min="0" max="${p.count}" step="1" value="${n}"/></td><td>${p.count-n}</td></tr>`;}).join('')}</tbody><tfoot><tr><td>Total</td><td>${kg(inventoryTotal(inv))}</td><td>${kg(poolTotal(1))}</td><td>${kg(poolTotal(2))}</td></tr></tfoot></table></div>
 <div class="settings-buttons"><button class="btn btn-secondary" data-action="split-auto">Repartir automáticamente</button><button class="btn btn-secondary" data-action="split-reset">Restaurar reparto 94,5 / 94 kg</button><button class="btn btn-secondary" data-nav="ajustes">Cambiar mi inventario</button></div>
 <p class="helper-note">El reparto original coloca los 2 discos de 1,25 kg juntos en la polea 1. No mezcla discos entre poleas durante el cálculo. Si ajustas el soporte 1, el soporte 2 recibe el resto.</p></section>
 <section class="panel"><div class="panel-heading"><h3>Combinaciones guardadas</h3><span class="mini-icon">${I('heart')}</span></div>${saved.length?`<div class="saved-load-list">${saved.map((v,i)=>`<div class="saved-load"><div><strong>${esc(v.name)}</strong><small>${kg(v.totals[0])} / ${kg(v.totals[1])}</small></div><div class="settings-buttons"><button class="btn btn-secondary" data-action="use-load" data-index="${i}">Calcular</button><button class="btn btn-secondary" data-action="delete-load" data-index="${i}" aria-label="Eliminar combinación">${I('trash',15)}</button></div></div>`).join('')}</div>`:'<p class="helper-note">Puedes guardar una carga habitual desde el resultado de la calculadora.</p>'}</section>
 <div class="disclaimer">${I('info',17)} La masa de discos no equivale necesariamente a la resistencia efectiva del cable. Comprueba la capacidad máxima de la máquina, la longitud útil de las barras y los cierres de seguridad.</div>`;
}
const BODY_FIELDS=[['fat','Grasa corporal'],['muscle','Masa muscular'],['water','Agua corporal'],['bone','Masa ósea'],['organs','Órganos (si tienes una medición)']];
const BODY_METRICS=[['weight','Peso corporal','kg'],...BODY_FIELDS.map(([id,label])=>[id,label,'kg'])];
function localISODate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function bodyRows(){return [...(state.data.bodyRecords||[])].filter(x=>Number.isFinite(x.weight)&&x.weight>0).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));}
function bodyValue(row,key,unit='kg'){
 if(key==='weight')return row.weight;
 const item=row.measurements?.[key];
 if(!item||!Number.isFinite(item.value))return null;
 if(unit==='kg')return item.unit==='kg'?item.value:row.weight*item.value/100;
 return item.unit==='%'?item.value:item.value/row.weight*100;
}
function bodyValueText(record,field){const kgVal=bodyValue(record,field,'kg'),pctVal=bodyValue(record,field,'%');return kgVal==null?'Sin datos':`${fmt(kgVal)} kg · ${fmt(pctVal)} %`;}
function bodyTrendSvg(rows,metric){
 const data=rows.slice(0,30).reverse().map(r=>({date:r.date,value:bodyValue(r,metric,'kg')})).filter(r=>Number.isFinite(r.value));
 if(data.length===0)return `<div class="empty mini">${I('chart',28)}<p>Añade una medición para ver cómo evoluciona.</p></div>`;
 if(data.length===1)return `<div class="single-body-point"><strong>${fmt(data[0].value)} kg</strong><small>${esc(data[0].date)} · Añade más registros para crear la gráfica.</small></div>`;
 const width=600,height=185,padX=46,top=22,bottom=37;
 const min=Math.min(...data.map(x=>x.value)),max=Math.max(...data.map(x=>x.value));
 const range=Math.max(.5,max-min),lo=Math.max(0,min-range*.22),hi=max+range*.22;
 const points=data.map((d,i)=>({x:padX+i*(width-2*padX)/(data.length-1),y:top+(hi-d.value)*(height-top-bottom)/(hi-lo),...d}));
 const path=points.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
 return `<svg class="body-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución de ${esc(BODY_METRICS.find(x=>x[0]===metric)?.[1]||'peso')} entre ${esc(data[0].date)} y ${esc(data.at(-1).date)}"><path d="M ${padX} ${height-bottom} H ${width-padX}" stroke="var(--border)" stroke-width="1"/><path d="M ${padX} ${top} H ${width-padX}" stroke="var(--theme-line)" stroke-dasharray="4 6"/><text x="4" y="${top+5}" class="body-axis">${fmt(hi)}</text><text x="4" y="${height-bottom+4}" class="body-axis">${fmt(lo)}</text><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--accent)"><title>${esc(p.date)}: ${fmt(p.value)} kg</title></circle>`).join('')}<text x="${padX}" y="${height-8}" class="body-axis">${esc(data[0].date.slice(5))}</text><text x="${width-padX}" y="${height-8}" class="body-axis" text-anchor="end">${esc(data.at(-1).date.slice(5))}</text></svg>`;
}
function progressSwitch(){return `<div class="progress-switch" role="group" aria-label="Sección de progreso"><button data-action="progress-tab" data-value="cuerpo" aria-pressed="${state.progressTab==='cuerpo'}" class="${state.progressTab==='cuerpo'?'active':''}">${I('target',17)} Peso y cuerpo</button><button data-action="progress-tab" data-value="entrenamientos" aria-pressed="${state.progressTab==='entrenamientos'}" class="${state.progressTab==='entrenamientos'?'active':''}">${I('chart',17)} Entrenamientos</button><button data-action="progress-tab" data-value="nutricion" aria-pressed="${state.progressTab==='nutricion'}" class="${state.progressTab==='nutricion'?'active':''}">${I('heart',17)} Nutrición</button></div>`;}
function bodyProgress(){
 const rows=bodyRows(),latest=rows[0],first=rows.at(-1);
 const delta=rows.length>1?latest.weight-first.weight:0;
 return `${progressSwitch()}<div class="body-progress"><div class="section-intro body-intro"><div><p>SEGUIMIENTO PERSONAL</p><h2>Peso y composición corporal</h2><span>Registra tus mediciones y compara tu evolución con el tiempo.</span></div><button class="btn btn-primary" data-action="add-body">${I('plus',17)} Añadir medición</button></div>
 <div class="metrics body-stats">${stat('Peso más reciente',latest?kg(latest.weight):'Sin datos','target',latest?`Registro del ${latest.date}`:'Añade tu primer peso')}${stat('Cambio total',rows.length>1?`${delta>0?'+':''}${fmt(delta)} kg`:'Sin datos','chart',rows.length>1?'Primera y última medición':'Necesitas dos registros')}${stat('Mediciones',String(rows.length),'calendar','Guardadas en tu cuenta')}</div>
 <section class="panel body-chart-panel"><div class="panel-heading"><div><h3>Evolución de tus mediciones</h3><p class="helper-note">Selecciona qué dato quieres visualizar (en kg).</p></div>${I('chart',23)}</div><label class="body-chart-choice">Dato de la gráfica<select id="bodyMetric">${BODY_METRICS.map(([key,label])=>`<option value="${key}" ${state.bodyMetric===key?'selected':''}>${esc(label)}</option>`).join('')}</select></label>${bodyTrendSvg(rows,state.bodyMetric)}</section>
 <div class="section-head"><h2>Tus registros</h2></div>${rows.length?`<div class="body-records">${rows.map(record=>`<article class="body-record"><div class="body-record-top"><div><span class="body-record-date">${esc(record.date)}</span><h3>${fmt(record.weight)} <small>kg</small></h3></div><div class="body-record-actions"><button data-action="edit-body" data-id="${esc(record.id)}" aria-label="Editar medición del ${esc(record.date)}">${I('edit',18)}</button><button data-action="delete-body" data-id="${esc(record.id)}" aria-label="Borrar medición del ${esc(record.date)}">${I('trash',18)}</button></div></div><div class="body-record-values">${BODY_FIELDS.filter(([k])=>bodyValue(record,k)!=null).map(([k,label])=>`<div><small>${esc(label)}</small><strong>${bodyValueText(record,k)}</strong></div>`).join('')||'<span class="muted">Solo peso corporal</span>'}</div>${record.note?`<p class="body-record-note">${esc(record.note)}</p>`:''}</article>`).join('')}</div>`:`<div class="empty"><h3>Aún no hay mediciones</h3><p>Pulsa «Añadir medición» para registrar tu peso y, si los conoces, tus datos de composición corporal.</p></div>`}
 <p class="body-disclaimer">Los porcentajes y kilos se convierten mediante tu peso registrado, pero <strong>la app no estima grasa, músculo, agua, huesos ni órganos solo con el peso</strong>. Introduce datos que te haya proporcionado un dispositivo o profesional. Las mediciones de agua y músculo pueden solaparse, por lo que no se deben sumar todos estos componentes como si fueran partes independientes. Las básculas de bioimpedancia ofrecen estimaciones orientativas.</p></div>`;
}
const NUTRITION_GOALS=[['deficit','Déficit · perder peso'],['mantenimiento','Mantenimiento'],['ganancia','Ganancia · subir peso / masa muscular']];
const NUTRITION_METRICS=[['calories','Calorías','kcal'],['protein','Proteínas','g'],['carbs','Carbohidratos','g'],['fat','Grasas','g']];
const nutritionRows=()=>[...(state.data.nutritionRecords||[])].filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.calories)).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
const macroCalories=r=>4*r.protein+4*r.carbs+9*r.fat;
// El peso proviene del registro más reciente de «Peso y cuerpo».
function latestNutritionWeight(){return bodyRows()[0]||null;}
function calculateNutritionMacros(calories,weight,proteinFactor=1.3,fatFactor=0.8){
 const c=Number(calories),w=Number(weight),p=Number(proteinFactor),f=Number(fatFactor);
 if(!Number.isFinite(c)||!Number.isInteger(c)||c<1||c>10000||!Number.isFinite(w)||w<10||w>600)return {ok:false,reason:'Indica calorías válidas y registra tu peso en Peso y cuerpo.'};
 if(!Number.isFinite(p)||!Number.isFinite(f)||p<0||p>10||f<0||f>10)return {ok:false,reason:'Indica factores de proteínas y grasas entre 0 y 10 g por kg de peso.'};
 const protein=Math.round(p*w*10)/10;
 const fat=Math.round(f*w*10)/10;
 const rest=c-4*protein-9*fat;
 if(rest < -0.001)return {ok:false,reason:`Con ${fmt(w)} kg y esos factores, proteínas y grasas ya necesitan ${fmt(4*protein+9*fat)} kcal. Baja sus factores o aumenta las calorías.`};
 const carbs=Math.max(0,Math.round(rest/4*10)/10);
 return {ok:true,calories:c,weight:w,proteinFactor:p,fatFactor:f,protein,fat,carbs};
}
const nutritionGoalLabel=g=>NUTRITION_GOALS.find(x=>x[0]===g)?.[1]||'Objetivo personalizado';
function nutritionChart(records,metric){
 const selected=NUTRITION_METRICS.find(x=>x[0]===metric)||NUTRITION_METRICS[0];
 const points=records.slice(0,50).reverse().map(r=>({date:r.date,value:Number(r[metric])})).filter(r=>Number.isFinite(r.value));
 if(points.length===0)return `<div class="empty mini">${I('chart',28)}<p>Registra un objetivo para empezar la gráfica.</p></div>`;
 if(points.length===1)return `<div class="single-body-point"><strong>${fmt(points[0].value)} ${selected[2]}</strong><small>${esc(points[0].date)} · Añade otro registro para comparar.</small></div>`;
 const width=620,height=208,left=53,right=23,top=25,bottom=38;
 const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),diff=Math.max(1,max-min),lo=Math.max(0,min-diff*.22),hi=max+diff*.22;
 const pt=points.map((p,i)=>({...p,x:left+i*(width-left-right)/(points.length-1),y:top+(hi-p.value)*(height-top-bottom)/(hi-lo)}));
 const line=pt.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
 return `<svg class="body-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución del objetivo de ${esc(selected[1])} desde ${esc(points[0].date)} hasta ${esc(points.at(-1).date)}"><path d="M${left} ${height-bottom}H${width-right}" stroke="var(--border)"/><path d="M${left} ${top}H${width-right}" stroke="var(--theme-line)" stroke-dasharray="4 6"/><text x="3" y="${top+6}" class="body-axis">${fmt(hi)}</text><text x="3" y="${height-bottom+4}" class="body-axis">${fmt(lo)}</text><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${pt.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="var(--accent)"><title>${esc(p.date)}: ${fmt(p.value)} ${selected[2]}</title></circle>`).join('')}<text x="${left}" y="${height-8}" class="body-axis">${esc(points[0].date.slice(5))}</text><text x="${width-right}" y="${height-8}" text-anchor="end" class="body-axis">${esc(points.at(-1).date.slice(5))}</text></svg>`;
}
function nutritionProgress(){
 const records=nutritionRows(),latest=records[0],metric=NUTRITION_METRICS.find(x=>x[0]===state.nutritionMetric)||NUTRITION_METRICS[0];
 return `${progressSwitch()}<div class="nutrition-progress">
 <div class="section-intro body-intro"><div><p>TUS OBJETIVOS ALIMENTARIOS</p><h2>Nutrición y calorías.</h2><span>Indica tus calorías y ajusta los gramos por kilo de proteínas y grasas. Los carbohidratos se calculan con las calorías restantes.</span></div><button class="btn btn-primary" data-action="add-nutrition">${I('plus',17)} ${latest?'Nuevo objetivo':'Crear objetivo'}</button></div>
 ${latest?`<div class="nutrition-goal-tag">${I('target',17)} ${esc(nutritionGoalLabel(latest.goal))} <small>Actualizado el ${esc(latest.date)}</small></div>`:''}
 <div class="nutrition-summary">${[['Calorías',latest?.calories,'kcal'],['Proteínas',latest?.protein,'g'],['Carbohidratos',latest?.carbs,'g'],['Grasas',latest?.fat,'g']].map(([label,val,unit])=>`<div class="nutrition-summary-card"><small>${label}</small><strong>${val===undefined?'—':fmt(val)} <em>${unit}</em></strong></div>`).join('')}</div>
 ${latest?.weight?`<p class="nutrition-used-weight">Cálculo basado en ${fmt(latest.weight)} kg · proteínas: ${fmt(latest.proteinFactor??1.3)} g/kg · grasas: ${fmt(latest.fatFactor??0.8)} g/kg.</p>`:''}
 ${latest?`<div class="nutrition-macro-check ${Math.abs(macroCalories(latest)-latest.calories)>100?'warning':''}">${I('info',17)} Tus macros representan <strong>${fmt(macroCalories(latest))} kcal</strong> (proteína y carbohidratos × 4, grasa × 9). ${Math.abs(macroCalories(latest)-latest.calories)>100?'Hay una diferencia respecto a tus calorías objetivo; comprueba tus cantidades.':'Los valores están razonablemente alineados con el objetivo calórico.'}</div>`:''}
 <section class="panel body-chart-panel"><div class="panel-heading"><div><h3>Evolución de tus objetivos</h3><p class="helper-note">Compara calorías o gramos de cada macronutriente entre fechas.</p></div>${I('chart',23)}</div><label class="body-chart-choice">Mostrar en la gráfica<select id="nutritionMetric">${NUTRITION_METRICS.map(([key,label,unit])=>`<option value="${key}" ${metric[0]===key?'selected':''}>${label} (${unit})</option>`).join('')}</select></label>${nutritionChart(records,metric[0])}</section>
 <div class="section-head"><h2>Historial de objetivos</h2></div>
 ${records.length?`<div class="nutrition-records">${records.map(record=>`<article class="nutrition-record"><div class="nutrition-record-top"><div><span class="body-record-date">${esc(record.date)} · ${esc(nutritionGoalLabel(record.goal))}</span><h3>${fmt(record.calories)} <small>kcal al día</small></h3></div><div class="body-record-actions"><button data-action="edit-nutrition" data-id="${esc(record.id)}" aria-label="Editar objetivo del ${esc(record.date)}">${I('edit',18)}</button><button data-action="delete-nutrition" data-id="${esc(record.id)}" aria-label="Eliminar objetivo del ${esc(record.date)}">${I('trash',18)}</button></div></div>${record.weight?`<div class="nutrition-history-weight">Peso utilizado: ${fmt(record.weight)} kg · proteínas: ${fmt(record.proteinFactor??1.3)} g/kg · grasas: ${fmt(record.fatFactor??0.8)} g/kg</div>`:''}<div class="nutrition-record-macros"><span>Proteínas <strong>${fmt(record.protein)} g</strong></span><span>Carbohidratos <strong>${fmt(record.carbs)} g</strong></span><span>Grasas <strong>${fmt(record.fat)} g</strong></span></div>${record.note?`<p class="body-record-note">${esc(record.note)}</p>`:''}</article>`).join('')}</div>`:`<div class="empty"><h3>Aún no has definido un objetivo</h3><p>Crea tu primera meta de calorías y gramos diarios para registrar su evolución.</p></div>`}
 <p class="body-disclaimer">Estos son <strong>objetivos diarios planificados</strong>, no un diario de comidas ni calorías consumidas. Déficit, mantenimiento y ganancia son etiquetas; ForgeFit no determina automáticamente cuántas calorías necesitas. Si cambias tus objetivos, registra una nueva fecha para conservar el historial.</p></div>`;
}
function history(){if(state.progressTab==='cuerpo')return bodyProgress();if(state.progressTab==='nutricion')return nutritionProgress();const logs=state.logs||[];const completed=logs.length;const volume=logs.reduce((sum,log)=>sum+(log.exercises||[]).reduce((s,ex)=>s+(ex.sets||[]).reduce((v,x)=>v+Number(x.kg||0)*Number(x.reps||0),0),0),0);
 const last=logs.slice(0,8).reverse();const max=Math.max(1,...last.map(l=>l.exercises.reduce((sum,x)=>sum+x.sets.reduce((s,v)=>s+Number(v.kg||0)*Number(v.reps||0),0),0)));
 return `${progressSwitch()}<div class="section-intro"><div><p>LO QUE SE MIDE, MEJORA</p><h2>Tu progreso, en números.</h2><span>Consulta las sesiones terminadas y el volumen registrado.</span></div><button class="btn btn-secondary" data-action="export">${I('download',18)} Exportar</button></div>
 <div class="metrics metrics-two">${stat('Sesiones completadas',String(completed),'check','Historial guardado')}${stat('Volumen acumulado',`${fmt(volume)} kg`,'chart','Suma de peso × repeticiones')}</div>
 <div class="panel history-panel"><div class="panel-heading"><h3>Volumen de tus últimos entrenamientos</h3><span class="mini-icon">${I('chart')}</span></div>${last.length?`<div class="bar-chart">${last.map(l=>{const v=l.exercises.reduce((sum,x)=>sum+x.sets.reduce((s,z)=>s+Number(z.kg||0)*Number(z.reps||0),0),0);return `<div class="chart-item" title="${fmt(v)} kg"><div class="chart-bar" style="height:${Math.max(7,Math.round(v/max*100))}%"></div><small>${new Date(l.date).toLocaleDateString('es-ES',{day:'numeric',month:'numeric'})}</small></div>`}).join('')}</div>`:`<div class="empty mini">${I('chart',31)}<p>Completa un entrenamiento para empezar a ver tus progresos.</p></div>`}</div>
 <div class="section-head"><h2>Historial de sesiones</h2></div><div class="history-list">${logs.length?logs.map(log=>`<button class="history-row" data-action="view-log" data-id="${esc(log.id)}"><span class="history-mark">${I('check')}</span><span><strong>${esc(log.day||'Entrenamiento')}</strong><small>${new Date(log.date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})} · ${(log.exercises||[]).length} ejercicios</small></span>${I('chevron')}</button>`).join(''):`<div class="empty"><h3>Aún no hay entrenamientos</h3><p>Ve a tu rutina, pulsa Entrenar y guarda tu primera sesión.</p><button class="btn btn-primary" data-nav="rutina">Ir a mi rutina</button></div>`}</div>`;}
function themeSettings(){
 const chosen=validTheme(state.data.theme);
 const choice=t=>`<button type="button" class="theme-choice ${chosen===t.id?'chosen':''}" data-action="set-theme" data-theme-id="${t.id}" aria-pressed="${chosen===t.id}" title="${t.name}"><span class="theme-swatch" style="--swatch-a:${t.a};--swatch-b:${t.b}"><span aria-hidden="true">${chosen===t.id?I('check',18):''}</span></span><span class="theme-name">${t.name}</span></button>`;
 return `<section class="panel theme-panel"><div class="panel-heading"><div><h3>Apariencia</h3><p class="settings-description">Personaliza el fondo y los colores sin cambiar el logo ni tus rutinas.</p></div><span class="mini-icon">${I('spark')}</span></div><div class="theme-category"><h4>Fondo oscuro</h4><div class="theme-options" role="group" aria-label="Temas con fondo oscuro">${THEMES.filter(t=>t.mode==='dark').map(choice).join('')}</div></div><div class="theme-category"><h4>Fondo blanco</h4><div class="theme-options" role="group" aria-label="Temas con fondo blanco">${THEMES.filter(t=>t.mode==='light').map(choice).join('')}</div></div><p class="theme-helper">${I('cloud',15)} Tu elección se guarda con tu usuario y se sincroniza con Firebase.</p></section>`;
}
function settings(){return `<div class="section-intro"><div><p>TODO A TU MEDIDA</p><h2>Personaliza tu gimnasio.</h2><span>Cambia los colores, tus datos, discos disponibles y copias de seguridad.</span></div></div><div class="settings-grid">${themeSettings()}<div class="panel"><div class="panel-heading"><h3>Tu perfil</h3><span class="mini-icon">${I('user')}</span></div><div class="fields"><label>Nombre visible<input id="profileName" maxlength="40" value="${esc(state.data.profile.name)}"/></label><label>Objetivo<input id="profileGoal" maxlength="80" value="${esc(state.data.profile.goal)}"/></label></div><button class="btn btn-primary" data-action="save-profile">${I('check',16)} Guardar perfil</button><div class="divider-line"></div><div class="profile-status">${I(state.demo?'info':'cloud')}<div><strong>${state.demo?'Modo de prueba · almacenamiento local':'Cuenta con sincronización'}</strong><small>${state.demo?'Los datos de esta demo se guardan solo en este navegador.':esc(state.user?.email||'Conectado a Firebase')}</small></div></div>${configured?`<button class="btn btn-secondary" data-action="${state.demo?'show-login':'logout'}">${I(state.demo?'user':'logout',17)} ${state.demo?'Entrar con cuenta':'Cerrar sesión'}</button>`:''}</div>
 <div class="panel"><div class="panel-heading"><h3>Inventario de discos</h3><span class="mini-icon">${I('dumbbell')}</span></div><p class="settings-description">Estos valores son los de tus discos reales. Cambia cantidades cuando compres o retires alguno.</p><div class="inventory-list">${state.data.inventory.map((p,i)=>`<label class="inventory-row"><span><span class="mini-plate"></span>${fmt(p.kg)} kg</span><span class="counter"><button data-action="adjust-stock" data-index="${i}" data-value="-1" aria-label="Quitar disco de ${fmt(p.kg)} kg">−</button><input aria-label="Cantidad de ${fmt(p.kg)} kg" data-stock="${i}" type="number" min="0" max="100" value="${toInt(p.count)}"/><button data-action="adjust-stock" data-index="${i}" data-value="1" aria-label="Añadir disco de ${fmt(p.kg)} kg">+</button></span></label>`).join('')}</div><div class="inventory-total"><span>Total disponible</span><strong>${kg(inventoryTotal(state.data.inventory))}</strong></div><div class="settings-buttons"><button class="btn btn-secondary" data-action="reset-stock">Restablecer inventario</button><button class="btn btn-primary" data-nav="calculadora">Usar calculadora ${I('arrow',15)}</button></div></div>
 <div class="panel"><div class="panel-heading"><h3>Datos y copias de seguridad</h3><span class="mini-icon">${I('download')}</span></div><p class="settings-description">Descarga tus rutinas e historial a un archivo JSON o restaura una copia creada desde esta app.</p><div class="settings-buttons"><button class="btn btn-secondary" data-action="export">${I('download',17)} Exportar mis datos</button><button class="btn btn-secondary" data-action="import">${I('upload',17)} Importar copia</button><input type="file" id="backupFile" accept="application/json,.json" hidden/></div><p class="helper-note">Las importaciones sustituyen tu rutina y configuración, pero conservan los entrenamientos anteriores del historial. No exportamos contraseñas.</p></div>
 <div class="panel"><div class="panel-heading"><h3>Instalar en iPhone</h3><span class="mini-icon">${I('heart')}</span></div><p class="settings-description">Abre la web publicada en <strong>Safari</strong>, pulsa <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>. Se abrirá a pantalla completa como una aplicación.</p><div class="notice">${I('info',17)} En un iPhone no se abre la dirección de tu repositorio GitHub. Se abre la URL pública de GitHub Pages.</div></div></div>`;}
function training(){const entries=getList(state.trainingDay||state.day);
 return `<div class="training-banner"><div><div class="eyebrow">SESIÓN EN CURSO</div><h2>Entrenamiento de ${esc(state.trainingDay||state.day)}</h2><p>Registra el peso y las repeticiones reales de cada serie.</p></div><button class="btn btn-secondary" data-action="stop-training">Salir</button></div><div class="training-list">${entries.map((entry,i)=>{const ex=getEx(entry.id);const draft=state.draft[i]||[];return `<div class="panel training-card"><div class="training-title">${art(ex,'tiny')}<div><span class="eyebrow">EJERCICIO ${i+1}</span><h3>${esc(ex.name)}</h3><p>${entry.sets} series planificadas</p></div></div><div class="set-head"><span>SERIE</span><span>REPETICIONES</span><span>PESO (KG)</span></div>${draft.map((set,j)=>`<div class="set-row"><span>${j+1}</span><input data-draft="reps" data-exindex="${i}" data-setindex="${j}" type="number" min="0" max="999" inputmode="numeric" value="${esc(set.reps)}"/><input data-draft="kg" data-exindex="${i}" data-setindex="${j}" type="number" min="0" max="9999" step="0.25" inputmode="decimal" value="${esc(set.kg)}"/></div>`).join('')}<button class="small-link" data-action="add-set" data-exindex="${i}">${I('plus',15)} Añadir serie</button></div>`}).join('')}</div><div class="training-footer"><button class="btn btn-primary" data-action="finish-training">${I('check',19)} Guardar entrenamiento</button></div>`;}
function renderModal(){const m=state.modal;if(!m)return '';
 let content='';
 if(m.type==='add'){
  const matches=searchCatalog(m.query||'');
  content=`<div class="modal-kicker">ELIGE TU MOVIMIENTO</div><h2>${Number.isInteger(m.replaceIndex)?'Sustituir ejercicio':'Añadir ejercicio'} · ${esc(m.day)}</h2>${Number.isInteger(m.replaceIndex)?'<p class="modal-sub">Mantendremos tus series, repeticiones y kilos.</p>':''}<label class="search-box modal-search">${I('search')}<input id="modalSearch" type="search" placeholder="Buscar ejercicios..." value="${esc(m.query||'')}"/></label><div class="modal-list">${matches.slice(0,55).map(x=>`<button class="modal-ex" data-action="select-exercise" data-id="${esc(x.id)}" data-day="${esc(m.day)}" ${Number.isInteger(m.replaceIndex)?`data-replace-index="${m.replaceIndex}"`:''}>${art(x,'micro')}<span><strong>${esc(x.name)}</strong><small>${esc(x.muscle)} · ${esc(x.equipment)}</small></span>${I('plus',18)}</button>`).join('')||'<p>No hay ejercicios con ese nombre.</p>'}</div>`;
 }else if(m.type==='edit' || m.type==='configure'){
  const e=m.type==='edit'?getList(m.day)[m.index]:Number.isInteger(m.replaceIndex)?getList(m.day)[m.replaceIndex]:null,ex=getEx(m.id||e?.id);
  content=`<div class="modal-kicker">CONFIGURAR ENTRENAMIENTO</div><h2>${esc(ex.name)}</h2><p class="modal-sub">${esc(ex.muscle)} · ${esc(ex.equipment)}</p><form id="exerciseForm"><div class="form-triple"><label>Series<input name="sets" type="number" min="1" max="20" required value="${e?.sets||3}"/></label><label>Repeticiones<input name="reps" type="number" min="1" max="999" required value="${e?.reps||12}"/></label><label>Peso (kg)<input name="kg" type="number" step="0.25" min="0" max="9999" required value="${e?.kg??0}"/></label></div><button class="btn btn-primary full" type="submit">${I('check',17)} ${m.type==='edit'?'Guardar cambios':Number.isInteger(m.replaceIndex)?'Cambiar ejercicio manteniendo las cargas':'Añadir a la rutina'}</button></form>`;
 }else if(m.type==='detail'){
  const ex=getEx(m.id),custom=state.data.customExercises.some(x=>x.id===m.id);
  content=`<div class="detail-visual">${art(ex,'large')}</div><div class="modal-kicker">${esc(ex.muscle)} · ${esc(ex.equipment)}${ex.source?' · GIF externo':''}</div><h2>${esc(ex.name)}</h2><p class="modal-sub">${esc(ex.tip)}</p>${ex.sourceId?`<p class="source-id">GIF original vinculado a <code>${esc(ex.sourceId)}</code>. <a href="${esc(EXERCISE_DB_SOURCE)}" target="_blank" rel="noopener noreferrer">Ver repositorio</a></p>`:''}<button class="btn btn-primary full" data-action="add-one" data-id="${esc(ex.id)}">${I('plus',17)} Añadir a ${esc(state.day)}</button>${custom?`<div class="settings-buttons custom-edit-actions"><button class="btn btn-secondary" data-action="edit-custom" data-id="${esc(ex.id)}">${I('edit',16)} Editar ejercicio</button><button class="btn btn-secondary" data-action="delete-custom" data-id="${esc(ex.id)}">${I('trash',16)} Eliminar</button></div>`:''}`;
 }else if(m.type==='custom'){
  const current=state.data.customExercises.find(x=>x.id===m.id);const editing=Boolean(current);
  content=`<div class="modal-kicker">TU CATÁLOGO PERSONAL</div><h2>${editing?'Editar ejercicio':'Crear nuevo ejercicio'}</h2><form id="customForm" class="stack-form"><label>Nombre<input required maxlength="90" name="name" value="${esc(current?.name||'')}" placeholder="Ej. Press de banca inclinado en máquina"/></label><label>Grupo muscular<select name="muscle">${MUSCLES.filter(x=>x!=='Todos').map(x=>`<option ${current?.muscle===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Material<select name="equipment">${['Polea','Mancuernas','Barra','Máquina','Peso corporal','Banda','Otro'].map(x=>`<option ${current?.equipment===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Enlace HTTPS de GIF o imagen (opcional)<input name="media" type="url" value="${esc(current?.media||'')}" placeholder="https://.../ejercicio.gif"/></label><label>Consejos de ejecución<textarea name="tip" maxlength="700" rows="3">${esc(current?.tip||'')}</textarea></label><p class="helper-note">Puedes añadir GIFs autorizados o imágenes propias. Estos cambios se sincronizan con tu cuenta de Firebase.</p><button class="btn btn-primary full" type="submit">${I('check',17)} ${editing?'Guardar cambios':'Crear ejercicio'}</button></form>`;
 }else if(m.type==='body'){
  const row=(state.data.bodyRecords||[]).find(x=>x.id===m.id)||null;
  const metrics=BODY_FIELDS.map(([key,label])=>{
   const value=row?.measurements?.[key]?.value,unit=row?.measurements?.[key]?.unit||((key==='bone'||key==='organs')?'kg':'%');
   return `<div class="body-form-measure"><label for="body-${key}">${esc(label)}<input id="body-${key}" name="${key}" type="number" min="0" max="600" step="0.01" inputmode="decimal" placeholder="Opcional" value="${value===undefined?'':esc(value)}"/></label><label class="body-unit-label" for="unit-${key}">Unidad<select id="unit-${key}" name="unit-${key}"><option value="%" ${unit==='%'?'selected':''}>%</option><option value="kg" ${unit==='kg'?'selected':''}>kg</option></select></label></div>`;
  }).join('');
  content=`<div class="modal-kicker">COMPOSICIÓN CORPORAL</div><h2>${row?'Editar':'Añadir'} medición</h2><p class="modal-sub">El peso es obligatorio. Completa solo los demás valores que realmente hayas medido.</p><form id="bodyForm" class="stack-form"><div class="body-base-inputs"><label>Fecha<input required name="date" type="date" value="${esc(row?.date||localISODate())}"/></label><label>Peso corporal (kg)<input required name="weight" type="number" min="10" max="600" step="0.01" inputmode="decimal" placeholder="Ej.: 73,5" value="${row?.weight??''}"/></label></div><div class="body-metric-fields">${metrics}</div><label>Notas (opcional)<textarea name="note" maxlength="300" rows="2" placeholder="Por ejemplo, báscula utilizada o momento del día">${esc(row?.note||'')}</textarea></label><p class="helper-note">Si introduces un porcentaje, calcularemos sus kg equivalentes usando el peso de esa fecha. Si introduces kg, calcularemos el porcentaje. No mezclaremos los valores sumándolos.</p><button class="btn btn-primary full" type="submit">${I('check',17)} ${row?'Actualizar':'Guardar'} medición</button></form>`;
 }else if(m.type==='nutrition'){
  const row=(state.data.nutritionRecords||[]).find(x=>x.id===m.id)||null;
  const newest=nutritionRows()[0]||null;
  const measurement=row?.weight?{weight:row.weight,date:row.weightDate||row.date}:latestNutritionWeight();
  const selectedProteinFactor=row?.proteinFactor??newest?.proteinFactor??1.3;
  const selectedFatFactor=row?.fatFactor??newest?.fatFactor??0.8;
  content=`<div class="modal-kicker">OBJETIVO NUTRICIONAL</div><h2>${row?'Editar':'Crear'} objetivo diario</h2><p class="modal-sub">Indica tus calorías y ajusta proteínas y grasas en gramos por kilo de peso. Los carbohidratos se calculan automáticamente.</p>
  <form id="nutritionForm" class="stack-form"><div class="nutrition-form-top"><label>Fecha del objetivo<input type="date" required name="date" value="${esc(row?.date||localISODate())}"/></label><label>Modalidad<select name="goal">${NUTRITION_GOALS.map(([key,label])=>`<option value="${key}" ${row?.goal===key?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div>
  <div class="nutrition-weight-source ${measurement?'':'nutrition-weight-missing'}">${measurement?`${I('check',18)} <span><strong>Peso registrado: ${fmt(measurement.weight)} kg</strong><small>Última medición: ${esc(measurement.date)}. Se guarda una copia de este peso con el objetivo.</small></span>`:`${I('info',18)} <span><strong>Aún no hay peso guardado.</strong><small>Primero añade tu peso en «Peso y cuerpo» para calcular los macros automáticamente.</small></span>`}</div>
  <label>Calorías que quieres comer al día (kcal)<input required name="calories" type="number" min="1" max="10000" step="1" inputmode="numeric" placeholder="Ej.: 2000" value="${row?.calories??''}"/></label>
  <div class="nutrition-form-factors"><label>Proteína (g por kg)<input required name="proteinFactor" type="number" min="0" max="10" step="any" inputmode="decimal" value="${esc(selectedProteinFactor)}" aria-describedby="nutritionFactorsHelp"/></label><label>Grasa (g por kg)<input required name="fatFactor" type="number" min="0" max="10" step="any" inputmode="decimal" value="${esc(selectedFatFactor)}" aria-describedby="nutritionFactorsHelp"/></label></div>
  <p id="nutritionFactorsHelp" class="helper-note">Puedes cambiar 1,3 o 0,8 por cualquier otro valor válido. El cálculo se actualizará en directo.</p>
  <div id="nutritionMath" class="nutrition-auto-preview" aria-live="polite">${measurement?`<p>Introduce las calorías para ver la distribución automática.</p>`:`<p>Necesitamos tu peso antes de calcular los macros.</p>`}</div>
  ${measurement?`<label>Notas (opcional)<textarea name="note" rows="2" maxlength="300" placeholder="Ej.: déficit durante cuatro semanas">${esc(row?.note||'')}</textarea></label><button type="submit" class="btn btn-primary full">${I('check',17)} ${row?'Actualizar objetivo':'Guardar objetivo'}</button>`:`<button type="button" class="btn btn-secondary full" data-action="add-body">${I('plus',17)} Registrar mi peso</button>`}</form>`;
 }else if(m.type==='log'){
  const log=state.logs.find(x=>x.id===m.id);if(log)content=`<div class="modal-kicker">SESIÓN GUARDADA</div><h2>${esc(log.day)}</h2><p class="modal-sub">${new Date(log.date).toLocaleString('es-ES')}</p>${log.exercises.map(x=>`<div class="log-ex"><strong>${esc(getEx(x.id).name)}</strong>${x.sets.map(s=>`<small>${fmt(s.reps)} repeticiones · ${kg(s.kg)}</small>`).join('')}</div>`).join('')}<button class="btn btn-secondary full" data-action="delete-log" data-id="${esc(log.id)}">${I('trash',17)} Eliminar sesión</button>`;
 }
 return `<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(m.type)}" data-stop="true"><button class="modal-close" data-action="close-modal" aria-label="Cerrar">${I('close')}</button>${content}</div></div>`;
}
function authView(){return `<div class="auth-layout"><div class="auth-brand"><div class="brand-auth">${I('dumbbell',29)} <strong>FORGE<span>FIT</span></strong></div><h1>Entrena con un<br/><em>propósito.</em></h1><p>Tus rutinas, tus marcas y tu gimnasio. Todo en un mismo lugar.</p><div class="auth-visual"><div class="auth-orbit"></div>${I('dumbbell',120)}</div></div><div class="auth-form-side"><div class="auth-form-card"><span class="eyebrow">ACCESO PRIVADO</span><h2>${state.authMode==='reset'?'Recuperar contraseña':'Bienvenido de nuevo'}</h2><p>Solo pueden entrar las personas autorizadas por el administrador.</p><form id="authForm" class="stack-form"><label>Correo electrónico<input name="email" type="email" required autocomplete="email" placeholder="tu@correo.com"/></label>${state.authMode!=='reset'?`<label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="current-password" placeholder="Tu contraseña"/></label>`:''}<button class="btn btn-primary full" ${state.authBusy?'disabled':''} type="submit">${state.authMode==='reset'?'Enviar instrucciones':'Entrar en mi cuenta'} ${I('arrow',17)}</button></form><div class="auth-switch">${state.authMode==='reset'?`<button data-action="auth-mode" data-value="login">Volver a iniciar sesión</button>`:''}</div>${state.authMode==='login'?`<button class="forgot" data-action="auth-mode" data-value="reset">He olvidado mi contraseña</button>`:''}<p class="auth-footnote">Acceso por invitación. Solicita tu cuenta a quien administra ForgeFit.</p></div></div></div>`;}
function render(){
 if(state.loading){root.innerHTML='<div class="loader"><div class="spinner"></div><h2>ForgeFit</h2><p>Cargando tus datos...</p></div>';return;}
 if(state.cloudError && !state.demo){root.innerHTML=`<div class="loader"><h2>No se pudo conectar a Firebase</h2><p>${esc(state.cloudError)}</p><p>Revisa la conexión o contacta con el administrador.</p></div>`;return;}
 if(configured&&!state.demo&&!state.user){root.innerHTML=authView();return;}
 root.innerHTML=`<div class="app-shell">${sidebar()}<div class="main-shell">${header()}${(state.writeLocked||state.syncIssue)?`<div class="notice" role="alert" style="margin:16px 24px">${I('info',18)} <span>${esc(state.writeLocked?state.saveError:state.syncIssue)}</span> <button class="btn btn-secondary" data-action="export">Exportar copia local</button> ${!state.writeLocked?`<button class="btn btn-secondary" data-action="retry-sync">Reintentar</button>`:''} <button class="btn btn-secondary" data-action="review-cloud">Comprobar Firebase</button></div>`:''}<main class="content">${state.training?training():state.page==='inicio'?dashboard():state.page==='rutina'?weekView():state.page==='ejercicios'?library():state.page==='calculadora'?calculator():state.page==='historial'?history():settings()}</main><footer class="app-footer"><span>FORGEFIT · ENTRENAMIENTO INTELIGENTE</span><span>Construye tu progreso, día a día.</span></footer></div>${mobileNav()}</div>${renderModal()}`;
}

async function recalc(){
 const a=Number(state.calcPole1),b=Number(state.calcPole2);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0){
  state.calcResult={ok:false,error:'Introduce cantidades válidas para las poleas.'};render();focusCalculatorResult();return;
 }
 if(a===0&&b===0){state.calcResult={ok:false,error:'Introduce una carga mayor que cero al menos en una polea.'};render();focusCalculatorResult();return;}
 state.calcBusy=true;state.calcResult=null;render();
 await new Promise(resolve=>setTimeout(resolve,25));
 try{state.calcResult=solveSeparated(pool(1),pool(2),a,b,0);}
 catch(e){state.calcResult={ok:false,error:'No se pudo completar el cálculo. Prueba una carga diferente.'};}
 state.calcBusy=false;render();focusCalculatorResult();
}
function autoSplitPools(){
 const inv=state.data.inventory;
 const original=inv.length===DEFAULT_INVENTORY.length&&DEFAULT_INVENTORY.every(p=>inv.some(x=>x.kg===p.kg&&x.count===p.count));
 if(original){state.data.pulleyAllocation=clone(defaultAlloc);return;}
 for(const p of inv)state.data.pulleyAllocation[String(p.kg)]=Math.floor(p.count/2);
 // Mantén los discos de 1,25 kg juntos siempre que sea posible.
 for(const p of inv)if(Math.round(p.kg*100)%50!==0&&p.count%2===0&&state.data.pulleyAllocation[String(p.kg)]%2===1)
  state.data.pulleyAllocation[String(p.kg)]++;
 for(let t=0;t<inv.length*3;t++){
  const diff=poolTotal(1)-poolTotal(2);let best=null,improvement=0;
  for(const p of inv)for(const delta of [-1,1]){
   const key=String(p.kg),n=state.data.pulleyAllocation[key]+delta;
   if(n<0||n>p.count)continue;
   const after=Math.abs(diff+2*delta*p.kg),gain=Math.abs(diff)-after;
   if(gain>improvement+1e-7){best={key,n};improvement=gain;}
  }
  if(!best)break;
  state.data.pulleyAllocation[best.key]=best.n;
 }
}

function beginTraining(day){const list=getList(day);if(!list.length){notify('Añade algún ejercicio primero.');return;}
 state.trainingDay=day;state.training=true;state.draft={};list.forEach((ex,i)=>{state.draft[i]=Array.from({length:Math.max(1,toInt(ex.sets,1,20))},()=>({reps:ex.reps,kg:ex.kg}));});render();window.scrollTo(0,0);
}
async function startFirebase(){
 try{
  const v='12.4.0';
  const [appApi,authApi,api]=await Promise.all([
   import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
   import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
   import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`)
  ]);
  const app=appApi.initializeApp(firebaseConfig),auth=authApi.getAuth(app),db=api.getFirestore(app);
  state.firebase={auth,authApi,api,db};
  authApi.onAuthStateChanged(auth,async user=>{
   const generation=++state.authGeneration;
   state.unsubs.forEach(f=>f());state.unsubs=[];
   clearTimeout(state.saveTimer);
   state.saveTimer=null;state.savePending=false;state.saveQueued=false;state.saveInFlight=false;state.currentSavePromise=null;
   state.remoteReady=false;state.syncedData=null;state.writeLocked=false;state.saveError='';state.cloudError='';state.syncIssue='';state.saveRetryCount=0;
   state.user=user;state.training=false;state.logs=[];
   if(!user){state.data=defaultData();state.loading=false;render();return;}
   state.demo=false;state.loading=true;render();
   const ref=api.doc(db,'users',user.uid,'data','main');
   try{
    // Lectura confirmada por el servidor: nunca inicializar desde una caché vacía.
    let snapshot=await api.getDocFromServer(ref);
    if(generation!==state.authGeneration)return;
    if(!snapshot.exists()){
     const fresh=defaultData();fresh.profile.name=user.displayName||user.email?.split('@')[0]||'Deportista';
     await api.runTransaction(db,async tx=>{
      const current=await tx.get(ref);
      if(!current.exists())tx.set(ref,fresh);
     });
     snapshot=await api.getDocFromServer(ref);
     if(generation!==state.authGeneration)return;
     if(!snapshot.exists())throw Error('No se pudo inicializar el documento de la cuenta.');
    }
    state.data=validateStoredData(snapshot.data());state.syncedData=clone(state.data);
    state.remoteReady=true;state.loading=false;applyTheme(state.data.theme);render();
    const unsubscribe=api.onSnapshot(ref,{includeMetadataChanges:true},remote=>{
     if(generation!==state.authGeneration)return;
     if(remote.metadata.fromCache||remote.metadata.hasPendingWrites)return;
     if(!remote.exists()){
      lockWrites('El documento de tu cuenta no existe en el servidor. No se crearán datos vacíos automáticamente.');return;
     }
     try{
      const incoming=validateStoredData(remote.data());
      if(!state.savePending&&!state.saveInFlight){state.data=incoming;state.syncedData=clone(incoming);applyTheme(state.data.theme);render();}
      // Si hay cambios locales pendientes, la transacción comprueba conflictos.
     }catch(e){lockWrites(humanError(e));}
    },error=>lockWrites('Error escuchando tus datos: '+humanError(error)));
    state.unsubs.push(unsubscribe);
    const query=api.query(api.collection(db,'users',user.uid,'logs'),api.orderBy('date','desc'),api.limit(200));
    state.unsubs.push(api.onSnapshot(query,snapshot=>{
     if(generation!==state.authGeneration)return;
     state.logs=snapshot.docs.map(d=>d.data());render();
    },error=>notify('Error leyendo el historial: '+humanError(error))));
   }catch(e){
    if(generation!==state.authGeneration)return;
    state.loading=false;state.remoteReady=false;state.cloudError=humanError(e);render();
   }
  });
 }catch(e){state.loading=false;state.cloudError=humanError(e);render();}
}

root.addEventListener('click',async e=>{
 const node=e.target.closest('button,[data-action],[data-nav],[data-dayselect],[data-muscle]');if(!node||node.disabled)return;
 if(node.hasAttribute('data-stop'))return;
 if(node.dataset.nav){state.training=false;state.page=node.dataset.nav;state.modal=null;render();window.scrollTo(0,0);return;}
 if(node.dataset.dayselect){state.day=node.dataset.dayselect;render();return;}
 if(node.dataset.muscle){state.muscle=node.dataset.muscle;render();return;}
 const act=node.dataset.action;if(!act)return;
 if(!state.demo&&state.user&&!state.remoteReady&&!['export','review-cloud','logout','close-modal','detail','view-log','progress-tab','day-step'].includes(act)){notify('Esperando confirmación de Firebase. No se puede editar todavía.');return;}
 // Mientras exista un conflicto no permitir editar sin posibilidad de guardado.
 if(state.writeLocked&&!['export','review-cloud','close-modal','detail','view-log','progress-tab','day-step','logout','auth-mode','show-login'].includes(act)){
  notify('Esta sesión tiene un conflicto. Guarda una copia local y comprueba Firebase antes de continuar.');return;
 }
 if(act==='retry-sync'){
  if(!state.writeLocked&&state.user&&state.remoteReady&&state.savePending){
   clearTimeout(state.saveTimer);state.saveRetryCount=0;state.syncIssue='';void flushData();render();
  }return;
 }
 if(act==='review-cloud'){
  if(!state.firebase||!state.user){notify('No hay una sesión de Firebase activa.');return;}
  const ownerUid=state.user.uid,generation=state.authGeneration;
  try{
   const {api,db}=state.firebase;
   const snapshot=await api.getDocFromServer(api.doc(db,'users',ownerUid,'data','main'));
   if(generation!==state.authGeneration||state.user?.uid!==ownerUid)return;
   if(!snapshot.exists()){alert('ATENCIÓN: el documento data/main no existe en el servidor. No cierres esta pantalla antes de exportar tus datos locales.');return;}
   const remote=validateStoredData(snapshot.data());
   const summary=DAYS.map(day=>`${day}: ${Array.isArray(remote.routine?.[day])?remote.routine[day].length:0} ejercicios`).join('\n');
   alert('Estos son los ejercicios que FIREBASE conserva actualmente, no los que están en esta pestaña:\n\n'+summary+'\n\nSi tu pestaña tiene cambios diferentes, pulsa Exportar copia local para conservarlos. No se ha modificado Firebase.');
  }catch(error){alert('No se han podido leer los datos del servidor: '+humanError(error));}
  return;
 }
 if(act==='close-modal'){if(e.target.closest('[data-stop]')&&!node.classList.contains('modal-close'))return;state.modal=null;render();return;}
 if(act==='auth-mode'){state.authMode=node.dataset.value==='reset'?'reset':'login';render();return;}
 if(act==='demo'){if(configured)return;state.demo=true;state.loading=false;state.cloudError='';state.data=readDemo();state.logs=readLogs();render();return;}
 if(act==='show-login'){state.demo=false;state.user=null;state.authMode='login';render();return;}
 if(act==='logout'&&state.firebase){
  if(state.writeLocked){notify('No puedes cerrar sesión con un conflicto pendiente. Exporta los datos antes.');return;}
  if(state.savePending){clearTimeout(state.saveTimer);await flushData();if(state.saveInFlight&&state.currentSavePromise)await state.currentSavePromise;}
  if(state.savePending||state.writeLocked){notify('Hay cambios sin guardar. Exporta una copia antes de cerrar sesión.');return;}
  await state.firebase.authApi.signOut(state.firebase.auth);state.authMode='login';state.page='inicio';return;
 }
 if(act==='progress-tab'){state.progressTab=['entrenamientos','cuerpo','nutricion'].includes(node.dataset.value)?node.dataset.value:'cuerpo';render();return;}
 if(act==='add-nutrition'){state.modal={type:'nutrition'};render();updateNutritionMath();return;}
 if(act==='edit-nutrition'){state.modal={type:'nutrition',id:node.dataset.id};render();updateNutritionMath();return;}
 if(act==='delete-nutrition'){const old=(state.data.nutritionRecords||[]).find(x=>x.id===node.dataset.id);if(!old||!confirm(`¿Borrar el objetivo del ${old.date}?`))return;state.data.nutritionRecords=state.data.nutritionRecords.filter(x=>x.id!==old.id);saveData();render();notify('Objetivo eliminado');return;}
 if(act==='add-body'){state.modal={type:'body'};render();return;}
 if(act==='edit-body'){state.modal={type:'body',id:node.dataset.id};render();return;}
 if(act==='delete-body'){
  const old=(state.data.bodyRecords||[]).find(r=>r.id===node.dataset.id);
  if(!old||!confirm(`¿Eliminar la medición del ${old.date}?`))return;
  state.data.bodyRecords=state.data.bodyRecords.filter(r=>r.id!==old.id);saveData();render();notify('Medición eliminada');return;
 }
 if(act==='add'){state.modal={type:'add',day:node.dataset.day||state.day,query:''};render();return;}
 if(act==='day-step'){const n=DAYS.indexOf(state.day);state.day=DAYS[(n+(Number(node.dataset.value)||1)+7)%7];render();return;}
 if(act==='replace-routine'){state.modal={type:'add',day:node.dataset.day||state.day,replaceIndex:Number(node.dataset.index),query:''};render();return;}
 if(act==='more-catalog'){state.visibleCatalog+=48;render();return;}
 if(act==='custom'){state.modal={type:'custom'};render();return;}
 if(act==='edit-custom'){state.modal={type:'custom',id:node.dataset.id};render();return;}
 if(act==='delete-custom'){const id=node.dataset.id;if(!confirm('¿Borrar este ejercicio personalizado? Los entrenamientos que ya lo utilizan conservarán su identificador.'))return;state.data.customExercises=state.data.customExercises.filter(x=>x.id!==id);state.modal=null;saveData();render();return;}
 if(act==='detail'){state.modal={type:'detail',id:node.dataset.id};render();return;}
 if(act==='select-exercise'){state.modal={type:'configure',id:node.dataset.id,day:node.dataset.day,replaceIndex:node.dataset.replaceIndex!==undefined?Number(node.dataset.replaceIndex):undefined};render();return;}
 if(act==='add-one'){state.modal={type:'configure',id:node.dataset.id,day:state.day};render();return;}
 if(act==='edit-routine'){state.modal={type:'edit',day:node.dataset.day,index:Number(node.dataset.index)};render();return;}
 if(act==='delete-routine'){state.data.routine[node.dataset.day].splice(Number(node.dataset.index),1);saveData();render();notify('Ejercicio eliminado de la rutina');return;}
 if(act==='move'){const a=state.data.routine[node.dataset.day],i=Number(node.dataset.index),j=i+Number(node.dataset.dir);if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];saveData();render();return;}
 if(act==='start-today'){beginTraining(node.dataset.day||state.day);return;}
 if(act==='stop-training'){state.training=false;render();return;}
 if(act==='add-set'){const i=Number(node.dataset.exindex),last=state.draft[i].at(-1)||{reps:10,kg:0};state.draft[i].push({...last});render();return;}
 if(act==='finish-training'){
  const day=state.trainingDay||state.day;const exercises=getList(day).map((ex,i)=>({id:ex.id,sets:clone(state.draft[i]||[])}));
  const log={id:uid(),date:stamp(),day,exercises};if(!await saveLog(log))return;state.training=false;state.page='historial';render();notify('¡Entrenamiento guardado!');return;
 }
 if(act==='preset-two'){state.calcPole1=Number(node.dataset.first);state.calcPole2=Number(node.dataset.second);await recalc();return;}
 if(act==='calculate'){
  state.calcPole1=Number($('#calcPole1')?.value);state.calcPole2=Number($('#calcPole2')?.value);
  await recalc();return;
 }
 if(act==='split-auto'){autoSplitPools();invalidateCalc();saveData();render();notify('Discos reservados en los dos soportes');return;}
 if(act==='split-reset'){
  if(!DEFAULT_INVENTORY.every(p=>state.data.inventory.some(x=>x.kg===p.kg&&x.count===p.count))){notify('Para restaurar 94,5/94 kg necesitas primero los 72 discos originales.');return;}
  state.data.pulleyAllocation=clone(defaultAlloc);invalidateCalc();saveData();render();notify('Reparto original: 94,5 kg / 94 kg');return;
 }
 if(act==='save-load' && state.calcResult?.ok){
  const r=state.calcResult;
  const title=prompt('Nombre de esta combinación:',`Polea 1 ${fmt(r.totals[0])} kg · Polea 2 ${fmt(r.totals[1])} kg`);
  if(title===null||!title.trim())return;
  state.data.savedLoads=[{id:uid(),name:title.trim().slice(0,70),totals:r.totals},...(state.data.savedLoads||[])].slice(0,60);
  saveData();render();notify('Combinación guardada');return;
 }
 if(act==='use-load'){
  const saved=state.data.savedLoads?.[Number(node.dataset.index)];if(!saved)return;
  state.calcPole1=saved.totals[0];state.calcPole2=saved.totals[1];await recalc();return;
 }
 if(act==='delete-load'){
  state.data.savedLoads.splice(Number(node.dataset.index),1);saveData();render();return;
 }
 if(act==='adjust-stock'){const i=Number(node.dataset.index);state.data.inventory[i].count=toInt(state.data.inventory[i].count+Number(node.dataset.value),0,100);state.data.pulleyAllocation[String(state.data.inventory[i].kg)]=Math.min(state.data.pulleyAllocation[String(state.data.inventory[i].kg)]??0,state.data.inventory[i].count);invalidateCalc();saveData();render();return;}
 if(act==='reset-stock'){if(confirm('¿Restablecer las cantidades originales de discos?')){state.data.inventory=clone(DEFAULT_INVENTORY);state.data.pulleyAllocation=clone(defaultAlloc);invalidateCalc();saveData();render();}return;}
 if(act==='set-theme'){
  const requested=node.dataset.themeId;
  if(!THEMES.some(t=>t.id===requested))return;
  state.data.theme=requested;applyTheme(requested);saveData();render();notify('Tema actualizado');return;
 }
 if(act==='save-profile'){state.data.profile.name=($('#profileName')?.value||'Deportista').trim().slice(0,40);state.data.profile.goal=($('#profileGoal')?.value||'').trim().slice(0,80);saveData();render();notify('Perfil guardado');return;}
 if(act==='export'){
  const json=JSON.stringify({app:'ForgeFit',version:1,exportedAt:stamp(),data:state.data,logs:state.logs},null,2);
  const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='forgefit-copia-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);notify('Copia preparada para descargar');return;
 }
 if(act==='import'){$('#backupFile')?.click();return;}
 if(act==='view-log'){state.modal={type:'log',id:node.dataset.id};render();return;}
 if(act==='delete-log'){
  if(!confirm('¿Eliminar esta sesión del historial?'))return;
  const id=node.dataset.id;state.logs=state.logs.filter(x=>x.id!==id);
  if(state.demo||!configured)saveData();else try{const {api,db}=state.firebase;await api.deleteDoc(api.doc(db,'users',state.user.uid,'logs',id));}catch(e){notify(humanError(e));}
  state.modal=null;render();return;
 }
});
root.addEventListener('submit',async e=>{
 e.preventDefault();
 if(state.writeLocked){notify('Guardado bloqueado. Exporta una copia local y revisa Firebase.');return;}
 if(!state.demo&&state.user&&!state.remoteReady){notify('Esperando datos confirmados de Firebase.');return;}
 const f=e.target,form=new FormData(f);
 if(f.id==='authForm'){
  if(!state.firebase){notify('Firebase aún no está conectado.');return;}
  state.authBusy=true;const {auth,authApi}=state.firebase;
  try{
   if(state.authMode==='reset'){
    await authApi.sendPasswordResetEmail(auth,String(form.get('email')));state.authMode='login';notify('Si existe una cuenta con ese correo, recibirá instrucciones.');
   }else await authApi.signInWithEmailAndPassword(auth,String(form.get('email')),String(form.get('password')));
  }catch(err){notify(humanError(err));}finally{state.authBusy=false;render();}
  return;
 }
 if(f.id==='exerciseForm'){
  const m=state.modal,exId=m.type==='edit'?getList(m.day)[m.index].id:m.id,ex=getEx(exId),
   entry={id:exId,...(m.type==='edit'?(getList(m.day)[m.index].entryUid?{entryUid:getList(m.day)[m.index].entryUid}:{}):(Number.isInteger(m.replaceIndex)&&getList(m.day)?.[m.replaceIndex]?(getList(m.day)[m.replaceIndex].entryUid?{entryUid:getList(m.day)[m.replaceIndex].entryUid}:{}):{entryUid:uid()})),sets:toInt(form.get('sets'),1,20),reps:toInt(form.get('reps'),1,999),kg:toNum(form.get('kg'),0,9999),
   snapshot:{name:ex.name,muscle:ex.muscle,equipment:ex.equipment,tip:ex.tip,media:ex.media}};
  if(m.type==='edit')state.data.routine[m.day][m.index]=entry;else if(Number.isInteger(m.replaceIndex)&&state.data.routine[m.day]?.[m.replaceIndex])state.data.routine[m.day][m.replaceIndex]=entry;else state.data.routine[m.day].push(entry);
  state.day=m.day;state.modal=null;state.page='rutina';saveData();render();notify('Cambio pendiente. Espera a ver «Sincronizado».');return;
 }
 if(f.id==='bodyForm'){
  const date=String(form.get('date')||''),weight=Number(form.get('weight'));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||!Number.isFinite(weight)||weight<10||weight>600){notify('Introduce una fecha y un peso válidos entre 10 y 600 kg.');return;}
  const measurements={};
  for(const [key,label] of BODY_FIELDS){
   const raw=String(form.get(key)||'').trim();if(!raw)continue;
   const value=Number(raw.replace(',','.')),unit=String(form.get('unit-'+key));
   if(!Number.isFinite(value)||value<0||(unit==='%'&&value>100)||(unit==='kg'&&value>weight)||!['%','kg'].includes(unit)){
    notify(`${label}: introduce un valor entre 0 y ${unit==='%'?'100 %':fmt(weight)+' kg'}.`);return;
   }
   measurements[key]={value:Math.round(value*100)/100,unit};
  }
  const previous=(state.data.bodyRecords||[]).find(r=>r.id===state.modal?.id);
  const record={id:previous?.id||uid(),date,weight:Math.round(weight*100)/100,measurements,note:String(form.get('note')||'').trim().slice(0,300),createdAt:previous?.createdAt||stamp()};
  if(previous)Object.assign(previous,record);else state.data.bodyRecords=[record,...(state.data.bodyRecords||[])].slice(0,400);
  state.modal=null;state.progressTab='cuerpo';state.bodyMetric='weight';state.page='historial';saveData();render();notify('Medición pendiente de sincronizar.');return;
 }
 if(f.id==='nutritionForm'){
  const date=String(form.get('date')||''),goal=String(form.get('goal')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||!NUTRITION_GOALS.some(x=>x[0]===goal)){notify('Introduce una fecha y un objetivo válidos.');return;}
  const input=String(form.get('calories')||'').trim();
  if(!input||!/^\d+$/.test(input)){notify('Introduce un número entero de calorías.');return;}
  const old=(state.data.nutritionRecords||[]).find(x=>x.id===state.modal?.id);
  const latest=latestNutritionWeight();
  if(!latest&&!old?.weight){notify('Primero registra tu peso corporal en Peso y cuerpo.');return;}
  const weight=old?.weight??latest?.weight;
  const proteinText=String(form.get('proteinFactor')??'').replace(',','.').trim();
  const fatText=String(form.get('fatFactor')??'').replace(',','.').trim();
  if(!proteinText||!fatText){notify('Indica los gramos por kilo de proteína y grasa.');return;}
  const value=calculateNutritionMacros(Number(input),weight,Number(proteinText),Number(fatText));
  if(!value.ok){notify(value.reason);updateNutritionMath();return;}
  const collision=(state.data.nutritionRecords||[]).find(x=>x.date===date&&x.id!==old?.id);
  if(collision&&!confirm('Ya hay un objetivo guardado para esa fecha. ¿Quieres reemplazarlo?'))return;
  const record={id:old?.id||collision?.id||uid(),date,goal,...value,weightDate:old?.weightDate??latest?.date,note:String(form.get('note')||'').trim().slice(0,300),createdAt:old?.createdAt||collision?.createdAt||stamp()};
  delete record.ok;
  state.data.nutritionRecords=[...(state.data.nutritionRecords||[]).filter(x=>x.id!==old?.id&&x.id!==collision?.id),record].slice(-500);
  state.modal=null;state.progressTab='nutricion';state.nutritionMetric='calories';state.page='historial';saveData();render();notify('Objetivo pendiente de sincronizar.');return;
 }
 if(f.id==='customForm'){
  const media=String(form.get('media')||'').trim();
  if(media&&!/^https:\/\//i.test(media)){notify('La URL de imagen debe comenzar por https://');return;}
  const name=String(form.get('name')||'').trim();if(!name){notify('Escribe el nombre del ejercicio.');return;}
  const current=state.data.customExercises.find(x=>x.id===state.modal?.id);
  const ex={id:current?.id||'custom-'+uid(),name:name.slice(0,90),muscle:String(form.get('muscle')),equipment:String(form.get('equipment')),type:'pull',tip:String(form.get('tip')||'').slice(0,700),media};
  if(current)Object.assign(current,ex);else state.data.customExercises.push(ex);
  state.modal=null;saveData();render();notify('Cambio pendiente de sincronizar.');return;
 }

});
root.addEventListener('change',e=>{
 if(state.writeLocked&&e.target.id!=='backupFile'){
  notify('Guardado bloqueado. No puedes editar hasta resolver el conflicto.');render();return;
 }
 const node=e.target;
 if(node.matches('[data-stock]')){const i=Number(node.dataset.stock);state.data.inventory[i].count=toInt(node.value,0,100);const k=String(state.data.inventory[i].kg);state.data.pulleyAllocation[k]=Math.min(state.data.pulleyAllocation[k]||0,state.data.inventory[i].count);invalidateCalc();saveData();render();}
 if(node.matches('[data-split-weight]')){const item=state.data.inventory.find(p=>String(p.kg)===node.dataset.splitWeight);if(!item)return;state.data.pulleyAllocation[String(item.kg)]=toInt(node.value,0,item.count);invalidateCalc();saveData();render();}
 if(node.matches('[data-draft]')){const i=Number(node.dataset.exindex),j=Number(node.dataset.setindex),key=node.dataset.draft;if(state.draft[i]?.[j])state.draft[i][j][key]=key==='kg'?toNum(node.value):toInt(node.value);}
 if(node.id==='bodyMetric'){state.bodyMetric=BODY_METRICS.some(x=>x[0]===node.value)?node.value:'weight';render();return;}
 if(node.id==='nutritionMetric'){state.nutritionMetric=NUTRITION_METRICS.some(x=>x[0]===node.value)?node.value:'calories';render();return;}
 if(node.id==='backupFile'){
  const file=node.files?.[0];if(!file)return;
  file.text().then(async text=>{
   try{
    const json=JSON.parse(text);
    if(json.app!=='ForgeFit'||!json.data||!Array.isArray(json.logs))throw Error('El archivo no es una copia válida de ForgeFit.');
    const imported=validateStoredData(json.data);
    const importingUid=state.user?.uid,importingGeneration=state.authGeneration;
    if(!state.demo&&(!state.remoteReady||state.writeLocked))throw Error('No se puede importar sin conexión segura al servidor.');
    if(!confirm('Se sustituirá tu rutina y configuración con la copia. Se CONSERVARÁN los entrenamientos actuales del historial. ¿Continuar?'))return;
    // Los logs existentes se conservan. No se borran al importar una copia parcial.
    if(!state.demo&&state.firebase){
     const {api,db}=state.firebase,ownerUid=state.user.uid,collectionRef=api.collection(db,'users',ownerUid,'logs');
     const old=await api.getDocs(collectionRef),existingIds=new Set(old.docs.map(d=>d.id));
     if(state.authGeneration!==importingGeneration||state.user?.uid!==importingUid)throw Error('La cuenta cambió durante la importación.');
     const additions=json.logs.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&!existingIds.has(x.id)).slice(0,200);
     if(additions.length){const batch=api.writeBatch(db);additions.forEach(log=>batch.set(api.doc(db,'users',ownerUid,'logs',log.id),log));await batch.commit();}
    }else{
     const byId=new Map([...state.logs,...json.logs.filter(x=>x&&typeof x?.id==='string')].map(x=>[x.id,x]));state.logs=[...byId.values()];
    }
    if(!state.demo&&(state.authGeneration!==importingGeneration||state.user?.uid!==importingUid))throw Error('La cuenta cambió durante la importación.');
    state.data=imported;applyTheme(state.data.theme);state.calcResult=null;saveData();
    render();notify('Copia importada. Historial previo conservado.');
   }catch(e){notify('No se pudo importar: '+humanError(e));}
  });
 }
});
// Broken remote GIFs receive an explicit empty state, never another exercise's picture.
root.addEventListener('error',event=>{
 const img=event.target;
 if(img?.tagName!=='IMG'||!img.closest?.('.media-art'))return;
 img.hidden=true;
 const label=img.parentElement.querySelector('.media-unavailable');
 if(label)label.hidden=false;
},{capture:true});
root.addEventListener('input',e=>{
 if(e.target.closest?.('#nutritionForm')&&e.target.matches?.('[name=calories],[name=proteinFactor],[name=fatFactor]'))updateNutritionMath();
 if(e.target.id==='searchExercises'){
  state.search=e.target.value;state.visibleCatalog=36;
  const q=textMatch(state.search);
  const results=searchCatalog(state.search,state.muscle);
  const node=$('#catalogGrid');if(node)node.innerHTML=results.length?catalogCards(results.slice(0,36)):'<div class="empty">No hay coincidencias</div>';
  const c=$('.catalog-count');if(c)c.textContent=`${results.length} ejercicios encontrados`;
  const more=$('#catalogMore');if(more)more.innerHTML=results.length>36?`<button class="btn btn-secondary catalog-more" data-action="more-catalog">${I('plus',17)} Mostrar más (${results.length-36} restantes)</button>`:'';
 }
 if(e.target.id==='modalSearch'&&state.modal?.type==='add'){
  state.modal.query=e.target.value;const selected=e.target.selectionStart;
  render();const input=$('#modalSearch');if(input){input.focus();input.setSelectionRange(selected,selected);}
 }
});

function updateNutritionMath(){
 const f=$('#nutritionForm'),out=$('#nutritionMath');if(!f||!out)return;
 const old=(state.data.nutritionRecords||[]).find(x=>x.id===state.modal?.id);
 const measurement=old?.weight?{weight:old.weight,date:old.weightDate||old.date}:latestNutritionWeight();
 if(!measurement){out.innerHTML='<p>Registra tu peso en «Peso y cuerpo» para activar el cálculo.</p>';return;}
 const raw=f.elements.calories.value.trim();
 if(!raw){out.innerHTML='<p>Escribe las calorías para ver los gramos recomendados por tu fórmula.</p>';return;}
 const pText=f.elements.proteinFactor.value.trim(),fText=f.elements.fatFactor.value.trim();
 if(!pText||!fText){out.textContent='Indica ambos factores para calcular los macronutrientes.';out.classList.add('warning');return;}
 const result=calculateNutritionMacros(Number(raw),measurement.weight,Number(pText.replace(',','.')),Number(fText.replace(',','.')));
 if(!result.ok){out.textContent=result.reason;out.classList.add('warning');return;}
 out.classList.remove('warning');
 out.innerHTML=`<div class="nutrition-auto-grid"><div><small>Proteínas · ${fmt(result.proteinFactor)} g/kg</small><strong>${fmt(result.protein)} g</strong><span>${fmt(result.protein*4)} kcal</span></div><div><small>Grasas · ${fmt(result.fatFactor)} g/kg</small><strong>${fmt(result.fat)} g</strong><span>${fmt(result.fat*9)} kcal</span></div><div><small>Carbohidratos · resto</small><strong>${fmt(result.carbs)} g</strong><span>${fmt(result.carbs*4)} kcal</span></div></div><p>Total aproximado: ${fmt(macroCalories(result))} de ${fmt(result.calories)} kcal. Calculado con ${fmt(result.weight)} kg.</p>`;
}
function focusCalculatorResult(){
 requestAnimationFrame(()=>{
  const el=$('.calc-output');if(!el)return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
 });
}
window.addEventListener('beforeunload',event=>{
 if(state.user&&(state.savePending||state.saveInFlight||state.writeLocked)){
  event.preventDefault();event.returnValue='';
 }
});
if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js?v=forgefit-v7-20261027',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
if(configured)startFirebase();else{state.loading=false;render();}
loadRemoteExercises();
