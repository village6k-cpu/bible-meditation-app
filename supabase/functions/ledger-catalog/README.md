# Ledger catalog search

Dedicated project: `mbypanaxjuliucxsujea` only. No schema, RLS, auth provider,
Google Photos or HeyBilly changes. Deploy **only `ledger-catalog`**, with
`verify_jwt: true`. The handler additionally calls `auth.getUser(bearer)` and
rejects anonymous users. Do not disable the JWT gate to work around a 401.

Server secrets (never VITE variables or committed files):

- `LEDGER_KAKAO_KEY`: REST key for the dedicated Kakao Ledger app `1593072`.
- `LEDGER_TMDB_TOKEN`: TMDB personal Free Developer read token.

Use the existing Ledger Supabase dashboard to save these two secrets. Do not
change any existing secrets. A missing secret produces a recoverable 503 and
manual registration remains available. The UI should not be released before
both secrets and authenticated function calls have been verified.

POST `{action: "search", kind: "book" | "film" | "series", q: "title"}`.
POST `{action: "detail", kind: "film" | "series", id: "157336"}` resolves
directors/creators only when the user chooses a result.

Only the search text or selected public catalog ID goes to fixed provider
URLs. No review, rating, local notes, photos, or user ID goes to the provider.
Five-minute bounded in-memory cache; best-effort per-isolate 30 requests per
user per minute (not a distributed abuse limit). No query/token logging.

Artwork is optional metadata inside `sources.library_json`; it must never
use `thumbnail_uri`, which would propagate into the user's note photos.
Old clients preserve this JSON as a whole. Invalid artwork is dropped on
read without discarding the review or rating. External image failure falls
back to an icon. The UI includes provider attribution and TMDB's official
logo/notice. No image files are uploaded to the user's Google Photos.

Verification before release: authenticated Korean book/movie search, select,
save, reopen, edit, refresh, 390px and 1280px screenshots; distinguish these
from physical two-device verification. Test unauthorized calls fail and
secrets are absent from built frontend assets.
