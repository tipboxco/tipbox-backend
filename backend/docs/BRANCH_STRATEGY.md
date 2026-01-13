# Branch Stratejisi ve Workflow

Bu doküman, Tipbox Backend projesinin branch stratejisi ve deployment workflow'unu açıklar.

## 📋 İçindekiler

1. [Branch Yapısı](#branch-yapısı)
2. [Workflow Akışı](#workflow-akışı)
3. [Deployment Stratejisi](#deployment-stratejisi)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Best Practices](#best-practices)

---

## Branch Yapısı

### Developer Branch

- **İsim:** `developer`
- **Amaç:** Aktif geliştirme
- **Deploy:** Otomatik yok, manuel lokal
- **Docker Compose:** `docker-compose.yml`
- **Database:** `tipbox_dev`
- **Environment:** `.env` (NODE_ENV=development)
- **Özellikler:**
  - Hot reload (nodemon)
  - Debug modu aktif
  - Verbose logging
  - Tüm portlar expose
  - Prisma Studio ve PgAdmin erişimi
  - Test data seed edilebilir

### Test Branch

- **İsim:** `test`
- **Amaç:** Staging/QA ortamı (Hetzner test server)
- **Deploy:** Otomatik (GitHub Actions → Hetzner test server)
- **Docker Compose:** `docker-compose.test.yml`
- **Database:** `tipbox_test`
- **Environment:** `.env.test` (NODE_ENV=test)
- **Özellikler:**
  - Production-like build ama daha esnek
  - Info level logging, 30 gün retention
  - Health check'ler aktif
  - Sınırlı port exposure
  - Test data seed edilebilir
  - Monitoring (opsiyonel)

### Main Branch

- **İsim:** `main`
- **Amaç:** Production (Hetzner production server)
- **Deploy:** Manuel onay ile (GitHub Actions → Hetzner production server)
- **Docker Compose:** `docker-compose.production.yml`
- **Database:** `tipbox_prod`
- **Environment:** `.env.production` (NODE_ENV=production)
- **Özellikler:**
  - Maximum security
  - Optimized build
  - Warn level console, Info level file logging, 90 gün retention
  - Health check'ler zorunlu
  - SSL/TLS zorunlu
  - Minimum port exposure
  - Seed YOK
  - Backup otomatik

---

## Workflow Akışı

```
┌─────────────┐
│  Developer  │ ← Aktif geliştirme
└──────┬──────┘
       │
       │ Feature tamamlandı
       │ Test edildi
       │
       ▼
┌─────────────┐
│    Test     │ ← Otomatik deploy
└──────┬──────┘
       │
       │ QA testleri geçti
       │ Production'a hazır
       │
       ▼
┌─────────────┐
│    Main      │ ← Manuel onay ile deploy
└─────────────┘
```

### Geliştirme Süreci

1. **Feature Development:**
   ```bash
   git checkout developer
   git pull origin developer
   # Feature geliştir
   git add .
   git commit -m "feat: add new feature"
   git push origin developer
   ```

2. **Test'e Merge:**
   ```bash
   git checkout test
   git pull origin test
   git merge developer
   git push origin test
   # Otomatik deploy tetiklenir
   ```

3. **Production'a Merge:**
   ```bash
   git checkout main
   git pull origin main
   git merge test
   git push origin main
   # GitHub Actions'da manuel onay gerekir
   ```

---

## Deployment Stratejisi

### Developer Ortamı

**Deploy:** Manuel lokal

```bash
npm run docker:up
npm run dev
```

### Test Ortamı

**Deploy:** Otomatik (GitHub Actions)

**Trigger:**
- `test` branch'ine push yapıldığında
- Workflow dispatch ile manuel tetikleme

**Workflow:** `.github/workflows/deploy-hetzner-test.yml`

**Adımlar:**
1. Code checkout
2. Lint check
3. Build
4. SSH ile sunucuya bağlan
5. Git pull
6. Docker build
7. Docker Compose up
8. Migration deploy
9. Health check

### Production Ortamı

**Deploy:** Manuel onay ile (GitHub Actions)

**Trigger:**
- Workflow dispatch ile manuel tetikleme
- "DEPLOY" yazarak onay gerekir

**Workflow:** `.github/workflows/deploy-production.yml`

**Adımlar:**
1. Deployment onayı (DEPLOY yazılmalı)
2. Code checkout (main branch)
3. Lint check
4. Test run
5. Build
6. Database backup (zorunlu)
7. SSH ile sunucuya bağlan
8. Git pull
9. Docker build
10. Docker Compose up
11. Migration deploy
12. Health check
13. Old image cleanup

---

## CI/CD Pipeline

### CI Pipeline (Continuous Integration)

**Workflow:** `.github/workflows/ci.yml`

**Trigger:**
- Pull request açıldığında
- `developer`, `test`, `main` branch'lerine push yapıldığında

**Jobs:**
1. **Lint:** ESLint kontrolü
2. **Test:** Jest testleri
3. **Build:** TypeScript compile

### CD Pipeline (Continuous Deployment)

#### Test Environment

**Workflow:** `.github/workflows/deploy-hetzner-test.yml`

**Trigger:**
- `test` branch'ine push
- Workflow dispatch

**Deploy:** Otomatik

#### Production Environment

**Workflow:** `.github/workflows/deploy-production.yml`

**Trigger:**
- Workflow dispatch (manuel)

**Deploy:** Manuel onay gerekir

---

## Best Practices

### Branch Management

1. **Developer Branch:**
   - Her zaman güncel tutun
   - Feature branch'leri developer'dan açın
   - Merge'den önce test edin

2. **Test Branch:**
   - Sadece test edilmiş kodları merge edin
   - Production'a geçmeden önce test ortamında doğrulayın
   - Hotfix'ler için test branch'ini kullanabilirsiniz

3. **Main Branch:**
   - Sadece test edilmiş ve onaylanmış kodları merge edin
   - Production'a merge etmeden önce code review yapın
   - Hotfix'ler için dikkatli olun

### Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/) formatını kullanın:

```
feat: add new feature
fix: fix bug
docs: update documentation
refactor: refactor code
test: add tests
chore: update dependencies
```

### Pull Request Process

1. **Feature Development:**
   - Developer branch'te feature geliştir
   - Test et
   - Commit ve push

2. **Test Merge:**
   - Developer'dan test'e merge
   - Otomatik deploy
   - QA testleri

3. **Production Merge:**
   - Test'ten main'e merge
   - Manuel onay
   - Production deploy

### Deployment Checklist

#### Test Deployment

- [ ] Developer branch'te test edildi
- [ ] Lint hataları yok
- [ ] Build başarılı
- [ ] Test branch'e merge edildi
- [ ] Otomatik deploy başarılı
- [ ] Health check geçti
- [ ] QA testleri yapıldı

#### Production Deployment

- [ ] Test ortamında doğrulandı
- [ ] Database backup alındı
- [ ] Migration'lar test edildi
- [ ] Main branch'e merge edildi
- [ ] Manuel onay verildi
- [ ] Production deploy başarılı
- [ ] Health check geçti
- [ ] Production testleri yapıldı
- [ ] Rollback planı hazır

### Rollback Stratejisi

#### Test Ortamı

```bash
# Önceki commit'e geri dön
git checkout test
git reset --hard <previous-commit>
git push origin test --force
# Otomatik deploy tetiklenir
```

#### Production Ortamı

```bash
# Database backup'tan restore
docker compose -f docker-compose.production.yml exec -T postgres psql -U tipbox_user tipbox_prod < backup-file.sql

# Önceki image'a geri dön
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

---

## GitHub Secrets

### Test Environment

- `HETZNER_SSH_KEY`: SSH private key
- `HETZNER_HOST`: Test server IP/hostname
- `HETZNER_USER`: SSH user (genelde root)
- `HETZNER_SSH_PORT`: SSH port (default: 22)

### Production Environment

- `HETZNER_PRODUCTION_SSH_KEY`: SSH private key
- `HETZNER_PRODUCTION_HOST`: Production server IP/hostname
- `HETZNER_PRODUCTION_USER`: SSH user
- `HETZNER_PRODUCTION_SSH_PORT`: SSH port

---

## Troubleshooting

### Deployment Failed

1. **Logları kontrol edin:**
   ```bash
   docker compose -f docker-compose.test.yml logs backend
   ```

2. **Health check'i kontrol edin:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Container durumunu kontrol edin:**
   ```bash
   docker compose -f docker-compose.test.yml ps
   ```

### Migration Failed

1. **Migration durumunu kontrol edin:**
   ```bash
   docker compose exec backend npx prisma migrate status
   ```

2. **Manuel migration:**
   ```bash
   docker compose exec backend npx prisma migrate deploy
   ```

### Health Check Failed

1. **Backend loglarını kontrol edin:**
   ```bash
   docker compose logs backend
   ```

2. **Database bağlantısını kontrol edin:**
   ```bash
   docker compose exec backend npx prisma db pull
   ```

---

## İlgili Dokümantasyon

- [Environment Setup](./ENVIRONMENT_SETUP.md)
- [Hetzner Deployment](./HETZNER_DEPLOYMENT.md)
- [Automated Deployment](./AUTOMATED_DEPLOYMENT.md)

