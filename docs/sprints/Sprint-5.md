# Sprint-5 Plani (Persistent Backend + Product Install UX)

## Kickoff

- Kickoff Date: 2026-02-11
- Sprint Owner: Team Lead
- Sprint Branches:
  - `feat/backend-sprint-5-pg-persistence`
  - `feat/frontend-sprint-5-product-install-ux`

## Sprint Goal

Sprint-4 prototip davranisini gercek urun davranisina tasimak:

1. Backend in-memory state yerine PostgreSQL (`safepark_ops`) kullanacak.
2. Install/Login yonlendirme urun akisi netlestirilecek.
3. Install ekrani sadece ilk kurulum icin kullanilacak; kurulumdan sonra erisilemeyecek.

## Kurallar

1. Kendi scope disina cikmayin.
2. PR template zorunlu.
3. API ve docs guncellemeleri zorunlu.
4. DB migration ve rollback etkileri PR notunda aciklanacak.
5. Bitince asagidaki formatta teslim edin:
   - Summary
   - Test/Validation
   - PR linki

## Backend Tasks

1. `pg` tabanli persistence katmani ekle:
   - `DB1_URL` kullanarak PostgreSQL baglantisi
   - Merkezi query helper / repository yapisi
2. Uygulama acilisinda migrationlari otomatik calistir:
   - `0001_tenant_foundation.sql`
   - `0002_platform_state.sql`
3. Asagidaki endpointleri DB tabanli hale getir:
   - `GET /setup/status`
   - `POST /install`
   - `POST /auth/login`
   - `GET /auth/me`
   - `GET/PUT /parks/:branchId/profile`
   - `POST /tenants`
4. Kurulum kilidi:
   - `platform_state.is_installed=true` oldugunda install tekrar acilamaz (`409 already_installed`)
5. `INSTALL_KEY` davranisini koru:
   - Env set ise `x-install-key` zorunlu
6. Session/token davranisini netlestir:
   - En azindan mevcut token mekanizmasi korunur
   - Restart sonrasi auth davranisi PR risklerinde belirtilir
7. Smoke testi DB'li akisa gore guncelle:
   - Test oncesi ilgili tablolari temizleme veya izole test verisi
   - Install once false, sonra true
   - Ikinci install 409
   - Login + profile okuma/guncelleme temel senaryo
8. `docs/API.md` guncelle

## Frontend Tasks

1. `App.vue` urun layoutuna gecsin:
   - Sol route menusu kaldirilacak
   - Install/Login sayfalarinda sade ekran
2. Router guard urun kurali:
   - `installed=false` iken sadece `/install`
   - `installed=true` iken `/install` her durumda `/login`e yonlensin
3. Root davranisi:
   - `installed=false` -> `/install`
   - `installed=true` -> `/login`
4. Install akisi:
   - Basarili kurulumdan sonra otomatik `/login`
   - Kurulu sistemde install formu gosterilmez
5. Login ekrani sade urun girisi olarak kalsin
6. `docs/sprints/Sprint-5-Frontend-Notes.md` notu olustur/guncelle

## Team Lead Tasks

1. Contract freeze:
   - `GET /setup/status`
   - `POST /install`
2. DB persistence PR review:
   - Gercekten DB'ye yaziyor mu
   - Server restart sonrasi install durumu korunuyor mu
3. Frontend PR review:
   - Sol route menusu kalkmis mi
   - Install erisimi kurulum sonrasi kapanmis mi
4. Sprint sonunda demo:
   - Bos DB -> `/install`
   - Install tamamla -> `/login`
   - `/install`e manuel git -> `/login`
   - DBeaver'da tenant/branch/user/platform_state kayitlarini goster

## Exit Criteria

1. DBeaver'da tablolar ve veriler gorunur.
2. Install bilgisi restart sonrasi korunur.
3. Kurulu sistemde `/install` erisimi kapali.
4. Frontend install/login deneyimi urun formatinda sade.
5. Backend smoke ve frontend build basarili.

## Related Docs

1. `docs/sprints/Sprint-5-Tracker.md`
2. `docs/sprints/Sprint-5-Kickoff-Messages.md`
