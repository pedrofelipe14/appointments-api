export type Lang = 'es' | 'en'

/** Every text on the portal, in both languages (a test checks they stay in step). */
export const STRINGS = {
  es: {
    nav: { overview: 'Qué hace', quickstart: 'Guía rápida', guide: 'Integración', errors: 'Errores', reference: 'Referencia', playground: 'Probala' },
    hero: {
      kicker: 'API REST · NestJS · PostgreSQL',
      title: 'Reservas de canchas que nunca se pisan',
      subtitle: 'Una API para que tu app de fútbol muestre turnos libres, reserve y cobre, con la garantía de que dos personas jamás se quedan con la misma cancha a la misma hora.',
      tryIt: 'Probala en vivo',
      reference: 'Ver los endpoints',
      stats: [
        ['25 → 1', 'pedidos simultáneos, una sola reserva'],
        ['27', 'tests contra PostgreSQL real'],
        ['15', 'endpoints documentados'],
        ['15 min', 'para pagar antes de liberar el turno'],
      ],
    },
    overview: {
      title: 'Qué hace',
      features: [
        ['Complejos y canchas', 'Los dueños publican sus canchas con deporte, precio por hora, horarios y largo del turno, en la zona horaria del complejo.'],
        ['Disponibilidad en vivo', 'Para cualquier día, todos los turnos con cuáles están libres. Lo que necesita una grilla de reservas.'],
        ['Reservas a prueba de choques', 'Si dos personas reservan el mismo turno en el mismo instante, una gana y la otra recibe un 409. Lo garantiza la base de datos.'],
        ['Cuentas y roles', 'Jugadores, dueños y admins con JWT. Cada dueño ve y administra solo lo suyo.'],
        ['Reglas de negocio', 'Turnos sin pagar que vencen a los 15 minutos, y cancelación hasta 24 h antes para jugadores. El dueño puede cancelar siempre.'],
        ['Pagos', 'Próximamente: Mercado Pago con un webhook que confirma cada reserva una sola vez.'],
      ],
      problemTitle: 'El problema difícil: dos personas, un turno, el mismo segundo',
      problem: 'La solución ingenua es "primero me fijo si está libre y después reservo". Pero si dos pedidos llegan juntos, los dos ven el turno libre y los dos reservan. Esta API no confía en ese chequeo: la regla vive en PostgreSQL como una exclusion constraint, que rechaza cualquier reserva activa que se superponga con otra en la misma cancha, sin importar el orden en que lleguen.',
      lifecycleTitle: 'La vida de una reserva',
      states: [
        ['pending_payment', 'Recién creada. Guarda el turno 15 minutos.'],
        ['confirmed', 'Pagada (con el webhook de pagos, próximamente).'],
        ['expired', 'Pasaron los 15 minutos sin pagar: el turno se libera.'],
        ['cancelled', 'Cancelada por el jugador (con 24 h) o por el dueño.'],
      ],
    },
    quickstart: {
      title: 'Guía rápida: tu primera reserva en 4 pasos',
      intro: 'Los ejemplos usan la URL base configurada en "Probala". Copiá el que prefieras: curl, JavaScript o Python.',
      steps: [
        ['Creá una cuenta e iniciá sesión', 'El login devuelve un accessToken (JWT) que dura una hora. Mandalo en cada pedido como Authorization: Bearer <token>.'],
        ['Mirá qué turnos hay libres', 'La disponibilidad es pública: pedís un día (en la fecha local del complejo) y recibís cada turno con available: true/false.'],
        ['Reservá', 'startsAt va en ISO 8601 con zona horaria, y la duración es un múltiplo del turno de la cancha. La respuesta trae el precio y hasta cuándo se guarda el turno sin pagar.'],
        ['Manejá el "ya está reservado"', 'Si alguien ganó el turno antes, la API responde 409. Mostrale al usuario que se ocupó y recargá la disponibilidad.'],
      ],
      copy: 'Copiar',
      copied: '¡Copiado!',
    },
    guide: {
      title: 'Guía de integración',
      intro: 'Cómo armar las pantallas típicas de una app de reservas encima de esta API.',
      sections: [
        ['Sesión', 'Guardá el token en memoria (o sessionStorage) y mandalo en el header Authorization. Dura una hora: ante un 401, volvé a pedir el login. No hay que guardar contraseñas.'],
        ['Grilla de turnos', 'Pedí /courts/{id}/availability con la fecha que eligió el usuario. Los horarios vuelven en UTC: mostralos en la zona horaria del complejo (venue.timezone) para que "20:00" sea las 20 h de la cancha, no las del celular.'],
        ['Reservar', 'Mandá startsAt exactamente como vino en la disponibilidad. No marques el turno como tuyo hasta recibir el 201: si llega un 409, otro lo ganó.'],
        ['Pagar', 'La reserva nace en pending_payment y trae expiresAt. Mostrá una cuenta regresiva: si vence, el turno se libera solo.'],
        ['Cancelar', 'POST /bookings/{id}/cancel. A los jugadores se les pide 24 h de anticipación (sino 409 con el motivo); el dueño puede cancelar siempre.'],
        ['Panel del dueño', 'GET /venues/{id}/bookings?date= devuelve la agenda del día de su complejo. Otro dueño recibe 403.'],
      ],
      tzTitle: 'Mostrar el horario del complejo',
    },
    errors: {
      title: 'Errores y qué mostrarle al usuario',
      intro: 'Todos los errores vienen como JSON con statusCode y message.',
      head: ['Código', 'Cuándo pasa', 'Qué hacer en la app'],
      rows: [
        ['400', 'Datos inválidos, fuera de horario, turno que no existe o en el pasado.', 'Mostrar el message: ya viene explicado ("The court opens at 09:00").'],
        ['401', 'Falta el token o venció.', 'Mandar al login.'],
        ['403', 'El usuario no tiene permiso (por ejemplo, un jugador creando canchas).', 'Ocultar esa acción para ese rol.'],
        ['404', 'La cancha, el complejo o la reserva no existe.', 'Volver al listado.'],
        ['409', 'El turno ya está reservado, el email ya existe o es tarde para cancelar.', 'Avisar y recargar la disponibilidad.'],
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
      tourHelp: 'Dueña crea complejo y cancha, un jugador reserva, otro choca con un 409 y se cancela.',
      race: 'Carrera de 25',
      raceHelp: '25 jugadores reservan el mismo turno en el mismo instante. Cada casillero es un pedido.',
      running: 'Corriendo…',
      raceResult: (won: number, lost: number) => `${won} consiguió el turno · ${lost} recibieron 409`,
      clear: 'Limpiar',
      empty: 'Elegí un escenario para empezar.',
    },
    footer: 'Hecho por Pedro Marchiori · código abierto en GitHub',
  },
  en: {
    nav: { overview: 'What it does', quickstart: 'Quickstart', guide: 'Integration', errors: 'Errors', reference: 'Reference', playground: 'Try it' },
    hero: {
      kicker: 'REST API · NestJS · PostgreSQL',
      title: 'Court bookings that never collide',
      subtitle: 'An API that lets your football app show free slots, book and charge for them, and guarantees that two people never end up with the same court at the same time.',
      tryIt: 'Try it live',
      reference: 'See the endpoints',
      stats: [
        ['25 → 1', 'simultaneous requests, one booking'],
        ['27', 'tests against real PostgreSQL'],
        ['15', 'documented endpoints'],
        ['15 min', 'to pay before the slot is released'],
      ],
    },
    overview: {
      title: 'What it does',
      features: [
        ['Venues and courts', "Owners publish courts with their sport, price per hour, opening hours and slot length, in the venue's own time zone."],
        ['Live availability', 'For any day, every slot and whether it is free: exactly what a booking grid needs.'],
        ['Collision-proof bookings', 'If two people book the same slot at the same instant, one wins and the other gets a 409. The database guarantees it.'],
        ['Accounts and roles', 'Players, owners and admins with JWT. Each owner only sees and manages their own venues.'],
        ['Business rules', 'Unpaid holds expire after 15 minutes, and players can cancel up to 24 hours before. Owners can always cancel.'],
        ['Payments', 'Coming next: Mercado Pago, with a webhook that confirms each booking exactly once.'],
      ],
      problemTitle: 'The hard problem: two people, one slot, the same second',
      problem: 'The naive approach is "check if it is free, then book it". But when two requests arrive together, both see the slot as free and both book it. This API doesn\'t trust that check. The rule lives in PostgreSQL as an exclusion constraint, which rejects any active booking that overlaps another on the same court, whatever order the requests arrive in.',
      lifecycleTitle: 'The life of a booking',
      states: [
        ['pending_payment', 'Just created. Holds the slot for 15 minutes.'],
        ['confirmed', 'Paid (through the payments webhook, coming next).'],
        ['expired', '15 minutes passed without payment, so the slot is released.'],
        ['cancelled', 'Cancelled by the player (with 24 h notice) or by the owner.'],
      ],
    },
    quickstart: {
      title: 'Quickstart: your first booking in 4 steps',
      intro: 'The examples use the base URL set in "Try it". Copy the one you prefer: curl, JavaScript or Python.',
      steps: [
        ['Create an account and log in', 'Login returns an accessToken (JWT) valid for one hour. Send it with every request as Authorization: Bearer <token>.'],
        ['See which slots are free', "Availability is public: ask for a day (the venue's local date) and get every slot with available: true/false."],
        ['Book', "startsAt is ISO 8601 with a time zone, and the duration is a multiple of the court's slot. The response includes the price and how long the unpaid slot is held."],
        ['Handle "already booked"', 'If someone got the slot first, the API answers 409. Tell the user it was taken and reload availability.'],
      ],
      copy: 'Copy',
      copied: 'Copied!',
    },
    guide: {
      title: 'Integration guide',
      intro: 'How to build the usual screens of a booking app on top of this API.',
      sections: [
        ['Session', 'Keep the token in memory (or sessionStorage) and send it in the Authorization header. It lasts one hour: on a 401, ask the user to log in again. You never store passwords.'],
        ['Slot grid', "Request /courts/{id}/availability for the date the user picked. Times come back in UTC: show them in the venue's time zone (venue.timezone), so \"20:00\" means 8 pm at the court, not on the phone."],
        ['Booking', "Send startsAt exactly as availability returned it. Don't show the slot as the user's until you get the 201: a 409 means someone else won it."],
        ['Paying', 'A booking starts as pending_payment and includes expiresAt. Show a countdown: when it runs out, the slot is released automatically.'],
        ['Cancelling', 'POST /bookings/{id}/cancel. Players need 24 hours of notice (otherwise 409 with the reason); owners can always cancel.'],
        ['Owner dashboard', "GET /venues/{id}/bookings?date= returns the day's agenda for their venue. Another owner gets 403."],
      ],
      tzTitle: "Showing the venue's time",
    },
    errors: {
      title: 'Errors, and what to show the user',
      intro: 'Every error comes as JSON with a statusCode and a message.',
      head: ['Code', 'When it happens', 'What the app should do'],
      rows: [
        ['400', 'Invalid data, outside opening hours, a slot that doesn\'t exist, or in the past.', 'Show the message: it already explains the problem ("The court opens at 09:00").'],
        ['401', 'Missing or expired token.', 'Send the user to log in.'],
        ['403', 'The user lacks permission (for example, a player creating courts).', 'Hide that action for that role.'],
        ['404', "The court, venue or booking doesn't exist.", 'Go back to the list.'],
        ['409', 'The slot is taken, the email is already registered, or it is too late to cancel.', 'Tell the user and reload availability.'],
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
      tourHelp: 'An owner creates a venue and a court, a player books, another gets a 409, and a booking is cancelled.',
      race: 'Race of 25',
      raceHelp: '25 players book the same slot at the same instant. Each square is one request.',
      running: 'Running…',
      raceResult: (won: number, lost: number) => `${won} got the slot · ${lost} got 409`,
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
