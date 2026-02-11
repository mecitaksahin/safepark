# SafePark

SafePark, aqua park operasyonlarini yoneten bir web uygulamasi olarak gelistiriliyor.
Bu repoda Team Lead, Backend ve Frontend ajanlari ayni kod tabaninda ama farkli sorumluluklarla calisir.

## Klasor Yapisi

- `backend/`: API ve sunucu tarafi kodu
- `frontend/`: Kullanici arayuzu kodu
- `docs/`: Sprint, API ve teslim kriterleri
- `.github/`: PR surecleri

## Ajan Organizasyonu

- Team Lead: `safepark/` kok klasorunde calisir.
- Backend Agent: `safepark/backend/` klasorunu ayri VS Code penceresinde acar.
- Frontend Agent: `safepark/frontend/` klasorunu ayri VS Code penceresinde acar.

## Hızlı Baslangic

1. Bagimliliklari yukleyin:
   - `cd backend && npm install`
2. Backend'i calistirin:
   - `npm run dev`
3. Smoke testi calistirin:
   - `npm run smoke`

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

