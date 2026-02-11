# SafePark Tech Decision v1

## 1. Karar Ozeti

1. Database: PostgreSQL (DB-1 + DB-2)
2. Backend: Node.js + TypeScript + NestJS (Fastify adapter)
3. Frontend: Vue 3 + TypeScript + Vite + Tailwind CSS
4. Queue/Cache: Redis
5. Deploy model: Docker-first, Kubernetes-ready

## 2. Neden PostgreSQL (MySQL yerine)?

1. Iki DB mimarisi icin guclu replication ve analitik uyumu
2. Materialized view, partitioning, JSONB gibi raporlama ve domain ihtiyaclarina uygun yetenekler
3. OLTP + reporting ayiriminda olgun bir ekosistem ve arac destegi

Not:
- MySQL ile de kurulabilir, ancak bu kapsamta raporlama/analitik tarafinda PostgreSQL daha avantajli.

## 3. Neden Node.js + NestJS (Fastify)?

1. Yuksek ekip verimi ve hizli delivery
2. Domain modullerini net ayirma (rezervasyon, turnike, cashless, komisyon)
3. TypeScript ile contract ve entegrasyon guvenligi
4. Fastify adapter ile performans avantaji

Alternatif:
- Daha hafif MVP istenirse plain Fastify + TypeScript da tercih edilebilir.

## 4. Neden Vue 3 Mantikli?

1. Backoffice UI gelistirmede hizli ve temiz component modeli
2. Ekip Vue deneyimine sahipse ogrenme maliyeti dusuk
3. Pinia + Vue Query ile state ve server-data yonetimi netlesir
4. Vite ile hizli build ve gelistirme dongusu

Sonuc:
- Evet, Vue 3 bu proje icin mantikli bir secimdir.

## 4.1 Neden Tailwind CSS?

1. Backoffice ekranlarinda hizli ve tutarli UI gelistirme
2. Tasarim tokenlarinin (renk, spacing, typography) merkezi yonetimi
3. Component kutuphanesi ile (ornegin headless/ui patternleri) iyi uyum
4. MVP hizini dusurmeyen, sonrasinda design system'e evrilebilen yapi

## 5. Mimari Yapi

Baslangic:
1. Modular monolith (tek backend repo/uygulama, net domain modulleri)
2. Iki DB ayri sorumluluk
3. Async jobs ile agir raporlar

Buyume:
1. Gerekirse domain bazli servis ayirma (mikroservis)
2. K8s uzerinde yatay olcekleme

## 6. Standartlar

1. API: REST + OpenAPI
2. DB migration: versioned migration zorunlu
3. Logging: JSON structured logs
4. Tracing/Metrics: OpenTelemetry uyumlu
