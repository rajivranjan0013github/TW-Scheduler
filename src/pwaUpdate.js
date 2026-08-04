import { registerSW } from 'virtual:pwa-register';

const PWA_UPDATE_CHECK_MS = 15 * 60 * 1000;
const PWA_UPDATE_FOCUS_THROTTLE_MS = 60 * 1000;

let serviceWorkerRegistration = null;
let lastUpdateCheckAt = 0;
let updateCheckInFlight = false;

const checkForAppUpdate = async ({ force = false } = {}) => {
  if (!serviceWorkerRegistration || updateCheckInFlight || !navigator.onLine) return;
  if (!force && Date.now() - lastUpdateCheckAt < PWA_UPDATE_FOCUS_THROTTLE_MS) return;

  updateCheckInFlight = true;
  lastUpdateCheckAt = Date.now();
  try {
    await serviceWorkerRegistration.update();
  } catch (error) {
    console.warn('PWA update check failed:', error);
  } finally {
    updateCheckInFlight = false;
  }
};

registerSW({
  immediate: true,
  onRegisteredSW: (_serviceWorkerUrl, registration) => {
    serviceWorkerRegistration = registration || null;
    void checkForAppUpdate({ force: true });
  },
  onRegisterError: (error) => {
    console.error('PWA service worker registration failed:', error);
  },
});

const checkWhenVisible = () => {
  if (document.visibilityState === 'visible') {
    void checkForAppUpdate();
  }
};

document.addEventListener('visibilitychange', checkWhenVisible);
window.addEventListener('focus', checkWhenVisible);
window.addEventListener('online', () => void checkForAppUpdate({ force: true }));
window.setInterval(checkWhenVisible, PWA_UPDATE_CHECK_MS);
