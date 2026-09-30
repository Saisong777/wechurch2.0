export class PasswordWorkBusyError extends Error {
  constructor() { super('Password verification capacity is busy'); }
}

export function createPasswordWorkLimiter(maxConcurrent = 4) {
  let active = 0;
  return async function run<T>(work: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) throw new PasswordWorkBusyError();
    active++;
    try {
      return await work();
    } finally {
      // Release when computation settles, not when its HTTP connection closes.
      active--;
    }
  };
}
