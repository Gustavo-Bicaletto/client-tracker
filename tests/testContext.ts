import { prisma } from "./setup";

type TestSession = {
  user: { id: string; name?: string | null };
  expires: string;
} | null;

export function createTestContext(session?: TestSession) {
  return {
    db: prisma,
    session: session ?? {
      user: { id: "test-user-123", name: "Test User" },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    headers: new Headers(),
  };
}

export function createUnauthenticatedContext() {
  return {
    db: prisma,
    session: null,
    headers: new Headers(),
  };
}