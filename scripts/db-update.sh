#!/bin/bash

# Veritabanı Güncelleme Script'i
# Bu script Prisma migration'larını güvenli bir şekilde çalıştırır
# Docker ve local ortamları destekler

set -e  # Hata durumunda script'i durdur

# Renkli çıktı için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log dosyası
LOG_FILE="logs/db-update-$(date +%Y%m%d-%H%M%S).log"
mkdir -p logs

# Log fonksiyonu
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Yardım mesajı
show_help() {
    cat << EOF
Veritabanı Güncelleme Script'i

Kullanım:
    ./scripts/db-update.sh [OPTIONS]

Seçenekler:
    -e, --env ENV         Ortam tipi (dev, test, prod) [varsayılan: dev]
    -m, --mode MODE       Migration modu (dev, deploy, reset) [varsayılan: deploy]
    -s, --seed            Migration sonrası seed çalıştır
    -b, --backup          Migration öncesi backup al
    -d, --docker          Docker container kullan (varsayılan: auto-detect)
    -n, --no-docker       Docker container kullanma
    -f, --force           Onay sormadan devam et
    -h, --help            Bu yardım mesajını göster

Örnekler:
    # Development ortamında migration çalıştır
    ./scripts/db-update.sh -e dev -m deploy

    # Migration + Seed
    ./scripts/db-update.sh -e dev -m deploy -s

    # Backup al + Migration
    ./scripts/db-update.sh -e prod -m deploy -b

    # Reset database (DİKKAT: Tüm veriler silinir!)
    ./scripts/db-update.sh -e dev -m reset -f

Notlar:
    - Script otomatik olarak Docker kullanımını tespit eder
    - Production ortamında backup almak önerilir
    - Reset modu sadece development/test ortamlarında kullanılmalıdır
EOF
}

# Varsayılan değerler
ENV="dev"
MODE="deploy"
SEED=false
BACKUP=false
FORCE=false
DOCKER_MODE="auto"

# Parametreleri parse et
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -s|--seed)
            SEED=true
            shift
            ;;
        -b|--backup)
            BACKUP=true
            shift
            ;;
        -d|--docker)
            DOCKER_MODE="docker"
            shift
            ;;
        -n|--no-docker)
            DOCKER_MODE="no-docker"
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error "Bilinmeyen parametre: $1"
            show_help
            exit 1
            ;;
    esac
done

# Docker kontrolü
detect_docker() {
    if [ "$DOCKER_MODE" = "docker" ]; then
        return 0
    elif [ "$DOCKER_MODE" = "no-docker" ]; then
        return 1
    fi
    
    # Otomatik tespit
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
            return 0
        fi
    fi
    
    return 1
}

# Docker komutunu hazırla
get_docker_cmd() {
    if detect_docker; then
        echo "docker-compose exec -T backend"
    else
        echo ""
    fi
}

# Prisma komutunu çalıştır
run_prisma() {
    local cmd="$1"
    local docker_cmd=$(get_docker_cmd)
    
    if [ -n "$docker_cmd" ]; then
        log "Docker container üzerinde çalıştırılıyor: $cmd"
        $docker_cmd sh -c "$cmd"
    else
        log "Local ortamda çalıştırılıyor: $cmd"
        eval "$cmd"
    fi
}

# PostgreSQL backup al
create_backup() {
    if [ "$ENV" = "dev" ] && [ "$BACKUP" = false ]; then
        warning "Development ortamında backup alınmıyor. Zorlamak için -b parametresini kullanın."
        return 0
    fi
    
    log "Veritabanı backup'ı alınıyor..."
    
    local backup_dir="backups"
    mkdir -p "$backup_dir"
    local backup_file="$backup_dir/backup-$(date +%Y%m%d-%H%M%S).sql"
    
    if detect_docker; then
        # Docker container'dan backup
        local db_name=$(docker-compose exec -T postgres psql -U postgres -t -c "SELECT current_database();" | tr -d ' \n\r')
        docker-compose exec -T postgres pg_dump -U postgres "$db_name" > "$backup_file"
    else
        # Local backup
        local db_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/tipbox_dev}"
        pg_dump "$db_url" > "$backup_file" 2>/dev/null || {
            error "Backup alınamadı. pg_dump kurulu mu kontrol edin."
            return 1
        }
    fi
    
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        success "Backup alındı: $backup_file"
        log "Backup boyutu: $(du -h "$backup_file" | cut -f1)"
    else
        error "Backup dosyası oluşturulamadı veya boş!"
        return 1
    fi
}

# Container'ları kontrol et
check_containers() {
    if ! detect_docker; then
        return 0
    fi
    
    log "Docker container'ları kontrol ediliyor..."
    
    if ! docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
        warning "PostgreSQL container çalışmıyor. Başlatılıyor..."
        docker-compose up -d postgres
        log "PostgreSQL container'ının başlaması bekleniyor (5 saniye)..."
        sleep 5
    fi
    
    if [ "$MODE" != "reset" ] && ! docker-compose ps backend 2>/dev/null | grep -q "Up"; then
        warning "Backend container çalışmıyor. Başlatılıyor..."
        docker-compose up -d backend
        log "Backend container'ının başlaması bekleniyor (5 saniye)..."
        sleep 5
    fi
    
    success "Container'lar hazır"
}

