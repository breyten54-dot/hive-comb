// Comb is public (no HTTP Basic gate). Kept as a no-op so a future gate can
// drop back in without changing Vercel wiring. Security headers live in vercel.json.

export default function middleware() {
  return; // continue to filesystem / API
}
