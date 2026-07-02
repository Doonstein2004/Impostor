import { ScrollView, View } from 'react-native';
import { Text } from './Text';

interface Section {
  title: string;
  body: string[];
  anchorId?: string;
}

const SECTIONS: Section[] = [
  {
    title: '1. Qué datos recolectamos',
    body: [
      'Nombre de jugador: el nombre que elegís al entrar a una sala. Es visible para los demás jugadores de esa sala.',
      'Identificador de dispositivo: al abrir la app se genera un identificador aleatorio guardado localmente en tu dispositivo (no es tu nombre real, ni tu email, ni ningún dato personal). Se usa para saber qué jugador sos dentro de una partida y para guardar tus estadísticas.',
      'Estadísticas de juego: partidas jugadas, veces que fuiste impostor, veces detectado, puntaje. Se guardan asociadas al identificador de dispositivo, no a tu identidad real.',
      'Mensajes de chat y reacciones: los mensajes que escribís en el chat de una sala quedan guardados mientras esa sala existe.',
      'Audio (solo si activás la sala de voz): si el host activa el modo audio, tu micrófono se transmite en tiempo real a los demás jugadores de esa sala a través de un proveedor de infraestructura (LiveKit). No grabamos ni almacenamos el audio.',
    ],
  },
  {
    title: '2. Para qué usamos estos datos',
    body: [
      'Únicamente para el funcionamiento del juego: mostrar quién está en la sala, llevar el puntaje, mostrar el chat y habilitar la sala de voz.',
      'No vendemos ni compartimos tus datos con terceros para publicidad. No mostramos anuncios.',
    ],
  },
  {
    title: '3. Con quién compartimos datos',
    body: [
      'Convex: la base de datos donde vive la información de las salas, jugadores y estadísticas.',
      'LiveKit: el proveedor que transmite el audio en tiempo real cuando usás la sala de voz.',
      'Ninguno de estos proveedores usa tus datos para fines propios; solo procesan lo necesario para que la app funcione.',
    ],
  },
  {
    title: '4. Permisos del dispositivo',
    body: [
      'Micrófono: solo se solicita si entrás a una sala con el modo de audio activado, y solo se usa mientras estás conectado a esa sala de voz.',
    ],
  },
  {
    title: '5. Cuánto tiempo guardamos los datos',
    body: [
      'Los mensajes de chat y el estado de la sala se eliminan cuando la sala deja de usarse.',
      'Las estadísticas por dispositivo se mantienen hasta que decidas desinstalar la app o pedirnos que las borremos (ver contacto).',
    ],
  },
  {
    title: '6. Solicitar el borrado de tus datos',
    anchorId: 'borrado-de-datos',
    body: [
      'Impostor Fútbol no tiene sistema de cuentas, así que no hay "cuenta" que borrar — pero podés pedirnos en cualquier momento que eliminemos los datos asociados a tu dispositivo (identificador de dispositivo, nombre de jugador guardado y estadísticas de partidas).',
      'Pasos para solicitarlo: escribinos a doonstein@gmail.com indicando el nombre de jugador que usás en la app (y, si lo tenés, el código de alguna sala en la que jugaste, para poder ubicar tus datos más rápido).',
      'Qué se borra: tus estadísticas (partidas jugadas, veces impostor, puntaje) y tu nombre guardado. Qué se conserva: los mensajes de chat y datos de salas ya finalizadas no identifican a nadie más allá del nombre que se ve en pantalla y de todos modos se eliminan automáticamente cuando la sala deja de usarse.',
      'Procesamos estas solicitudes dentro de los 30 días de recibidas.',
    ],
  },
  {
    title: '7. Normas de la comunidad',
    body: [
      'Impostor Fútbol incluye chat de texto y, opcionalmente, sala de voz en vivo entre los jugadores de una misma sala. No se permite acoso, lenguaje discriminatorio, contenido sexual, spam ni cualquier otra conducta abusiva.',
      'Cualquier jugador puede reportar a otro desde el chat (mantené presionado un mensaje) o desde la lista de jugadores de la sala (ícono 🚩), indicando el motivo. El reporte queda registrado para revisión — no se lo notificamos a la persona reportada.',
      'Además, quien creó la sala (el host) puede expulsar a cualquier jugador en cualquier momento.',
      'Ante reportes reiterados o conductas graves, podemos bloquear el acceso a la app desde ese dispositivo.',
    ],
  },
  {
    title: '8. Contacto',
    body: [
      'Si tenés preguntas sobre esta política de privacidad, escribinos a: doonstein@gmail.com',
    ],
  },
];

export function PrivacyPolicy() {
  return (
    <ScrollView className="flex-1 bg-surface px-4" contentContainerStyle={{ paddingVertical: 24 }}>
      <Text variant="display" className="mb-2">
        Política de privacidad
      </Text>
      <Text variant="muted" className="mb-6">
        Última actualización: julio de 2026 — Impostor Fútbol
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title} nativeID={section.anchorId} className="mb-6">
          <Text variant="title" className="mb-2">
            {section.title}
          </Text>
          {section.body.map((paragraph, i) => (
            <Text key={i} variant="body" className="mb-2">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
