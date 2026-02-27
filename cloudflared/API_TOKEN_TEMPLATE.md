# Cloudflare API Token - Tunnel Setup İçin (Tipbox)

`cloudflared/.env` içindeki `TUNNEL_CLOUDFLARE_API_TOKEN` için oluşturulacak token izinleri:

## Token Oluşturma

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **My Profile** → **API Tokens**
2. **Create Token** → **Create Custom Token**

## Gerekli İzinler

| Permission          | Access |
|---------------------|--------|
| **Account** → Cloudflare Tunnel | Edit |
| **Zone** → DNS      | Edit   |

### Detaylı (Custom Token)

**Account permissions:**
- `Cloudflare Tunnel` → **Edit**

**Zone permissions:**
- `DNS` → **Edit** (api-tipbox.exportergo.com CNAME için)

## Alternatif Hazır Şablonlar

Cloudflare'da şu hazır izinlerden biri yeterli olabilir:
- `Cloudflare Tunnel Write`
- `Cloudflare One Connector: cloudflared Write`
- `Cloudflare One Connectors Write`

Bunlara ek olarak **Zone → DNS → Edit** gerekir (`tunnel route dns` için).

## Account Resources

- **Include** → **Specific account** → Tipbox hesabınızı seçin

## Zone Resources (DNS için)

- **Include** → **Specific zone** → `tipbox.co` seçin
