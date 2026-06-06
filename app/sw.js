const CACHE_NAME = 'ai-code-note-v1';
// 캐싱할 파일 목록 (경로에 맞게 수정 가능)
const FILES_TO_CACHE = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 서비스 워커 설치 및 파일 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 파일 사전 캐싱 중...');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 서비스 워커 활성화 (이전 버전의 캐시 정리)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 오래된 캐시 제거 중:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 요청을 가로채 캐시된 파일이 있으면 우선 반환
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시에 있으면 캐시 반환, 없으면 네트워크에서 가져옴
      return response || fetch(event.request);
    })
  );
});