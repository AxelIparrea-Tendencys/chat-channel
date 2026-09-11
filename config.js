// Configuración del portal.
//
// ESTE ARCHIVO ES PÚBLICO. Vive en un repo público y se sirve desde GitHub
// Pages: cualquiera puede leerlo. Aquí SOLO van valores que no son secretos.
//
// El token NO va aquí. Nunca. Se escribe en el formulario al conectar y queda
// en sessionStorage del navegador, que se borra al cerrar la pestaña.

window.AI_ASSISTANT_CONFIG = {
  // Opcional: la URL de tu backend, para no escribirla cada vez.
  // Es la que imprime `ngrok http 8787` y cambia en cada reinicio de ngrok.
  // Déjala vacía para escribirla a mano en el formulario.
  //
  //   endpoint: "https://abc123.ngrok-free.app",
  endpoint: "",

  // Título que se muestra en la cabecera.
  title: "AI Assistant",
};
