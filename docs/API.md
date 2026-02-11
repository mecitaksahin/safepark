# API Draft

Bu dokuman backend ajan tarafindan sprintlerde guncellenecektir.

## Health

- `GET /health`
- Response:
  - `200 OK`
  - `{ "status": "ok" }`

## Bootstrap ve Kimlik

- `POST /setup/bootstrap`
- Aciklama:
  - Ilk kurulumda tenant/firma, ilk sube ve super admin kullanicisini olusturur.
- Request (ornek):
  - `{ "companyName": "SafePark Group", "parkName": "SafePark Antalya", "email": "admin@safepark.local", "password": "..." }`
- Response:
  - `201 Created`
  - `{ "tenantId": "...", "branchId": "...", "userId": "..." }`

- `POST /auth/login`
- Request:
  - `{ "email": "admin@safepark.local", "password": "...", "tenantCode": "safepark" }`
- Response:
  - `200 OK`
  - `{ "accessToken": "...", "refreshToken": "...", "user": { "id": "...", "role": "SUPER_ADMIN" } }`

- `GET /auth/me`
- Response:
  - `200 OK`
  - `{ "userId": "...", "tenantId": "...", "branchId": "...", "role": "TENANT_ADMIN" }`

## Tenant/Firma ve Park Profili

- `POST /tenants`
- `GET /tenants/:tenantId`
- `PATCH /tenants/:tenantId`

- `POST /branches`
- `GET /branches/:branchId`
- `PATCH /branches/:branchId`

- `GET /parks/:branchId/profile`
- `PUT /parks/:branchId/profile`
- Profile fields:
  - `parkName`
  - `address`
  - `mapUrl`
  - `phone`
  - `website`

## Kullanici ve Roller

- `POST /users`
- `GET /users/:userId`
- `PATCH /users/:userId`
- `PATCH /users/:userId/role`

Role enum (ilk taslak):
- `SUPER_ADMIN`
- `TENANT_ADMIN`
- `BACKOFFICE_OPERATOR`
- `FINANCE`
- `POS_USER`
