# SafePark

SafePark, aqua park operasyonlarini yoneten bir web uygulamasi olarak gelistiriliyor.
Bu repoda Team Lead, Backend ve Frontend ajanlari ayni kod tabaninda ama farkli sorumluluklarla calisir.

## Klasor Yapisi

- `backend/`: API ve sunucu tarafi kodu
- `frontend/`: Kullanici arayuzu kodu
- `docs/`: Sprint, API, gereksinim ve mimari dokumanlari
- `.github/`: PR surecleri

## Ajan Organizasyonu

- Team Lead: `safepark/` kok klasorunde calisir.
- Backend Agent: `safepark-backend/backend/` klasorunu ayri VS Code penceresinde acar.
- Frontend Agent: `safepark-frontend/frontend/` klasorunu ayri VS Code penceresinde acar.

## Hizli Baslangic

1. Bagimliliklari yukleyin:
   - `cd backend && npm install`
2. Backend'i calistirin:
   - `npm run dev`
3. Smoke testi calistirin:
   - `npm run smoke`

## Docker ile Calistirma

Tum servislere (backend + frontend + db1 + db2 + redis) tek komutla kalkis:

1. `docker compose up --build -d`
2. Backend health: `http://localhost:3001/health`
3. Frontend UI: `http://localhost:8080`

Loglari izleme:

1. `docker compose logs -f`

Durdurma:

1. `docker compose down`
2. Veriyi de silmek istersen: `docker compose down -v`

## Sprint ve PR Akisi

1. Team Lead issue ve sprint plani olusturur.
2. Backend ve Frontend ajanlari kendi branch'lerinde gelistirme yapar.
3. Her ajan PR acar.
4. Team Lead review edip merge eder.

Detaylar icin:

- `docs/roles/team-lead.md`
- `docs/roles/backend-agent.md`
- `docs/roles/frontend-agent.md`
- `docs/DoD.md`
- `docs/requirements/Software-Requirements-v1.md`
- `docs/architecture/Deployment-Strategy-v1.md`
- `docs/architecture/Tech-Decision-v1.md`
- `docs/roadmap/Implementation-Plan-v1.md`
