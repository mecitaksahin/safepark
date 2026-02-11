# Sprint-2 Plani (Platform Foundation)

## Sprint Goal

Cloud/on-prem uyumlu container tabanli temel platformu kurmak.

## Backend Tasks

1. `backend/Dockerfile` olustur
2. Cevresel degisken (PORT, DB URL, REDIS URL) yapisini standardize et
3. Health endpointlerini container healthcheck icin uygun hale getir
4. DB-1 ve DB-2 baglanti ayri config taslagi ekle

## Frontend Tasks

1. `frontend/Dockerfile` olustur
2. API base URL'i env/config ile yonet
3. Backend baglanti hatalarini UI'da netlestir
4. Basic app shell ve navigation taslagi olustur

## Team Lead Tasks

1. `docker-compose.yml` kapsam ve servis isimlerini onayla
2. PR review checklist'e container maddeleri ekle
3. Sprint sonunda local stack demo kabulunu yap

## Exit Criteria

1. `docker compose up` ile tum servisler lokal calisiyor
2. Backend ve frontend container icinden erisilebilir
3. Cloud/on-prem deploy farklari dokumante edildi

