# Sprint-4 Kickoff Mesajlari

## Team Lead Broadcast

Sprint-4 basliyor.
Backend: `platform_state` migration + `GET /setup/status` + `POST /install` + `/setup/bootstrap` deprecate + smoke + `docs/API.md`.
Frontend: Vue router install/login/dashboard + startup status check + route guard + install form + login redirect + `docs/sprints/Sprint-4-Frontend-Notes.md`.
Tamamlaninca PR acip test notu ekleyin.

Kurallar:
1. Kendi scope disina cikmayin.
2. PR template zorunlu.
3. API ve docs guncellemeleri zorunlu.
4. Bitince Summary + Test/Validation + PR linki paylasin.

## Backend Agent Mesaji

Sprint-4 backend gorevlerin:
1. `platform_state` migration ekle (`is_installed`, `installed_at`, `installed_tenant_id`, `installed_branch_id`, `installed_user_id`).
2. `GET /setup/status` endpointini ekle, response `{ installed: boolean }`.
3. `POST /install` endpointini ekle:
   - Sadece kurulu degilken tenant + branch(profile) + super admin olustur.
   - Basarida `platform_state.is_installed=true`.
   - Kuruluysa `409 already_installed`.
4. `POST /setup/bootstrap` endpointini deprecated yap (410 ya da install endpointine yonlendirme mesaji).
5. Smoke testleri guncelle:
   - Install oncesi status false
   - Install sonrasi status true
   - Ikinci install denemesi 409
6. `docs/API.md` guncelle.

Teslim:
- Summary
- Test/Validation (`npm run smoke` cikti ozeti)
- PR linki

## Frontend Agent Mesaji

Sprint-4 frontend gorevlerin:
1. Vue Router ile rotalari netlestir:
   - `/install`
   - `/login`
   - `/dashboard` (placeholder)
2. App startupta `GET /setup/status` cagir.
3. Guard kurallari:
   - `installed=false` ise tum rotalar `/install`e gitsin.
   - `installed=true` ise `/install` acilmasin, `/login`e yonlendirilsin.
4. Install formu ekle:
   - tenant/firma
   - branch/park profile
   - super admin
5. Install basariliysa kullaniciyi otomatik `/login`e yonlendir.
6. `docs/sprints/Sprint-4-Frontend-Notes.md` guncelle.

Teslim:
- Summary
- Validation (build + manuel akis)
- PR linki
