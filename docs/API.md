# API Draft

Bu dokuman Sprint-5 ile PostgreSQL persistence akisina guncellenmistir.

## Runtime Notes

- Backend `DB1_URL` ile PostgreSQL (DB1) uzerinden calisir.
- Uygulama acilisinda migrationlar otomatik calisir:
  - `backend/db/migrations/0001_tenant_foundation.sql`
  - `backend/db/migrations/0002_platform_state.sql`

## Health

- `GET /health`
- Response `200 OK`

```json
{
  "status": "ok"
}
```

## Version

- `GET /version`
- Response `200 OK`

```json
{
  "version": "0.5.0"
}
```

## Setup Status

- `GET /setup/status`
- Response `200 OK`

```json
{
  "installed": false
}
```

Kurulumdan sonra:

```json
{
  "installed": true
}
```

## Install

- `POST /install`
- Aciklama: Ilk kurulum endpointi; ilk tenant + ilk branch + ilk admin kullaniciyi olusturur.
- Not: Sadece bir kez basarili olur. Sonraki denemelerde `409 already_installed` doner.
- `INSTALL_KEY` env set ise `x-install-key` header zorunludur.

Request:

```json
{
  "tenant": { "code": "sprint5-demo", "name": "Sprint 5 Demo Tenant" },
  "branch": {
    "code": "izmir-01",
    "name": "Izmir Aqua Park",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 }
  },
  "adminUser": {
    "fullName": "Platform Admin",
    "email": "admin@safepark.local",
    "password": "Admin123!"
  }
}
```

Response `201 Created`:

```json
{
  "installed": true,
  "tenant": {
    "id": "<uuid>",
    "code": "sprint5-demo",
    "name": "Sprint 5 Demo Tenant",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  },
  "branch": {
    "id": "<uuid>",
    "tenantId": "<uuid>",
    "code": "izmir-01",
    "name": "Izmir Aqua Park",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 },
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  },
  "branches": [
    {
      "id": "<uuid>",
      "tenantId": "<uuid>",
      "code": "izmir-01",
      "name": "Izmir Aqua Park",
      "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 },
      "createdAt": "2026-02-11T12:00:00.000Z",
      "updatedAt": "2026-02-11T12:00:00.000Z"
    }
  ],
  "adminUser": {
    "id": "<uuid>",
    "tenantId": "<uuid>",
    "branchId": "<uuid>",
    "email": "admin@safepark.local",
    "fullName": "Platform Admin",
    "isActive": true,
    "lastLoginAt": null,
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z",
    "roles": ["super_admin", "platform_admin"]
  }
}
```

Hata:
- `403` `invalid_install_key`
- `409` `already_installed`
- `400` `missing_fields`, `weak_password`

## Setup Bootstrap (Deprecated)

- `POST /setup/bootstrap`
- Response `410 Gone`

```json
{
  "error": "Endpoint deprecated",
  "code": "bootstrap_deprecated",
  "message": "Use POST /install endpoint for initial setup",
  "installEndpoint": "/install"
}
```

## Tenant Create

- `POST /tenants`
- Header: `Authorization: Bearer <accessToken>`
- Role policy: `platform_admin`
- Not: Platform once `POST /install` ile kurulmus olmali.

## Login

- `POST /auth/login`

Request:

```json
{
  "tenantCode": "sprint5-demo",
  "email": "admin@safepark.local",
  "password": "Admin123!"
}
```

Response `200 OK`:

```json
{
  "accessToken": "<token>",
  "tokenType": "Bearer",
  "expiresAt": "2026-02-11T20:00:00.000Z",
  "user": {
    "id": "<uuid>",
    "tenantId": "<uuid>",
    "branchId": "<uuid>",
    "email": "admin@safepark.local",
    "fullName": "Platform Admin",
    "isActive": true,
    "lastLoginAt": "2026-02-11T12:05:00.000Z",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:05:00.000Z",
    "roles": ["super_admin", "platform_admin"]
  }
}
```

Hata:
- `401` `invalid_credentials`
- `400` `missing_credentials`

## Me

- `GET /auth/me`
- Header: `Authorization: Bearer <accessToken>`

## Park Profile

- `GET /parks/:branchId/profile`
- `PUT /parks/:branchId/profile`
- Header: `Authorization: Bearer <accessToken>`
- Role policy:
  - `super_admin`: ayni tenant icindeki tum branchler
  - `branch_manager`: sadece kendi `branchId`

Hata:
- `401` `missing_bearer_token`, `invalid_or_expired_token`
- `403` `insufficient_role`, `cross_tenant_forbidden`, `branch_scope_forbidden`
- `404` `branch_not_found`
