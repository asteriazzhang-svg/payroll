// Small helpers for Route Handlers: consistent JSON responses + error handling.
import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap a Route Handler so AuthError / unexpected errors produce uniform JSON.
 */
export function withErrorHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<NextResponse>
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) {
        return errorResponse(e.status, e.message);
      }
      console.error('API error:', e);
      const msg = e instanceof Error ? e.message : 'Internal Server Error';
      return errorResponse(500, process.env.NODE_ENV === 'production' ? '服务器内部错误' : msg);
    }
  };
}
