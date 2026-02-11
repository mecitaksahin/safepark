# SafePark Software Requirements v1

## 1. Amac

SafePark, aqua park operasyonlarini tek platformda yonetecek:
- backoffice
- biletleme ve turnike gecisleri
- cashless harcama
- acente ve OTA entegrasyonlari
- yuksek hacimli raporlama

Sistem hem cloud hem on-prem (park icindeki sunucular) calisabilmelidir.

## 2. Kapsam

### 2.1 In Scope

1. Rezervasyon ve bilet yasam dongusu
2. Bileklik (RFID/QR) aktivasyon ve gecis kontrolu
3. Walk-in ve acente kanal ayrimi
4. Komisyon ve mutabakat
5. Park ici harcama (F&B, retail vb.)
6. Kampanya/paket (bilet + yiyecek)
7. OTA entegrasyonlari
8. Raporlama ve dashboard
9. Tenant/firma, sube, kullanici ve rol yonetimi
10. Aqua park profil bilgileri (adres, harita, telefon, web sitesi)

### 2.2 Out of Scope (MVP disi)

1. Loyalty puan sistemi (faz-2)
2. Gelismis CRM marketing automation (faz-2)
3. Dynamic pricing AI motoru (faz-3)

## 3. Roller

1. Super Admin
2. Backoffice Operator
3. Gise/POS Kullanici
4. Finance
5. Operations Manager
6. Acente Kullanici (B2B portal opsiyonel)
7. Tenant Admin

## 4. Fonksiyonel Gereksinimler

### FR-00 Tenant ve Erisim Temeli

1. Sistem tenant/firma bazli calismalidir.
2. Her tenant altinda bir veya daha fazla sube/park tanimi olmali.
3. Kullanici hesaplari bir tenant ve role bagli olmali.
4. Varsayilan bootstrap super admin kullanicisi ile ilk kurulum yapilabilmeli.
5. Tenant/park profil bilgileri tutulmali:
   - firma adi
   - aqua park adi
   - adres
   - harita koordinatlari veya map linki
   - telefon
   - web sitesi
6. Kullanici girisinde hangi firma ve hangi subede oldugu net olarak izlenebilmeli.
7. Kritik degisiklikler audit log ile takip edilmelidir.

### FR-01 Rezervasyon ve Biletleme

1. Rezervasyon olusturma, degistirme, iptal
2. Voucher/QR/barcode uretimi
3. Kanal bazli fiyat ve kontenjan

### FR-02 Turnike ve Giris Kontrol

1. Turnike validasyon API
2. Coklu giris/yeniden giris kurallari
3. Offline toleransli kontrol (kisa sureli baglanti kesintisinde)

### FR-03 Bileklik ve Cashless

1. Bileklik basim/aktive/deaktive
2. Bakiye yukleme/kullanim/iade
3. Harcama hareketlerinin misafirle iliskilendirilmesi

### FR-04 Acente ve Komisyon

1. Acente tanimi, kontrat, oran setleri
2. Pax bazli komisyon hesaplama
3. Mutabakat raporu (donemsel)

### FR-05 OTA Entegrasyon

1. OTA rezervasyon import/sync
2. Fiyat/kontenjan aktarimi (uygun kanallarda)
3. Hata takip ve tekrar deneme (retry) mekanizmasi

### FR-06 Kampanya Motoru

1. Paket urunler (bilet + yiyecek vb.)
2. Tarih/saat/kanal bazli kural
3. Kural celismelerinde oncelik yonetimi

### FR-07 Raporlama

1. Walk-in vs acente vs OTA ayrimi
2. Uyruk bazli ziyaret raporu
3. Turnike gecis ve saatlik yogunluk
4. Harcama detay/master raporlari
5. Komisyon raporlari

## 5. Veri Mimarisi (2 DB zorunlu)

### DB-1 Operasyonel OLTP

Kullanim:
1. Rezervasyon
2. Turnike validasyonlari
3. POS/cashless hareketleri
4. Canli operasyon ekranlari

Ozellik:
1. Dusuk gecikme
2. Yuksek yazma performansi

### DB-2 Raporlama/Analitik

Kullanim:
1. Agir raporlar
2. Dashboard sorgulari
3. Donemsel finansal/operasyonel analiz

Ozellik:
1. DB-1'den ayrik
2. ETL/CDC ile beslenir
3. Agir sorgular DB-1'i etkilemez

## 6. Non-Functional Gereksinimler

### NFR-01 Performans

1. Turnike validasyonu p95 < 200 ms
2. Kritik API'lerde p95 < 400 ms
3. Toplu raporlar async calismali

### NFR-02 Olcekleme

1. Gunluk 15.000+ giris
2. Milyonlarca harcama satiri ile raporlama
3. Servisler yatay olceklenebilir olmali

### NFR-03 Guvenlik ve Uyumluluk

1. RBAC ve audit log
2. Hassas veri sifreleme
3. Odeme tarafinda PCI DSS uyum hedefi

### NFR-04 Dayaniklilik

1. Retry/idempotency
2. Queue tabanli async isleme
3. Backup/restore proseduru

### NFR-05 Dagitim Esnekligi

1. Cloud ve on-prem ayni container imajlari ile calismali
2. Ortam farklari sadece konfigurasyon seviyesinde olmali

## 7. MVP Oncelikleri

### P0 (Ilk canliya cikis)

1. Tenant/firma + sube + kullanici/rol temeli
2. Rezervasyon + bilet + turnike
3. Walk-in/acente kanal ayrimi
4. Temel cashless harcama
5. Temel komisyon raporu
6. DB-1/DB-2 ayrimi ve async raporlama

### P1

1. OTA entegrasyonu (ilk 1-2 kanal)
2. Gelismis kampanya kurallari
3. Finans mutabakat ekranlari

### P2

1. Gelismis BI
2. Forecasting/AI
3. Loyalty/CRM derinlestirme

## 8. Basari Kriterleri

1. Giris operasyonu pik saatte sorunsuz calisiyor
2. Agir raporlar operasyonel performansi dusurmuyor
3. Walk-in/acente/OTA gelir ayrimi dogru uretiliyor
4. Cloud ve on-prem kurulumlari ayni kod tabanindan yapiliyor
