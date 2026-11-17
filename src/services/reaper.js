const TICK_MS = 60_000;
const SWEEP_EVERY_TICKS = 60;
const SWEEP_GRACE_MS = 60 * 60_000;

export function createReaper({ files, spool, drive, library, cacheBytes, log }) {
  let timer;
  let ticks = 0;

  async function expire() {
    for (const file of files.expired(Date.now())) await library.destroy(file);
  }

  async function evict() {
    let excess = files.localBytes() - cacheBytes;
    for (const file of files.evictable()) {
      if (excess <= 0) break;
      files.markEvicted(file.storage_id);
      await spool.remove(file.storage_id);
      excess -= file.size;
    }
  }

  async function sweepDrive() {
    const known = new Set(files.storageIds());
    const cutoff = Date.now() - SWEEP_GRACE_MS;
    for (const remote of await drive.list()) {
      if (!known.has(remote.name) && Date.parse(remote.createdTime) < cutoff) await drive.remove(remote.id);
    }
  }

  async function tick() {
    try {
      await expire();
      await evict();
      if (drive && ticks++ % SWEEP_EVERY_TICKS === 0) await sweepDrive();
    } catch (error) {
      log.warn('reaper', error.message);
    }
  }

  function start() {
    timer = setInterval(tick, TICK_MS);
    timer.unref();
    tick();
  }

  return { start, tick, stop: () => clearInterval(timer) };
}
