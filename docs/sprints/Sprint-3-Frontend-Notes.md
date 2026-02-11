# Sprint-3 Frontend Notes

## Scope

- Vite + Vue 3 + Tailwind + PostCSS toolchain kuruldu.
- TypeScript entrypoint ve Vue SFC yapisi eklendi (`src/main.ts`, `src/App.vue`).
- Tailwind tokenlari `tailwind.config.cjs` uzerinden tanimlandi.
- Uc ana ekran eklendi:
  - Login (`tenantCode` + email + sifre)
  - Bootstrap ilk kurulum formu
  - Park profile formu
- Super Admin / Tenant Admin role bazli menu taslagi eklendi.
- API hata ve validation mesaji normalize edilerek UI geri bildirimi netlestirildi.
- CDN script bagimliligi kaldirildi.
- Docker build sureci dist uretip nginx ile serve edecek sekilde guncellendi.
- `branchId` login veya `/auth/me` response'undan alinip park profile endpoint path'inde kullanildi.

## API Endpoint Varsayimlari

- `POST /auth/login`
- `POST /setup/bootstrap`
- `GET /parks/:branchId/profile`
- `PUT /parks/:branchId/profile`

Mevcut backend sprint durumunda bu endpointler yoksa frontend 404 mesajini acik sekilde gosterir.

## Payload Contract

- Login payload:
  - `{ tenantCode, email, password }`
- Bootstrap payload:
  - `{ tenant:{code,name}, branch:{code,name,profile}, adminUser:{fullName,email,password} }`

## Validation Kurallari

- Login:
  - `tenantCode`, `email`, `password` zorunlu
  - email format kontrolu
- Bootstrap:
  - `tenant.code`, `tenant.name`, `branch.code`, `branch.name` zorunlu
  - `branch.profile.parkName`, `branch.profile.address` zorunlu
  - `adminUser.fullName`, `adminUser.email`, `adminUser.password` zorunlu
  - URL format kontrolu: `branch.profile.mapUrl`, `branch.profile.website`
  - admin sifre min 8 karakter
- Park Profile:
  - `parkName`, `address` zorunlu
  - `mapUrl` ve `website` doluysa URL format kontrolu

## Responsive Kontrol Notu

- Layout mobilde tek kolon, desktopta menu + content iki kolon olarak calisir.
