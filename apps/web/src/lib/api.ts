export class ApiFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiFailure(
      0,
      'NETWORK_UNAVAILABLE',
      'Unable to connect. Check your connection and try again.',
    );
  }
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    const record = error && typeof error === 'object' ? error : null;
    const message =
      record && 'message' in record && typeof record.message === 'string'
        ? record.message
        : 'The request could not be completed.';
    const code =
      record && 'code' in record && typeof record.code === 'string'
        ? record.code
        : 'REQUEST_FAILED';
    throw new ApiFailure(response.status, code, message);
  }
  return response.json() as Promise<T>;
}
