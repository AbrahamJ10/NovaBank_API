import { crearApp } from "./aplicacion";
import { env } from "./configuracion/entorno";

const app = crearApp();

app.listen(env.PORT, () => {
  console.log(`API de NovaBank escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
});
