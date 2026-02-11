# Sprint-5 Kickoff Mesajlari

## Team Lead Broadcast

Sprint-5 basliyor.
Backend: PostgreSQL persistence + startup migration + install/auth/parks/tenants endpointlerini DB tabanli hale getirme + smoke + `docs/API.md`.
Frontend: urun layout sadeleme (sol route menusu kaldirilacak) + install/login guard netlestirme + install kapanisi + `docs/sprints/Sprint-5-Frontend-Notes.md`.
Tamamlaninca PR acip test notu ekleyin.

Kurallar:
1. Kendi scope disina cikmayin.
2. PR template zorunlu.
3. API ve docs guncellemeleri zorunlu.
4. Bitince Summary + Test/Validation + PR linki paylasin.

## Backend Agent Mesaji

Branch: `feat/backend-sprint-5-pg-persistence`

Sprint-5 backend gorevlerin:
1. `DB1_URL` ile PostgreSQL baglantisi kur ve query/repository katmani ekle.
2. App startup'ta migrationlari otomatik calistir (`0001`, `0002`).
3. Endpointleri DB tabanli hale getir:
   - `GET /setup/status`
   - `POST /install`
   - `POST /auth/login`
   - `GET /auth/me`
   - `GET/PUT /parks/:branchId/profile`
   - `POST /tenants`
4. `INSTALL_KEY` zorunlulugunu koru (env varsa `x-install-key` gereksinimi).
5. Smoke testi DB persistence dogrulayan senaryolarla guncelle.
6. `docs/API.md` guncelle.

Teslim:
- Summary
- Test/Validation (`npm run smoke` + kritik manuel notlar)
- PR linki

## Frontend Agent Mesaji

Branch: `feat/frontend-sprint-5-product-install-ux`

Sprint-5 frontend gorevlerin:
1. `App.vue` layoutunu urun formatina cevir:
   - Sol route menusu ve debug benzeri alanlari kaldir.
2. Router guard urun kurali:
   - `installed=false`: sadece `/install`
   - `installed=true`: `/install` -> `/login`
3. Root acilis:
   - `installed=false` -> `/install`
   - `installed=true` -> `/login`
4. Install basarili oldugunda otomatik `/login` yonlendir.
5. Kurulu sistemde install formunun gosterilmedigini garanti et.
6. `docs/sprints/Sprint-5-Frontend-Notes.md` guncelle.

Teslim:
- Summary
- Validation (`npm run build` + manuel akis)
- PR linki
