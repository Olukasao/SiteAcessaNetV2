// Ponto de entrada (pm2 / npm start). index.mjs so exporta, para os testes importarem sem abrir portas.
import { start } from "./index.mjs";

start();
