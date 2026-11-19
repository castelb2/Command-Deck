/* Command Deck · on-device database
   Stands in for the claude.ai artifact database the deck was built on. It keeps the
   same small surface the page already calls (collection().onSnapshot / add / doc().set,
   db.doc(path).update / delete / set, orderBy().limit()), so the rest of the app is
   unchanged. Everything lives in this browser's localStorage, on this device only. */
(function () {
  "use strict";
  const PREFIX = "deck.db.";
  const COLLECTIONS = ["projects", "checklist", "log"];
  const listeners = new Map(); // collection -> Set of fns

  function quota(e) {
    const err = new Error("Storage is full on this device.");
    err.code = "quota_exceeded"; err.cause = e; return err;
  }
  function read(col) {
    try { const raw = localStorage.getItem(PREFIX + col); const v = raw ? JSON.parse(raw) : {}; return v && typeof v === "object" ? v : {}; }
    catch (e) { return {}; }
  }
  function write(col, map) {
    try { localStorage.setItem(PREFIX + col, JSON.stringify(map)); }
    catch (e) { throw quota(e); }
    notify(col);
  }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function snap(col, opts) {
    const map = read(col);
    let docs = Object.keys(map).map(id => ({ id, _d: map[id] }));
    if (opts && opts.orderBy) {
      const { field, dir } = opts.orderBy;
      docs.sort((a, b) => {
        const x = a._d[field], y = b._d[field];
        if (x === y) return 0;
        if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
      });
    }
    if (opts && opts.limit) docs = docs.slice(0, opts.limit);
    return { docs: docs.map(d => ({ id: d.id, exists: true, data: () => clone(d._d) })) };
  }
  function notify(col) {
    const set = listeners.get(col); if (!set) return;
    set.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }
  function newId() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
  function splitPath(path) {
    const parts = String(path).split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw Object.assign(new Error("Bad path " + path), { code: "invalid_argument" });
    return parts;
  }
  function stripDeletes(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(k => { const v = obj[k]; if (!(v && typeof v === "object" && v.__delete__ === true)) out[k] = v; });
    return out;
  }

  function docRef(col, id) {
    return {
      id,
      async get() { const m = read(col); return { id, exists: id in m, data: () => clone(m[id]) }; },
      async set(data) { const m = read(col); m[id] = stripDeletes(clone(data)); write(col, m); },
      async update(patch) {
        const m = read(col);
        if (!(id in m)) throw Object.assign(new Error("No document " + col + "/" + id), { code: "not_found" });
        const next = Object.assign({}, m[id]);
        Object.keys(patch || {}).forEach(k => { const v = patch[k]; if (v && typeof v === "object" && v.__delete__ === true) delete next[k]; else next[k] = clone(v); });
        m[id] = next; write(col, m);
      },
      async delete() { const m = read(col); delete m[id]; write(col, m); }
    };
  }
  function query(col, opts) {
    return {
      orderBy(field, dir) { return query(col, Object.assign({}, opts, { orderBy: { field, dir: dir || "asc" } })); },
      limit(n) { return query(col, Object.assign({}, opts, { limit: n })); },
      onSnapshot(cb, errCb) {
        const fire = () => { try { cb(snap(col, opts)); } catch (e) { if (errCb) errCb(e); else console.error(e); } };
        if (!listeners.has(col)) listeners.set(col, new Set());
        listeners.get(col).add(fire);
        setTimeout(fire, 0);
        return () => listeners.get(col).delete(fire);
      },
      async get() { return snap(col, opts); }
    };
  }
  function collection(col) {
    const q = query(col, {});
    q.doc = id => docRef(col, id || newId());
    q.add = async data => { const id = newId(); await docRef(col, id).set(data); return { id }; };
    return q;
  }

  const db = {
    collection,
    doc(path) { const [col, id] = splitPath(path); return docRef(col, id); },

    /* Backup: one JSON file holding every collection plus the deck's settings. */
    exportAll() {
      const collections = {};
      COLLECTIONS.forEach(c => { collections[c] = read(c); });
      const settings = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("deck.") && !k.startsWith(PREFIX) && k !== "deck.apiKey") settings[k.slice(5)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) { /* settings are optional in a backup */ }
      return { app: "command-deck", version: 1, exportedAt: new Date().toISOString(), collections, settings };
    },
    importAll(obj, mode) {
      if (!obj || obj.app !== "command-deck" || !obj.collections || typeof obj.collections !== "object") {
        throw Object.assign(new Error("That file isn't a Command Deck backup."), { code: "invalid_argument" });
      }
      const counts = {};
      COLLECTIONS.forEach(c => {
        const incoming = obj.collections[c];
        if (!incoming || typeof incoming !== "object") { counts[c] = 0; return; }
        const base = mode === "replace" ? {} : read(c);
        Object.keys(incoming).forEach(id => { if (incoming[id] && typeof incoming[id] === "object") base[id] = incoming[id]; });
        counts[c] = Object.keys(incoming).length;
        write(c, base);
      });
      if (obj.settings && typeof obj.settings === "object") {
        Object.keys(obj.settings).forEach(k => {
          if (/^[a-zA-Z]+$/.test(k) && k !== "apiKey") { try { localStorage.setItem("deck." + k, JSON.stringify(obj.settings[k])); } catch (e) {} }
        });
      }
      return counts;
    },
    clearAll() { COLLECTIONS.forEach(c => write(c, {})); },
    isEmpty() { return COLLECTIONS.every(c => !Object.keys(read(c)).length); }
  };

  // Another tab or the installed app changed storage: refresh live views.
  window.addEventListener("storage", e => {
    if (e.key && e.key.startsWith(PREFIX)) notify(e.key.slice(PREFIX.length));
  });
  // Ask the browser not to evict this data under storage pressure (best effort).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  window.DeckDB = db;
})();
