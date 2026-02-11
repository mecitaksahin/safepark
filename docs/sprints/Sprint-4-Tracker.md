# Sprint-4 Tracker

- Sprint: Sprint-4 Install Flow ve First-Run Guard
- Start Date: 2026-02-11
- Team Lead: active

## Assignment

1. Backend Agent
   - Branch: `feat/backend-sprint-4-install-flow`
   - Scope: `platform_state` migration + `GET /setup/status` + `POST /install` + setup deprecate + smoke + API docs
2. Frontend Agent
   - Branch: `feat/frontend-sprint-4-install-routing`
   - Scope: router + install/login guards + install form + login redirect + sprint frontend notes

## PR Checklist

1. PR template dolduruldu
2. Scope disi dosya yok
3. `docs/API.md` guncel (backend degisikliklerinde)
4. `docs/sprints/Sprint-4-Frontend-Notes.md` guncel (frontend degisikliklerinde)
5. Test/validation notu eklendi
6. Team Lead review tamamlandi

## Acceptance Focus

1. Bos sistemde root acilisi `/install`e gidiyor
2. `GET /setup/status` install oncesi `installed=false`
3. Install sonrasi root acilisi `/login`e gidiyor
4. Install sonrasi `/install` route kilitli
5. Ikinci install denemesi backend tarafinda `409`

## PR Links

1. Backend PR: https://github.com/mecitaksahin/safepark/pull/3 (merged)
2. Frontend PR: https://github.com/mecitaksahin/safepark/pull/4 (merged)

## Status

1. Backend: merged
2. Frontend: merged
3. Team Lead Review: completed
