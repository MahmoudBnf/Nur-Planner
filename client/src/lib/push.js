// The installable app (service worker) and notifications on this device.
// Browsers only allow both on HTTPS pages or on localhost.
import { api } from './api.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// The push subscription of this browser, or null.
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

const deviceName = () => {
  const ua = navigator.userAgent;
  const model = ua.match(/Android [\d.]+; ([^;)]+)/)?.[1];
  return model ? `Android · ${model.trim()}` : /iPhone|iPad/.test(ua) ? 'iPhone' : /Firefox/.test(ua) ? 'PC · Firefox' : 'PC · browser';
};

export async function enablePush() {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications were not allowed. Allow them in the site settings, then try again.');
  const { key } = await api.get('/api/push/key');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made for another server key can't receive our messages.
  if (sub && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey || []))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== key) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.post('/api/push/subscribe', { subscription: sub.toJSON(), device: deviceName() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}
