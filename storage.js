/* storage.js - the ONLY file that talks to storage.
   In Phase 2 we replace this file with a cloud version; the rest of the app stays the same.
   All functions are "async" so the cloud version can work the same way. */

const DB = (function () {
  const PREFIX = "eadcrm_";
  const COLLECTIONS = ["leads", "clients", "followups", "payments", "tasks", "services"];

  function read(name) {
    try { return JSON.parse(localStorage.getItem(PREFIX + name)) || []; }
    catch (e) { return []; }
  }
  function write(name, list) {
    try { localStorage.setItem(PREFIX + name, JSON.stringify(list)); return true; }
    catch (e) { alert("Could not save data. Browser storage may be full or blocked."); return false; }
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    COLLECTIONS,
    async all(name) { return read(name); },
    async get(name, id) { return read(name).find(x => x.id === id) || null; },
    async add(name, item) {
      const list = read(name);
      const rec = Object.assign({}, item, { id: newId(), createdAt: new Date().toISOString() });
      list.push(rec); write(name, list); return rec;
    },
    async update(name, id, changes) {
      const list = read(name);
      const i = list.findIndex(x => x.id === id);
      if (i < 0) return null;
      list[i] = Object.assign({}, list[i], changes, { updatedAt: new Date().toISOString() });
      write(name, list); return list[i];
    },
    async remove(name, id) { write(name, read(name).filter(x => x.id !== id)); },
    async count(name) { return read(name).length; },

    /* Backup: everything in one object */
    async exportAll() {
      const data = {};
      COLLECTIONS.forEach(c => data[c] = read(c));
      return { app: "EndlessArcCRM", version: 1, exportedAt: new Date().toISOString(), data };
    },
    /* Restore: replaces current data with backup data */
    async importAll(backup) {
      if (!backup || backup.app !== "EndlessArcCRM" || !backup.data) throw new Error("This is not an EndlessArc CRM backup file.");
      COLLECTIONS.forEach(c => write(c, Array.isArray(backup.data[c]) ? backup.data[c] : []));
    }
  };
})();
