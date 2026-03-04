#!/bin/sh
# SSL sertifikası varsa nginx ssl config dosyasını oluştur
# Yoksa nginx sadece HTTP modunda çalışır

SSL_CONF="/etc/nginx/conf.d/ssl-tipbox.conf"
CERT_DIR="/etc/letsencrypt/live/api-test.tipbox.co"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  echo "SSL certificate found, enabling HTTPS..."
  cat > "$SSL_CONF" << 'SSLEOF'
server {
    listen 443 ssl;
    http2 on;
    server_name api-test.tipbox.co;

    ssl_certificate /etc/letsencrypt/live/api-test.tipbox.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-test.tipbox.co/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 10M;

    location / {
        set $backend http://backend:3000;
        proxy_pass $backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;

        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 32 16k;
        proxy_busy_buffers_size 64k;
        proxy_temp_file_write_size 64k;
        proxy_max_temp_file_size 512m;
    }

    # Admin panel dashboard
    location /dashboard/ {
        set $admin http://admin-panel:5174;
        rewrite ^/dashboard/(.*)$ /$1 break;
        proxy_pass $admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Vite dev server internal paths
    location ~ ^/(@vite|@react-refresh|@fs|__vite_hmr|src/|node_modules/) {
        set $admin http://admin-panel:5174;
        proxy_pass $admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_cache_bypass $http_upgrade;
    }

    # Medusa admin dashboard
    location /catalog/app {
        set $catalog http://catalog-service:5175;
        rewrite ^/catalog(.*)$ $1 break;
        proxy_pass $catalog;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_cache_bypass $http_upgrade;
    }

    # Catalog seed/sync API
    location ~ ^/catalog/admin/(seed|sync) {
        set $catalog http://catalog-service:5175;
        rewrite ^/catalog(.*)$ $1 break;
        proxy_pass $catalog;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # Catalog service API
    location /catalog/ {
        set $catalog http://catalog-service:5175;
        rewrite ^/catalog(.*)$ $1 break;
        proxy_pass $catalog;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host localhost;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location /health {
        set $backend http://backend:3000;
        proxy_pass $backend;
        access_log off;
    }

    location /media/ {
        set $minio http://minio:9000;
        rewrite ^/media/(.*)$ /tipbox-media/$1 break;
        proxy_pass $minio;
        limit_except GET HEAD OPTIONS { deny all; }
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header Access-Control-Allow-Origin * always;
        add_header Cache-Control "public, max-age=3600";
        if ($request_method = 'OPTIONS') { return 204; }
    }
}
SSLEOF
  echo "HTTPS enabled."
else
  echo "No SSL certificate found at $CERT_DIR, running HTTP only."
  rm -f "$SSL_CONF" 2>/dev/null
fi
