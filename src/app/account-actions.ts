'use server';
import { signOut } from '@/server/auth';

/** Sign out of the Google account; the phone carries on as its guest identity (R94). */
export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
