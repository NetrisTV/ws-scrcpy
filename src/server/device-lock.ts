export class DeviceLock {
  private locks: Map<string, {
    sessionId: string;
    ws: any;
    lastActive: number;
  }> = new Map();

  private timeoutMs: number;
  public onUpdate: (() => void) | null = null;

  constructor(timeoutMs = 5 * 60 * 1000) {
    this.timeoutMs = timeoutMs;

    setInterval(() => this.cleanup(), 10000);
  }

  lockDevice(deviceId: string, sessionId: string, ws: any): boolean {
    const existing = this.locks.get(deviceId);

    if (existing?.ws && existing.ws.readyState !== 3) {
      return false;
    }

    this.locks.set(deviceId, { sessionId, ws, lastActive: Date.now() });
    this.onUpdate?.();
    return true;
  }

  refresh(deviceId: string, sessionId: string): void {
    const lock = this.locks.get(deviceId);
    if (lock && lock.sessionId === sessionId) {
      lock.lastActive = Date.now();
    }
  }

  unlock(deviceId: string, sessionId: string): void {
    const lock = this.locks.get(deviceId);
    if (!lock) return;

    if (lock.sessionId === sessionId) {
      this.locks.delete(deviceId);
      this.onUpdate?.();
    }
  }

  private cleanup() {
    const now = Date.now();

    for (const [deviceId, lock] of this.locks.entries()) {
      const wsDead = lock.ws.readyState === 3;
      const expired = now - lock.lastActive > this.timeoutMs;

      if (expired || wsDead) {
        try { lock.ws.close(); } catch {}
        this.locks.delete(deviceId);
        this.onUpdate?.();
      }
    }
  }

  listActive() {
    return Array.from(this.locks.entries()).map(([deviceId, lock]) => ({
      deviceId,
      sessionId: lock.sessionId,
      lastActive: lock.lastActive
    }));
  }
}

export default new DeviceLock();
