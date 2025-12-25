const CACHE_NAME = 'pk-games-v1';
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
	event.respondWith(
		caches.match(event.request)
			.then((response) => {
				if (response) {
					return response;
				}
				return fetch(event.request);
			})
	);
});