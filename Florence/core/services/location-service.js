/* location-service: the traveler's position. Asked for only when True Wanderer opens, never on app load.
   Never stored in trip state and never sent anywhere. Later provider: Capacitor Geolocation in the native apps. */

const OPTS = { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 };   // battery-friendly

const shape = p => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0), at: p.timestamp });
const why = e => (e && e.code === 1) ? 'denied' : (e && e.code === 3) ? 'timeout' : 'unavailable';

export const locationService = {
  available() { return Promise.resolve(typeof navigator !== 'undefined' && !!navigator.geolocation); },
  async permission() {
    try { if (navigator.permissions) return (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) {}
    return 'prompt';
  },
  getOnce() {
    return new Promise(res => {
      if (!navigator.geolocation) return res({ error: 'unavailable' });
      navigator.geolocation.getCurrentPosition(p => res(shape(p)), e => res({ error: why(e) }), OPTS);
    });
  },
  /* Calls onUpdate(position) gently as the traveler walks. Returns a Promise of a stop() function. */
  watch(onUpdate, onError) {
    if (!navigator.geolocation) { onError && onError('unavailable'); return Promise.resolve(() => {}); }
    let last = null;
    const id = navigator.geolocation.watchPosition(p => {
      const s = shape(p);
      if (last && Math.abs(last.lat - s.lat) < 0.00015 && Math.abs(last.lng - s.lng) < 0.00015) return;   // ignore jitter under ~15 m
      last = s; onUpdate(s);
    }, e => onError && onError(why(e)), OPTS);
    return Promise.resolve(() => { try { navigator.geolocation.clearWatch(id); } catch (e) {} });
  }
};
