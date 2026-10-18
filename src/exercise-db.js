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
  try {const u = new URL(url);return u.protocol === 'https:' && (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'raw.githubusercontent.com') ? u.href : '';}
  catch {return '';}
};
export function normalizeExerciseRecord(row) {
  if(!row || typeof row !== 'object' || !row.id || !row.name)return null;
  const id=String(row.id).slice(0,150);
  const file = String(row.file||'').replace(/^\/+/, '');
  const media=validMedia(row.gifUrl || (file ? `${BASE}/${file}` : ''));
  return {
    id:'db:'+id,
    name:String(row.name).trim().slice(0,110),
    muscle:MUSCLE[String(row.muscle)] || 'Otros',
    equipment:EQUIPMENT[String(row.equipment)] || 'Otro',
    type:'pull',
    tip:Array.isArray(row.instructions)?row.instructions.slice(0,5).map(String).join(' ').slice(0,700):'',
    media,
    source:'ExerciseGymGifsDB'
  };
}
export async function fetchExerciseCatalog({signal}={}) {
  const response=await fetch(`${BASE}/api/es/exercises.json`,{signal,cache:'force-cache'});
  if(!response.ok)throw Error('Catálogo no disponible ('+response.status+')');
  const payload=await response.json();
  const items=Array.isArray(payload)?payload:Array.isArray(payload.exercises)?payload.exercises:Array.isArray(payload.data)?payload.data:[];
  if(!Array.isArray(items) || items.length===0)throw Error('Formato de catálogo no reconocido');
  return items.map(normalizeExerciseRecord).filter(Boolean);
}
