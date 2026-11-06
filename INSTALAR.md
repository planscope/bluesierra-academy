# Blue Sierra Academy · cómo subirla a Webflow con Memberstack

El dashboard va en la página `/academy` que Grok ya creó como borrador. Cada persona que contrates entra con su propio usuario de Memberstack y ve su ficha, el curso, la práctica, su checklist de la primera semana y su certificado. Su avance se guarda en su cuenta de Memberstack, no en el navegador.

## 1. Memberstack (una sola vez)

1. Crea la cuenta en memberstack.com y conecta el sitio de Webflow (Memberstack te pide pegar su script en **Site settings → Custom code → Head**). Revisa el precio actual antes de pagar.
2. En **Plans**, crea un plan gratis llamado **Team** y desactiva el registro público, para que solo entre a quien tú agregues.
3. En **Gated content**, protege `/academy`: solo miembros del plan Team, y los demás se mandan al login.
4. En **Custom fields**, crea estos campos con estos IDs exactos (el ID es lo que lee el dashboard):

| ID del campo | Qué pones | Ejemplo |
|---|---|---|
| `first-name`, `last-name` | Nombre | Timothy |
| `role` | Puesto | Appointment Setter |
| `work-email` | Su correo de trabajo | (cuando lo tengas) |
| `ringcentral-number` | Número de negocio asignado | (408) … |
| `ringcentral-ext` | Su extensión | 104 |
| `call-list-url` | Link de la Setter Call List | https://docs.google.com/… |
| `calendly-url` | Solo si no es el de siempre | |
| `schedule`, `reports-to`, `pay`, `goals` | Solo si cambian para esa persona | |

Si un campo está vacío, el dashboard muestra el valor de siempre (Calendly, horario, pago, metas) o dice "Pending — Jesús will add this".

5. Para dar acceso a alguien: **Members → Add member**, con su correo, el plan Team y sus campos. Le llega el correo para poner su contraseña.

## 2. Webflow, página `/academy`

El código vive en GitHub (`planscope/bluesierra-academy`) y la página lo carga desde jsDelivr. Pegas un snippet corto una sola vez, y cada cambio que se sube al repositorio aparece solo en la página.

1. **Quita la contraseña de página "upwork"** cuando Memberstack ya esté listo. Si dejas las dos, le piden contraseña dos veces.
2. Abre `webflow-loader.html` y pega sus tres partes:
   - **Page settings → Custom code → Inside `<head>`**: la parte 1 (fuentes y estilos).
   - Un **Code Embed** a todo lo ancho en la página: la parte 2 (`<div id="bs-academy"></div>`). Puedes borrar lo demás de la página.
   - **Page settings → Custom code → Before `</body>`**: la parte 3.
3. En la parte 3 llena `window.BSA_SETTINGS`:
   - `loginPhoto` y `heroPhoto`: sube dos fotos de Blue Sierra a **Assets** y pega sus URLs. Sin fotos, se ve con fondo negro.
   - `callsApi`: la URL del Apps Script (sección 3).
   Estos datos van en Webflow y no en el repositorio, que es público.
4. Copia los dos formularios de `/onboarding-setter` a `/academy` y ponles estos nombres en el Designer (hoy se llaman "Html Form"):
   - **Academy Progress**, con campos `Name`, `Role`, `Module`, `Score`, `Timestamp`
   - **Setter Certification**, con campos `Full-Name`, `Email`, `Course-Results`, `Acknowledge`
   El dashboard los esconde y los llena solo. Te llega un aviso de Webflow cada vez que alguien empieza, pasa un módulo, termina la práctica o se certifica.
5. El modo vista previa viene apagado. Si Memberstack no carga, nadie entra.
6. Publica solo cuando todo lo anterior esté listo.

### Subir cambios

Desde esta carpeta, `./publicar.sh "qué cambió"` revisa el código, lo sube a GitHub y limpia el caché de jsDelivr, así el cambio se ve en minutos y no en horas.

