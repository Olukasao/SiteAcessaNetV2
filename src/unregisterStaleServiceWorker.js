/**
 * Este site nunca registrou Service Worker/PWA (sem workbox, sem
 * vite-plugin-pwa, sem manifest) -- mas se um já existir no navegador de
 * algum visitante (versão antiga do site, teste local, extensão), ele
 * continua interceptando requests e pode servir HTML/JS em cache
 * indefinidamente, do jeito mais difícil de diagnosticar porque nem aparece
 * como "cache do navegador" comum. Limpeza defensiva e idempotente: só mexe
 * em Service Worker/Cache Storage, nunca em localStorage/sessionStorage/
 * IndexedDB (onde ficam os tokens de sessão do cliente).
 */
export function unregisterStaleServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => undefined);
      }
    })
    .catch(() => undefined);

  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
  }
}
