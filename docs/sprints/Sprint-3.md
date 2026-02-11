# Sprint-3 Plani (Tenant ve Park Foundation)

## Kickoff

- Kickoff Date: 2026-02-11
- Sprint Owner: Team Lead
- Sprint Branches:
  - `feat/backend-sprint-3-tenant-foundation`
  - `feat/frontend-sprint-3-tenant-ui`

## Sprint Goal

Rezervasyon ve operasyon modullerinden once, coklu firma/tenant temelini kurmak:

1. tenant/firma
2. sube/park
3. kullanici/rol
4. bootstrap super admin
5. park profil bilgileri

## Kurallar

1. Kendi scope disina cikmayin.
2. PR template zorunlu.
3. API ve docs guncellemeleri zorunlu.
4. Bitince asagidaki formatta teslim edin:
   - Summary
   - Test/Validation
   - PR linki

## Backend Tasks

1. DB migration taslagi:
   - `tenants`
   - `branches`
   - `users`
   - `roles` (veya enum + user_roles)
   - `audit_logs`
2. `POST /setup/bootstrap` endpointi
3. `POST /auth/login` ve `GET /auth/me` temel akisi
4. `GET/PUT /parks/:branchId/profile` endpointleri
5. Temel authorization middleware (role check)
6. API dokuman guncellemesi (`docs/API.md`)

## Frontend Tasks

1. Login ekrani (tenant + email + sifre)
2. Ilk kurulum (bootstrap) formu
3. Vue + Tailwind temel UI setup (design token taslagi ile)
4. Park profil ekrani:
   - park adi
   - adres
   - map url
   - telefon
   - website
5. Rol bazli menu gorunum taslagi (en az Super Admin / Tenant Admin)
6. API hata/validation mesajlarini netlestirme

## Team Lead Tasks

1. Role matrix dokumanini dondur
2. Bootstrap acceptance criteria onayi
3. PR review'de tenant izolasyon kontrolu
4. Sprint sonunda demo:
   - bootstrap
   - login
   - park profil guncelleme
5. Backend ve frontend PR'larini merge etmeden once `docs/API.md` ve sprint notlarini kontrol et

## Exit Criteria

1. Ilk kurulumda super admin olusuyor.
2. Login sonrasi kullanicinin tenant/branch baglami belirleniyor.
3. Park profil bilgileri kaydedilip okunuyor.
4. Yetkisiz rol ile profile update denemesi reddediliyor.
