# Userprofile görselleri – dosya ↔ kullanıcı eşleştirmesi

`tests/assets/userprofile/` altındaki dosya adları, seed'deki `avatarKey` ve `user.avatar.*` key'leri ile eşleşir.

## Dosya adı → Seed key

| Dosya | Key | Kullanan kullanıcılar (örnek) |
|-------|-----|-------------------------------|
| omer.png | user.avatar.omer | Ömer Faruk |
| mehmet.png | user.avatar.mehmet | Mehmet |
| burakcan.png | user.avatar.burakcan | Burakcan |
| mihrac.png | user.avatar.mihrac | Mihraç |
| furkan.png | user.avatar.furkan | Furkan |
| aycan.png | user.avatar.aycan | Aycan |
| ozan.jpg / ozan.png | user.avatar.ozan | Ozan (.jpg öncelikli) |
| man-user.jpg | user.avatar.man1 | Tuna, Barış, Serkan, … |
| man-user-2.png | user.avatar.man2 | İbrahim, Berkay, Kaan, … |
| man-user-3.jpg | user.avatar.man3 | Can, Murat, Selim, … |
| man-user-4.jpg | user.avatar.man4 | Ahmet, Onur, Cem, … |
| man-user-5.jpg | user.avatar.man5 | Emre, Tolga, … |
| woman-user.jpg | user.avatar.woman1 | İrem, Merve, Ece, … |
| woman-user-2.jpg | user.avatar.woman2 | Elif, Aslı, Derya, … |
| woman-user-3.jpg | user.avatar.woman3 | Zeynep, Gizem, Pelin, … |
| woman-user-4.jpg | user.avatar.woman4 | Selin, Burcu, … |
| woman-user-5.jpg | user.avatar.woman5 | Deniz, Ebru, … |
| banner.png | user.banner.primary | Profil banner (örn. Ömer) |

Eşleştirme: `ensure-seed-media.ts` (buildAssetMapping) ve `seed-media-map.json`.
