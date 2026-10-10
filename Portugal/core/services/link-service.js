/* link-service: every outside link is built here, so the native apps can open them in the system browser later. */

export const linkService = {
  tripadvisor(q) { return 'https://www.tripadvisor.com/Search?q=' + encodeURIComponent(q); },
  getyourguide(q) { return 'https://www.getyourguide.com/s/?q=' + encodeURIComponent(q); },
  flight(code) { return 'https://www.google.com/search?q=' + encodeURIComponent('flight ' + code); },
  appleMaps({ lat, lng, name }) { return 'https://maps.apple.com/?q=' + encodeURIComponent(name || 'Destination') + (lat != null ? '&ll=' + lat + ',' + lng : ''); },
  googleMaps({ lat, lng, name }) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat != null ? lat + ',' + lng : name); },
  directions({ lat, lng }, mode = 'walking') { return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=' + mode; },
  open(url) { try { window.open(url, '_blank', 'noopener'); return Promise.resolve(true); } catch (e) { return Promise.resolve(false); } }
};