# Environment dosyasını kontrol et
check_env() {
    log "Environment kontrolü yapılıyor..."
    
    if [ ! -f ".env" ] && [ ! -f ".env.$ENV" ]; then
        warning ".env dosyası bulunamadı. env.example.txt'den kopyalayın."
        if [ "$FORCE" = false ]; then
            read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error "İşlem iptal edildi"
                exit 1
            fi
        fi
    fi
    
    # DATABASE_URL kontrolü
    if [ -z "$DATABASE_URL" ]; then
        if [ -f ".env" ]; then
            export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
        elif [ -f ".env.$ENV" ]; then
            export $(grep -v '^#' ".env.$ENV" | grep DATABASE_URL | xargs)
        fi
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL bulunamadı. .env dosyasını kontrol edin."
        exit 1
    fi
    
    log "DATABASE_URL: ${DATABASE_URL//:*@/:***@}"  # Şifreyi gizle
}

# Migration öncesi kontrol
pre_migration_check() {
    log "Migration öncesi kontrol yapılıyor..."
    
    # Prisma schema kontrolü
    if [ ! -f "prisma/schema.prisma" ]; then
        error "prisma/schema.prisma dosyası bulunamadı!"
        exit 1
    fi
    
    # Prisma client generate
    log "Prisma Client generate ediliyor..."
    run_prisma "npx prisma generate"
    
    success "Migration öncesi kontroller tamamlandı"
}

# Migration çalıştır
run_migration() {
    log "Migration modu: $MODE"
    
    case $MODE in
        deploy)
            log "Production migration çalıştırılıyor (prisma migrate deploy)..."
            run_prisma "npx prisma migrate deploy"
            success "Migration başarıyla tamamlandı"
            ;;
        dev)
            log "Development migration çalıştırılıyor (prisma migrate dev)..."
            if [ "$FORCE" = false ]; then
                warning "Bu mod migration dosyası oluşturabilir. Devam etmek istiyor musunuz?"
                read -p "Devam? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    error "İşlem iptal edildi"
                    exit 1
                fi
            fi
            run_prisma "npx prisma migrate dev"
            success "Development migration başarıyla tamamlandı"
            ;;
        reset)
            if [ "$ENV" = "prod" ]; then
                error "Production ortamında reset yapılamaz!"
                exit 1
            fi
            
            if [ "$FORCE" = false ]; then
                error "RESET MODU: Bu işlem TÜM VERİLERİ SİLECEK!"
                read -p "Emin misiniz? 'EVET' yazın: " -r
                if [ "$REPLY" != "EVET" ]; then
                    error "İşlem iptal edildi"
                    exit 1
                fi
            fi
            
            log "Database reset ediliyor..."
            run_prisma "npx prisma migrate reset --force --skip-seed"
            success "Database reset edildi"
            ;;
        *)
            error "Geçersiz migration modu: $MODE"
            exit 1
            ;;
    esac
}

# Seed çalıştır
run_seed() {
    if [ "$SEED" = false ]; then
        return 0
    fi
    
    log "Seed çalıştırılıyor..."
    run_prisma "npm run db:seed"
    success "Seed başarıyla tamamlandı"
}

# Migration sonrası kontrol
post_migration_check() {
    log "Migration sonrası kontrol yapılıyor..."
    
    # Prisma studio'yu başlatma seçeneği (opsiyonel)
    if [ "$FORCE" = false ] && [ "$MODE" != "reset" ]; then
        read -p "Prisma Studio'yu açmak ister misiniz? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log "Prisma Studio başlatılıyor..."
            if detect_docker; then
                docker-compose up -d prisma-studio
                success "Prisma Studio: http://localhost:5555"
            else
                run_prisma "npx prisma studio" &
                success "Prisma Studio başlatıldı"
            fi
        fi
    fi
}

# Ana işlem
main() {
    log "================================================"
    log "Veritabanı Güncelleme Script'i Başlatıldı"
    log "Ortam: $ENV | Mod: $MODE"
    log "================================================"
    
    # Kontroller
    check_env
    check_containers
    pre_migration_check
    
    # Backup
    if [ "$BACKUP" = true ] || [ "$ENV" = "prod" ]; then
        create_backup
    fi
    
    # Migration
    run_migration
    
    # Seed
    if [ "$MODE" != "reset" ]; then
        run_seed
    fi
    
    # Son kontroller
    post_migration_check
    
    log "================================================"
    success "Tüm işlemler başarıyla tamamlandı!"
    log "Log dosyası: $LOG_FILE"
    log "================================================"
}

# Hata yakalama
trap 'error "Script hataya düştü. Log dosyasını kontrol edin: $LOG_FILE"; exit 1' ERR

# Ana fonksiyonu çalıştır
main







