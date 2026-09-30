const safeCodes = new Set([
  '23505', '23503', '23502', '22001', '22P02', '42P01', '42703', '40001', '40P01',
  '53300', '57P01', '08006', '08001', '08003', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
]);
const safeNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError']);

export function authErrorMetadata(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error && safeNames.has(error.name) ? error.name : 'Error';
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  // Driver messages, details and stacks may contain email addresses, tokens or password hashes.
  return typeof code === 'string' && safeCodes.has(code) ? { name, code } : { name };
}
