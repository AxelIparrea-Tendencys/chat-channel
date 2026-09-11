# chat-channel

> Chat estático que habla con un backend propio corriendo en tu máquina, autenticado por token.

Página sin dependencias ni build: tres archivos que se sirven desde GitHub Pages.
No guarda datos, no tiene servidor propio y no incluye ninguna credencial — todo
lo que hace es mandar peticiones al backend que tú levantas, con un token que tú
escribes.

El backend vive en [AI-Assistant](https://github.com/AxelIparrea-Tendencys/AI-Assistant).

## Tabla de contenidos

- [Seguridad](#seguridad)
- [Configurar](#configurar)
- [Publicar](#publicar)
- [Uso](#uso)
- [Qué necesita del backend](#qué-necesita-del-backend)
- [Licencia](#licencia)

## Seguridad

**Este repositorio es público.** Todo lo que esté aquí lo puede leer cualquiera,
ahora y en el historial de git. Por eso:

**El token no va en el código.** Ni en `config.js`, ni en `app.js`, ni en una
variable "temporal". Se escribe en el formulario al conectar y se guarda en
`sessionStorage`, que el navegador borra al cerrar la pestaña. Nunca se
commitea y nunca llega a GitHub.

Si alguna vez pegas un token en un archivo y haces commit, **rótalo**: borrarlo
después no sirve, queda en el historial.

**Solo se aceptan endpoints `https`**, salvo `localhost`. Sobre `http` plano el
token viaja legible para cualquiera en la red.

**El token es una credencial compartida, no una identidad.** No distingue quién
lo usa: quien lo tenga puede hacer todo lo que tú. Si se filtra, cámbialo en el
backend y reinícialo.

Lo que sí protege del lado del backend: comparación en tiempo constante, bloqueo
tras varios fallos de autenticación, límite de peticiones por minuto, CORS por
lista explícita y un allowlist de rutas que acota qué puede tocar.

## Configurar

`config.js` tiene lo único configurable, y nada de eso es secreto:

```js
window.AI_ASSISTANT_CONFIG = {
  endpoint: "",          // opcional: tu URL de ngrok, para no escribirla cada vez
  title: "AI Assistant", // título de la página
};
```

Dejar `endpoint` vacío es lo normal: la URL de ngrok cambia en cada reinicio, así
que suele ser más cómodo escribirla en el formulario. Lo que escribas ahí se
recuerda en ese navegador.

## Publicar

```bash
git push origin main
```

Y en GitHub: **Settings → Pages → Source: `main`, carpeta `/ (root)`**.

Queda en `https://<tu-usuario>.github.io/chat-channel/`.

Ese origen —sin barra final— es el que el backend tiene que declarar en
`AI_ASSISTANT_ALLOWED_ORIGINS`. Si no coincide exacto, el navegador bloquea la
petición y el portal dice que no se pudo conectar.

## Uso

1. Levanta el backend y ngrok en tu máquina.
2. Abre la página, pega la URL de ngrok y tu token, y pulsa **Conectar**.
3. Chatea.

Comandos:

```
/ls [ruta]      lista un directorio permitido
/cat <ruta>     muestra un archivo
/git <repo>     git status de un repositorio
/health         estado del backend y rutas accesibles
/help           ayuda
```

Cualquier otro texto va al motor que elijas:

- **Local** — un modelo corriendo en tu máquina. No cuesta nada y no sale de ahí.
- **Claude Code** — tu sesión del CLI, con las integraciones que ya tengas
  conectadas.

**Salir** borra el token de la pestaña.

## Qué necesita del backend

Seis rutas `POST` que respondan JSON y acepten `Authorization: Bearer <token>`:

| Ruta | Cuerpo | Devuelve |
|---|---|---|
| `/api/health` | `{}` | `{ ok, llm_local, claude_cli, roots }` |
| `/api/list` | `{ path? }` | `{ path, entries[] }` |
| `/api/read` | `{ path }` | `{ path, content, truncated }` |
| `/api/git` | `{ repo, command }` | `{ repo, command, output }` |
| `/api/chat` | `{ message }` | `{ model, reply, engine }` |
| `/api/ask` | `{ message }` | `{ model, reply, engine }` |

Errores: cualquier status distinto de 200 con `{ "error": "..." }`. El portal
muestra ese mensaje tal cual.

Y el backend debe responder al preflight `OPTIONS` con
`Access-Control-Allow-Origin` igual al origen de esta página y
`Access-Control-Allow-Headers: Authorization, Content-Type`.

## Licencia

Propietario. Uso interno.
