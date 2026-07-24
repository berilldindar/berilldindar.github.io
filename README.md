# Beril Dindar — kişisel site ve teknik blog

Samimi bir kişisel portföy ile Markdown tabanlı teknik blogu bir araya getiren statik site.

## Site içeriğini güncellemek

Kişisel içerikler `build.mjs` dosyasından ayrılmıştır:

- `content/profile.json`: İsim, unvan, ana sayfa metinleri, hakkımda yazısı, iletişim bilgileri, sosyal bağlantılar ve kullanılan profil fotoğrafları
- `content/projects.json`: Projeler, proje görselleri, açıklamalar, etiketler ve bağlantılar
- `content/experience.json`: Şirket, görev ve çalışma tarihleri
- `content/certificates.json`: Ana sayfada gösterilecek seçili sertifikalar
- `content/posts/`: Markdown biçimindeki teknik yazılar

JSON dosyalarında metinleri tırnak işaretleri içinde tut. Son öğeden sonra virgül ekleme.

### Fotoğraf değiştirmek

Fotoğraflar `assests/images` klasöründe bulunur. Aynı dosya adını kullanarak görseli değiştirebilir veya yeni dosyanın yolunu `content/profile.json` ve `content/projects.json` içinden güncelleyebilirsin.

Profil görselleri `content/profile.json` içindeki `images` alanından yönetilir:

```json
{
  "images": {
    "hero": "/assests/images/favicon.jpg",
    "about": "/assests/images/profile.png",
    "avatar": "/assests/images/favicon.jpg"
  }
}
```

## Yeni yazı eklemek

1. `content/posts/_template.md` dosyasını kopyala.
2. Dosya adını `YYYY-AA-GG-yazi-basligi.md` biçiminde değiştir.
3. Başlık, açıklama, tarih, kategori ve etiketleri doldur.
4. Yazıyı Markdown ile yaz.
5. `draft: false` yaptığında yazı sitede görünür.

Örnek:

```md
---
title: "Azure Container Apps ile ilk servis"
description: "Küçük bir servisi adım adım yayına alma notlarım."
date: "2026-08-01"
category: "Azure"
tags: ["Azure", "Containers"]
accent: "azure"
featured: true
draft: false
---

Yazının giriş paragrafı...
```

Kullanılabilen vurgu renkleri: `azure`, `coral`, `mint`.

## Yerelde çalıştırmak

```bash
npm run dev
```

Site `http://localhost:4173` adresinde açılır. Üretim çıktısı için:

```bash
npm run build
```

Oluşturulan site `dist` klasörüne yazılır.

## Yayın

`main` dalına gönderilen her değişiklik GitHub Actions tarafından otomatik olarak oluşturulur ve GitHub Pages'a yayımlanır.
