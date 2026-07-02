// Authentication bypassed: always return admin session.
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'payroll_session';

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId: string | null;
  iat: number;
}

const BYPASS_SESSION: SessionPayload = {
  userId: 'cm_admin',
  username: 'admin',
  role: 'ADMIN',
  employeeId: null,
  iat: Math.floor(Date.now() / 1000),
};

export async function getSession(req?: NextRequest): Promise<SessionPayload | null> {
  return { ...BYPASS_SESSION, iat: Math.floor(Date.now() / 1000) };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: false,
  };
}

export async function setSessionCookie(token: string) {
  // no-op
}

export async function clearSessionCookie() {
  // no-op
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  return { ...BYPASS_SESSION, iat: Math.floor(Date.now() / 1000) };
}

export async function requireAdmin(): Promise<SessionPayload> {
  return { ...BYPASS_SESSION, iat: Math.floor(Date.now() / 1000) };
}

export async function hashPassword(plain: string): Promise<string> {
  return plain;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return plain === hash;
}

export function createSessionToken(payload: Omit<SessionPayload, 'iat'>): string {
  return 'bypass';
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  return { ...BYPASS_SESSION, iat: Math.floor(Date.now() / 1000) };
}
