# NaqshAI — manba kodi haqida tushuntirish

**Talabnoma:** DT 202610311/2
**Dastur nomi:** NaqshAI
**Muallif:** EGAMNAZAROVA SEVARAXON XASANBOY QIZI
**Dasturlash tili:** JavaScript (ECMAScript)

---

## 1. Dastur nimadan iborat

Dastur bitta ijro etiluvchi fayl (`index.html`) ko'rinishida tarqatiladi.
Bu faylning tarkibi quyidagicha taqsimlangan:

| Qism | Hajmi | Ulushi | Kimning ishi |
|---|---|---|---|
| **Muallif JavaScript kodi** | **391 767 belgi (9 008 qator)** | **31.0%** | **Muallifniki** |
| Three.js r128 kutubxonasi (MIT) | 603 596 belgi | 47.8% | Uchinchi tomon |
| Supabase JS v2 kutubxonasi (MIT) | 212 556 belgi | 16.8% | Uchinchi tomon |
| HTML qobiq + CSS uslublar | 55 337 belgi | 4.4% | Muallifniki (yordamchi) |

Ya'ni faylning **95.6% i — JavaScript kodi**, HTML esa atigi **4.4%** —
u faqat oynalar joylashuvini belgilovchi qobiq vazifasini bajaradi.

## 2. Nima uchun bitta faylda

Dastur **internetsiz, o'rnatishsiz** ishlashi uchun shunday tuzilgan:
foydalanuvchi faylni ochsa kifoya. Shuning uchun barcha kod bitta faylga
joylashtirilgan. Bu dasturning tarqatish shakli bo'lib, uning yozilgan
tiliga daxli yo'q.

## 3. Taqdim etilayotgan material

`naqshai.js` — dasturning **boshlang'ich matni** (source code), JavaScript
tilida. Unda:

- 9 008 qator kod;
- 41 ta naqsh algoritmi (Hankin usuli, girih plitkalari, islimiy, fraktallar);
- sanoat eksporti (DXF R12, EPS, SVG, TIFF, BMP, WIF Jakkard drafti);
- 3D geometriya qurish (muqarnas, ustun, ravoq);
- Douglas–Peucker soddalashtirish, Sutherland–Hodgman va Liang–Barsky
  qirqish algoritmlari;
- Otsu chegaralash usuli.

Matn **hech qanday kompilyator yoki obfuskator tomonidan qayta ishlanmagan**:
funksiya va o'zgaruvchi nomlari to'liq, izohlar saqlangan, qator tuzilishi
asl holida.

## 4. Nima taqdim etilmayapti va nega

`Three.js` va `Supabase JS` kutubxonalari muallifning ijodiy mehnati
natijasi emas — ular MIT litsenziyasi asosidagi ochiq kutubxonalar.
Ularni o'z asari sifatida taqdim etish mumkin emas, shuning uchun
`naqshai.js` fayliga kiritilmagan.

## 5. JavaScript — dasturlash tili

JavaScript **ECMA-262** (ECMAScript) xalqaro standarti va **ISO/IEC 16262**
bilan belgilangan to'laqonli dasturlash tili. U HTML yoki XML kabi
belgilash tili emas: o'zgaruvchilar, shartlar, sikllar, funksiyalar,
sinflar, rekursiya va istisnolarni qayta ishlashga ega.

Taqqoslash uchun, `naqshai.js` faylida sanab chiqilgan konstruksiyalar:

| Konstruksiya | Soni |
|---|---|
| `function` e'lonlari | 330 |
| `for` sikllari | 397 |
| `while` sikllari | 6 |
| `if` shartlari | 894 |
| `async` / `await` | 29 |
| `try` / `catch` (istisnolarni qayta ishlash) | 56 |

Shuningdek rekursiv algoritmlar mavjud (Sierpinski, Koch, dragon egri
chizig'i, Douglas–Peucker soddalashtirish).

Belgilash tillarida (HTML, XML) bu konstruksiyalarning **birortasi ham**
yo'q — ularda sikl ham, shart ham, funksiya ham bo'lmaydi.
