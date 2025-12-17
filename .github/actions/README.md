# GitHub Actions - Modüler Deployment Yapısı

Bu dizin, deployment süreçlerini modüler ve yeniden kullanılabilir hale getiren GitHub Actions içerir.

## 📁 Yapı

### `execute-remote-stage/`
Ana deployment action'ı. Tüm deployment aşamalarını (stage) uzak sunucuda SSH üzerinden çalıştırır.

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

| Stage | Açıklama |
|-------|----------|
| `prepare` | Proje dizinine git, kodu pull et, env dosyasını kontrol et |
| `backup` | Veritabanı backup'ı oluştur |
| `stop` | Tüm servisleri durdur |
| `build` | Docker image'larını build et |
| `prisma` | Prisma Client'ı generate et |
| `infrastructure` | Infrastructure servislerini başlat (postgres, redis, minio) |
| `wait-db` | Veritabanının hazır olmasını bekle |
| `migrate` | Prisma migration'ları çalıştır |
| `seed` | Seed data'ları ekle (akıllı kontrol ile) |
| `start` | Tüm servisleri başlat |
| `health` | Backend health check yap |
| `cleanup` | Eski Docker image'larını temizle |

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

## 🎯 Avantajlar

1. **Modüler Yapı**: Her deployment aşaması ayrı bir stage olarak tanımlanmış
2. **Yeniden Kullanılabilir**: Tek action ile tüm stage'ler yönetiliyor
3. **Hızlı**: Her stage için sadece bir SSH bağlantısı açılıyor
4. **Okunabilir**: Workflow dosyası daha temiz ve anlaşılır
5. **Akıllı Seed**: Database'de veri varsa seed'leri atlıyor
6. **Güvenli**: Her stage'de hata kontrolü var

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

      # ... diğer stage'ler
```

## 🔧 Özelleştirme

Yeni bir deployment stage'i eklemek için `execute-remote-stage/action.yml` dosyasındaki `case` statement'ına yeni bir durum ekleyin:

```bash
mynewstage)
  echo "🎨 Running my new stage..."
  # Stage komutları buraya
  echo "✅ My new stage completed"
  ;;
```

## 📝 Notlar

- **Seed Kontrolü**: `seed` stage'i, `users` tablosunda `@tipbox.%` emaili olan kullanıcı varsa seed'leri atlar
- **Database Adı**: Test ortamı için `tipbox_dev` kullanılır
- **Backup**: Her deployment öncesi otomatik backup alınır
- **Health Check**: 30 deneme, 2 saniye aralıklarla (toplam 1 dakika)
