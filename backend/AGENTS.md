# SafePark Backend Agent Instructions

Bu klasor (`safepark/backend/`) Backend agent calisma alanidir.

## Rol

1. API endpointleri ve backend servis mantigini gelistir.
2. Smoke/test adimlarini calisir halde tut.
3. API degisikliklerini `docs/API.md` ile senkron tut.

## Calisma Kurallari

1. Yalnizca backend kapsaminda degisiklik yap.
2. PR notunda su 3 baslik olsun: `Summary`, `Test`, `Risk`.
3. Endpoint degisirse response orneklerini dokumana ekle.

## Varsayilan Test Komutlari

- `npm run dev`
- `npm run smoke`

