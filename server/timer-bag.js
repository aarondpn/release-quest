function createTimerBag() {
  const timers = new Map();
  return {
    setTimeout(name, fn, ms) {
      this.clear(name);
      timers.set(name, { handle: setTimeout(fn, ms), type: 'timeout' });
    },
    setInterval(name, fn, ms) {
      this.clear(name);
      timers.set(name, { handle: setInterval(fn, ms), type: 'interval' });
    },
    clear(name) {
      const t = timers.get(name);
      if (!t) return;
      (t.type === 'timeout' ? clearTimeout : clearInterval)(t.handle);
      timers.delete(name);
    },
    clearAll() {
      for (const [, t] of timers) {
        (t.type === 'timeout' ? clearTimeout : clearInterval)(t.handle);
      }
      timers.clear();
    },
    has(name) {
      return timers.has(name);
    },
  };
}

module.exports = { createTimerBag };
