# API Draft

Bu dokuman Sprint-3 tenant foundation revizyonu ile guncellenmistir.

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
  "version": "0.3.1"
}
```

## Setup Bootstrap

- `POST /setup/bootstrap`
- Aciklama: Platform ilk kurulumunu yapar (ilk tenant + ilk admin). Bir kez calisir.
- Not: Sonraki tenant olusturmalari `POST /tenants` ile devam eder.
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
    "fullName": "Platform Admin",
    "email": "admin@safepark.local",
    "password": "Admin123!"
  }
}
```

- Response `201 Created`

```json
{
  "setupCompleted": true,
  "platformInitialized": true,
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
  - `409` `bootstrap_already_done`
  - `400` `missing_fields`, `weak_password`

## Tenant Create

- `POST /tenants`
- Header: `Authorization: Bearer <accessToken>`
- Role policy: sadece `platform_admin`
- Aciklama: Yeni tenant, primary branch ve tenant admin olusturur.
- Request body:

```json
{
  "tenant": { "code": "west-hub", "name": "West Hub Tenant" },
  "branch": {
    "code": "west-01",
    "name": "West Main",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 3000 }
  },
  "extraBranches": [
    {
      "code": "west-02",
      "name": "West Annex",
      "profile": { "timezone": "Europe/Istanbul", "capacity": 1800 }
    }
  ],
  "adminUser": {
    "fullName": "West Manager",
    "email": "admin@safepark.local",
    "password": "WestPass123!",
    "roles": ["branch_manager"]
  }
}
```

- Response `201 Created`

```json
{
  "tenant": {
    "id": "ten_0002",
    "code": "west-hub",
    "name": "West Hub Tenant",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  },
  "branch": {
    "id": "brn_0002",
    "tenantId": "ten_0002",
    "code": "west-01",
    "name": "West Main",
    "profile": { "timezone": "Europe/Istanbul", "capacity": 3000 },
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z"
  },
  "branches": [
    {
      "id": "brn_0002",
      "tenantId": "ten_0002",
      "code": "west-01",
      "name": "West Main",
      "profile": { "timezone": "Europe/Istanbul", "capacity": 3000 },
      "createdAt": "2026-02-11T12:00:00.000Z",
      "updatedAt": "2026-02-11T12:00:00.000Z"
    },
    {
      "id": "brn_0003",
      "tenantId": "ten_0002",
      "code": "west-02",
      "name": "West Annex",
      "profile": { "timezone": "Europe/Istanbul", "capacity": 1800 },
      "createdAt": "2026-02-11T12:00:00.000Z",
      "updatedAt": "2026-02-11T12:00:00.000Z"
    }
  ],
  "adminUser": {
    "id": "usr_0002",
    "tenantId": "ten_0002",
    "branchId": "brn_0002",
    "email": "admin@safepark.local",
    "fullName": "West Manager",
    "isActive": true,
    "lastLoginAt": null,
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:00:00.000Z",
    "roles": ["branch_manager"]
  }
}
```

- Hata:
  - `401` `missing_bearer_token`, `invalid_or_expired_token`
  - `403` `insufficient_role`
  - `409` `tenant_code_exists`, `email_already_exists`

## Login

- `POST /auth/login`
- Request body:

```json
{
  "tenantCode": "sprint3-demo",
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
    "fullName": "Platform Admin",
    "isActive": true,
    "lastLoginAt": "2026-02-11T12:05:00.000Z",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:05:00.000Z",
    "roles": ["super_admin", "platform_admin"]
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
    "fullName": "Platform Admin",
    "isActive": true,
    "lastLoginAt": "2026-02-11T12:05:00.000Z",
    "createdAt": "2026-02-11T12:00:00.000Z",
    "updatedAt": "2026-02-11T12:05:00.000Z",
    "roles": ["super_admin", "platform_admin"]
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
- `PUT /parks/:branchId/profile`
- Header: `Authorization: Bearer <accessToken>`
- Role policy:
  - `super_admin`: ayni tenant icindeki tum branchler
  - `branch_manager`: sadece kendi `branchId`

- `PUT /parks/:branchId/profile` request body:

```json
{
  "name": "West Main Updated",
  "profile": {
    "timezone": "Europe/Istanbul",
    "capacity": 3200
  }
}
```

- Hata:
  - `401` `missing_bearer_token`, `invalid_or_expired_token`
  - `403` `insufficient_role`, `cross_tenant_forbidden`, `branch_scope_forbidden`
  - `404` `branch_not_found`
