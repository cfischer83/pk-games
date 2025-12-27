const CACHE_NAME = 'pk-games-v9';
const urlsToCache = [
	'/index.html',
	'/logo2.png',
	'/manifest.json'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => {
				return Promise.all(
					urlsToCache.map((url) => {
						return cache.add(url).catch((err) => {
							console.log('Failed to cache:', url, err);
						});
					})
				);
			})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	
	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}
	
	// Network-only for HTML files (never use cache, always fresh)
	if (request.destination === 'document' || url.pathname.endsWith('.html')) {
		event.respondWith(
			fetch(request, { cache: 'no-store' })
				.catch(() => caches.match(request))
		);
		return;
	}
	
	// Stale-while-revalidate for other resources
	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			const fetchPromise = fetch(request).then((networkResponse) => {
				// Clone before using
				const responseToCache = networkResponse.clone();
				// Update cache with fresh content
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(request, responseToCache);
				});
				return networkResponse;
			}).catch(() => cachedResponse);
			
			// Return cached version immediately, but update in background
			return cachedResponse || fetchPromise;
		})
	);
});