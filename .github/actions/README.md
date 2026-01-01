# GitHub Actions - Modüler Deployment Yapısı

Bu dizin, deployment süreçlerini modüler ve yeniden kullanılabilir hale getiren GitHub Actions içerir.

## 📁 Yapı

### Ana Action: `execute-remote-stage/`
**Kullanımda olan** ana deployment action'ı. Tüm deployment aşamalarını (stage) uzak sunucuda SSH üzerinden çalıştırır.

#### Kullanım

```yaml
- name: Run migrations
  uses: ./.github/actions/execute-remote-stage
  with:
    ssh_host: hetzner-deploy
    stage: migrate
    project_dir: /opt/tipbox-backend
    compose_file: docker-compose.test.yml
```

#### Desteklenen Stage'ler

| Stage | Açıklama | Gerekli Parametreler |
|-------|----------|---------------------|
| `prepare` | Proje dizinine git, kodu pull et, env dosyasını kontrol et | `deploy_branch`, `env_file` |
| `backup` | Veritabanı backup'ı oluştur | `db_user`, `db_name` |
| `stop` | Tüm servisleri durdur | - |
| `build` | Docker image'larını build et | - |
| `prisma` | Prisma Client'ı generate et | - |
| `infrastructure` | Infrastructure servislerini başlat (postgres, redis, minio) | - |
| `wait-db` | Veritabanının hazır olmasını bekle | `db_user` |
| `migrate` | Prisma migration'ları çalıştır | - |
| `seed` | Seed data'ları ekle (akıllı kontrol ile) | `db_user`, `db_name` |
| `start` | Tüm servisleri başlat | - |
| `health` | Backend health check yap | - |
| `cleanup` | Eski Docker image'larını temizle | - |

#### Parametreler

| Parametre | Zorunlu | Açıklama |
|-----------|---------|----------|
| `ssh_host` | ✅ | SSH host alias |
| `stage` | ✅ | Çalıştırılacak stage adı |
| `project_dir` | ✅ | Proje dizini yolu |
| `compose_file` | ✅ | Docker compose dosya adı |
| `deploy_branch` | ❌ | Deploy edilecek branch |
| `env_file` | ❌ | Environment dosya adı |
| `db_user` | ❌ | Veritabanı kullanıcısı |
| `db_name` | ❌ | Veritabanı adı |

### Diğer Action'lar (Referans)

Aşağıdaki action'lar modüler yapı için oluşturulmuş referans implementasyonlardır. Şu anda `execute-remote-stage` action'ı tüm işlemleri yönettiği için **aktif olarak kullanılmamaktadırlar**. İleride ihtiyaç halinde kullanılabilirler.

- `backup-database/` - Database backup işlemi
- `build-images/` - Docker image build işlemi
- `cleanup-deployment/` - Deployment cleanup işlemi
- `generate-prisma/` - Prisma Client generation
- `health-check/` - Backend health check
- `prepare-deployment/` - Deployment preparation
- `run-migrations/` - Database migrations
- `run-seeds/` - Database seeding
- `start-infrastructure/` - Infrastructure services
- `start-services/` - All services start
- `stop-services/` - Services stop
- `wait-database/` - Database ready wait

## 🎯 Avantajlar

1. **Modüler Yapı**: Her deployment aşaması ayrı bir stage olarak tanımlanmış
2. **Yeniden Kullanılabilir**: Tek action ile tüm stage'ler yönetiliyor
3. **Hızlı**: Her stage için sadece bir SSH bağlantısı açılıyor
4. **Okunabilir**: Workflow dosyası daha temiz ve anlaşılır
5. **Akıllı Seed**: Database'de veri varsa seed'leri atlıyor
6. **Güvenli**: Her stage'de hata kontrolü ve directory validation var

## 🔄 Workflow Örneği

```yaml
name: Deploy to Test Server

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Prepare deployment
        uses: ./.github/actions/execute-remote-stage
        with:
          ssh_host: hetzner-deploy
          stage: prepare
          project_dir: /opt/tipbox-backend
          compose_file: docker-compose.test.yml
          deploy_branch: test
          env_file: .env.test

      - name: Backup database
        uses: ./.github/actions/execute-remote-stage
        with:
          ssh_host: hetzner-deploy
          stage: backup
          project_dir: /opt/tipbox-backend
          compose_file: docker-compose.test.yml
          db_user: tipbox_user
          db_name: tipbox_dev

      - name: Run migrations
        uses: ./.github/actions/execute-remote-stage
        with:
          ssh_host: hetzner-deploy
          stage: migrate
          project_dir: /opt/tipbox-backend
          compose_file: docker-compose.test.yml

      - name: Run seeds
        uses: ./.github/actions/execute-remote-stage
        with:
          ssh_host: hetzner-deploy
          stage: seed
          project_dir: /opt/tipbox-backend
          compose_file: docker-compose.test.yml
          db_user: tipbox_user
          db_name: tipbox_dev
```

## 🔧 Özelleştirme

Yeni bir deployment stage'i eklemek için `execute-remote-stage/action.yml` dosyasındaki `case` statement'ına yeni bir durum ekleyin:

```bash
mynewstage)
  echo "🎨 Running my new stage..."
  cd "$PROJECT_DIR" || exit 1
  # Stage komutları buraya
  echo "✅ My new stage completed"
  ;;
```

## 📝 Önemli Notlar

### Akıllı Seed Kontrolü
`seed` stage'i, database'de veri olup olmadığını kontrol eder:
```sql
SELECT COUNT(*) FROM users WHERE email LIKE '%@tipbox.%' LIMIT 1;
```
Eğer kayıt varsa seed'leri atlar, yoksa çalıştırır. Bu sayede:
- Her deployment'ta gereksiz seed hataları olmaz
- Mevcut veriler korunur
- Log'lar daha temiz ve okunabilir olur

### Database Adı
Test ortamı için **`tipbox_dev`** kullanılır (tipbox_test değil).

### Güvenlik Kontrolleri
Her stage'de `cd "$PROJECT_DIR" || exit 1` kontrolü yapılır. Bu:
- Yanlış dizinde komut çalıştırılmasını önler
- Script'in güvenli bir şekilde fail olmasını sağlar
- Beklenmedik yan etkileri engeller

### Backup
Her deployment öncesi otomatik backup alınır ve `backups/` dizinine timestamp ile kaydedilir.

### Health Check
- 30 deneme
- 2 saniye aralıklarla
- Toplam 1 dakika timeout
- Backend `/health` endpoint'ini kontrol eder

## 🚀 Deployment Akışı

1. **Prepare** → Kodu pull et, env dosyasını kontrol et
2. **Backup** → Database backup al
3. **Stop** → Mevcut servisleri durdur
4. **Build** → Yeni image'ları build et
5. **Prisma** → Prisma Client generate et
6. **Infrastructure** → DB, Redis, MinIO başlat
7. **Wait-DB** → Database'in hazır olmasını bekle
8. **Migrate** → Migration'ları çalıştır
9. **Seed** → Gerekirse seed data ekle
10. **Start** → Tüm servisleri başlat
11. **Health** → Backend health check
12. **Cleanup** → Eski image'ları temizle
