const CACHE_NAME = 'ai-code-note-v2';

// 앞뒤 슬래시를 제외한 순수 저장소 이름만 적는 것이 경로 꼬임을 방지하기 좋습니다.
const REPO_NAME = 'AI_centered_world_assignmnet'; 

const FILES_TO_CACHE = [
  `/${REPO_NAME}/`,
  `/${REPO_NAME}/index.html`,
  `/${REPO_NAME}/style.css`,
  `/${REPO_NAME}/script.js`,
  `/${REPO_NAME}/manifest.json`,
  `/${REPO_NAME}/icon-192.png`,
  `/${REPO_NAME}/icon-512.png`,
  `/${REPO_NAME}/sw.js` // 서비스 워커 본인도 캐싱 목록에 넣어주는 것이 안전합니다.
];

// 서비스 워커 설치 및 파일 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 파일 사전 캐싱 중...');
      // 존재하지 않는 파일이 하나라도 있으면 전체 캐싱이 실패(reject)하므로 주의하세요!
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
      return response || fetch(event.request);
    })
  );
});
