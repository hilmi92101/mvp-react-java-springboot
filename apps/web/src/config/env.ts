/**
 * Typed access to the `VITE_*` variables, so no component reaches into
 * `import.meta.env` and invents its own fallback.
 *
 * Everything here is compiled into the bundle and therefore public. That is
 * fine for the Maps key — it is protected by an HTTP-referrer restriction on
 * the key itself, not by secrecy (see docs/plans/place-finder.md
 * Question #7) — and it is the reason no server-side secret may ever be read
 * through this file.
 */

/**
 * Google Maps / Places browser key. Empty when the compose environment did not
 * supply one.
 *
 * Deliberately *not* a throw at module load, which is what the plan sketched:
 * this module is imported by the Place Finder page, and throwing during import
 * takes down the router with a blank screen and a console stack — the exact
 * failure the UX requirements call the worst possible feedback. The page checks
 * the value and renders a sentence saying what to do instead.
 */
export const googleMapsApiKey: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
