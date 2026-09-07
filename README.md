# NaqshAI

**O'zbek milliy naqshlari studiyasi** — girih, islimiy va boshqa an'anaviy
geometrik naqshlarni interaktiv yaratish, 3D buyumda ko'rish va sanoat
uskunalariga tayyor formatlarda eksport qilish platformasi.

Butun ilova — **bitta `index.html` fayl**. Build bosqichi yo'q, o'rnatish
kerak emas: faylni brauzerda ochish kifoya. Three.js va Supabase kutubxonalari
fayl ichiga joylashtirilgan, shuning uchun **internetsiz ham** to'liq ishlaydi.

## Imkoniyatlar

**🎨 Studio** — 5 toifada 40 naqsh turi:

| Toifa | Naqshlar |
|---|---|
| O'zbek geometrik | Girih (5 xil plitkalash), Shamsa, Xatam, Rozetta, Yulduz, Muqarnas, Katak-8… |
| Islimiy organik | Rumi, Hatayi, Palak, Shamsa, Arabesque, Bargli novda, Medalyon |
| Kombinatsiyalar | Girih+Islimiy, Shamsa+Girih, Muqarnas+Islimiy, Xatam+Rumi |
| Dunyo naqshlari | Celtic, Mandala, Penrose, Zellige, Batik, Paisley, Greek Key, Xitoy panjara |
| Matematik | Koch, Sierpinski, Dragon, Hilbert, Spirograph, Lissajous, Voronoi |

Simmetriya, murakkablik, chiziq qalinligi, zichlik, qatlamlar va boshqa
parametrlar jonli sozlanadi. Tessellatsiya rejimi 4 devor guruhini qo'llab-quvvatlaydi
(`p4` · `p4m` · `p6` · `p6m`).

**🧊 3D** — naqshni haqiqiy buyumda ko'rish: lagan, piyola, kosa, tuvak,
stakan, panel, shar. 4 yoritish rejimi, avto-aylanish, jonli chizilish
animatsiyasi, foto ramka va suvenir matni.

**⬡ AR** — naqshni devor, piyola, pol yoki gilam ustida ko'rish.
Kamera bo'lmasa **simulyatsiya rejimi** ishlaydi.

**💬 Chat** — matndan naqsh: «12 simmetriyali feruza islimiy, zich».
Sozlashsiz ishlaydi. Ixtiyoriy ravishda Google Gemini orqali badiiy tasvir
ham chizdirish mumkin → [`docs/AI-CHAT.md`](docs/AI-CHAT.md)

**📐 Nazariya** — har bir naqshning matematik asosi: formulalar, algoritm va
manba kodi.

## Eksport

| Format | Maqsad |
|---|---|
| **PNG** | 1024 / 2048 / 4096 px, shaffof fon imkoni |
| **SVG** | Vektor — CorelDraw, Illustrator, lazer kesish |
| **DXF** | AutoCAD 2000, mm o'lchamida, yopiq konturlar — CNC / lazer |
| **TIFF** | 1 / 8 / 24-bit — sanoat Jakkard CAD tizimlari |
| **BMP** | 1 / 24-bit — Jakkard boshqaruv dasturlari |
| **WIF** | To'quv drafti (ramka / pedal / tie-up) |

Jakkard formatlari **chok-suz rapport** sifatida chiqadi: kanvas o'lchami
naqsh panjarasining aniq davriga teng olinadi, shuning uchun mato bo'ylab
takrorlanganda uzilish chizig'i **paydo bo'lmaydi**. Har eksportdan oldin
natija avtomatik o'lchanadi.

Batafsil → [`docs/SANOAT-EKSPORTI.md`](docs/SANOAT-EKSPORTI.md)

## Foydalanuvchi hisoblari

Ikki rejimda ishlaydi:

- **Lokal (standart)** — hisob shu qurilmada saqlanadi. Hech narsa sozlash kerak emas.
- **Supabase** — haqiqiy database, Google OAuth, rollar, status, parol tiklash,
  email tasdiqlash, admin panel va audit log.

Supabase'ni ulash (~5 daqiqa) → [`supabase/README.md`](supabase/README.md)

## Ishga tushirish

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

`file://` orqali ochish ham mumkin, lekin kamera (AR) va OAuth ishlamaydi —
bu brauzer xavfsizlik siyosati.

## Productionga chiqarish

Build talab qilinmaydi. GitHub Pages: **Settings → Pages → Source** da
branch tanlang — tamom.

## Fayl tuzilishi

```
index.html                  butun ilova (Three.js va Supabase ichida)
supabase/schema.sql         database sxemasi, RLS, triggerlar
supabase/README.md          autentifikatsiyani ulash yo'riqnomasi
docs/SANOAT-EKSPORTI.md     Jakkard va lazer eksporti
docs/AI-CHAT.md             AI chat sozlash (ikki usul)
```
