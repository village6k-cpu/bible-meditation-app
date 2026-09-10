export async function migrateWithBackup(
  backup: () => Promise<'shared' | 'downloaded' | 'cancelled'>,
  move: () => Promise<void>
): Promise<boolean> {
  if (await backup() === 'cancelled') return false;
  await move();
  return true;
}
