/**
 * Catálogo enlazado de ExerciseGymGifsDB.
 * Los GIFs no se empaquetan ni se copian a ForgeFit: se cargan desde
 * las URLs indicadas por su API pública, cuando hay conexión.
 * Fuente: https://github.com/JahelCuadrado/ExerciseGymGifsDB
 */
export const EXERCISE_DB_SOURCE = 'https://github.com/JahelCuadrado/ExerciseGymGifsDB';
const BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0';
const MUSCLE = {
  pectorals:'Pecho', lats:'Espalda', 'upper-back':'Espalda', traps:'Espalda', spine:'Espalda',
  quads:'Piernas', hamstrings:'Piernas', calves:'Piernas', abductors:'Piernas', adductors:'Piernas',
  glutes:'Glúteos', delts:'Hombros', biceps:'Bíceps', triceps:'Tríceps', forearms:'Bíceps',
  abs:'Abdominales', cardio:'Cardio', 'levator-scapulae':'Espalda', 'serratus-anterior':'Pecho'
};
const EQUIPMENT = {
  barbell:'Barra', dumbbell:'Mancuernas', cable:'Polea', machine:'Máquina',
  bodyweight:'Peso corporal', band:'Banda', kettlebell:'Kettlebell', smith:'Máquina Smith',
  'ez-bar':'Barra Z', lever:'Máquina', other:'Otro'
};
const validMedia = url => {
  try {const u = new URL(url); return u.protocol === 'https:' && (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'raw.githubusercontent.com') ? u.href : '';}
  catch {return '';}
};
/**
 * The source id is the ONLY link between an exercise and its GIF.
 * In particular, never infer a GIF from similar Spanish names.
 */
export function normalizeExerciseRecord(row) {
  if(!row || typeof row !== 'object' || typeof row.id !== 'string' || typeof row.name !== 'string') return null;
  const id = row.id.trim();
  if(!/^[a-z0-9-]+\/[a-z0-9-]+$/i.test(id))return null;
  const file = typeof row.file === 'string' ? row.file.replace(/^\/+/, '') : '';
  // Only accept a GIF path that matches this very same exercise id.
  if(file && file !== `${id}.gif`)return null;
  const gif = validMedia(row.gifUrl || `${BASE}/${id}.gif`);
  if(!gif || !gif.endsWith(`/${id}.gif`))return null;
  const alias = id.split('/')[1].replace(/-/g,' ');
  const hints = alias.replace(/incline/g,'inclinado').replace(/decline/g,'declinado')
    .replace(/barbell/g,'barra').replace(/dumbbell/g,'mancuernas')
    .replace(/cable/g,'polea').replace(/bench/g,'banca');
  return {
    id:'db:'+id,
    sourceId:id,
    name:row.name.trim().slice(0,130),
    muscle:MUSCLE[String(row.muscle)] || 'Otros',
    equipment:EQUIPMENT[String(row.equipment)] || 'Otro',
    type:row.equipment === 'cable' ? 'cable' : 'pull',
    tip:Array.isArray(row.instructions)?row.instructions.slice(0,5).map(String).join(' ').slice(0,700):'',
    media:gif,
    keywords:`${alias} ${hints}`,
    source:'ExerciseGymGifsDB'
  };
}
export async function fetchExerciseCatalog({signal}={}) {
  const response=await fetch(`${BASE}/api/es/exercises.json`,{signal,cache:'force-cache'});
  if(!response.ok)throw Error('Catálogo no disponible ('+response.status+')');
  const payload=await response.json();
  const items=Array.isArray(payload)?payload:Array.isArray(payload.exercises)?payload.exercises:Array.isArray(payload.data)?payload.data:[];
  if(!Array.isArray(items) || items.length===0)throw Error('Formato de catálogo no reconocido');
  return [...new Map(items.map(normalizeExerciseRecord).filter(Boolean).map(ex=>[ex.id,ex])).values()];
}
