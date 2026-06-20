# Eagle Web API Client

> HTTP client for Eagle's local web API — covers operations the injected plugin global cannot, chiefly switching the active library.

## Purpose

The injected `eagle` plugin global has no `library.switch` (and no
recent-libraries call). Eagle also runs a local HTTP API; this client targets
it for those gaps. It is a separate component from `eagle-host` because it
speaks HTTP with its own identity (base URL, token), not the in-process global.

## Constraints

- Base URL is the fixed local endpoint `http://localhost:41595/api`.
- Auth is a developer **token** read once from `GET /application/info`
  (`data.preferences.developer.apiToken`) and passed as a `?token=` query param
  on every call — there is no header auth.
- Eagle wraps responses in a `{ data: … }` envelope; the client unwraps it.
- `fetch` is injected (defaults to global `fetch`) so the client is tested
  without a live Eagle instance; the token is cached per client instance.

## Key Invariants

- Every request resolves the token first; a failed token fetch or any non-ok
  response throws. Callers that must stay graceful (the eagle-host
  `switchLibrary`) catch and surface the failure as a host event.

## Scope Boundary

**Owns:** HTTP calls to Eagle's web API. Currently the `library` namespace
(`info` / `history` / `switch`); `folder`/`item` endpoints are intentionally not
ported until a consumer needs them (the request core makes each a one-liner).
**Does not own:** the in-process `eagle` global surface (that is eagle-host), or
recent-libraries reading (eagle-host reads the Settings file; `library/history`
here is an available alternative, not yet wired).
