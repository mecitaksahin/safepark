# Sprint-4 Plani (Install Flow ve First-Run Guard)

## Kickoff

- Kickoff Date: 2026-02-11
- Sprint Owner: Team Lead
- Sprint Branches:
  - `feat/backend-sprint-4-install-flow`
  - `feat/frontend-sprint-4-install-routing`

## Sprint Goal

Sistem ilk acilista kurulum durumuna gore dogru ekrana yonlendirmeli:

1. Eger sistem kurulu degilse sadece `/install` aktif olacak.
2. Kurulum tamamlandiginda `/install` kapanacak.
3. Sonraki acilislarda default rota `/login` olacak.

## Kurallar

1. Kendi scope disina cikmayin.
2. PR template zorunlu.
3. API ve docs guncellemeleri zorunlu.
4. Kurulum akisi idempotent ve guvenli olmali.
5. Bitince asagidaki formatta teslim edin:
   - Summary
   - Test/Validation
   - PR linki

## Backend Tasks

1. Platform kurulum durumu icin migration:
   - `platform_state` (tek satir, `is_installed`, `installed_at`, `installed_tenant_id`, `installed_branch_id`, `installed_user_id`)
2. `GET /setup/status` endpointi:
   - Response: `{ "installed": true|false }`
3. `POST /install` endpointi:
   - Kurulu degilse tenant + branch(profile) + super admin olustur
   - Basari sonunda `platform_state.is_installed = true`
   - Kuruluysa `409 already_installed`
4. `POST /setup/bootstrap` endpointini deprecated hale getir:
   - Ya `410 gone` donsun, ya da `POST /install`e yonlendirme notu versin
5. Guvenlik:
   - Ilk kurulum icin opsiyonel `INSTALL_KEY` env kontrolu (varsa zorunlu)
6. Smoke test guncelle:
   - Kurulum oncesi `installed=false`
   - Install sonrasi `installed=true`
   - Ikinci install denemesi `409`
7. `docs/API.md` guncelle

## Frontend Tasks

1. Vue Router kurulumu:
   - `/install`
   - `/login`
   - `/dashboard` (placeholder)
2. App baslangicinda `GET /setup/status` cagri mekanizmasi
3. Route guard:
   - `installed=false` ise tum rotalar -> `/install`
   - `installed=true` ise `/install` -> `/login`
4. Install ekrani:
   - Firma/tenant bilgileri
   - Park/branch profile bilgileri
   - Super admin kullanici bilgileri
5. Install basariliysa:
   - Basari mesaji
   - Otomatik `/login` yonlendirmesi
6. Login ekraninda default acilis davranisi:
   - Kurulu sistemde root -> `/login`
7. `docs/sprints/Sprint-4-Frontend-Notes.md` notu olustur/guncelle

## Team Lead Tasks

1. API kontratini dondur:
   - `GET /setup/status`
   - `POST /install`
2. Backend ve frontend route/contract uyumunu review et
3. PR reviewde asagidaki kritikleri kontrol et:
   - Kurulum tamamlandiysa `/install` kapali mi?
   - Kurulum tamamlanmadan `/login` acilmiyor mu?
4. Sprint sonunda demo:
   - Empty state -> `/install`
   - Install -> `/login`
   - Re-open `/install` -> redirect `/login`

## Exit Criteria

1. Bos sistemde acilis rota `/install`.
2. Install sonrasi sistem `installed=true` donuyor.
3. Install sonrasi `/install` route devre disi.
4. Root acilis kurulumdan sonra `/login`.
5. Ikinci install denemesi backend tarafinda `409`.

## Related Docs

1. `docs/sprints/Sprint-4-Tracker.md`
2. `docs/sprints/Sprint-4-Kickoff-Messages.md`