## 3. Registro de llamadas (Calls) y tu reporte

El setter abre la pestaña **Calls** (solo después de certificarse), ve las firmas de la Setter Call List, abre una y registra el canal, el resultado, si califica, la fecha de la reunión, el siguiente paso y una nota. Eso se escribe en la fila de esa firma en la hoja y en una pestaña nueva **Call Log**. Tú ves la pestaña **Report**. El resumen de las 5:30 PM te lo sigue mandando el bot Growth Strategist, que lee la pestaña Call Log, para que no te lleguen dos reportes. Si algún día quieres también el correo del script, corre `enableDailyEmail` en Apps Script.

Una sola vez, en la Setter Call List:

1. **Extensions → Apps Script**. Borra lo que haya en `Code.gs` y pega todo `apps-script/Code.gs`. Revisa que `REPORT_EMAIL` sea tu correo. Guarda.
2. Arriba elige la función **setup** y dale **Run**. Google te pide permiso para la hoja: acéptalo con tu cuenta. Esto crea la pestaña **Call Log** y tu llave de admin. La llave sale en el registro de ejecución (View → Logs).
3. Para cada setter corre `addSetter("Timothy", "su correo")` y copia la llave del registro. Las llaves se guardan en la memoria privada del script, no en la hoja: Timothy puede editar la hoja, así que ahí las podría ver.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copia la URL que termina en `/exec` y pégala en `callsApi` de la parte 3 de `webflow-loader.html`.
5. En Memberstack crea el campo `call-key`. Pon la llave de cada setter en su cuenta y la tuya en tu cuenta. A tu cuenta ponle `role` = **Admin** para que te salga la pestaña Report.
6. No compartas las llaves por chat ni las pongas en la hoja.

"Anyone" solo quiere decir que la página puede hablar con el script. Sin una llave válida no regresa nada, el reporte solo responde a tu llave de admin, y las llaves nunca viajan en la URL. Para quitarle el acceso a alguien corre `deactivateSetter("Timothy")`; `listSetters()` te muestra quién está activo. Solo tú debes poder editar el Apps Script.

El script nunca agrega, borra ni reordena firmas. Las notas nuevas van al principio de la celda con su fecha y nunca borran las anteriores, como dice el playbook.

## 4. Antes de que Timothy entre

- **Comparte la carpeta de videos en Drive** como "Cualquier persona con el enlace → Lector". Sin eso, los videos salen en negro.
- Crea su extensión de RingCentral y su correo, y llena esos campos en Memberstack.
- Mándale el acceso del gestor de contraseñas. El dashboard nunca muestra contraseñas.

## Dónde ves el avance

- **Memberstack → Members → (la persona) → Member JSON**: todo su avance (módulos, mejores calificaciones, intentos, checklist, certificado).
- **Webflow → Forms**: un registro por cada evento, con nombre, módulo, calificación y hora.
- **Pestaña Report** y el **resumen de Grok a las 5:30 PM**: llamadas, conversaciones, reuniones, seguimientos pendientes y cobertura de la lista.
- **Call Log** en la hoja: cada toque, uno por fila.

## Cambiar el contenido

Las preguntas, módulos, checklist y textos están en `academy-content.js`. Ojo: el repositorio es público y todo lo que esté ahí se puede ver, así que no pongas nada secreto. Lo personal de cada empleado va en los campos de Memberstack.

## Probarlo sin Webflow

Abre `preview.html` con un servidor local. Entra en modo vista previa, guarda el avance solo en ese navegador, y la pestaña Calls usa 12 firmas ficticias en lugar de la hoja real.

---

# Portal de clientes · bluesierracorp.com/portal

Cada cliente entra con su correo (le llega un código de 6 dígitos, sin contraseña) y ve **solo su proyecto**: fase y avance, actualizaciones con fotos, galería, mensajes y preguntas, facturas y checklist. Tú y tu equipo ven todos los proyectos y pueden subir fotos, publicar actualizaciones, hacer preguntas, agregar facturas con PDF y manejar el checklist.

