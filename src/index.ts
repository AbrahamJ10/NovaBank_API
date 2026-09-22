import { crearApp } from "./app";
import { env } from "./config/env";

const app = crearApp();

app.listen(env.PORT, () => {
  console.log(`API de NovaBank escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
});
