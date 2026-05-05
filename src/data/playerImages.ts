/**
 * Player images disabled — ESPNCricinfo CMS IDs are not publicly predictable.
 * All players use canvas-generated initials avatars instead (reliable, instant).
 */
export function getPlayerImage(_id: string): string | null {
  return null; // always use canvas avatar
}
