# Remote MCP server — security design

Status: **design only, nothing deployed.** Written 2026-09-03.

The MCP server (`mcp-server/`) currently speaks newline-delimited JSON over stdio
to a local process. That makes it desktop-only: a phone has no path to a process
running on a Windows machine. Making it reachable from a phone means putting it
on the internet, which changes the threat model completely.

This document exists because the failure mode is not a bug. It is the whole
database.

---

## The one rule

**The service-role key must never leave the machine.**

Today the server is configured with `MCP_SUPABASE_SERVICE_ROLE_KEY` and
`MCP_USER_ID`. That is acceptable for a local stdio process — the key sits in a
file on a personal machine at the same trust level as `.env.local`, and the
process is spawned by the desktop app, not reachable by anything else.

It is categorically unacceptable over HTTP. A service-role key bypasses every RLS
policy in the database. An endpoint holding one is a total-compromise primitive:
anyone who reaches it reads and writes every row of every user, and migration
0044's entire multitenant model is switched off for that request path.

So the remote design inverts the local one:

| | local (today) | remote (proposed) |
|---|---|---|
| identity | `MCP_USER_ID` env var | resolved from the caller's credential |
| authority | service role, RLS bypassed | the user's own JWT, **RLS enforced** |
| blast radius if auth is wrong | n/a — no auth surface | a query returning zero rows |

That last row is the point. Letting RLS do the scoping turns an authorization bug
from a breach into an empty result set.

---

## What the MCP spec actually requires

Checked against the specification (`basic/authorization`), because this was the
open question and guessing at it would have been the wrong way to design.

For HTTP transports the spec is not "pick an auth scheme you like":

- Servers **MUST** implement OAuth 2.0 Protected Resource Metadata (RFC 9728),
  either at `/.well-known/oauth-protected-resource` or via a `resource_metadata`
  parameter on the `WWW-Authenticate` header of a 401.
- That metadata **MUST** name at least one `authorization_servers` entry.
- Clients **MUST** implement PKCE with `S256`, and **MUST refuse to proceed** if
  the authorization server's metadata omits `code_challenge_methods_supported`.
- Clients **MUST** send RFC 8707 `resource` indicators; servers **MUST** validate
  that a token was issued for them specifically.
- Token passthrough is **explicitly forbidden** — a token minted for one audience
  may never be forwarded to another.
- All endpoints over HTTPS; redirect URIs HTTPS or localhost, exact-matched.

**Consequence: a static bearer token is not spec-compliant**, and a compliant
client will not offer a "paste an API key" field. It will look for the discovery
document and start an OAuth flow.

That kills the cheapest version of this idea, which is worth knowing before
building rather than after.

---

## Why capture tokens were the obvious idea, and where they still fit

`capture_tokens` (migration 0063) already solves the shape of this problem for
the bookmarklet and iOS Shortcut, and its properties are exactly what a remote
credential wants:

- 32 bytes of CSPRNG entropy, base64url
- stored as **SHA-256 hash only**, so a database leak yields no usable credential
- plaintext shown exactly once — the GitHub PAT contract
- per-user, so `user_id` comes from the credential, not from the environment
- revocable, with `last_used_at` deliberately retained on revoked rows as evidence
  of when a leaked token stopped working
- a `security definer` resolver already exists

Its migration comment already makes the argument this document is repeating:
a shared secret was *"fine for one user; disqualifying for signups."*

They cannot be the MCP credential directly, because of the discovery requirement
above. They remain the right credential for **non-MCP** remote surfaces — a
capture endpoint, a shortcut, a future extension — and they are the right thing
for the OAuth layer to issue against if this is ever built.

---

## The three honest options

### 1. Do not go remote. Make the PWA the phone client.

The app is already installable, already authenticates as the user, and already
enforces RLS. Once due dates are editable in the UI, the phone can read and
change the backlog with no new attack surface, no OAuth server, and no secret
leaving the machine.

What is lost: conversational capture on the phone. "Remind me to email the
recruiter Friday" stays a desktop gesture; on the phone it is a few taps.

**This is the recommendation.** It closes the same two gaps that motivated remote
access — phone access, and surviving without Claude credits — for a fraction of
the work and none of the risk.

### 2. Minimal OAuth 2.1 authorization server in edge functions

Buildable, and bounded, but it is a real project: RFC 9728 metadata, RFC 8414
metadata, dynamic client registration, an authorization endpoint with PKCE S256,
a token endpoint, refresh rotation, audience validation. Every one of those is a
place to get security wrong, and the consequence of getting it wrong is the whole
database.

Only worth it if conversational capture from the phone turns out to be something
actually reached for, repeatedly, after living with option 1.

### 3. Front it with a hosted identity provider that speaks OAuth 2.1 + DCR

Less code than option 2 and far less to get wrong, at the cost of another
dependency in the path to personal data. The reasonable middle if option 1 proves
insufficient.

---

## If option 2 or 3 is ever built, the non-negotiables

- **Never** ship the service-role key to the edge. Resolve identity, then act as
  that user so RLS is enforced.
- Rate limiting is **optional here** and deliberately so. It exists to stop one
  tenant exhausting shared capacity; with a personal project and a single human,
  that pressure does not exist. `supabase/functions/_shared/meter.ts` is there if
  it is ever wanted. This is the only line in this document that being
  single-user relaxes — see the note below.
- Scope tokens read-only vs read-write. Casual phone use should not be able to
  destroy anything.
- Log tool calls with the credential's **id**, never the credential.
- Credentials in headers only. URLs leak into proxy logs, browser history and
  referrers.
- Reuse `_shared/isSafeUrl.ts` for any tool that fetches a URL.
- Validate token audience on every request; never forward a received token onward.

---

## "I am the only user" does not narrow the threat

Worth stating plainly, because the two concerns feel alike and are not.

Rate limiting is about legitimate load, so a single user genuinely removes the
need for it. Service-role exposure is about the open internet. A public endpoint
is reachable by anyone who finds the URL, and edge-function URLs are found by
scanners as a matter of routine. Being the only *legitimate* user does not reduce
who can send a request — it only means every request that is not yours is
hostile. If that endpoint bypasses RLS, one unauthenticated call reads or destroys
every entry.

Single-tenancy relaxes the rate-limit line. It changes nothing above it.

Also: the premise is not currently true. The project has **two** auth accounts —
the founder, and one other that last signed in 2026-07-30. Probably a test
account, but RLS multitenancy is live today rather than hypothetical, and any
design that assumes a single tenant should verify that assumption first.

---

## Decision

Build option 1. Revisit remote access only if phone-side conversational capture
proves to be a thing that is genuinely missed, and treat it as a security project
with its own review rather than a feature.
