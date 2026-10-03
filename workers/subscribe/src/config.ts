// Values shared by the Worker and the notify script. None of these are secrets.
export const SITE_URL = 'https://diyaz.dev';
export const WORKER_URL = 'https://subscribe.diyaz.dev';
export const FROM = 'Diyaz Yakubov <diyaz@news.diyaz.dev>';
export const TOKEN_TTL_HOURS = 48; // also quoted in the confirmation email and the expired page
export const TOKEN_TTL_MS = TOKEN_TTL_HOURS * 60 * 60 * 1000;
export const TURNSTILE_ACTION = 'subscribe';
