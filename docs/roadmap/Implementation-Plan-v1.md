# SafePark Implementation Plan v1

## Nereden Baslayalim?

## Faz-0 (1 hafta) - Scope ve Teknik Kararlar

1. Gereksinimlerin dondurulmasi (P0/P1/P2)
2. Domain model taslagi (rezervasyon, bilet, turnike, harcama, komisyon)
3. Deployment strategy onayi (Compose now, Kubernetes-ready)

## Faz-1 (1-2 hafta) - Platform Foundation

1. Monorepo servis iskeleti
2. Dockerfile + docker-compose local stack
3. Konfigurasyon/secrets standardi
4. CI pipeline (lint, test, image build)

## Faz-2 (2-3 hafta) - Core Operations MVP

1. Rezervasyon + biletleme API
2. Turnike validasyon API
3. Walk-in / acente kanal ayrimi
4. Backoffice temel ekranlari

## Faz-3 (2-3 hafta) - Cashless ve POS

1. Bileklik aktivasyon ve bakiye
2. Harcama hareketleri
3. Temel finans uzlastirma ciktilari

## Faz-4 (2 hafta) - Reporting Backbone (2 DB)

1. DB-1 -> DB-2 veri aktarimi (CDC/ETL)
2. Async rapor joblari
3. Ilk KPI dashboardlari

## Faz-5 (2 hafta) - Entegrasyon ve Hardening

1. Ilk OTA/acente entegrasyonu
2. Guvenlik, audit, role policy
3. Performans testleri ve tuning

## Nereye Devam Edelim?

## Faz-6 (Surekli)

1. Gelismis kampanya motoru
2. Gelismis finans/komisyon otomasyonu
3. Multi-park operasyon ve merkezi raporlama
4. Kubernetes production rollout (gereklilik kosullari olusunca)

## Simdi Yapilacak Somut Ilk Isler

1. `docker-compose.yml` ile backend + frontend + postgres(2) + redis local stack
2. DB-1 ve DB-2 schema ayrimi
3. Queue tabanli rapor altyapisi (job table veya redis queue)
4. API contract ve event naming standardi

