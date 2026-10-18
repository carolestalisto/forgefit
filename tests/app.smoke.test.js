import test from 'node:test';
import assert from 'node:assert/strict';

// Verifica que la interfaz básica se representa y que la calculadora
// se puede accionar sin frameworks ni compilación.
test('inicio y cálculo de cuatro barras',async()=>{
 const listeners={};
 const root={innerHTML:'',addEventListener:(k,callback)=>{listeners[k]=callback;}};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const controls={
  '#root':root,'#toast':toast,
  '#calcTotal':{value:'188.5'},'#calcApprox':{checked:true}
 };
 globalThis.localStorage={getItem(){return null;},setItem(){}};
 globalThis.document={querySelector:k=>controls[k]||null};
 globalThis.window={scrollTo(){}};
 await import('../src/app.js');
 assert.match(root.innerHTML,/Más fuerte/);
 const dispatch=async dataset=>{
  const node={dataset,disabled:false,hasAttribute(){return false;},classList:{contains(){return false;}}};
  await listeners.click({target:{closest(){return node;}}});
 };
 await dispatch({nav:'calculadora'});
 assert.match(root.innerHTML,/Configura la carga/);
 await dispatch({action:'calculate'});
 assert.match(root.innerHTML,/47 kg/);
 assert.match(root.innerHTML,/0,5 kg/);
 assert.match(root.innerHTML,/Equilibrado/);
});