- **Preguntas por correo:** cuando le haces una pregunta al cliente, le llega un correo desde tu Gmail. Si contesta respondiendo el correo, su respuesta aparece sola en el portal (se revisa cada 10 minutos).
- **Avisos para ti:** te llega un correo cuando un cliente te escribe, contesta una pregunta o marca algo del checklist.
- **Facturas:** las agregas tú (número, monto, fechas, estado, PDF y, si quieres, un link de pago de Stripe o QuickBooks). Los borradores no los ve el cliente.
- **No usa Memberstack** y no cuesta nada por cliente. Todo vive en una hoja privada de Google y una carpeta de Drive tuyas.

## 1. Google (una sola vez)

1. Crea una hoja nueva en Google Sheets llamada **Blue Sierra Portal**. No la compartas con clientes.
2. **Extensions → Apps Script**. Borra lo que haya, pega todo `apps-script/Portal.gs` y guarda. Revisa arriba `NOTIFY_EMAIL` (tu correo) y `PORTAL_URL`.
3. Elige **setup** y dale **Run**. Acepta los permisos con tu cuenta: hoja, Drive (fotos y PDFs) y Gmail (mandar correos y leer las respuestas de los clientes a las preguntas). Esto crea las pestañas, la carpeta **Blue Sierra Portal** en tu Drive, te agrega como admin y deja corriendo la revisión de correos cada 10 minutos.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copia la URL que termina en `/exec`.
5. Para agregar a alguien de tu equipo: en Apps Script corre `addStaff("Nombre", "correo")`. Los clientes los agregas desde el portal (pestaña **People** de cada proyecto).

## 2. Webflow

1. Crea una página nueva **/portal** (no `/projects`: ahí ya están tus proyectos del portafolio).
2. Pega la sección **CLIENT PORTAL** de `webflow-loader.html`: la parte A en el head de la página, la parte B en un Code Embed a todo lo ancho y la parte C antes de `</body>`.
3. En la parte C pon la URL del paso 1.4 en `api` y una foto de Blue Sierra (de Assets) en `loginPhoto`.
4. Marca la página como **noindex** (Page settings → SEO) para que Google no la muestre.
5. Publica cuando lo hayas probado.

## Cómo se usa

- **Proyecto nuevo:** entra a /portal con tu correo → **New project** → nombre, cliente, ciudad, fase, fechas.
- **Dar acceso al cliente:** en el proyecto, pestaña **People** → nombre y correo → **Add** (con "Email them an invitation" le llega el aviso).
- **Fotos:** pestaña **Updates** (con texto y fotos, y opción de avisarle al cliente por correo) o **Photos** (solo fotos). Se achican solas antes de subir. Desde la foto puedes ponerla de portada o borrarla.
- **Preguntas:** pestaña **Messages** → marca "Ask as a question". Quedan "waiting" hasta que contesten.
- **Quitar acceso:** pestaña **People** → ×. Para archivar un proyecto: **Edit project → Status → Archived** (el cliente deja de verlo).

## Privacidad

- El cliente solo ve proyectos donde está en People. El servidor lo revisa en cada acción, no solo la pantalla.
- Los códigos duran 15 minutos y aguantan 5 intentos; las sesiones se guardan cifradas (hash) y duran 30 días.
- Las fotos y PDFs se guardan en tu Drive y se comparten "con el enlace" para que el portal pueda mostrarlas. Los enlaces son largos e imposibles de adivinar y solo aparecen dentro del portal. Si tu Google Workspace no permite compartir con enlace, las fotos no se verán: avísame y lo cambiamos.
- Nada de esto está en GitHub: el repositorio solo tiene el código.

## Probarlo sin Google

Abre `portal-preview.html` con un servidor local. Entra como **jesus@example.com** (equipo) o **client@example.com** (cliente), código **123456**. Todo es ficticio y se guarda solo en ese navegador.
