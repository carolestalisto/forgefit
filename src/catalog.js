// Catálogo editorial creado para este proyecto. Sin imágenes de terceros de licencia dudosa.
// Los ejercicios personales pueden contener la URL de GIF/imagen de la que tengas derechos.
const make = (id, name, muscle, equipment, type, tip) => ({ id, name, muscle, equipment, type, tip, media: '' });
export const EXERCISES = [
 make('press-banca','Press de banca','Pecho','Barra','push','Mantén los hombros estables y controla la bajada.'),
 make('press-banca-inclinado-barra','Press de banca inclinado con barra','Pecho','Barra','push','Coloca el banco inclinado y baja la barra con control.'),
 make('press-inclinado','Press de banca inclinado con mancuernas','Pecho','Mancuernas','push','Banco ligeramente inclinado y recorrido controlado.'),
 make('aperturas','Aperturas con mancuernas','Pecho','Mancuernas','push','Flexiona ligeramente los codos durante el movimiento.'),
 make('cruce-poleas','Cruce de poleas','Pecho','Polea','cable','Mantén una posición estable y acerca las manos al frente.'),
 make('press-pecho-polea','Press de pecho en polea','Pecho','Polea','cable','Empuja en línea con el pecho sin arquear la espalda.'),
 make('flexiones','Flexiones','Pecho','Peso corporal','push','Mantén abdomen firme y cuerpo alineado.'),
 make('dominadas','Dominadas','Espalda','Peso corporal','pull','Evita balancearte e inicia con las escápulas.'),
 make('jalon-pecho','Jalón al pecho','Espalda','Polea','cable','Lleva la barra al pecho sin tirar con impulso.'),
 make('remo-polea','Remo sentado en polea','Espalda','Polea','cable','Lleva los codos atrás manteniendo torso estable.'),
 make('remo-barra','Remo con barra','Espalda','Barra','pull','Espalda neutra y caderas estables.'),
 make('remo-mancuerna','Remo con mancuerna','Espalda','Mancuernas','pull','Lleva el codo hacia la cadera.'),
 make('pullover-polea','Pullover en polea','Espalda','Polea','cable','Brazos casi extendidos sin balancear el tronco.'),
 make('peso-muerto','Peso muerto','Espalda','Barra','hinge','Barra cerca del cuerpo y espalda neutra.'),
 make('sentadilla','Sentadilla con barra','Piernas','Barra','squat','Rodillas alineadas y profundidad que controles.'),
 make('sentadilla-goblet','Sentadilla goblet','Piernas','Mancuernas','squat','Mantén la pesa cerca del pecho.'),
 make('prensa','Prensa de piernas','Piernas','Máquina','squat','Evita despegar la cadera del respaldo.'),
 make('zancadas','Zancadas','Piernas','Mancuernas','squat','Controla la rodilla de la pierna adelantada.'),
 make('extension-cuadriceps','Extensión de cuádriceps','Piernas','Máquina','squat','Sube sin golpe y desciende despacio.'),
 make('curl-femoral','Curl femoral','Piernas','Máquina','hinge','No levantes la cadera del banco.'),
 make('peso-muerto-rumano','Peso muerto rumano','Piernas','Barra','hinge','Lleva la cadera atrás con rodillas suaves.'),
 make('hip-thrust','Hip thrust','Glúteos','Barra','hinge','Extiende la cadera sin hiperextender la espalda.'),
 make('patada-gluteo','Patada de glúteo en polea','Glúteos','Polea','cable','Mueve la cadera sin inclinar la espalda.'),
 make('abduccion','Abducción de cadera','Glúteos','Máquina','squat','Evita balancearte para completar repeticiones.'),
 make('elevaciones-gemelos','Elevación de gemelos','Piernas','Máquina','squat','Pausa arriba y baja con control.'),
 make('press-militar','Press militar','Hombros','Barra','push','Aprieta el abdomen y empuja vertical.'),
 make('press-hombros','Press de hombros','Hombros','Mancuernas','push','Evita arquear excesivamente la zona lumbar.'),
 make('elevaciones-laterales','Elevaciones laterales','Hombros','Mancuernas','raise','Eleva los brazos con poco balanceo.'),
 make('face-pull','Face pull en polea','Hombros','Polea','cable','Lleva la cuerda hacia la cara y abre codos.'),
 make('pajaros','Pájaros con mancuernas','Hombros','Mancuernas','raise','Prioriza el deltoides posterior sin impulso.'),
 make('curl-biceps','Curl de bíceps','Bíceps','Mancuernas','curl','Mantén los codos cerca del cuerpo.'),
 make('curl-barra','Curl con barra','Bíceps','Barra','curl','Evita balancear el torso al subir.'),
 make('curl-polea','Curl de bíceps en polea','Bíceps','Polea','cable','Codos quietos durante toda la repetición.'),
 make('curl-martillo','Curl martillo','Bíceps','Mancuernas','curl','Agarre neutro y muñecas alineadas.'),
 make('triceps-polea','Extensión de tríceps en polea','Tríceps','Polea','cable','Mantén los codos pegados al cuerpo.'),
 make('triceps-cuerda','Tríceps con cuerda','Tríceps','Polea','cable','Separa la cuerda al final del movimiento.'),
 make('press-frances','Press francés','Tríceps','Barra','push','Flexiona los codos sin desplazar hombros.'),
 make('fondos','Fondos en paralelas','Tríceps','Peso corporal','push','Baja solamente hasta tu rango cómodo.'),
 make('crunch','Crunch abdominal','Abdominales','Peso corporal','core','Eleva el tronco sin tirar del cuello.'),
 make('plancha','Plancha','Abdominales','Peso corporal','core','Alinea cabeza, cadera y talones.'),
 make('elevaciones-piernas','Elevaciones de piernas','Abdominales','Peso corporal','core','Evita balancearte y controla la pelvis.'),
 make('crunch-polea','Crunch en polea','Abdominales','Polea','cable','Flexiona el tronco sin tirar de brazos.'),
 make('bicicleta','Bicicleta estática','Cardio','Máquina','cardio','Mantén un ritmo que puedas sostener.'),
 make('cinta','Cinta de correr','Cardio','Máquina','cardio','Ajusta velocidad e inclinación a tu nivel.'),
 make('eliptica','Elíptica','Cardio','Máquina','cardio','Sujétate suavemente y busca un ritmo estable.')
];
export const MUSCLES = ['Todos','Pecho','Espalda','Piernas','Glúteos','Hombros','Bíceps','Tríceps','Abdominales','Cardio'];
export const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const DEFAULT_INVENTORY = [
  {kg:10, count:6}, {kg:5, count:8}, {kg:3, count:2}, {kg:2.5, count:6},
  {kg:2, count:16}, {kg:1.5, count:4}, {kg:1.25, count:2}, {kg:1, count:26}, {kg:0.5, count:2}
];
export const STARTER_PLAN = {
  'Lunes':[{id:'press-banca',sets:4,reps:8,kg:30},{id:'press-inclinado',sets:3,reps:10,kg:12},{id:'triceps-polea',sets:3,reps:12,kg:15}],
  'Martes':[{id:'jalon-pecho',sets:4,reps:10,kg:30},{id:'remo-polea',sets:3,reps:10,kg:25},{id:'curl-biceps',sets:3,reps:12,kg:10}],
  'Miércoles':[{id:'sentadilla',sets:4,reps:8,kg:40},{id:'peso-muerto-rumano',sets:3,reps:10,kg:30},{id:'elevaciones-gemelos',sets:3,reps:15,kg:20}],
  'Jueves':[{id:'press-militar',sets:3,reps:8,kg:20},{id:'elevaciones-laterales',sets:3,reps:12,kg:6},{id:'face-pull',sets:3,reps:12,kg:12}],
  'Viernes':[{id:'cruce-poleas',sets:3,reps:12,kg:15},{id:'remo-polea',sets:3,reps:12,kg:20},{id:'plancha',sets:3,reps:45,kg:0}],
  'Sábado':[], 'Domingo':[]
};
