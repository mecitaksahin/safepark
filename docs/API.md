# API Draft

Bu dokuman Sprint-3 ile tenant foundation endpointleri icin guncellenmistir.

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
  "version": "0.3.0"
}
```

## Setup Bootstrap

- `POST /setup/bootstrap`
- Aciklama: Ilk tenant + branch + admin kullanici olusturur. Bir kez calisir.
- Request body:

```json
{
  "tenant": { "code": "sprint3-demo", "name": "Sprint 3 Demo Tenant" },
  "branch": {
    "code": "izmir-01",
    "name": "Izmir Aqua Park",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 }
  },
  "adminUser": {
    "fullName": "Sprint Admin",
    "email": "admin@safepark.local",
    "password": "Admin123!"
  }
}
```

- Response `201 Created`

```json
{
  "setupCompleted": true,
  "tenant": {
    "id": "ten_0001",
    "code": "sprint3-demo",
    "name": "Sprint 3 Demo Tenant",
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
  "adminUser": {
    "id": "usr_0001",
    "tenantId": "ten_0001",
    "branchId": "brn_0001",
    "email": "admin@safepark.local",
    "fullName": "Sprint Admin",
    "isActive": true,
    "lastLoginAt": null,
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z",
    "roles": ["super_admin"]
  }
}
```

- Hata:
  - `409` `bootstrap_already_done`
  - `400` `missing_fields`, `weak_password`

## Login

- `POST /auth/login`
- Request body:

```json
{
  "email": "admin@safepark.local",
  "password": "Admin123!"
}
```

- Response `200 OK`

```json
{
  "accessToken": "<token>",
  "tokenType": "Bearer",
  "expiresAt": "2026-02-11T20:00:00.000Z",
  "user": {
    "id": "usr_0001",
    "tenantId": "ten_0001",
    "branchId": "brn_0001",
    "email": "admin@safepark.local",
    "fullName": "Sprint Admin",
    "isActive": true,
    "lastLoginAt": "2026-02-11T12:05:00.000Z",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:05:00.000Z",
    "roles": ["super_admin"]
  }
}
```

- Hata:
  - `401` `invalid_credentials`
  - `400` `missing_credentials`

## Me

- `GET /auth/me`
- Header: `Authorization: Bearer <accessToken>`
- Response `200 OK`

```json
{
  "user": {
    "id": "usr_0001",
    "tenantId": "ten_0001",
    "branchId": "brn_0001",
    "email": "admin@safepark.local",
    "fullName": "Sprint Admin",
    "isActive": true,
    "lastLoginAt": "2026-02-11T12:05:00.000Z",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:05:00.000Z",
    "roles": ["super_admin"]
  },
  "tenant": {
    "id": "ten_0001",
    "code": "sprint3-demo",
    "name": "Sprint 3 Demo Tenant",
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
  }
}
```

## Park Profile

- `GET /parks/:branchId/profile`
- Header: `Authorization: Bearer <accessToken>`
- Role policy: authenticated user + ayni tenant
- Response `200 OK`

```json
{
  "branch": {
    "id": "brn_0001",
    "tenantId": "ten_0001",
    "code": "izmir-01",
    "name": "Izmir Aqua Park",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 5500 },
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  }
}
```

- `PUT /parks/:branchId/profile`
- Header: `Authorization: Bearer <accessToken>`
- Role policy: `super_admin` veya `branch_manager`
- Request body:

```json
{
  "name": "Izmir Aqua Park North",
  "profile": {
    "timezone": "Europe/Istanbul",
    "capacity": 6000,
    "contactEmail": "north@safepark.local"
  }
}
```

- Response `200 OK`

```json
{
  "branch": {
    "id": "brn_0001",
    "tenantId": "ten_0001",
    "code": "izmir-01",
    "name": "Izmir Aqua Park North",
    "profile": {
      "timezone": "Europe/Istanbul",
      "capacity": 6000,
      "contactEmail": "north@safepark.local"
    },
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:10:00.000Z"
  }
}
```

- Hata:
  - `401` `missing_bearer_token`, `invalid_or_expired_token`
  - `403` `insufficient_role`, `cross_tenant_forbidden`
  - `404` `branch_not_found`
