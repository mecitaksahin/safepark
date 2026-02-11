# SafePark Deployment Strategy v1

## 1. Hedef

Tek kod tabani ile iki modelin desteklenmesi:
1. Cloud deployment
2. On-prem deployment (aqua park icindeki sunucular)

## 2. Temel Prensipler

1. Tum servisler containerized olacak.
2. Ortam bagimli farklar image degil, config ile yonetilecek.
3. Uygulama servisleri stateless; state DB/queue/object storage katmaninda tutulacak.
4. Gozlemlenebilirlik (logs, metrics, traces) zorunlu olacak.

## 3. Docker ve Kubernetes Karari

### Karar

1. Gelistirme ve ilk entegrasyon asamasi: Docker Compose zorunlu.
2. Uretim hedefi: Kubernetes-ready mimari.
3. Ilk canli (tek park, tek node) gerekiyorsa Compose ile baslanabilir; ama buyume ve HA ihtiyacinda Kubernetes'e gecis planli olmalidir.

## 4. Ne Zaman Kubernetes Gerekli?

Asagidaki durumlardan 2+ tanesi varsa Kubernetes'e gecis zorunlu kabul edilir:

1. 3+ uygulama node'u
2. 99.9+ uptime ve zero-downtime deploy beklentisi
3. Birden fazla park/tenant
4. Peak saatlerde manuel olcekleme yetersizligi
5. Operasyonel standardizasyon ihtiyaci (auto-heal, rolling update, HPA)

## 5. Cloud ve On-Prem Dagitim Modeli

### 5.1 Cloud

1. Kubernetes managed servis (EKS/AKS/GKE) veya erken fazda VM + Compose
2. Managed PostgreSQL (DB-1 ve DB-2), Redis, object storage
3. CI/CD ile image build + deploy

### 5.2 On-Prem

1. Baslangic: Docker Engine + Compose (pilot)
2. Olcek/HA: K3s veya upstream Kubernetes
3. Lokal backup, monitor ve update prosedurleri

## 6. Veri ve Isleme Katmani

1. DB-1 (OLTP): operasyonel yazma/okuma
2. DB-2 (Reporting): agir sorgu ve dashboard
3. CDC/ETL ile DB-1 -> DB-2 veri akisi
4. Agir raporlar queue + worker ile async calisir

## 7. Operasyonel Standartlar

1. Healthcheck/readiness endpointleri
2. Centralized logging
3. Metrics (request latency, queue lag, DB load)
4. Alerting (turnike API hata orani, DB replication lag, queue backlog)

## 8. Uretime Gecis Oncesi Checklist

1. Compose stack ile local E2E dogrulama
2. Load test (peak giris saat senaryolari)
3. Backup/restore tatbikati
4. Failover/incident runbook
5. Security hardening (secrets, TLS, RBAC)
