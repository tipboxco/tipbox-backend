# Monitoring Setup Guide

Bu dokümantasyon, Tipbox Backend için Prometheus ve Grafana monitoring entegrasyonunu açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Kurulum](#kurulum)
3. [Metrikler](#metrikler)
4. [Grafana Dashboard](#grafana-dashboard)
5. [Kullanım](#kullanım)

## 🎯 Genel Bakış

Monitoring stack'i şu bileşenlerden oluşur:

- **Prometheus**: Metrik toplama ve saklama
- **Grafana**: Metrik görselleştirme ve dashboard'lar
- **PostgreSQL Exporter**: PostgreSQL metrikleri
- **Redis Exporter**: Redis metrikleri
- **Node Exporter**: Sistem metrikleri (CPU, Memory, Disk, vb.)
- **Backend Metrics**: Uygulama metrikleri (prom-client ile)

## 🚀 Kurulum

### 1. Docker Compose ile Başlatma

```bash
docker-compose up -d
```

Bu komut şu servisleri başlatır:
- `prometheus` (port 9090)
- `grafana` (port 3001)
- `postgres-exporter` (port 9187)
- `redis-exporter` (port 9121)
- `node-exporter` (port 9100)

### 2. Servisleri Kontrol Etme

```bash
# Tüm servislerin durumunu kontrol et
docker-compose ps

# Prometheus loglarını görüntüle
docker-compose logs prometheus

# Grafana loglarını görüntüle
docker-compose logs grafana
```

### 3. Grafana'ya Giriş

1. Tarayıcıda http://localhost:3001 adresine gidin
2. Kullanıcı adı: `admin`
3. Şifre: `admin`
4. İlk girişte şifre değiştirme istenebilir

## 📊 Metrikler

### Backend Uygulama Metrikleri

Backend uygulaması şu metrikleri toplar:

#### HTTP Metrikleri

- `http_requests_total`: Toplam HTTP istek sayısı
  - Labels: `method`, `route`, `status_code`
  
- `http_request_duration_seconds`: HTTP istek süresi (histogram)
  - Labels: `method`, `route`, `status_code`
  - Buckets: 0.1s, 0.3s, 0.5s, 0.7s, 1s, 3s, 5s, 7s, 10s

- `http_request_size_bytes`: HTTP istek boyutu (histogram)
  - Labels: `method`, `route`

- `http_active_connections`: Aktif HTTP bağlantı sayısı (gauge)

#### Hata Metrikleri

- `errors_total`: Toplam hata sayısı
  - Labels: `type`, `route`, `status_code`

#### Veritabanı Metrikleri

- `database_query_duration_seconds`: Veritabanı sorgu süresi (histogram)
  - Labels: `operation`, `table`

#### Redis Metrikleri

- `redis_operation_duration_seconds`: Redis işlem süresi (histogram)
  - Labels: `operation`, `status`

#### Kullanıcı Metrikleri

- `active_users_total`: Aktif kullanıcı sayısı (gauge)

#### Node.js Metrikleri (Default)

Prometheus client otomatik olarak şu metrikleri toplar:

- `process_cpu_user_seconds_total`: CPU kullanımı
- `process_cpu_system_seconds_total`: Sistem CPU kullanımı
- `process_resident_memory_bytes`: Bellek kullanımı
- `nodejs_eventloop_lag_seconds`: Event loop lag
- `nodejs_heap_size_total_bytes`: Heap boyutu
- `nodejs_heap_size_used_bytes`: Kullanılan heap boyutu
- Ve daha fazlası...

### PostgreSQL Metrikleri

PostgreSQL Exporter şu metrikleri sağlar:

- `pg_stat_database_*`: Veritabanı istatistikleri
- `pg_stat_user_tables_*`: Tablo istatistikleri
- `pg_stat_activity_*`: Aktif bağlantılar
- `pg_stat_replication_*`: Replikasyon istatistikleri

### Redis Metrikleri

Redis Exporter şu metrikleri sağlar:

- `redis_commands_processed_total`: İşlenen komut sayısı
- `redis_connected_clients`: Bağlı istemci sayısı
- `redis_memory_used_bytes`: Kullanılan bellek
- `redis_keyspace_keys`: Key sayısı
- Ve daha fazlası...

### Sistem Metrikleri (Node Exporter)

- `node_cpu_seconds_total`: CPU kullanımı
- `node_memory_MemTotal_bytes`: Toplam bellek
- `node_memory_MemAvailable_bytes`: Kullanılabilir bellek
- `node_disk_io_time_seconds_total`: Disk I/O
- `node_network_receive_bytes_total`: Ağ trafiği
- Ve daha fazlası...

## 📈 Grafana Dashboard

### 1. Prometheus'u Data Source Olarak Ekleme

1. Grafana'da **Configuration** → **Data Sources** → **Add data source**
2. **Prometheus**'u seçin
3. **URL**: `http://prometheus:9090` (Docker network içinden)
4. **Access**: `Server (default)`
5. **Save & Test** butonuna tıklayın

### 2. Örnek Dashboard Sorguları

#### HTTP Request Rate (İstek/saniye)

```promql
rate(http_requests_total[5m])
```

#### HTTP Request Duration (P95)

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

#### Error Rate (Hata/saniye)

```promql
rate(errors_total[5m])
```

#### Active Connections

```promql
http_active_connections
```

#### Database Query Duration (P95)

```promql
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))
```

#### Redis Memory Usage

```promql
redis_memory_used_bytes
```

#### CPU Usage

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

#### Memory Usage

```promql
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100
```

### 3. Hazır Dashboard'lar

Grafana'da hazır dashboard'ları import edebilirsiniz:

1. **Dashboard** → **Import**
2. Aşağıdaki ID'leri kullanabilirsiniz:
   - **Node Exporter Full**: `1860`
   - **PostgreSQL Database**: `9628`
   - **Redis Dashboard**: `11835`
   - **Node.js Application Dashboard**: `11159`

## 🔧 Kullanım

### Metrics Endpoint'ine Erişim

Backend uygulaması `/metrics` endpoint'i üzerinden metrikleri sunar:

```bash
curl http://localhost:3000/metrics
```

### Prometheus UI'da Metrikleri Görüntüleme

1. Tarayıcıda http://localhost:9090 adresine gidin
2. **Graph** sekmesine gidin
3. Metrik adını yazın (örn: `http_requests_total`)
4. **Execute** butonuna tıklayın

### Metrikleri Kod İçinde Kullanma

```typescript
import { getMetricsService } from './infrastructure/metrics/metrics.service';

const metricsService = getMetricsService();

// Veritabanı sorgu süresini kaydet
const startTime = Date.now();
const result = await prisma.user.findMany();
const duration = (Date.now() - startTime) / 1000;
metricsService.recordDatabaseQuery('findMany', 'User', duration);

// Redis işlem süresini kaydet
const redisStart = Date.now();
await redis.get('key');
const redisDuration = (Date.now() - redisStart) / 1000;
metricsService.recordRedisOperation('get', 'success', redisDuration);

// Aktif kullanıcı sayısını güncelle
metricsService.setActiveUsers(activeUserCount);
```

## 🐛 Sorun Giderme

### Prometheus Metrikleri Toplamıyor

1. Backend'in çalıştığından emin olun:
   ```bash
   curl http://localhost:3000/metrics
   ```

2. Prometheus'un backend'e erişebildiğinden emin olun:
   - Prometheus UI'da **Status** → **Targets** bölümüne gidin
   - `backend` target'ının `UP` durumunda olduğunu kontrol edin

3. Docker network'ün doğru yapılandırıldığından emin olun:
   ```bash
   docker network inspect tipbox-backend_monitoring
   ```

### Grafana Metrikleri Görmüyor

1. Prometheus data source'unun doğru yapılandırıldığından emin olun
2. Prometheus'un metrikleri topladığını kontrol edin (Prometheus UI)
3. Grafana'da query'leri test edin

### Exporter'lar Çalışmıyor

1. Exporter container'larının çalıştığını kontrol edin:
   ```bash
   docker-compose ps
   ```

2. Exporter loglarını kontrol edin:
   ```bash
   docker-compose logs postgres-exporter
   docker-compose logs redis-exporter
   ```

## 📚 Kaynaklar

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [prom-client Documentation](https://github.com/siimon/prom-client)
- [PostgreSQL Exporter](https://github.com/prometheus-community/postgres_exporter)
- [Redis Exporter](https://github.com/oliver006/redis_exporter)

