# sunrise53 Discord & Kick Notifier Bot 🌅

Gökçe ([kick.com/sunrise53](https://kick.com/sunrise53)) topluluğu için geliştirilmiş Discord canlı yayın bildirim ve rol yönetim botu.

## 🚀 Özellikler
- **Kick Canlı Yayın Takibi:** Kick API üzerinden her 45 saniyede bir kanalı kontrol eder; yayın açıldığında Kick yeşili kart ve doğrudan izleme butonuyla duyurur.
- **Butonlu Rol Alma:** `#🎭・rol-al` kanalındaki butona tıklayan üyelere `@🔔 Yayın Bildirimi` rolünü verir veya kaldırır.
- **Discord Oryantasyon (Onboarding) Entegrasyonu:** Sunucuya yeni katılan üyelere otomatik olarak bildirim, ilgi alanı ve platform rollerini seçtirir.
- **Komutsuz Sessiz Çalışma:** Sohbet kirliliği yaratmaz; tamamen arka planda çalışır.

## ⚙️ Çevre Değişkenleri (Environment Variables)
Northflank veya yerel ortamda şu değişkeni tanımlayın:
- `DISCORD_TOKEN`: Discord Bot Tokeni
- `NOTIFICATION_CHANNEL_ID`: (İsteğe bağlı) Özel bir kanal ID'si verilmezse sunucudaki `kick-yayın` kanalına otomatik atar.

## 🐳 Northflank ile Dağıtım (Deploy)
1. Bu depoyu GitHub hesabınıza push'layın.
2. Northflank panelinde **"Create Service"** -> **"Deployment Service"** seçin.
3. Build Type olarak **"Dockerfile"** veya **"Node.js"** seçin.
4. **Environment Variables** bölümüne `DISCORD_TOKEN` değerinizi ekleyin.
5. Service Type: **Worker / Background Service** (HTTP portu gerektirmez).
6. **Deploy** butonuna basın!
