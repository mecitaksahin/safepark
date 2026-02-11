# API Draft

Bu dokuman Sprint-4 install flow ile guncellenmistir.

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
  "version": "0.4.0"
}
```

## Setup Status

- `GET /setup/status`
- Aciklama: Platform kurulum durumunu dondurur.
- Response `200 OK`

```json
{
  "installed": false
}
```

Kurulum tamamlandiktan sonra:

```json
{
  "installed": true
}
```

## Install

- `POST /install`
- Aciklama: Ilk kurulum endpointi; ilk tenant + ilk branch + ilk admin kullaniciyi olusturur.
- Not: Sadece bir kez basarili olur. Ikinci denemede `409 already_installed` doner.
- `INSTALL_KEY` env var set ise header zorunlu: `x-install-key: <INSTALL_KEY>`
- Request body:

```json
{
  "tenant": { "code": "sprint4-demo", "name": "Sprint 4 Demo Tenant" },
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

- Response `201 Created`

```json
{
  "installed": true,
  "tenant": {
    "id": "ten_0001",
    "code": "sprint4-demo",
    "name": "Sprint 4 Demo Tenant",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  },
  "branch": {
    "id": "brn_0001",
    "tenantId": "ten_0001",
    "code": "izmir-01",
    "name": "Izmir Aqua Park",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 },
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  },
  "branches": [
    {
      "id": "brn_0001",
      "tenantId": "ten_0001",
      "code": "izmir-01",
      "name": "Izmir Aqua Park",
      "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 },
      "createdAt": "2026-02-11T12:00:00.000Z",
      "updatedAt": "2026-02-11T12:00:00.000Z"
    }
  ],
  "adminUser": {
    "id": "usr_0001",
    "tenantId": "ten_0001",
    "branchId": "brn_0001",
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

- Hata:
  - `403` `invalid_install_key` (`INSTALL_KEY` set ve header eksik/yanlis oldugunda)
  - `409` `already_installed`
  - `400` `missing_fields`, `weak_password`

## Setup Bootstrap (Deprecated)

- `POST /setup/bootstrap`
- Durum: Deprecated
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
- Role policy: sadece `platform_admin`
- Aciklama: Yeni tenant, primary branch ve tenant admin olusturur.
- Not: Platform once `POST /install` ile kurulmus olmali.

## Login

- `POST /auth/login`
- Request body:

```json
{
  "tenantCode": "sprint4-demo",
  "email": "admin@safepark.local",
  "password": "Admin123!"
}
```

- Hata:
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
