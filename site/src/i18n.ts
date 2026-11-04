export type Lang = 'es' | 'en'

/** Every text on the portal, in both languages (a test checks they stay in step). */
export const STRINGS = {
  es: {
    nav: { overview: 'Qué hace', quickstart: 'Guía rápida', guide: 'Integración', errors: 'Errores', reference: 'Referencia', playground: 'Probala' },
    hero: {
      kicker: 'API REST · NestJS · PostgreSQL',
      title: 'Turnos que se agendan solos',
      subtitle: 'El cliente pide "esta semana, a la tarde". La API encuentra el primer horario libre y lo reserva, y el profesional lo confirma o lo rechaza. Nunca se dan dos turnos a la misma hora, aunque lleguen juntos.',
      tryIt: 'Probala en vivo',
      reference: 'Ver los endpoints',
      stats: [
        ['10 → 10', 'pedidos simultáneos, 10 horarios distintos'],
        ['28', 'tests contra PostgreSQL real'],
        ['18', 'endpoints documentados'],
        ['24 h', 'para confirmar antes de que venza'],
      ],
    },
    overview: {
      title: 'Qué hace',
      features: [
        ['Profesionales y servicios', 'Cada profesional publica sus servicios (duración y precio) y su horario semanal, con varios rangos por día y en su propia zona horaria.'],
        ['Agenda automática', 'El cliente no elige un horario de una grilla: dice qué días y qué parte del día le sirven, y la API le asigna el primer horario libre.'],
        ['Confirmación del profesional', 'Cada pedido queda pendiente y guarda el horario hasta que el profesional lo confirma o lo rechaza con un motivo.'],
        ['Vencimientos', 'Si nadie responde a tiempo (24 h por defecto, configurable), el pedido vence, el horario se libera y se avisa al cliente.'],
        ['Notificaciones', 'Pedidos nuevos para el profesional; confirmaciones, rechazos, vencimientos y cancelaciones para el cliente.'],
        ['Cancelaciones con reglas', 'El cliente cancela un pendiente cuando quiera y un confirmado hasta 12 h antes. El profesional puede cancelar siempre.'],
      ],
      problemTitle: 'El problema difícil: diez clientes, el mismo segundo',
      problem: 'Si diez personas piden "el primer horario libre" a la vez, la solución ingenua les da el mismo horario a todas: cada una ve las 9:00 libres y se queda con las 9:00. Esta API hace que los pedidos para un mismo profesional tomen turno en la base de datos, así cada uno ve lo que tomó el anterior y recibe el horario siguiente. Además, una exclusion constraint de PostgreSQL rechaza cualquier turno activo que se superponga con otro.',
      lifecycleTitle: 'La vida de un turno',
      states: [
        ['pending', 'Recién pedido. Guarda el horario hasta que el profesional responda.'],
        ['confirmed', 'El profesional lo aceptó. El cliente recibe una notificación.'],
        ['rejected', 'El profesional lo rechazó con un motivo. El horario se libera.'],
        ['expired', 'Nadie respondió a tiempo: el horario se libera y se avisa al cliente.'],
        ['cancelled', 'Lo canceló el cliente (con 12 h si estaba confirmado) o el profesional.'],
      ],
    },
    quickstart: {
      title: 'Guía rápida: tu primer turno en 4 pasos',
      intro: 'Los ejemplos usan la URL base configurada en "Probala". Copiá el que prefieras: curl, JavaScript o Python.',
      steps: [
        ['Creá una cuenta e iniciá sesión', 'El login devuelve un accessToken (JWT) que dura una hora. Mandalo en cada pedido como Authorization: Bearer <token>.'],
        ['Pedí un turno sin elegir horario', 'Mandá el servicio, el rango de días y la parte del día (morning, afternoon o evening). La API responde con el horario que te asignó, en estado pending.'],
        ['El profesional confirma', 'Desde su bandeja (/appointments/inbox?status=pending) confirma o rechaza. El cliente recibe la notificación.'],
        ['Manejá el "no hay lugar"', 'Si no queda ningún horario libre en ese rango, o el horario exacto que pediste ya está tomado, la API responde 409. Ofrecé ampliar el rango.'],
      ],
      copy: 'Copiar',
      copied: '¡Copiado!',
    },
    guide: {
      title: 'Guía de integración',
      intro: 'Cómo armar las pantallas típicas de una app de turnos encima de esta API.',
      sections: [
        ['Sesión', 'Guardá el token en memoria (o sessionStorage) y mandalo en el header Authorization. Dura una hora: ante un 401, volvé a pedir el login. No hay que guardar contraseñas.'],
        ['Pedir un turno', 'Lo más simple para el usuario: dos selectores ("esta semana", "a la tarde") y un botón. Mandá from, to y timeOfDay; si prefiere elegir el horario, mostrale /providers/{id}/availability y mandá startsAt.'],
        ['Esperar la confirmación', 'El turno nace en pending y trae respondBy: mostrale al cliente "esperando confirmación" y hasta cuándo. Consultá /notifications para enterarte de la respuesta.'],
        ['Bandeja del profesional', 'GET /appointments/inbox?status=pending lista lo que hay que responder. POST /appointments/{id}/confirm o /reject con un motivo que el cliente va a leer.'],
        ['Cancelar', 'POST /appointments/{id}/cancel, desde cualquiera de los dos lados. A los clientes se les piden 12 h de anticipación para un turno confirmado (si no, 409 con el motivo).'],
        ['Zona horaria', 'Los horarios vuelven en UTC. Mostralos en la zona horaria del profesional (provider.timezone) para que "16:00" sea la hora del consultorio, no la del celular.'],
      ],
      tzTitle: 'Mostrar el horario del profesional',
    },
    errors: {
      title: 'Errores y qué mostrarle al usuario',
      intro: 'Todos los errores vienen como JSON con statusCode y message.',
      head: ['Código', 'Cuándo pasa', 'Qué hacer en la app'],
      rows: [
        ['400', 'Datos inválidos, fuera del horario del profesional, fuera de la grilla de 15 minutos o con menos de una hora de anticipación.', 'Mostrar el message: ya viene explicado ("Outside the provider\'s working hours").'],
        ['401', 'Falta el token o venció.', 'Mandar al login.'],
        ['403', 'El usuario no tiene permiso (por ejemplo, un cliente confirmando un turno).', 'Ocultar esa acción para ese rol.'],
        ['404', 'El profesional, el servicio o el turno no existe.', 'Volver al listado.'],
        ['409', 'No hay horarios libres en el rango, el horario ya está tomado, el pedido ya fue respondido o venció, o es tarde para cancelar.', 'Avisar y ofrecer otro rango.'],
      ],
    },
    reference: {
      title: 'Referencia de endpoints',
      intro: 'Generada automáticamente desde el código de la API (OpenAPI), así que nunca queda desactualizada. También está en /docs de la API, con Swagger.',
      auth: 'Requiere token',
      public: 'Público',
      params: 'Parámetros',
      body: 'Cuerpo del pedido',
      responses: 'Respuestas',
      example: 'Ejemplo',
      required: 'obligatorio',
    },
    playground: {
      title: 'Probala en vivo',
      intro: 'Estos botones usan la API de verdad desde tu navegador y muestran cada pedido y respuesta.',
      baseUrl: 'URL de la API',
      online: 'Conectada',
      offline: 'Sin conexión',
      offlineHelp: 'Levantá la API (docker compose up) o poné la URL de una API publicada.',
      tour: 'Recorrido completo',
      tourHelp: 'Una profe de guitarra publica su horario, dos clientes piden "esta semana a la tarde", ella confirma uno y rechaza el otro.',
      race: 'Carrera de 10',
      raceHelp: 'Un día con 10 horarios libres y 10 clientes que piden turno en el mismo instante. Cada casillero es un pedido.',
      running: 'Corriendo…',
      raceResult: (distinct: number, late: number) => `${distinct} clientes, ${distinct} horarios distintos · el 11.º recibe ${late}`,
      clear: 'Limpiar',
      empty: 'Elegí un escenario para empezar.',
    },
    footer: 'Hecho por Pedro Marchiori · código abierto en GitHub',
  },
  en: {
    nav: { overview: 'What it does', quickstart: 'Quickstart', guide: 'Integration', errors: 'Errors', reference: 'Reference', playground: 'Try it' },
    hero: {
      kicker: 'REST API · NestJS · PostgreSQL',
      title: 'Appointments that schedule themselves',
      subtitle: 'A client asks for "this week, in the afternoon". The API finds the first free time and holds it, and the provider confirms or rejects it. Two appointments never land on the same time, even when they arrive together.',
      tryIt: 'Try it live',
      reference: 'See the endpoints',
      stats: [
        ['10 → 10', 'simultaneous requests, 10 different times'],
        ['28', 'tests against real PostgreSQL'],
        ['18', 'documented endpoints'],
        ['24 h', 'to confirm before a request expires'],
      ],
    },
    overview: {
      title: 'What it does',
      features: [
        ['Providers and services', 'Each provider publishes services (duration and price) and a weekly schedule, with several ranges per day, in their own time zone.'],
        ['Automatic scheduling', 'Clients don\'t hunt through a grid. They say which days and which part of the day work for them, and the API assigns the first free time.'],
        ['Provider confirmation', 'Each request stays pending and holds its time until the provider confirms it, or rejects it with a reason.'],
        ['Expiry', 'If nobody answers in time (24 h by default, configurable), the request expires, the time frees up and the client is told.'],
        ['Notifications', 'New requests for providers; confirmations, rejections, expirations and cancellations for clients.'],
        ['Cancellation rules', 'Clients can cancel a pending request anytime and a confirmed one up to 12 h before. Providers can always cancel.'],
      ],
      problemTitle: 'The hard problem: ten clients, the same second',
      problem: 'When ten people ask for "the first free time" at once, the naive approach gives all of them the same time: each one sees 9:00 as free and takes 9:00. This API makes requests for the same provider take turns in the database, so each one sees what the previous one took and gets the next time. On top of that, a PostgreSQL exclusion constraint rejects any active appointment that overlaps another.',
      lifecycleTitle: 'The life of an appointment',
      states: [
        ['pending', 'Just requested. Holds the time until the provider answers.'],
        ['confirmed', 'The provider accepted it. The client gets a notification.'],
        ['rejected', 'The provider turned it down with a reason. The time frees up.'],
        ['expired', 'Nobody answered in time, so the time frees up and the client is told.'],
        ['cancelled', 'Cancelled by the client (12 h ahead if confirmed) or by the provider.'],
      ],
    },
    quickstart: {
      title: 'Quickstart: your first appointment in 4 steps',
      intro: 'The examples use the base URL set in "Try it". Copy the one you prefer: curl, JavaScript or Python.',
      steps: [
        ['Create an account and log in', 'Login returns an accessToken (JWT) valid for one hour. Send it with every request as Authorization: Bearer <token>.'],
        ['Request an appointment without picking a time', 'Send the service, a range of days and a part of the day (morning, afternoon or evening). The API answers with the time it assigned, as pending.'],
        ['The provider confirms', 'From their inbox (/appointments/inbox?status=pending) they confirm or reject. The client gets a notification.'],
        ['Handle "no room"', 'If no time is free in that range, or the exact time you asked for is taken, the API answers 409. Offer a wider range.'],
      ],
      copy: 'Copy',
      copied: 'Copied!',
    },
    guide: {
      title: 'Integration guide',
      intro: 'How to build the usual screens of an appointments app on top of this API.',
      sections: [
        ['Session', 'Keep the token in memory (or sessionStorage) and send it in the Authorization header. It lasts one hour: on a 401, ask the user to log in again. You never store passwords.'],
        ['Requesting', 'The simplest UI: two pickers ("this week", "afternoon") and a button. Send from, to and timeOfDay. If the user prefers to choose, show /providers/{id}/availability and send startsAt.'],
        ['Waiting for confirmation', 'An appointment starts as pending and includes respondBy: show "waiting for confirmation" and the deadline. Poll /notifications to learn the answer.'],
        ['Provider inbox', 'GET /appointments/inbox?status=pending lists what needs an answer. POST /appointments/{id}/confirm, or /reject with a reason the client will read.'],
        ['Cancelling', 'POST /appointments/{id}/cancel, from either side. Clients need 12 hours of notice for a confirmed appointment (otherwise 409 with the reason).'],
        ['Time zones', 'Times come back in UTC. Show them in the provider\'s time zone (provider.timezone), so "16:00" means the time at the practice, not on the phone.'],
      ],
      tzTitle: "Showing the provider's time",
    },
    errors: {
      title: 'Errors, and what to show the user',
      intro: 'Every error comes as JSON with a statusCode and a message.',
      head: ['Code', 'When it happens', 'What the app should do'],
      rows: [
        ['400', "Invalid data, outside the provider's hours, off the 15-minute grid, or less than an hour ahead.", 'Show the message: it already explains the problem ("Outside the provider\'s working hours").'],
        ['401', 'Missing or expired token.', 'Send the user to log in.'],
        ['403', 'The user lacks permission (for example, a client confirming an appointment).', 'Hide that action for that role.'],
        ['404', "The provider, service or appointment doesn't exist.", 'Go back to the list.'],
        ['409', 'No free time in the range, the time is taken, the request was already answered or expired, or it is too late to cancel.', 'Tell the user and offer another range.'],
      ],
    },
    reference: {
      title: 'Endpoint reference',
      intro: "Generated automatically from the API's own code (OpenAPI), so it can never go out of date. It's also at the API's /docs, with Swagger.",
      auth: 'Token required',
      public: 'Public',
      params: 'Parameters',
      body: 'Request body',
      responses: 'Responses',
      example: 'Example',
      required: 'required',
    },
    playground: {
      title: 'Try it live',
      intro: 'These buttons call the real API from your browser and show every request and response.',
      baseUrl: 'API URL',
      online: 'Connected',
      offline: 'Not reachable',
      offlineHelp: 'Start the API (docker compose up) or enter the URL of a deployed one.',
      tour: 'Full walkthrough',
      tourHelp: 'A guitar teacher publishes her hours, two clients ask for "this week, afternoon", she confirms one and rejects the other.',
      race: 'Race of 10',
      raceHelp: 'A day with 10 free times and 10 clients requesting at the same instant. Each square is one request.',
      running: 'Running…',
      raceResult: (distinct: number, late: number) => `${distinct} clients, ${distinct} different times · the 11th gets ${late}`,
      clear: 'Clear',
      empty: 'Pick a scenario to start.',
    },
    footer: 'Made by Pedro Marchiori · open source on GitHub',
  },
}

export type Strings = (typeof STRINGS)['es']

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('cba-lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // storage blocked: use the browser language
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem('cba-lang', lang)
  } catch {
    // fine if it can't be remembered
  }
}
