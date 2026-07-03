import { ScrollView, View } from 'react-native';
import { Text } from './Text';

interface Section {
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    title: '1. Qué es Impostor Fútbol',
    body: [
      'Impostor Fútbol es un juego social gratuito para grupos: cada jugador recibe el nombre de un futbolista y uno o más impostores deben pasar desapercibidos mientras el resto intenta descubrirlos.',
      'No requiere registro ni cuenta — alcanza con elegir un nombre para jugar.',
    ],
  },
  {
    title: '2. Conducta esperada',
    body: [
      'Al usar el chat o la sala de voz, no está permitido el acoso, el lenguaje discriminatorio, el contenido sexual, el spam ni cualquier otra conducta abusiva hacia otros jugadores.',
      'El host de una sala puede expulsar a cualquier jugador en cualquier momento. Cualquier jugador puede reportar a otro (ver "Normas de la comunidad" en la política de privacidad).',
      'Nos reservamos el derecho de bloquear el acceso a la app desde un dispositivo ante conductas graves o reportes reiterados.',
    ],
  },
  {
    title: '3. Contenido y personajes',
    body: [
      'Los nombres de futbolistas y directores técnicos que aparecen en el juego son de dominio público (figuras públicas conocidas). No implican ningún vínculo, aprobación o patrocinio de esas personas.',
      'El contenido que generás vos (nombre de jugador, mensajes de chat) es tu responsabilidad. No publiques información personal tuya ni de terceros.',
    ],
  },
  {
    title: '4. Disponibilidad del servicio',
    body: [
      'La app depende de servicios de terceros (Convex para la base de datos, LiveKit para audio) y puede tener interrupciones fuera de nuestro control.',
      'No garantizamos disponibilidad continua ni la conservación indefinida de tus datos — ver la política de privacidad para plazos de retención.',
    ],
  },
  {
    title: '5. Sin garantías',
    body: [
      'La app se ofrece "tal cual", sin garantías de ningún tipo. Es un juego casual gratuito, no una herramienta profesional.',
    ],
  },
  {
    title: '6. Cambios a estos términos',
    body: [
      'Podemos actualizar estos términos ocasionalmente. Los cambios importantes se van a reflejar acá, con la fecha de última actualización.',
    ],
  },
  {
    title: '7. Contacto',
    body: [
      'Preguntas sobre estos términos: escribinos a doonstein@gmail.com',
    ],
  },
];

export function TermsOfService() {
  return (
    <ScrollView className="flex-1 bg-surface px-4" contentContainerStyle={{ paddingVertical: 24 }}>
      <Text variant="display" className="mb-2">
        Términos de servicio
      </Text>
      <Text variant="muted" className="mb-6">
        Última actualización: julio de 2026 — Impostor Fútbol
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title} className="mb-6">
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
