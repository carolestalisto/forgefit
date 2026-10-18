/** Búsqueda exacta con inventarios separados. Basada en la calculadora facilitada por el usuario. */
export function solvePulleyLoads(plates, totalsKg, maxPerSide = 0, timeLimitMs = 4000) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const W = plates.filter(p => p.count > 0).map(p => ({
    kg: p.kg, w: Math.round(p.kg * 100), count: p.count
  })).sort((a,b) => b.w - a.w);
  const desired = totalsKg.map(kg => Math.round(kg * 50));
  const target = [desired[0], desired[0], desired[1], desired[1]];
  const limit = maxPerSide > 0 ? maxPerSide : 99999;
  const initialMass = W.reduce((a, p) => a + p.w*p.count, 0);
  const neededMass = target.reduce((a,b)=>a+b,0);
  if (neededMass > initialMass) return {status:'impossible',reason:'No tienes suficientes kilos de discos para esa carga.'};
  if (target.some(v=>v<0) || target.some(v=>!Number.isSafeInteger(v))) return {status:'impossible',reason:'Introduce pesos válidos.'};
  if (!W.length) return neededMass === 0 ? {status:'ok', counts: [[],[],[],[]], rows: W, nodes:0} : {status:'impossible',reason:'No tienes discos disponibles.'};
  // Necessary residue bound: a side not divisible by 0.5 kg needs at least
  // one plate whose weight also is not a multiple of 0.5 kg.
  const fractionalBars=target.filter(t=>t%50!==0).length;
  const fractionalDiscs=W.reduce((s,p)=>s+(p.w%50!==0?p.count:0),0);
  if(fractionalBars>fractionalDiscs) return {status:'impossible',reason:'Faltan discos de pesos fraccionarios para equilibrar los cuatro lados exactamente.'};
  const n=W.length;
  const suffixMass = new Array(n+1).fill(0);
  const suffixCount = new Array(n+1).fill(0);
  for(let i=n-1;i>=0;i--){suffixMass[i]=suffixMass[i+1]+W[i].w*W[i].count;suffixCount[i]=suffixCount[i+1]+W[i].count;}
  // Independent subset-sum upper bounds on a single bar, used for safe branch pruning.
  const reach = new Array(n+1);
  const maxT = Math.max(...target);
  reach[n] = new Uint8Array(maxT+1); reach[n][0]=1;
  for(let i=n-1;i>=0;i--){
    const w=W[i].w, c=W[i].count;
    let arr=reach[i+1].slice();
    for(let j=0;j<c;j++) for(let s=maxT;s>=w;s--) if(arr[s-w]) arr[s]=1;
    reach[i]=arr;
  }
  if (target.some(t=>!reach[0][t])) return {status:'impossible',reason:'No puedes formar ese peso en cada lado con las denominaciones disponibles.'};
  const assigned = Array.from({length:4},()=>new Array(n).fill(0));
  const rem=target.slice();
  const cnt=[0,0,0,0];
  let nodes=0;
  let timedOut=false;
  const memo=new Set();
  function dfs(i){
    if ((++nodes & 2047) === 0 && (now()-t0 > timeLimitMs || nodes>4000000)) {timedOut=true;return false;}
    if(i===n) return rem.every(x=>x===0);
    let remTotal=rem.reduce((a,b)=>a+b,0);
    if(remTotal>suffixMass[i]) return false;
    const key = i + ':' + rem.join(',') + (maxPerSide>0 ? ':'+cnt.join(',') : '');
    if(memo.has(key))return false;
    const {w,count}=W[i];
    const minUsed = Math.max(0, Math.ceil((remTotal-suffixMass[i+1])/w));
    const maxUsed = Math.min(count, Math.floor(remTotal/w), rem.reduce((a,r,k)=>a+Math.min(Math.floor(r/w),limit-cnt[k]),0));
    if(minUsed>maxUsed) {memo.add(key);return false;}
    const caps=rem.map((r,k)=>Math.min(Math.floor(r/w), limit-cnt[k], count));
    const possibilities=[];
    for(let a=0;a<=caps[0];a++) for(let b=0;b<=Math.min(caps[1],count-a);b++) for(let c=0;c<=Math.min(caps[2],count-a-b);c++) {
      const maxD=Math.min(caps[3],count-a-b-c);
      const minD=Math.max(0,minUsed-a-b-c);
      for(let d=minD;d<=maxD;d++){
        const used=a+b+c+d;
        if(used<minUsed||used>maxUsed)continue;
        const ar=[a,b,c,d];
        let possible=true;
        for(let k=0;k<4;k++){
          const newR=rem[k]-w*ar[k];
          if(!reach[i+1][newR]) {possible=false;break;}
        }
        if(!possible)continue;
        // Best-first: use larger denominations, distribute each size evenly over four bars,
        // and keep matching plate counts within each pulley wherever practicable.
        const totalR=remTotal||1;
        let fair=0;
        for(let k=0;k<4;k++){
          const ideal= used * rem[k]/totalR;
          fair+=(ar[k]-ideal)*(ar[k]-ideal);
        }
        const pairDifference=Math.abs(a-b)+Math.abs(c-d);
        const perSideCounts=[cnt[0]+a,cnt[1]+b,cnt[2]+c,cnt[3]+d];
        const cntMean=perSideCounts.reduce((s,v)=>s+v,0)/4;
        const countFair=perSideCounts.reduce((s,v)=>s+Math.pow(v-cntMean,2),0);
        const avgNext=suffixCount[i+1] ? suffixMass[i+1]/suffixCount[i+1] : w;
        const estimatedFinal=ar.map((v,k)=>cnt[k]+v+(rem[k]-v*w)/avgNext);
        const estMean=estimatedFinal.reduce((s,v)=>s+v,0)/4;
        const estimatedFair=estimatedFinal.reduce((s,v)=>s+Math.pow(v-estMean,2),0);
        const score= -used*1000 + fair*4 + pairDifference*.5 + countFair*.25 + estimatedFair*3;
        possibilities.push({ar,score});
      }
    }
    possibilities.sort((x,y)=>x.score-y.score);
    for (const choice of possibilities){
      const a=choice.ar;
      for(let k=0;k<4;k++){rem[k]-=a[k]*w;cnt[k]+=a[k]; assigned[k][i]=a[k];}
      if(dfs(i+1))return true;
      for(let k=0;k<4;k++){rem[k]+=a[k]*w;cnt[k]-=a[k];assigned[k][i]=0;}
      if(timedOut) return false;
    }
    if(memo.size < 150000) memo.add(key);
    return false;
  }
  const success=dfs(0);
  if(success){
    const leftovers=W.map((p,j)=>p.count-assigned.reduce((acc,side)=>acc+side[j],0));
    return {status:'ok', counts: assigned, rows:W, leftovers, nodes, elapsed:Math.round(now()-t0)};
  }
  if(timedOut)return {status:'timeout',reason:'Esta combinación necesita más búsqueda. Prueba con pesos cercanos o reduce las denominaciones disponibles.',nodes};
  return {status:'impossible',reason:'No existe una distribución exacta con esos discos y los límites elegidos.',nodes};
}

