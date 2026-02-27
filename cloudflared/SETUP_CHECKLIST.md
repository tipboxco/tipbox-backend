# Cloudflare Tunnel - Kurulum Kontrol Listesi (Tipbox)

Backend'e bağlanamıyorsanız, bu adımları sırayla kontrol edin.

## 0. İlk Kurulum (Tek seferlik)

`bun run tunnel` veya `npm run tunnel` **otomatik** olarak şunları yapar (tunnel başlamadan önce):
1. **Published application routes** (Cloudflare API ile)
2. **DNS kayıtları** (cloudflared route dns)
3. **Tunnel başlatma**

Gerekli: `cloudflared/.env` içinde `TUNNEL_CLOUDFLARE_API_TOKEN`, `TUNNEL_CLOUDFLARE_ACCOUNT_ID`, `TUNNEL_ID`

## 1. Published Application Routes (Cloudflare Dashboard)

[Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels → **Tünelinize tıklayın**

**Configure** sekmesinde **Public Hostname** bölümünde şu kayıt olmalı:

- [ ] **api-tipbox.tipbox.co** → `http://localhost:3000`

**Ekleme:** Add a public hostname → Subdomain: `api-tipbox`, Domain: `tipbox.co`, URL: `localhost:3000`

---

## 2. DNS Kayıtları

Cloudflare DNS (tipbox.co) veya `bun run tunnel:route-dns`:

- [ ] **api-tipbox** CNAME → `<TUNNEL_ID>.cfargotunnel.com`

---

## 3. Servisler çalışıyor mu?

- [ ] Backend: `http://localhost:3000/health` → 200 OK
- [ ] Tunnel: `npm run tunnel` çalışıyor

---

## 4. Backend .env

**backend/.env:**
```
PORT=3000
BETTER_AUTH_URL=https://api-tipbox.tipbox.co
```

---

## Hızlı Test

```bash
# Lokal backend
curl http://localhost:3000/health

# Tunnel üzerinden (DNS yayıldıktan sonra)
curl https://api-tipbox.tipbox.co/health
```
