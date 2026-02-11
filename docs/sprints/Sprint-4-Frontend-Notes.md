# Sprint-4 Frontend Notes

## Scope

- Vue Router ile su rotalar tanimlandi:
  - `/install`
  - `/login`
  - `/dashboard`
- App startup asamasinda `GET /setup/status` cagrisi eklendi.
- Route guard kurallari uygulandi:
  - `installed=false` ise tum rotalar `/install`e yonlendirilir.
  - `installed=true` ise `/install` kapatilip `/login`e yonlendirilir.
- Install formu eklendi:
  - tenant bilgileri
  - park/branch profile bilgileri
  - super admin bilgileri
- Install basarili oldugunda otomatik `/login` yonlendirmesi eklendi.

## API Contract

- Setup status:
  - `GET /setup/status`
  - Beklenen response: `{ installed: true|false }`
- Install:
  - `POST /install`
  - Payload:
    - `{ tenant:{code,name}, branch:{code,name,profile}, adminUser:{fullName,email,password} }`
- Login:
  - `POST /auth/login`
  - Payload:
    - `{ tenantCode, email, password }`

## Validation Notes

- Build:
  - `npm run build`
- Manuel akista kontrol edilen noktalar:
  - `installed=false` iken `/login` ve `/dashboard` -> `/install`
  - Install basarisi sonrasi otomatik `/login`
  - `installed=true` iken `/install` -> `/login`