/** Carga independiente por polea usando únicamente discos reservados a esa polea. */
export function solveSeparated(stock1, stock2, total1, total2, maxPerSide=0) {
  const totals=[total1,total2];
  if(totals.some(n=>!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>1e-6))
    return {ok:false,error:'Introduce pesos válidos con un máximo de dos decimales.'};
  if(totals.some(n=>Math.abs(n*50-Math.round(n*50))>1e-6))
    return {ok:false,error:'El peso total de cada polea debe permitir dos mitades iguales (incrementos de 0,02 kg).'};
  if(!Number.isInteger(maxPerSide)||maxPerSide<0||maxPerSide>9999)
    return {ok:false,error:'El límite de discos por barra debe ser entero, o dejarse vacío.'};
  const all=[stock1,stock2], results=[];
  for(let i=0;i<2;i++) {
    const pool=all[i];
    if(totals[i] > pool.reduce((s,p)=>s+p.kg*p.count,0)+1e-7)
      return {ok:false,error:`La polea ${i+1} no tiene suficientes discos en su soporte reservado.`};
    const r=solvePulleyLoads(pool,[totals[i],0],maxPerSide,4000);
    if(r.status!=='ok')return {ok:false,error:`Polea ${i+1}: ${r.reason||'No se puede obtener ese reparto.'}`};
    results.push(r);
  }
  const loads=results.flatMap(r=>[0,1].map(k=>r.counts[k].map((n,j)=>({kg:r.rows[j].kg,count:n})).filter(p=>p.count>0)));
  const leftovers=results.map((r,i)=>r.rows.map((p,j)=>({kg:p.kg,count:p.count-r.counts[0][j]-r.counts[1][j]})).filter(p=>p.count>0));
  for(let i=0;i<2;i++) {
    for(let side=0;side<2;side++) {
      const weight=loads[2*i+side].reduce((s,p)=>s+p.kg*p.count,0);
      if(Math.abs(weight*2-totals[i])>1e-7)return {ok:false,error:'Error interno al validar el peso por barra.'};
    }
  }
  return {ok:true,totals,loads,leftovers,plateCounts:loads.map(a=>a.reduce((s,p)=>s+p.count,0)),
    actualTotal:totals[0]+totals[1], nodes:results.reduce((s,r)=>s+r.nodes,0)};
}
