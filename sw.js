const CACHE_PREFIX = 'calcula-tu-ganancia-2f43616c63756c612d74752d47616e616e6369612d44656d6f2f-v'
// Vite replaces this marker with a unique ID in every production build.
const CACHE = `${CACHE_PREFIX}3a4453c9-5c7e-4421-ac41-7b6b41cabc24`
const BASE = '/Calcula-tu-Ganancia-Demo/'
const CORE = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`, `${BASE}icon-192.png`, `${BASE}icon-512.png`]

function validResource(path, response) {
  if (!response.ok) return false
  const type = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (type.includes('text/html')) return false // Some SPA hosts return index.html for a missing file.
  if (path.endsWith('.js')) return /javascript|ecmascript/.test(type)
  if (path.endsWith('.css')) return type.includes('text/css')
  return true
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    try {
      // Read fresh HTML so its hashed assets belong to the same release.
      const response = await fetch(new Request(BASE, { cache: 'reload' }))
      if (!response.ok) throw new Error('No se pudo descargar la aplicación completa.')
      const html = await response.clone().text()
      const assets = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map(match => match[1]).filter(path => path.startsWith(`${BASE}assets/`))
      if (!assets.length) throw new Error('No se encontraron los recursos de la aplicación.')
      const downloads = await Promise.all([...CORE.slice(1), ...assets].map(async path => {
        const resource = await fetch(new Request(path, { cache: 'reload' }))
        if (!validResource(path, resource)) throw new Error(`Recurso incompleto: ${path}`)
        await resource.clone().arrayBuffer()
        return [path, resource]
      }))
      await Promise.all(downloads.map(([path, resource]) => cache.put(path, resource)))
      await cache.put(BASE, response)
      // The old worker remains active until the user asks to update.
    } catch (error) {
      await caches.delete(CACHE)
      throw error
    }
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    if (request.mode === 'navigate') {
      const cached = await cache.match(BASE, { ignoreVary: true })
      if (cached) return cached
    }
    // Static hosts may vary responses by Origin; all cached URLs here are same-origin app resources.
    const cached = await cache.match(request, { ignoreVary: true })
    if (cached) return cached
    return fetch(request)
  })())
})
