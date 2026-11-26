/** A saved token alone must never replace the usable local demonstration. */
export async function resumeAccount<T>(
  restore: () => Promise<boolean>,
  load: () => Promise<T>,
  isCurrent: () => boolean,
  adopt: (snapshot: T) => void,
): Promise<void> {
  try {
    if (!(await restore()) || !isCurrent()) return;
    const snapshot = await load();
    if (isCurrent()) adopt(snapshot);
  } catch {
    // Keep the clearly labelled demonstration available; explicit login remains accessible.
  }
}
