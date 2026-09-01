const DB_ERROR_PATTERNS = [
  "Can't reach database server",
  "database server",
  "Authentication failed against the database server",
  "provided database credentials",
  "ECONNREFUSED",
  "P1000",
  "P1001",
  "P1010",
  "P1017",
];

export function isDatabaseUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return DB_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export async function readDb<T>(promise: Promise<T>, fallback: T): Promise<{ value: T; unavailable: boolean }> {
  try {
    return { value: await promise, unavailable: false };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return { value: fallback, unavailable: true };
    }
    throw error;
  }
}
