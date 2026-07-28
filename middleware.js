// HTTP Basic Auth gate for the WHOLE app — page AND /api/* — via Vercel Edge Middleware (K-28).
// A client-side gate alone is theatre (curl /api/hive would bypass it); the gate lives here,
// before the filesystem, on every path. Fail CLOSED: unset env or bad/missing credentials
// → 401 with a Basic challenge and no data. Basic-over-HTTPS only (every Vercel deploy is HTTPS).

const REALM = "HIVE Comb";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "WWW-Authenticate": `Basic realm="${REALM}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Constant-time compare (the edge runtime has no crypto.timingSafeEqual).
// Loop length is max(len) regardless of match; length itself is not secret here.
function safeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length === bb.length ? 0 : 1;
  const max = Math.max(ab.length, bb.length);
  for (let i = 0; i < max; i++) {
    const x = i < ab.length ? ab[i] : 0;
    const y = i < bb.length ? bb[i] : 0;
    diff |= x ^ y;
  }
  return diff === 0;
}

export default function middleware(request) {
  const expectedUser = process.env.COMB_USER;
  const expectedPass = process.env.COMB_PASSWORD;

  // Not configured → fail closed (never open).
  if (!expectedUser || !expectedPass) return unauthorized();

  const header = (request.headers.get("authorization") || "").trim();
  // RFC 7235 §2.1: auth-scheme is case-INsensitive ("basic"/"BASIC"/"Basic" are all
  // valid). Split on the first whitespace run — a base64 blob never contains spaces,
  // so collapsing runs ("Basic  <b64>") is unambiguous and avoids a needless 401 on
  // tolerant-but-real clients (whitespace decision: ACCEPT normalized runs; the blob
  // cannot legally contain a space, so nothing valid is rejected and nothing invalid
  // is admitted that wasn't already a credential-shaped value).
  const firstSpace = header.search(/\s/);
  if (firstSpace > 0 && header.slice(0, firstSpace).toLowerCase() === "basic") {
    const blob = header.slice(firstSpace).trim();
    let decoded = "";
    try {
      decoded = atob(blob);
    } catch {
      return unauthorized();
    }
    const sep = decoded.indexOf(":");
    if (sep >= 0) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)) {
        return; // undefined → continue to the app (filesystem/API)
      }
    }
  }
  return unauthorized();
}
