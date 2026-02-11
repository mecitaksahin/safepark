# Sprint-5 Frontend Notes

## Scope

- `App.vue` urun layoutuna sadeleştirildi:
  - Sol route menusu kaldirildi.
  - Debug/setup paneli kaldirildi.
  - Install/Login odakli tek kolon urun kabugu uygulandi.
- Router guard kurallari netlestirildi:
  - `installed=false` ise sadece `/install` erisilebilir.
  - `installed=true` ise `/install` her durumda `/login`e yonlendirilir.
- Root acilis davranisi netlestirildi:
  - `installed=false` -> `/install`
  - `installed=true` -> `/login`
- Install basarili oldugunda otomatik `/login` yonlendirmesi korundu.
- Kurulu sistemde install formu gosterilmeyecek sekilde `InstallPage` icinde ek koruma eklendi.

## API Touchpoints

- `GET /setup/status`
- `POST /install`
- `POST /auth/login`

## Validation Notes

- Build:
  - `npm run build`
- Manuel akis:
  - `installed=false` iken `/`, `/login`, `/dashboard` -> `/install`
  - Install basarili -> otomatik `/login`
  - `installed=true` iken `/` -> `/login`
  - `installed=true` iken `/install` -> `/login`
