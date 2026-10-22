import type { TestProject } from 'vitest/node';
import { startTestDb, type TestDb } from './pg';

let db: TestDb | null = null;

export async function setup(project: TestProject) {
  db = await startTestDb('unit', 54331);
  project.provide('databaseUrl', db.url);
}

export async function teardown() {
  await db?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
