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

1. **Quita la contraseña de página "upwork"**. Memberstack ya protege la página y si dejas las dos, le piden contraseña dos veces.
2. **Page settings → Custom code → Inside `<head>`**: pega todo `webflow/1-head-code.html`.
3. En el Designer, arrastra un **Code Embed** a la página, a todo lo ancho, y pega `webflow/2-embed.html`. Puedes borrar lo demás de la página: el dashboard ocupa toda la pantalla.
4. Justo debajo, otro **Code Embed** con `webflow/3-calls-embed.html` (la pestaña Calls y el Report).
5. **Page settings → Custom code → Before `</body>`**: pega `webflow/4-footer-code.html`.
6. Copia los dos formularios de `/onboarding-setter` a `/academy` y ponles estos nombres en el Designer (hoy se llaman "Html Form"):
   - **Academy Progress**, con campos `Name`, `Role`, `Module`, `Score`, `Timestamp`
   - **Setter Certification**, con campos `Full-Name`, `Email`, `Course-Results`, `Acknowledge`
   El dashboard los esconde y los llena solo. Te llega un aviso de Webflow cada vez que alguien empieza, pasa un módulo, termina la práctica o se certifica.
7. Fotos: sube dos fotos de Blue Sierra a **Assets**, copia sus URLs y reemplaza `PASTE_LOGIN_PHOTO_URL` y `PASTE_HERO_PHOTO_URL` en el bloque 2. Sin fotos, se ve con fondo negro.
8. El modo vista previa ya viene apagado (`"demoAllowed": false`). Si Memberstack no carga, nadie entra.
9. Publica solo cuando todo lo anterior esté listo.

## 3. Registro de llamadas (Calls) y tu reporte

El setter abre la pestaña **Calls** (solo después de certificarse), ve las firmas de la Setter Call List, abre una y registra el canal, el resultado, si califica, la fecha de la reunión, el siguiente paso y una nota. Eso se escribe en la fila de esa firma en la hoja y en una pestaña nueva **Call Log**. Tú ves la pestaña **Report**. El resumen de las 5:30 PM te lo sigue mandando el bot Growth Strategist, que lee la pestaña Call Log, para que no te lleguen dos reportes. Si algún día quieres también el correo del script, corre `enableDailyEmail` en Apps Script.

Una sola vez, en la Setter Call List:

1. **Extensions → Apps Script**. Borra lo que haya en `Code.gs` y pega todo `apps-script/Code.gs`. Revisa que `REPORT_EMAIL` sea tu correo. Guarda.
2. Arriba elige la función **setup** y dale **Run**. Google te pide permiso para la hoja: acéptalo con tu cuenta. Esto crea la pestaña **Call Log** y tu llave de admin. La llave sale en el registro de ejecución (View → Logs).
3. Para cada setter corre `addSetter("Timothy", "su correo")` y copia la llave del registro. Las llaves se guardan en la memoria privada del script, no en la hoja: Timothy puede editar la hoja, así que ahí las podría ver.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copia la URL que termina en `/exec` y pégala en `callsApi` del bloque de Webflow (ver `webflow-loader.html`).
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

Las preguntas, módulos, checklist y textos están en `academy-content.js`, que es el bloque 2. Ojo: todo lo que esté ahí se puede ver en el código de la página, así que no pongas nada secreto. Lo personal de cada empleado va en los campos de Memberstack.

## Probarlo sin Webflow

Abre `preview.html` con un servidor local. Entra en modo vista previa, guarda el avance solo en ese navegador, y la pestaña Calls usa 12 firmas ficticias en lugar de la hoja real.
