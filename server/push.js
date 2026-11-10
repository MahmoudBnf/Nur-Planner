// Web Push: notifications that reach the phone even when the app is closed.
//
// How it travels: the phone's browser gives us a "subscription" (an address
// at Google's push service plus two keys). To notify, the server encrypts the
// message with those keys (RFC 8291) and posts it to that address, signed with
// our own VAPID key (RFC 8292) so the push service knows it's us. Google only
// sees encrypted bytes; the phone decrypts and shows the notification.
// Built on node:crypto, so there is nothing extra to install.
import crypto from 'node:crypto';
import { getDb, save } from './db.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');

// db.push = { vapid: { publicKey, privateJwk }, subs: [{ endpoint, keys: { p256dh, auth }, device, createdAt }] }
function store() {
  const db = getDb();
  if (!db.push?.vapid) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = publicKey.export({ format: 'jwk' });
    db.push = {
      vapid: { publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)])), privateJwk: privateKey.export({ format: 'jwk' }) },
      subs: db.push?.subs || [],
    };
    save();
  }
  return db.push;
}

export const publicKey = () => store().vapid.publicKey;
export const subscriptions = () => store().subs;

export function subscribe(sub, device) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw Object.assign(new Error('Invalid subscription'), { status: 400 });
  const s = store();
  s.subs = [...s.subs.filter((x) => x.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: sub.keys, device: device || '', createdAt: new Date().toISOString() }];
  save();
}
export function unsubscribe(endpoint) {
  const s = store();
  s.subs = s.subs.filter((x) => x.endpoint !== endpoint);
  save();
}

// VAPID: a short-lived token signed with our private key, for one push service.
function vapidHeader(endpoint) {
  const { vapid } = store();
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:nur-planner@localhost.invalid' }));
  const key = crypto.createPrivateKey({ key: vapid.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`;
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// RFC 8291 (aes128gcm): encrypt `payload` for one subscription.
export function encrypt(payload, keys) {
  const uaPublic = unb64u(keys.p256dh);
  const authSecret = unb64u(keys.auth);
  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const salt = crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0);
  head.writeUInt32BE(4096, 16);
  head[20] = asPublic.length;
  return Buffer.concat([head, asPublic, body]);
}

async function sendOne(sub, message) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(message.ttl ?? 900), // a reminder older than 15 minutes is useless
      Urgency: 'high',
    },
    body: encrypt(JSON.stringify(message), sub.keys),
    signal: AbortSignal.timeout(15000),
  });
  return res.status;
}

// Send to every subscribed device; forget the ones the push service says are gone.
export async function sendAll(message) {
  const s = store();
  const results = await Promise.all(s.subs.map((sub) => sendOne(sub, message).catch((e) => e.message)));
  const gone = s.subs.filter((_, i) => results[i] === 404 || results[i] === 410).map((x) => x.endpoint);
  if (gone.length) { s.subs = s.subs.filter((x) => !gone.includes(x.endpoint)); save(); }
  return s.subs.length ? results : [];
}
