/**
 * Reparto entero de discos entre 2 o 4 barras de carga.
 * Trabaja en cuartos de kilogramo, sin errores binarios de coma flotante.
 * Busca combinaciones exactas sin superar el inventario. No calcula la
 * resistencia real de un sistema de poleas (depende de su relación).
 */
export const toUnits = kg => Math.round(Number(kg) * 4);
export const fromUnits = units => units / 4;
export function inventoryTotal(inventory) {
  return inventory.reduce((sum, p) => sum + Number(p.kg || 0) * Number(p.count || 0), 0);
}
function choices(max, wanted, weight, remaining) {
  const a = Array.from({length: Math.min(max,Math.floor(remaining/weight))+1},(_,i)=>i);
  return a.sort((x,y)=> {
    // Para cargas altas intenta repartir los tipos de disco proporcionalmente.
    const cx=Math.abs(x-wanted),cy=Math.abs(y-wanted);
    return cx-cy || y-x;
  });
}
function findPatterns(weights, stock, target, sidesLeft, limit, budget) {
  const out=[];
  const picked=new Array(weights.length).fill(0);
  const suffix=Array(weights.length+1).fill(0);
  for(let i=weights.length-1;i>=0;i--) suffix[i]=suffix[i+1]+stock[i]*weights[i];
  function walk(i,remain) {
    if(out.length>=limit || budget.left--<=0) return;
    if(remain===0) {out.push([...picked]);return;}
    if(i===weights.length || remain<0 || suffix[i]<remain) return;
    const w=weights[i], max=Math.min(stock[i],Math.floor(remain/w));
    for(const k of choices(max,stock[i]/sidesLeft,w,remain)) {
      picked[i]=k;
      walk(i+1,remain-k*w);
      if(out.length>=limit || budget.left<=0) break;
    }
    picked[i]=0;
  }
  walk(0,target);
  return out;
}
export function solveLoad(inventory, sides, requestedTotal, {approximate=false}={}) {
  if(![2,4].includes(sides)) return {ok:false,error:'La máquina debe tener 2 o 4 barras de carga.'};
  const clean=(inventory||[]).map(p=>({kg:Number(p.kg),count:Number(p.count)}))
    .filter(p=>Number.isInteger(toUnits(p.kg))&&p.kg>0&&Number.isInteger(p.count)&&p.count>=0)
    .sort((a,b)=>b.kg-a.kg);
  if(!clean.length) return {ok:false,error:'Primero configura tus discos.'};
  const total=inventoryTotal(clean), want=Number(requestedTotal);
  if(!Number.isFinite(want)||want<=0) return {ok:false,error:'Introduce un peso total mayor que cero.'};
  const weights=clean.map(p=>toUnits(p.kg)), original=clean.map(p=>p.count);
  const available=weights.reduce((s,w,i)=>s+w*original[i],0);
  const requestedUnits=Math.min(available,Math.floor(want*4+1e-7));
  const maximum=Math.floor(requestedUnits/sides);
  const minTarget=approximate?1:maximum;
  for(let perSide=maximum;perSide>=minTarget;perSide--) {
    // Evita buscar repartos que no pueden alcanzar el objetivo con el inventario.
    if(perSide*sides>available) continue;
    const visited=new Set();
    const budget={left:160000};
    function split(side,stock) {
      if(side===sides) return [];
      const required=(sides-side)*perSide;
      if(weights.reduce((sum,w,i)=>sum+w*stock[i],0)<required) return null;
      const key=side+':'+stock.join(',');
      if(visited.has(key)) return null;
      const availablePatterns=findPatterns(weights,stock,perSide,sides-side,side===sides-1?1:110,budget);
      for(const pattern of availablePatterns) {
        const newStock=stock.map((n,i)=>n-pattern[i]);
        if(newStock.some(n=>n<0)) continue;
        if(side===sides-1) return [pattern];
        const solution=split(side+1,newStock);
        if(solution) return [pattern,...solution];
        if(budget.left<=0) break;
      }
      visited.add(key);
      return null;
    }
    const chosen=split(0,original);
    if(chosen) {
      const loads=chosen.map(pattern=>pattern.map((count,i)=>({kg:clean[i].kg,count})).filter(p=>p.count>0));
      const used=loads.reduce((sum,plates)=>sum+inventoryTotal(plates),0);
      return {ok:true,requestedTotal:want,perSide:fromUnits(perSide),actualTotal:used,
        unallocated:Math.round((total-used)*100)/100,loads,exact:Math.abs(used-want)<1e-8,
        plateCounts:loads.map(a=>a.reduce((sum,p)=>sum+p.count,0))};
    }
    if(!approximate) break;
  }
  return {ok:false,error:approximate?'No se encontró una combinación compatible con los discos disponibles. Prueba otro peso.':'No se encontró un reparto exacto con el inventario actual. Activa «ajustar al peso viable» o cambia el objetivo.'};
}
