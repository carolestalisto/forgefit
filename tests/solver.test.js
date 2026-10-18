import test from 'node:test';
import assert from 'node:assert/strict';
import {solveLoad,inventoryTotal} from '../src/solver.js';
import {DEFAULT_INVENTORY} from '../src/catalog.js';

test('suma inventario de usuario',()=>assert.equal(inventoryTotal(DEFAULT_INVENTORY),188.5));
test('reparte 60 kg en 4 lados idénticos',()=>{
 const r=solveLoad(DEFAULT_INVENTORY,4,60);
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.perSide,15);
 assert.equal(r.actualTotal,60);
});
test('encuentra 188 kg repartidos y descarta 0,5',()=>{
 const r=solveLoad(DEFAULT_INVENTORY,4,188.5);
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.perSide,47);
 assert.equal(r.actualTotal,188);
 assert.equal(r.unallocated,0.5);
});
test('no usa discos inexistentes',()=>{
 const r=solveLoad(DEFAULT_INVENTORY,4,120);
 assert.equal(r.ok,true,JSON.stringify(r));
 for(const p of DEFAULT_INVENTORY){
  const used=r.loads.reduce((total,group)=>total+(group.find(d=>d.kg===p.kg)?.count||0),0);
  assert.ok(used<=p.count);
 }
});
test('rechaza objetivos negativos',()=>assert.equal(solveLoad(DEFAULT_INVENTORY,4,-12).ok,false));
test('dos barras igualadas',()=>{
 const r=solveLoad([{kg:10,count:2},{kg:5,count:2}],2,30);
 assert.equal(r.ok,true);assert.equal(r.perSide,15);
});
