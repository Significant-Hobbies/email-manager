# Runbook: Google OAuth Setup

The most common setup footgun for email-manager is Google OAuth callback URL
registration. `redirect_uri_mismatch` errors mean the callback URL in Google
Cloud Console does not match the deployed URL.

## Required callback URLs

Register BOTH of these in Google Cloud Console → APIs & Services → Credentials
→ OAuth 2.0 Client ID → Authorized redirect URIs:

- `http://localhost:8787/api/auth/callback/google` (local dev)
- `https://mail.significanthobbies.com/api/auth/callback/google` (production)

## Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Select the project that owns the email-manager OAuth client.
3. Navigate to **APIs & Services → Credentials**.
4. Click the OAuth 2.0 Client ID used by email-manager.
5. Under **Authorized redirect URIs**, add both URLs above.
6. Click **Save**.
7. Wait ~5 minutes for Google to propagate the change.

## Verifying credentials are set

```bash
# Local: check .dev.vars has real values (do not print them)
grep -c "GOOGLE_CLIENT_ID\|GOOGLE_CLIENT_SECRET" .dev.vars

# Production: check the health endpoint
curl https://mail.significanthobbies.com/api/health | jq .auth.googleConfigured
# Should be: true
```

## Scopes

The OAuth client must request these scopes (configured in `src/lib/auth.ts`):

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

`accessType: "offline"` and `prompt: "consent"` ensure a refresh token is
issued, enabling `auth.api.getAccessToken` to transparently renew expired
tokens.

## If sign-in fails

| Error | Cause | Fix |
| --- | --- | --- |
| `redirect_uri_mismatch` | Callback URL not registered | Add the URL in Google Cloud Console (see steps above) |
| `invalid_client` | Client ID/secret mismatch | Verify `.dev.vars` / `wrangler secret` values match the Console |
| `access_denied` | User did not grant `gmail.readonly` | Re-trigger consent flow; check scopes in Console |
| Silent auth failure after 1 hour | Refresh token not stored or refresh failing | Verify `accessType: "offline"` + `prompt: "consent"` in `src/lib/auth.ts` |

## Security notes

- Never commit `GOOGLE_CLIENT_SECRET` to the repo.
- `.dev.vars` is gitignored — safe for local use.
- Production secrets: `wrangler secret put GOOGLE_CLIENT_SECRET`.
- If credentials are compromised, revoke and recreate in Google Cloud Console,
  then update `.dev.vars` / `wrangler secret` — do not rotate in tracked files.
