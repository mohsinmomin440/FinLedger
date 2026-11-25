# Security Controls

1. **In-Memory Access Tokens & Refresh Rotation**:
   - Short-lived JWT access tokens (`15m`) exist solely in Zustand React memory (`client/src/stores/authStore.js`), never persisted to `localStorage` or `sessionStorage`.
   - Refresh tokens (`7d`) are delivered in `HttpOnly`, `SameSite` cookies scoped to `/api/v1/auth` and stored as SHA-256 digests in MongoDB (`RefreshToken`).
   - Presenting a previously rotated/revoked refresh token immediately revokes all active tokens sharing its `familyId`.
2. **Double-Submit CSRF Protection**:
   - Cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`, `/auth/sessions/*`) verify `X-CSRF-Token` header matches `finledger_csrf` cookie via `crypto.timingSafeEqual`.
3. **Multi-Tenant Workspace Isolation & RBAC**:
   - `requireWorkspace(minRole)` verifies `WorkspaceMember` existence and minimum role weight (`VIEWER < MEMBER < ADMIN < OWNER`) on every workspace-scoped endpoint.
   - Socket.IO handshakes verify JWT tokens and check `WorkspaceMember` before joining `workspace:<id>` rooms.
4. **Private Receipt Upload Hardening**:
   - Multer enforces a 5 MB cap and strict MIME + extension allowlist (`png`, `jpg`, `jpeg`, `webp`, `pdf`).
   - `hasAllowedMagicBytes` verifies binary file headers before persisting outside public web roots (`server/uploads/`).
   - Downloads stream exclusively through authenticated workspace-authorized endpoints with `X-Content-Type-Options: nosniff`.
5. **Formula-Safe CSV Exports**:
   - `sanitizeCsvCell` prefixes any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with `'` before RFC 4180 quoting.
6. **Production Environment Fail-Fast**:
   - `server/src/config/env.js` aborts startup in `NODE_ENV=production` if `MONGO_URI`, `JWT_ACCESS_SECRET` (>= 32 chars), `JWT_REFRESH_SECRET` (>= 32 chars), or `CORS_ORIGIN` are missing, or if `USE_MEMORY_DB=true`.
