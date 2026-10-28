export function withDeadline<T>(work: PromiseLike<T>, ms = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Koneksi terlalu lama. Periksa jaringan dan coba lagi.')), ms);
    Promise.resolve(work).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
/** Cancel stalled requests while preserving cancellation from the caller. */
export const boundedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Koneksi terlalu lama. Coba lagi.')), 15_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
};
