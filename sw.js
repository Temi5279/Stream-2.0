self.addEventListener('install', (e) => {
  console.log('str▶eam Service Worker Installed');
});

self.addEventListener('fetch', (e) => {
  // This is empty for now, but required for PWA status
});
