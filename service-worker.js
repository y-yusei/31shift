const CACHE_NAME = '31shift-v1';
// ローカルリソースのみキャッシュ（CDNリソースは除外）
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/img/icon.png'
];

// インストール時の処理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('キャッシュを開きました');
        // ローカルリソースのみキャッシュ（エラーを無視して続行）
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`キャッシュに追加できませんでした: ${url}`, err);
            })
          )
        );
      })
      .catch((error) => {
        console.error('キャッシュの追加に失敗しました:', error);
      })
  );
  self.skipWaiting();
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// フェッチ時の処理（ネットワーク優先、フォールバックでキャッシュ）
self.addEventListener('fetch', (event) => {
  // APIリクエストは常にネットワークを使用
  if (event.request.url.includes('my-shift-backend.tamago-2483.workers.dev')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // ネットワークエラー時はキャッシュを返さず、エラーを返す
          return new Response(
            JSON.stringify({ error: 'オフラインです。ネットワーク接続を確認してください。' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // その他のリクエストはネットワーク優先、フォールバックでキャッシュ
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ローカルリソースのみキャッシュに保存（CDNリソースは除外）
        const url = new URL(event.request.url);
        const isLocalResource = url.origin === self.location.origin;
        
        if (isLocalResource && response.status === 200) {
          // レスポンスをクローンしてキャッシュに保存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(err => {
              console.warn('キャッシュの保存に失敗しました:', err);
            });
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時はキャッシュから取得（ローカルリソースのみ）
        const url = new URL(event.request.url);
        const isLocalResource = url.origin === self.location.origin;
        if (isLocalResource) {
          return caches.match(event.request);
        }
        // CDNリソースの場合はエラーをそのまま返す
        return new Response('ネットワークエラー', { status: 503 });
      })
  );
});

