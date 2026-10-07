import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Versão da build: um timestamp fixado no momento do `vite build`, igual em
// todo chunk gerado. Usado por VersionWatcher (src/components/VersionWatcher.jsx)
// pra detectar aba antiga: compara essa constante (embutida no bundle já
// carregado) contra /version.json (buscado com no-store, sempre fresco) e
// avisa quando divergem em vez de deixar o usuário só descobrir quando um
// import dinâmico falhar.
const appVersion = new Date().toISOString()

// Grava version.json em dist/ depois do build -- não pode ir em public/
// porque o Vite só copia public/ verbatim (não dá pra injetar um valor
// calculado em build-time nesse passo).
function writeVersionFile() {
  return {
    name: 'write-version-file',
    writeBundle(options) {
      fs.writeFileSync(
        path.join(options.dir, 'version.json'),
        JSON.stringify({ version: appVersion })
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), writeVersionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
