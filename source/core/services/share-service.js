/* share-service: the phone's share sheet and clipboard. Never a server.
   Later provider: Capacitor Share in the native apps. */

export const shareService = {
  async canShareFiles(files) { try { return !!(navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } },
  /* Returns 'shared' | 'cancelled' | 'unavailable' */
  async shareFiles(files, text) {
    if (!(await this.canShareFiles(files))) return 'unavailable';
    try { await navigator.share({ files, text }); return 'shared'; } catch (e) { return 'cancelled'; }
  },
  async shareText(text, title) {
    try { if (navigator.share) { await navigator.share({ text, title }); return 'shared'; } } catch (e) { return 'cancelled'; }
    return 'unavailable';
  },
  async copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  },
  makeFile(blob, name) { return new File([blob], name, { type: 'image/jpeg' }); }
};
