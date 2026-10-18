import {EXERCISES, MUSCLES, DAYS, DEFAULT_INVENTORY, STARTER_PLAN} from './catalog.js';
import {solveLoad, inventoryTotal} from './solver.js';
import {firebaseConfig} from '../firebase-config.js';

const $=selector=>document.querySelector(selector);
const root=$('#root');
const localKey='forgefit-local-v1';
const configured=Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const clone=value=>JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value??0).toLocaleString('es-ES',{maximumFractionDigits:2});
const kg=value=>fmt(value)+' kg';
const uid=()=>crypto?.randomUUID?.() ?? ('id'+Math.random().toString(36).slice(2));
const toInt=(v,min=0,max=999)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
const toNum=(v,min=0,max=9999)=>Math.max(min,Math.min(max,Math.round((Number(v)||0)*100)/100));
const currentDay=()=>DAYS[(new Date().getDay()+6)%7];
const today=()=>new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
const stamp=()=>new Date().toISOString();
const defaultData=()=>({version:1,profile:{name:'Deportista',goal:'Ganar fuerza'},inventory:clone(DEFAULT_INVENTORY),routine:clone(STARTER_PLAN),customExercises:[]});
function normalize(data){
 const initial=defaultData();
 const d=(data && typeof data==='object')?data:{};
 return {...initial,...d,profile:{...initial.profile,...(d.profile||{})},inventory:Array.isArray(d.inventory)?d.inventory:initial.inventory,
  routine:{...initial.routine,...(d.routine||{})},customExercises:Array.isArray(d.customExercises)?d.customExercises:[]};
}
function readDemo(){try{return normalize(JSON.parse(localStorage.getItem(localKey)||'null')?.data);}catch{return defaultData();}}
function readLogs(){try{return JSON.parse(localStorage.getItem(localKey)||'null')?.logs||[];}catch{return [];}}
const state={page:'inicio',day:currentDay(),muscle:'Todos',search:'',demo:!configured,user:null,authMode:'login',authBusy:false,
 data:readDemo(),logs:readLogs(),modal:null,toast:'',calcBars:4,calcTotal:188.5,calcApprox:true,calcResult:null,
 training:false,draft:{},loading:configured,cloudError:'',firebase:null,unsubs:[],saveTimer:null,savePending:false};

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
function getCatalog(){return [...EXERCISES,...state.data.customExercises];}
function getEx(id){return getCatalog().find(x=>x.id===id)||{id,name:'Ejercicio eliminado',muscle:'Otros',equipment:'Otro',type:'pull',tip:''};}
function getList(day=state.day){return Array.isArray(state.data.routine[day])?state.data.routine[day]:[];}
function notify(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.classList.remove('show'),3500);}
function saveData(){
 if(state.demo||!configured){localStorage.setItem(localKey,JSON.stringify({data:state.data,logs:state.logs}));return;}
 if(!state.user||!state.firebase)return;
 state.savePending=true;clearTimeout(state.saveTimer);
 state.saveTimer=setTimeout(async()=>{
  const current=clone(state.data);state.savePending=false;
  try{const {api,db}=state.firebase;await api.setDoc(api.doc(db,'users',state.user.uid,'data','main'),current,{merge:false});}
  catch(e){notify('No se han sincronizado los cambios: '+humanError(e));}
 },600);
}
async function saveLog(log){
 state.logs=[log,...state.logs].slice(0,200);
 if(state.demo||!configured){saveData();return;}
 try{const {api,db}=state.firebase;await api.setDoc(api.doc(db,'users',state.user.uid,'logs',log.id),log);}
 catch(e){notify('Error al guardar el entrenamiento: '+humanError(e));}
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
 return `<header class="topbar"><div><div class="eyebrow">${state.page==='inicio'?esc(today()):'FORGEFIT / ENTRENAMIENTO'}</div><h1>${esc(label)}</h1></div><div class="top-actions"><span class="cloud-state">${I(state.demo?'info':'cloud',15)} ${state.demo?'Local':'Sincronizado'}</span><button class="avatar" title="Ajustes" data-nav="ajustes">${esc((state.data.profile.name||'T').slice(0,1).toUpperCase())}</button></div></header>`;
}
function sidebar(){return `<aside class="sidebar"><button class="brand" data-nav="inicio"><span class="brand-icon">${I('dumbbell',27)}</span><span><strong>FORGE<span>FIT</span></strong><small>TRAIN YOUR WAY</small></span></button><div class="sidebar-label">TU ESPACIO</div><nav class="desktop-nav">${nav.map(([page,ico,title])=>`<button class="navlink ${state.page===page?'active':''}" data-nav="${page}">${I(ico)}<span>${title}</span>${state.page===page?'<i></i>':''}</button>`).join('')}</nav><div class="sidebar-foot"><div class="sidebar-quote"><span>${I('bolt')}</span><strong>Cada repetición cuenta.</strong><small>Hazlo por ti.</small></div><small>v1.0 · Hecho para entrenar</small></div></aside>`;}
function mobileNav(){return `<nav class="mobile-nav" aria-label="Secciones">${nav.slice(0,5).map(([page,ico,title])=>`<button data-nav="${page}" class="${state.page===page?'active':''}">${I(ico,21)}<small>${page==='calculadora'?'Discos':page==='ejercicios'?'Buscar':title.replace('Mi ','')}</small></button>`).join('')}</nav>`;}
function stat(label,value,ico,detail){return `<div class="stat-card"><span class="stat-icon">${I(ico,20)}</span><small>${esc(label)}</small><strong>${esc(value)}</strong><span class="stat-detail">${esc(detail||'')}</span></div>`;}
function routineCard(item,index,day=state.day,editable=true){
 const ex=getEx(item.id);const isCable=ex.equipment==='Polea';
 return `<article class="routine-card"><div class="routine-pos">${index+1}</div>${art(ex,'tiny')}<div class="routine-info"><h3>${esc(ex.name)}</h3><p>${esc(ex.muscle)} <span>·</span> ${esc(ex.equipment)}</p><div class="chips"><span>${toInt(item.sets,1,20)} series</span><span>${toInt(item.reps,1,999)} reps</span><span>${fmt(item.kg)} kg</span>${isCable?'<span class="chip-accent">Polea</span>':''}</div></div>${editable?`<div class="routine-actions"><button title="Editar" data-action="edit-routine" data-day="${esc(day)}" data-index="${index}">${I('edit',17)}</button><button title="Subir" ${index===0?'disabled':''} data-action="move" data-dir="-1" data-day="${esc(day)}" data-index="${index}">${I('up',17)}</button><button title="Bajar" ${index===getList(day).length-1?'disabled':''} data-action="move" data-dir="1" data-day="${esc(day)}" data-index="${index}">${I('down',17)}</button><button title="Eliminar" data-action="delete-routine" data-day="${esc(day)}" data-index="${index}">${I('trash',17)}</button></div>`:`<button class="subtle-btn" data-action="detail" data-id="${esc(ex.id)}">Ver ${I('chevron',15)}</button>`}</article>`;
}
function art(ex,size='normal'){
 if(ex.media && /^https:\/\//i.test(ex.media))return `<div class="exercise-art ${size}"><img loading="lazy" src="${esc(ex.media)}" alt="Demostración de ${esc(ex.name)}" referrerpolicy="no-referrer"/></div>`;
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
 <div class="days-tabs">${DAYS.map(d=>`<button data-dayselect="${esc(d)}" class="day-tab ${state.day===d?'active':''}"><span>${d.slice(0,3)}</span><small>${getList(d).length} ej.</small></button>`).join('')}</div>
 <div class="week-head"><div><div class="eyebrow">ENTRENAMIENTO</div><h2>${esc(state.day)} <span class="muted">/ ${getList().length} ejercicios</span></h2></div>${getList().length?`<button class="btn btn-secondary" data-action="start-today" data-day="${esc(state.day)}">${I('play',16)} Entrenar</button>`:''}</div>
 <div class="routine-list">${getList().length?getList().map((item,i)=>routineCard(item,i)).join(''):`<div class="empty">${I('calendar',36)}<h3>Hoy no hay ejercicios</h3><p>Añade un ejercicio para empezar a construir tu rutina.</p><button class="btn btn-primary" data-action="add" data-day="${esc(state.day)}">${I('plus',16)} Añadir ejercicio</button></div>`}</div>
 ${getList().length?`<button class="add-dashed" data-action="add" data-day="${esc(state.day)}">${I('plus',19)} Añadir otro ejercicio</button>`:''}`;}
function catalogCards(arr){return arr.map(ex=>`<article class="exercise-card">${art(ex)}<div class="exercise-card-body"><div class="exercise-topline">${esc(ex.muscle)} <span>·</span> ${esc(ex.equipment)}</div><h3>${esc(ex.name)}</h3><div class="exercise-card-actions"><button class="small-link" data-action="detail" data-id="${esc(ex.id)}">Ver detalles ${I('chevron',14)}</button><button class="circle-add" data-action="add-one" data-id="${esc(ex.id)}" title="Añadir a ${esc(state.day)}">${I('plus',17)}</button></div></div></article>`).join('');}
function library(){const q=state.search.toLowerCase().trim();const options=getCatalog().filter(ex=>(state.muscle==='Todos'||ex.muscle===state.muscle)&&(!q||(ex.name+' '+ex.muscle+' '+ex.equipment).toLowerCase().includes(q)));
 return `<div class="section-intro"><div><p>DESCUBRE TU PRÓXIMO MOVIMIENTO</p><h2>Biblioteca de ejercicios.</h2><span>${getCatalog().length} movimientos para construir tu rutina.</span></div><button class="btn btn-secondary" data-action="custom">${I('plus',18)} Ejercicio propio</button></div>
 <div class="catalog-tools"><label class="search-box">${I('search',19)}<input id="searchExercises" data-search="1" type="search" autocomplete="off" placeholder="Buscar ejercicio, músculo..." value="${esc(state.search)}" /></label><div class="filter-scroll">${MUSCLES.map(m=>`<button class="filter-pill ${state.muscle===m?'active':''}" data-muscle="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>
 <div class="catalog-count">${options.length} ejercicios encontrados</div><div id="catalogGrid" class="exercise-grid">${options.length?catalogCards(options):'<div class="empty"><h3>No hay coincidencias</h3><p>Prueba con otro nombre o músculo.</p></div>'}</div>
 <p class="helper-note">${I('info',16)} Las ilustraciones incluidas son originales y orientativas. Puedes añadir tus propios GIFs o imágenes con licencia desde «Ejercicio propio».</p>`;}
function cableDiagram(bars){const positions=bars===4?[88,264]:[176];return `<svg class="machine-diagram" viewBox="0 0 352 190" role="img" aria-label="Máquina con ${bars===4?'dos poleas y cuatro barras':'una polea y dos barras'}"><defs><linearGradient id="steel" x1="0" x2="1"><stop stop-color="#78919b"/><stop offset=".5" stop-color="#c6d3d9"/><stop offset="1" stop-color="#61747d"/></linearGradient></defs>${positions.map((cx,index)=>`<g><rect x="${cx-49}" y="19" width="98" height="144" rx="9" fill="#192a32" stroke="#5c7780" stroke-opacity=".65" stroke-width="2"/><path d="M${cx} 19V162" stroke="url(#steel)" stroke-width="7"/><circle cx="${cx}" cy="37" r="11" fill="#718d95" stroke="#bbced1"/><path d="M${cx-70} 111H${cx+70}" stroke="url(#steel)" stroke-width="9" stroke-linecap="round"/>${[-1,1].map(d=>`<rect x="${cx+d*56-5}" y="90" width="10" height="44" rx="2" fill="#8de0c6"/><rect x="${cx+d*41-5}" y="96" width="10" height="32" rx="2" fill="#4f998c"/>`).join('')}<text x="${cx}" y="182" fill="#acbec3" font-size="12" text-anchor="middle">POLEA ${index+1}</text></g>`).join('')}</svg>`;}
function calcResultMarkup(){const r=state.calcResult;if(!r)return `<div class="calc-placeholder">${I('target',34)}<h3>Tu reparto aparecerá aquí</h3><p>Indica la carga total y pulsa calcular. Se comprobará que tengas suficientes discos.</p></div>`;
 if(!r.ok)return `<div class="calc-placeholder calc-error">${I('info',31)}<h3>No hay una combinación exacta</h3><p>${esc(r.error)}</p></div>`;
 return `<div class="result-head"><div><span class="eyebrow">REPARTO CALCULADO</span><h3>${kg(r.perSide)} <small>por barra</small></h3><p>${kg(r.actualTotal)} repartidos · ${r.loads.length===4?'2 poleas':'1 polea'}</p></div><span class="success-tag">${I('check',16)} Equilibrado</span></div><div class="load-grid">${r.loads.map((items,i)=>`<div class="load-box"><span class="load-index">${r.loads.length===4?`Polea ${Math.floor(i/2)+1} · ${i%2?'Dcha.':'Izda.'}`:`${i?'Barra derecha':'Barra izquierda'}`}</span><strong>${kg(r.perSide)}</strong><div class="load-plates">${items.map(x=>`<span>${x.count} × ${fmt(x.kg)} kg</span>`).join('')}</div><small>${r.plateCounts[i]} discos</small></div>`).join('')}</div>${r.unallocated>0?`<div class="notice">${I('info',18)} Discos sin usar: ${kg(r.unallocated)}. Eso es normal cuando no se puede dividir todo exactamente.</div>`:''}<div class="notice success">${I('check',18)} Cada barra tiene la misma carga. Comprueba también el límite permitido por tu máquina y usa cierres de seguridad.</div>`;}
function calculator(){let r=state.calcResult;return `<div class="section-intro"><div><p>PRECISIÓN EN CADA REPETICIÓN</p><h2>Todos los lados. Igual peso.</h2><span>Calcula cómo repartir tus discos sin sobrepasar el inventario.</span></div><button class="btn btn-secondary" data-nav="ajustes">${I('settings',17)} Mis discos</button></div>
 <div class="calc-grid"><div class="panel calc-controls"><div class="panel-heading"><h3>Configura la carga</h3><span class="mini-icon">${I('calculator')}</span></div><label class="form-label">¿Cuántas poleas vas a cargar?</label><div class="segmented"><button data-action="bars" data-value="4" class="${state.calcBars===4?'active':''}">2 poleas <small>4 barras</small></button><button data-action="bars" data-value="2" class="${state.calcBars===2?'active':''}">1 polea <small>2 barras</small></button></div>
 <div class="diagram-wrap">${cableDiagram(state.calcBars)}</div><label for="calcTotal" class="form-label">Peso TOTAL de discos a repartir (kg)</label><div class="weight-input"><input id="calcTotal" type="number" min="0.25" step="0.25" value="${esc(state.calcTotal)}" inputmode="decimal"/><span>kg</span></div><div class="quick-weights">${[20,40,60,80,120,188.5].map(x=>`<button data-action="preset" data-value="${x}" class="${state.calcTotal===x?'selected':''}">${fmt(x)} kg</button>`).join('')}</div>
 <label class="toggle-row"><input id="calcApprox" type="checkbox" ${state.calcApprox?'checked':''}/><span><strong>Ajustar al reparto viable</strong><small>Si sobra peso, buscar el máximo que se pueda igualar.</small></span></label><button class="btn btn-primary full" data-action="calculate">${I('bolt',18)} Calcular reparto</button><p class="helper-note">Tienes ${kg(inventoryTotal(state.data.inventory))} en discos. En modo dos poleas se divide entre 4 barras, no se carga todo en una sola.</p></div>
 <div class="panel calc-output"><div class="panel-heading"><h3>Resultado de las barras</h3><span class="mini-icon">${I('target')}</span></div>${calcResultMarkup()}</div></div><div class="disclaimer">${I('info',17)} El cálculo iguala la masa de discos por barra. La resistencia que sientes al tirar del cable puede ser diferente según la relación de poleas de la máquina. La calculadora no verifica la capacidad de carga máxima ni la longitud física de las barras.</div>`;}
function history(){const logs=state.logs||[];const completed=logs.length;const volume=logs.reduce((sum,log)=>sum+(log.exercises||[]).reduce((s,ex)=>s+(ex.sets||[]).reduce((v,x)=>v+Number(x.kg||0)*Number(x.reps||0),0),0),0);
 const last=logs.slice(0,8).reverse();const max=Math.max(1,...last.map(l=>l.exercises.reduce((sum,x)=>sum+x.sets.reduce((s,v)=>s+Number(v.kg||0)*Number(v.reps||0),0),0)));
 return `<div class="section-intro"><div><p>LO QUE SE MIDE, MEJORA</p><h2>Tu progreso, en números.</h2><span>Consulta las sesiones terminadas y el volumen registrado.</span></div><button class="btn btn-secondary" data-action="export">${I('download',18)} Exportar</button></div>
 <div class="metrics metrics-two">${stat('Sesiones completadas',String(completed),'check','Historial guardado')}${stat('Volumen acumulado',`${fmt(volume)} kg`,'chart','Suma de peso × repeticiones')}</div>
 <div class="panel history-panel"><div class="panel-heading"><h3>Volumen de tus últimos entrenamientos</h3><span class="mini-icon">${I('chart')}</span></div>${last.length?`<div class="bar-chart">${last.map(l=>{const v=l.exercises.reduce((sum,x)=>sum+x.sets.reduce((s,z)=>s+Number(z.kg||0)*Number(z.reps||0),0),0);return `<div class="chart-item" title="${fmt(v)} kg"><div class="chart-bar" style="height:${Math.max(7,Math.round(v/max*100))}%"></div><small>${new Date(l.date).toLocaleDateString('es-ES',{day:'numeric',month:'numeric'})}</small></div>`}).join('')}</div>`:`<div class="empty mini">${I('chart',31)}<p>Completa un entrenamiento para empezar a ver tus progresos.</p></div>`}</div>
 <div class="section-head"><h2>Historial de sesiones</h2></div><div class="history-list">${logs.length?logs.map(log=>`<button class="history-row" data-action="view-log" data-id="${esc(log.id)}"><span class="history-mark">${I('check')}</span><span><strong>${esc(log.day||'Entrenamiento')}</strong><small>${new Date(log.date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})} · ${(log.exercises||[]).length} ejercicios</small></span>${I('chevron')}</button>`).join(''):`<div class="empty"><h3>Aún no hay entrenamientos</h3><p>Ve a tu rutina, pulsa Entrenar y guarda tu primera sesión.</p><button class="btn btn-primary" data-nav="rutina">Ir a mi rutina</button></div>`}</div>`;}
function settings(){return `<div class="section-intro"><div><p>TODO A TU MEDIDA</p><h2>Personaliza tu gimnasio.</h2><span>Cambia tus datos, discos disponibles y copias de seguridad.</span></div></div><div class="settings-grid"><div class="panel"><div class="panel-heading"><h3>Tu perfil</h3><span class="mini-icon">${I('user')}</span></div><div class="fields"><label>Nombre visible<input id="profileName" maxlength="40" value="${esc(state.data.profile.name)}"/></label><label>Objetivo<input id="profileGoal" maxlength="80" value="${esc(state.data.profile.goal)}"/></label></div><button class="btn btn-primary" data-action="save-profile">${I('check',16)} Guardar perfil</button><div class="divider-line"></div><div class="profile-status">${I(state.demo?'info':'cloud')}<div><strong>${state.demo?'Modo de prueba · almacenamiento local':'Cuenta con sincronización'}</strong><small>${state.demo?'Los datos de esta demo se guardan solo en este navegador.':esc(state.user?.email||'Conectado a Firebase')}</small></div></div>${configured?`<button class="btn btn-secondary" data-action="${state.demo?'show-login':'logout'}">${I(state.demo?'user':'logout',17)} ${state.demo?'Entrar con cuenta':'Cerrar sesión'}</button>`:''}</div>
 <div class="panel"><div class="panel-heading"><h3>Inventario de discos</h3><span class="mini-icon">${I('dumbbell')}</span></div><p class="settings-description">Estos valores son los de tus discos reales. Cambia cantidades cuando compres o retires alguno.</p><div class="inventory-list">${state.data.inventory.map((p,i)=>`<label class="inventory-row"><span><span class="mini-plate"></span>${fmt(p.kg)} kg</span><span class="counter"><button data-action="adjust-stock" data-index="${i}" data-value="-1" aria-label="Quitar disco de ${fmt(p.kg)} kg">−</button><input aria-label="Cantidad de ${fmt(p.kg)} kg" data-stock="${i}" type="number" min="0" max="100" value="${toInt(p.count)}"/><button data-action="adjust-stock" data-index="${i}" data-value="1" aria-label="Añadir disco de ${fmt(p.kg)} kg">+</button></span></label>`).join('')}</div><div class="inventory-total"><span>Total disponible</span><strong>${kg(inventoryTotal(state.data.inventory))}</strong></div><div class="settings-buttons"><button class="btn btn-secondary" data-action="reset-stock">Restablecer inventario</button><button class="btn btn-primary" data-nav="calculadora">Usar calculadora ${I('arrow',15)}</button></div></div>
 <div class="panel"><div class="panel-heading"><h3>Datos y copias de seguridad</h3><span class="mini-icon">${I('download')}</span></div><p class="settings-description">Descarga tus rutinas e historial a un archivo JSON o restaura una copia creada desde esta app.</p><div class="settings-buttons"><button class="btn btn-secondary" data-action="export">${I('download',17)} Exportar mis datos</button><button class="btn btn-secondary" data-action="import">${I('upload',17)} Importar copia</button><input type="file" id="backupFile" accept="application/json,.json" hidden/></div><p class="helper-note">Las importaciones sustituyen tus rutinas, inventario e historial actuales. No exportamos contraseñas.</p></div>
 <div class="panel"><div class="panel-heading"><h3>Instalar en iPhone</h3><span class="mini-icon">${I('heart')}</span></div><p class="settings-description">Abre la web publicada en <strong>Safari</strong>, pulsa <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>. Se abrirá a pantalla completa como una aplicación.</p><div class="notice">${I('info',17)} En un iPhone no se abre la dirección de tu repositorio GitHub. Se abre la URL pública de GitHub Pages.</div></div></div>`;}
function training(){const entries=getList(state.trainingDay||state.day);
 return `<div class="training-banner"><div><div class="eyebrow">SESIÓN EN CURSO</div><h2>Entrenamiento de ${esc(state.trainingDay||state.day)}</h2><p>Registra el peso y las repeticiones reales de cada serie.</p></div><button class="btn btn-secondary" data-action="stop-training">Salir</button></div><div class="training-list">${entries.map((entry,i)=>{const ex=getEx(entry.id);const draft=state.draft[i]||[];return `<div class="panel training-card"><div class="training-title">${art(ex,'tiny')}<div><span class="eyebrow">EJERCICIO ${i+1}</span><h3>${esc(ex.name)}</h3><p>${entry.sets} series planificadas</p></div></div><div class="set-head"><span>SERIE</span><span>REPETICIONES</span><span>PESO (KG)</span></div>${draft.map((set,j)=>`<div class="set-row"><span>${j+1}</span><input data-draft="reps" data-exindex="${i}" data-setindex="${j}" type="number" min="0" max="999" inputmode="numeric" value="${esc(set.reps)}"/><input data-draft="kg" data-exindex="${i}" data-setindex="${j}" type="number" min="0" max="9999" step="0.25" inputmode="decimal" value="${esc(set.kg)}"/></div>`).join('')}<button class="small-link" data-action="add-set" data-exindex="${i}">${I('plus',15)} Añadir serie</button></div>`}).join('')}</div><div class="training-footer"><button class="btn btn-primary" data-action="finish-training">${I('check',19)} Guardar entrenamiento</button></div>`;}
function renderModal(){const m=state.modal;if(!m)return '';
 let content='';
 if(m.type==='add'){
  const matches=getCatalog().filter(x=>(x.name+' '+x.muscle).toLowerCase().includes((m.query||'').toLowerCase()));
  content=`<div class="modal-kicker">ELIGE TU MOVIMIENTO</div><h2>Añadir ejercicio a ${esc(m.day)}</h2><label class="search-box modal-search">${I('search')}<input id="modalSearch" type="search" placeholder="Buscar ejercicios..." value="${esc(m.query||'')}"/></label><div class="modal-list">${matches.slice(0,55).map(x=>`<button class="modal-ex" data-action="select-exercise" data-id="${esc(x.id)}" data-day="${esc(m.day)}">${art(x,'micro')}<span><strong>${esc(x.name)}</strong><small>${esc(x.muscle)} · ${esc(x.equipment)}</small></span>${I('plus',18)}</button>`).join('')||'<p>No hay ejercicios con ese nombre.</p>'}</div>`;
 }else if(m.type==='edit' || m.type==='configure'){
  const e=m.type==='edit'?getList(m.day)[m.index]:null,ex=getEx(m.id||e?.id);
  content=`<div class="modal-kicker">CONFIGURAR ENTRENAMIENTO</div><h2>${esc(ex.name)}</h2><p class="modal-sub">${esc(ex.muscle)} · ${esc(ex.equipment)}</p><form id="exerciseForm"><div class="form-triple"><label>Series<input name="sets" type="number" min="1" max="20" required value="${e?.sets||3}"/></label><label>Repeticiones<input name="reps" type="number" min="1" max="999" required value="${e?.reps||12}"/></label><label>Peso (kg)<input name="kg" type="number" step="0.25" min="0" max="9999" required value="${e?.kg??0}"/></label></div><button class="btn btn-primary full" type="submit">${I('check',17)} ${m.type==='edit'?'Guardar cambios':'Añadir a la rutina'}</button></form>`;
 }else if(m.type==='detail'){
  const ex=getEx(m.id);content=`<div class="detail-visual">${art(ex,'large')}</div><div class="modal-kicker">${esc(ex.muscle)} · ${esc(ex.equipment)}</div><h2>${esc(ex.name)}</h2><p class="modal-sub">${esc(ex.tip)}</p><button class="btn btn-primary full" data-action="add-one" data-id="${esc(ex.id)}">${I('plus',17)} Añadir a ${esc(state.day)}</button>`;
 }else if(m.type==='custom'){
  content=`<div class="modal-kicker">TU PROPIO CATÁLOGO</div><h2>Crear ejercicio</h2><form id="customForm" class="stack-form"><label>Nombre<input required maxlength="90" name="name" placeholder="Ej. Remo en máquina alta"/></label><label>Grupo muscular<select name="muscle">${MUSCLES.filter(x=>x!=='Todos').map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Material<select name="equipment"><option>Polea</option><option>Mancuernas</option><option>Barra</option><option>Máquina</option><option>Peso corporal</option><option>Otro</option></select></label><label>Enlace HTTPS de GIF / imagen (opcional)<input name="media" type="url" placeholder="https://.../ejercicio.gif"/></label><label>Consejo (opcional)<textarea name="tip" maxlength="200" rows="2"></textarea></label><p class="helper-note">Utiliza únicamente imágenes o GIFs propios, o archivos que tengas permiso de usar.</p><button class="btn btn-primary full" type="submit">Crear ejercicio</button></form>`;
 }else if(m.type==='log'){
  const log=state.logs.find(x=>x.id===m.id);if(log)content=`<div class="modal-kicker">SESIÓN GUARDADA</div><h2>${esc(log.day)}</h2><p class="modal-sub">${new Date(log.date).toLocaleString('es-ES')}</p>${log.exercises.map(x=>`<div class="log-ex"><strong>${esc(getEx(x.id).name)}</strong>${x.sets.map(s=>`<small>${fmt(s.reps)} repeticiones · ${kg(s.kg)}</small>`).join('')}</div>`).join('')}<button class="btn btn-secondary full" data-action="delete-log" data-id="${esc(log.id)}">${I('trash',17)} Eliminar sesión</button>`;
 }
 return `<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(m.type)}" data-stop="true"><button class="modal-close" data-action="close-modal" aria-label="Cerrar">${I('close')}</button>${content}</div></div>`;
}
function authView(){return `<div class="auth-layout"><div class="auth-brand"><div class="brand-auth">${I('dumbbell',29)} <strong>FORGE<span>FIT</span></strong></div><h1>Entrena con un<br/><em>propósito.</em></h1><p>Tus rutinas, tus marcas y tu gimnasio. Todo en un mismo lugar.</p><div class="auth-visual"><div class="auth-orbit"></div>${I('dumbbell',120)}</div></div><div class="auth-form-side"><div class="auth-form-card"><span class="eyebrow">EMPIEZA HOY</span><h2>${state.authMode==='register'?'Crea tu cuenta':state.authMode==='reset'?'Recupera tu cuenta':'Bienvenido de nuevo'}</h2><p>${state.authMode==='register'?'Guarda tu entrenamiento y sincronízalo en todos tus dispositivos.':'Accede a tus entrenamientos y sigue progresando.'}</p><form id="authForm" class="stack-form">${state.authMode==='register'?'<label>Tu nombre<input name="name" autocomplete="name" required maxlength="40" placeholder="¿Cómo te llamas?"/></label>':''}<label>Correo electrónico<input name="email" type="email" required autocomplete="email" placeholder="tu@correo.com"/></label>${state.authMode!=='reset'?`<label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="${state.authMode==='register'?'new-password':'current-password'}" placeholder="Mínimo 6 caracteres"/></label>`:''}<button class="btn btn-primary full" ${state.authBusy?'disabled':''} type="submit">${state.authMode==='register'?'Crear cuenta':state.authMode==='reset'?'Enviar recuperación':'Entrar en mi cuenta'} ${I('arrow',17)}</button></form><div class="auth-switch">${state.authMode==='login'?`¿No tienes cuenta? <button data-action="auth-mode" data-value="register">Regístrate</button>`:state.authMode==='register'?`¿Ya tienes cuenta? <button data-action="auth-mode" data-value="login">Iniciar sesión</button>`:`<button data-action="auth-mode" data-value="login">Volver a iniciar sesión</button>`}</div>${state.authMode==='login'?`<button class="forgot" data-action="auth-mode" data-value="reset">He olvidado mi contraseña</button>`:''}<div class="auth-separator">o prueba antes de registrarte</div><button class="btn btn-secondary full" data-action="demo">Entrar en modo demostración</button><p class="auth-footnote">La demostración guarda los datos únicamente en este navegador.</p></div></div></div>`;}
function render(){
 if(state.loading){root.innerHTML='<div class="loader"><div class="spinner"></div><h2>ForgeFit</h2><p>Cargando tus datos...</p></div>';return;}
 if(state.cloudError && !state.demo){root.innerHTML=`<div class="loader"><h2>No se pudo conectar a Firebase</h2><p>${esc(state.cloudError)}</p><button class="btn btn-primary" data-action="demo">Probar la app sin cuenta</button></div>`;return;}
 if(configured&&!state.demo&&!state.user){root.innerHTML=authView();return;}
 root.innerHTML=`<div class="app-shell">${sidebar()}<div class="main-shell">${header()}<main class="content">${state.training?training():state.page==='inicio'?dashboard():state.page==='rutina'?weekView():state.page==='ejercicios'?library():state.page==='calculadora'?calculator():state.page==='historial'?history():settings()}</main><footer class="app-footer"><span>FORGEFIT · ENTRENAMIENTO INTELIGENTE</span><span>Construye tu progreso, día a día.</span></footer></div>${mobileNav()}</div>${renderModal()}`;
}

function recalc(){state.calcResult=solveLoad(state.data.inventory,state.calcBars,state.calcTotal,{approximate:state.calcApprox});render();}
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
   state.unsubs.forEach(f=>f());state.unsubs=[];
   state.user=user;state.training=false;
   if(!user){state.loading=false;render();return;}
   state.demo=false;state.loading=true;render();
   const ref=api.doc(db,'users',user.uid,'data','main');
   const unsubscribe=api.onSnapshot(ref,async snapshot=>{
    if(snapshot.exists()){
     if(!state.savePending)state.data=normalize(snapshot.data());
    }else{
     const fresh=defaultData();fresh.profile.name=user.displayName||user.email?.split('@')[0]||'Deportista';
     state.data=fresh;
     try{await api.setDoc(ref,fresh);}catch(e){notify('Revisa las reglas de Firestore: '+humanError(e));}
    }
    state.loading=false;render();
   },error=>{state.loading=false;state.cloudError=humanError(error);render();});
   state.unsubs.push(unsubscribe);
   const query=api.query(api.collection(db,'users',user.uid,'logs'),api.orderBy('date','desc'),api.limit(200));
   state.unsubs.push(api.onSnapshot(query,snapshot=>{state.logs=snapshot.docs.map(d=>d.data());render();},error=>notify('Error leyendo el historial: '+humanError(error))));
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
 if(act==='close-modal'){if(e.target.closest('[data-stop]')&&!node.classList.contains('modal-close'))return;state.modal=null;render();return;}
 if(act==='auth-mode'){state.authMode=node.dataset.value;render();return;}
 if(act==='demo'){state.demo=true;state.loading=false;state.cloudError='';state.data=readDemo();state.logs=readLogs();render();return;}
 if(act==='show-login'){state.demo=false;state.user=null;state.authMode='login';render();return;}
 if(act==='logout'&&state.firebase){clearTimeout(state.saveTimer);await state.firebase.authApi.signOut(state.firebase.auth);state.user=null;state.authMode='login';state.demo=false;state.page='inicio';render();return;}
 if(act==='add'){state.modal={type:'add',day:node.dataset.day||state.day,query:''};render();return;}
 if(act==='custom'){state.modal={type:'custom'};render();return;}
 if(act==='detail'){state.modal={type:'detail',id:node.dataset.id};render();return;}
 if(act==='select-exercise'){state.modal={type:'configure',id:node.dataset.id,day:node.dataset.day};render();return;}
 if(act==='add-one'){state.modal={type:'configure',id:node.dataset.id,day:state.day};render();return;}
 if(act==='edit-routine'){state.modal={type:'edit',day:node.dataset.day,index:Number(node.dataset.index)};render();return;}
 if(act==='delete-routine'){state.data.routine[node.dataset.day].splice(Number(node.dataset.index),1);saveData();render();notify('Ejercicio eliminado de la rutina');return;}
 if(act==='move'){const a=state.data.routine[node.dataset.day],i=Number(node.dataset.index),j=i+Number(node.dataset.dir);if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];saveData();render();return;}
 if(act==='start-today'){beginTraining(node.dataset.day||state.day);return;}
 if(act==='stop-training'){state.training=false;render();return;}
 if(act==='add-set'){const i=Number(node.dataset.exindex),last=state.draft[i].at(-1)||{reps:10,kg:0};state.draft[i].push({...last});render();return;}
 if(act==='finish-training'){
  const day=state.trainingDay||state.day;const exercises=getList(day).map((ex,i)=>({id:ex.id,sets:clone(state.draft[i]||[])}));
  const log={id:uid(),date:stamp(),day,exercises};await saveLog(log);state.training=false;state.page='historial';render();notify('¡Entrenamiento guardado!');return;
 }
 if(act==='bars'){state.calcBars=Number(node.dataset.value);state.calcResult=null;render();return;}
 if(act==='preset'){state.calcTotal=Number(node.dataset.value);state.calcResult=null;recalc();return;}
 if(act==='calculate'){state.calcTotal=Number($('#calcTotal')?.value);state.calcApprox=Boolean($('#calcApprox')?.checked);recalc();return;}
 if(act==='adjust-stock'){const i=Number(node.dataset.index);state.data.inventory[i].count=toInt(state.data.inventory[i].count+Number(node.dataset.value),0,100);state.calcResult=null;saveData();render();return;}
 if(act==='reset-stock'){if(confirm('¿Restablecer las cantidades originales de discos?')){state.data.inventory=clone(DEFAULT_INVENTORY);state.calcResult=null;saveData();render();}return;}
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
 e.preventDefault();const f=e.target,form=new FormData(f);
 if(f.id==='authForm'){
  if(!state.firebase){notify('Firebase aún no está conectado.');return;}
  state.authBusy=true;const {auth,authApi}=state.firebase;
  try{
   if(state.authMode==='register'){
    const result=await authApi.createUserWithEmailAndPassword(auth,String(form.get('email')),String(form.get('password')));
    const name=String(form.get('name')).trim().slice(0,40);
    await authApi.updateProfile(result.user,{displayName:name});
    const first=defaultData();first.profile.name=name||'Deportista';
    await state.firebase.api.setDoc(state.firebase.api.doc(state.firebase.db,'users',result.user.uid,'data','main'),first);
    notify('¡Cuenta creada!');
   }else if(state.authMode==='reset'){
    await authApi.sendPasswordResetEmail(auth,String(form.get('email')));state.authMode='login';notify('Si existe una cuenta con ese correo, recibirá instrucciones.');
   }else await authApi.signInWithEmailAndPassword(auth,String(form.get('email')),String(form.get('password')));
  }catch(err){notify(humanError(err));}finally{state.authBusy=false;render();}
  return;
 }
 if(f.id==='exerciseForm'){
  const m=state.modal,entry={id:m.type==='edit'?getList(m.day)[m.index].id:m.id,sets:toInt(form.get('sets'),1,20),reps:toInt(form.get('reps'),1,999),kg:toNum(form.get('kg'),0,9999)};
  if(m.type==='edit')state.data.routine[m.day][m.index]=entry;else state.data.routine[m.day].push(entry);
  state.day=m.day;state.modal=null;state.page='rutina';saveData();render();notify('Rutina actualizada');return;
 }
 if(f.id==='customForm'){
  const media=String(form.get('media')||'').trim();
  if(media&&!/^https:\/\//i.test(media)){notify('La URL de imagen debe comenzar por https://');return;}
  const ex={id:'custom-'+uid(),name:String(form.get('name')).trim().slice(0,90),muscle:String(form.get('muscle')),equipment:String(form.get('equipment')),type:'pull',tip:String(form.get('tip')||'').slice(0,200),media};
  state.data.customExercises.push(ex);state.modal=null;saveData();render();notify('Ejercicio propio creado');return;
 }
});
root.addEventListener('change',e=>{
 const node=e.target;
 if(node.matches('[data-stock]')){const i=Number(node.dataset.stock);state.data.inventory[i].count=toInt(node.value,0,100);state.calcResult=null;saveData();render();}
 if(node.matches('[data-draft]')){const i=Number(node.dataset.exindex),j=Number(node.dataset.setindex),key=node.dataset.draft;if(state.draft[i]?.[j])state.draft[i][j][key]=key==='kg'?toNum(node.value):toInt(node.value);}
 if(node.id==='backupFile'){
  const file=node.files?.[0];if(!file)return;
  file.text().then(async text=>{
   try{
    const json=JSON.parse(text);
    if(json.app!=='ForgeFit'||!json.data||!Array.isArray(json.logs))throw Error('El archivo no es una copia válida de ForgeFit.');
    if(!confirm('Se sustituirán tu rutina, inventario e historial. ¿Continuar?'))return;
    state.data=normalize(json.data);state.logs=json.logs.filter(x=>x&&typeof x==='object'&&typeof x.id==='string').slice(0,200);
    state.calcResult=null;saveData();
    if(!state.demo&&state.firebase){
     const {api,db}=state.firebase,collectionRef=api.collection(db,'users',state.user.uid,'logs');
     const old=await api.getDocs(collectionRef),newIds=new Set(state.logs.map(x=>x.id));
     const batch=api.writeBatch(db);
     old.docs.filter(d=>!newIds.has(d.id)).forEach(d=>batch.delete(d.ref));
     state.logs.forEach(log=>batch.set(api.doc(db,'users',state.user.uid,'logs',log.id),log));
     await batch.commit();
    }
    render();notify('Copia importada correctamente');
   }catch(e){notify('No se pudo importar: '+humanError(e));}
  });
 }
});
root.addEventListener('input',e=>{
 if(e.target.id==='searchExercises'){
  state.search=e.target.value;const results=getCatalog().filter(ex=>(state.muscle==='Todos'||ex.muscle===state.muscle)&&(ex.name+' '+ex.muscle+' '+ex.equipment).toLowerCase().includes(state.search.toLowerCase().trim()));
  const node=$('#catalogGrid');if(node)node.innerHTML=results.length?catalogCards(results):'<div class="empty">No hay coincidencias</div>';
  const c=$('.catalog-count');if(c)c.textContent=`${results.length} ejercicios encontrados`;
 }
 if(e.target.id==='modalSearch'&&state.modal?.type==='add'){
  state.modal.query=e.target.value;const selected=e.target.selectionStart;
  render();const input=$('#modalSearch');if(input){input.focus();input.setSelectionRange(selected,selected);}
 }
});

if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(configured)startFirebase();else{state.loading=false;render();}
