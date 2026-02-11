# Sprint-3 Frontend Notes

## Scope

- Vite + Vue 3 + Tailwind + PostCSS toolchain kuruldu.
- TypeScript entrypoint ve Vue SFC yapisi eklendi (`src/main.ts`, `src/App.vue`).
- Tailwind tokenlari `tailwind.config.cjs` uzerinden tanimlandi.
- Uc ana ekran eklendi:
  - Login (tenant + email + sifre)
  - Bootstrap ilk kurulum formu
  - Park profile formu
- Super Admin / Tenant Admin role bazli menu taslagi eklendi.
- API hata ve validation mesaji normalize edilerek UI geri bildirimi netlestirildi.
- CDN script bagimliligi kaldirildi.
- Docker build sureci dist uretip nginx ile serve edecek sekilde guncellendi.

## API Endpoint Varsayimlari

- `POST /api/auth/login`
- `POST /api/bootstrap/initialize`
- `PUT /api/parks/profile`

Mevcut backend sprint durumunda bu endpointler yoksa frontend 404 mesajini acik sekilde gosterir.

## Validation Kurallari

- Login:
  - `tenant`, `email`, `password` zorunlu
  - email format kontrolu
- Bootstrap:
  - `tenantName`, `tenantCode`, `adminEmail`, `adminPassword` zorunlu
  - admin sifre min 8 karakter
- Park Profile:
  - `parkName`, `address` zorunlu
  - `mapUrl` ve `website` doluysa URL format kontrolu

## Responsive Kontrol Notu

- Layout mobilde tek kolon, desktopta menu + content iki kolon olarak calisir.
