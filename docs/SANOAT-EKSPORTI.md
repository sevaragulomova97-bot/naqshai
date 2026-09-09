# Sanoat eksporti — Jakkard to'quv va lazer kesish

## Nima uchun "rapport" muhim

Jakkard dastgohi naqshni mato bo'ylab **takrorlab** to'qiydi. Agar tasvirning
chap cheti o'ng cheti bilan aynan tutashmasa, har takrorlanishda ko'zga
tashlanadigan **uzilish chizig'i** paydo bo'ladi va mato brak bo'ladi.

Bu platformada uzilish "yashirilmaydi" — **matematik jihatdan yo'q qilinadi**:

1. Kanvas o'lchami naqsh panjarasining **aniq davriga** (period) teng olinadi.
2. Naqsh barcha qo'shni panjara tugunlarida chiziladi.
3. Natijada tasvir ta'rifi bo'yicha davriy bo'ladi — chetlari kafolatlangan
   holda tutashadi.
4. Har eksportdan oldin natija **avtomatik o'lchanadi** (`verifySeamless`):
   chetlardagi farq tasvirning odatdagi qo'shni piksellar farqidan oshsa,
   ogohlantirish chiqadi.

## Simmetriya guruhlari (Fyodorov devor guruhlari)

| Guruh | Rapport o'lchami | Izoh |
|---|---|---|
| `p4`  | c × c | Sof siljish, kvadrat panjara |
| `p4m` | **2c × 2c** | Ko'zguli rapport |
| `p6`  | c × H₀ | Geksagonal panjara, H₀ ≈ c·√3 |
| `p6m` | **2c × 2H₀** | Geksagonal + ko'zgu |

### Ko'zguli rapport (`p4m` / `p6m`)

Asos plitka **o'z chetlariga nisbatan aks ettiriladi**:

```
R = [ T    Tx  ]        Tx — x bo'yicha akslangan T
    [ Ty   Txy ]        Ty — y bo'yicha akslangan T
```

Bunda `R` ning oxirgi ustuni aynan birinchi ustuniga teng
(`R[2W−1] = T[0] = R[0]`), demak **chok matematik jihatdan nol** —
o'lchov emas, ta'rif. Ko'zgu o'qlari ham aniq chiqadi.

> Ilgari ko'zgu panjaraning navbatdagi tugunlariga qo'llanardi. O'lchov
> ko'rsatdiki, bunda rapportda **aniq ko'zgu o'qi hosil bo'lmasdi**
> (eng mos o'q ham o'rtacha 12% farq berardi). Hozirgi usulda 80/80
> holatda ko'zgu o'qi **aniq** va chok **aynan 0 ilmoq**.

### Geksagonal balandlik H₀

`c·√3` — kasr son, uni piksel to'riga tushirish kerak. H₀ **eng yaqin
juft songa** yaxlitlanadi, chunki panjaraning yarim qadami `(c/2, H₀/2)`
butun pikselga tushishi shart.

O'lchangan: H₀ toq bo'lganda (c=192 → 333) geksagonal yarim-davr
simmetriyasi **4.3–6.5%** ga buzilgan; H₀ juft bo'lganda (c=128 → 222,
c=768 → 1330) buzilish **0.0–0.2%**. Eng yaqin juft songa yaxlitlash
tomonlar nisbatini atigi **≤0.2%** o'zgartiradi.

### Rapportning haqiqiy o'lchami

Girih oilasidagi naqshlar (`girih`, `hankin8`, `hankin6`, `panelgirih`,
`pic3636`) o'z plitka davriga ega — rapport shu davrning **butun
karralisiga** yaxlitlanadi, shuning uchun nazariy `c×c` dan farq qiladi
(masalan c=192 da `panelgirih` → 239×207).

Eksport oynasidagi panel **aynan fayldagi raqamni** ko'rsatadi
(`rapportSize()`), fayl nomida ham shu o'lcham bo'ladi. Dastgohni shu
raqamga qarab sozlash mumkin.

> Ilgari panel har doim nazariy `c×c` ni ko'rsatardi va 14 holatda fayl
> o'lchamiga mos kelmasdi — dastgoh sozlashda bu jiddiy xato edi.

## Formatlar

### 🧵 Jakkard to'quv dastgohlari

| Format | Chuqurlik | Foydalanish |
|---|---|---|
| **TIFF** | 1-bit / 8-bit / 24-bit | Sanoat Jakkard CAD tizimlarining asosiy formati |
| **BMP** | 1-bit / 24-bit | Ko'p eski Jakkard boshqaruv dasturlari o'qiydi |
| **WIF** | 1-bit | Weaving Information File — dastgoh drafti |

- **1-bit** — har piksel bitta ilmoq: qora = ip ko'tarilgan, oq = tushirilgan.
- Chegara **avtomatik** (Otsu usuli) tanlanadi — gistogrammani eng yaxshi
  ajratuvchi qiymat. Shu tufayli har qanday palitrada naqsh strukturasi
  saqlanadi. Natija deyarli bir rangli chiqsa, ilova ogohlantiradi.
- **Teskari** belgisi ip ko'tarilishini almashtiradi (dastgoh konvensiyasiga
  qarab kerak bo'lishi mumkin).
- TIFF/BMP **siqilmagan** yoziladi — maksimal moslik uchun.
- DPI metama'lumot sifatida yoziladi (standart 300).

#### WIF drafti qanday hisoblanadi
Piksel to'ridan haqiqiy draft chiqariladi:
- bir xil **ustunlar** → bitta ramka (shaft), `[THREADING]`
- bir xil **qatorlar** → bitta pedal (treadle), `[TREADLING]`
- kesishmasi → `[TIEUP]`

Bu ajratish har doim **aniq**: bir xil ustunlar ta'rifi bo'yicha bir xil
ko'tariladi, shuning uchun tie-up ziddiyatsiz chiqadi.

> ⚠️ Murakkab naqshda ramka soni yuzlab bo'lishi mumkin. Jakkard uchun bu
> normal (har ilmoq mustaqil), lekin **oddiy ramkali dastgoh** uchun ko'p —
> ilova ramka/pedal sonini xabar qilib beradi.

### ✂️ Lazer kesish / CNC

| Format | Izoh |
|---|---|
| **EPS** | Encapsulated PostScript — lazer dasturlari ro'yxatida odatda birinchi turadi |
| **DXF** | **R12 (AC1009)**, `$INSUNITS=4` + `$MEASUREMENT=1` (mm) |
| **SVG** | Haqiqiy mm o'lchamida, hairline qizil kontur = kesish yo'li |

### Nega DXF R12?

Lazer apparatlarining import moduli ko'pincha ancha eski bo'ladi va faqat
R12 ni to'liq o'qiydi. Ilgari AC1015 (AutoCAD 2000) va `LWPOLYLINE`
ishlatilardi, lekin:

- `LWPOLYLINE` R14 dan boshlab paydo bo'lgan;
- handle (kod 5) va `AcDbEntity` sinf belgilari R13+ ga tegishli.

Eski o'qigich ularda to'xtaydi yoki bo'sh chizma ochadi. R12 — eng past
umumiy maxraj: uni R12 dan keyingi **hamma** dastur o'qiydi. Shuning uchun
`POLYLINE` / `VERTEX` / `SEQEND` ishlatiladi, handle va sinf belgilari yo'q,
qatorlar CRLF bilan tugaydi.

### EPS

Oddiy matn: faqat `moveto` / `lineto` va `stroke`. Birlik — PostScript
punkti (1 pt = 0.352778 mm), `%%BoundingBox` aynan detal o'lchamiga teng,
`showpage` yo'q (EPS talabi). Qizil hairline — kesish konturi.

### Sirt fakturasi vektorga tushmaydi

«O'yma panel» naqshidagi nuqtali fon va relyef (yorug'-soya nusxalari)
faqat ekran va PNG uchun. Vektor eksportida ular **chizilmaydi**:

- nuqtali fon lazerga minglab mayda doira, ya'ni minglab alohida teshik
  bo'lib ketardi — o'lchandi: 180×120 mm panelda **3019 kontur, 2.5 MB**;
- relyef nusxalari har chiziqni **uch marta** kestirardi.

Tuzatilgandan keyin: **76 kontur, 236 KB**.

- Fizik o'lcham tanlanadi: **100 / 200 / 300 / 500 mm**.
- Qatlamlar: `Naqsh` (kesish konturi) va `Chegara` (joylashtirish ramkasi).
- Egri chiziqlar 32 nuqtali segmentlarga tabaqalanadi.
- **DXF va SVG aynan bir xil geometriyani** beradi — ikki fayl bir detal.

Geometriya chiqarishdan oldin uch bosqichdan o'tadi:

**1. Ish maydoniga qirqish.** Tekislikni to'ldiruvchi naqshlar berilgan
radiusdan tashqariga ham chizadi. O'lchov: `panelgirih` 1000 birlik
taxtada −2657…3880 gacha chiqib ketgan — ya'ni **100 mm deb e'lon
qilingan detal aslida 654 mm** bo'lgan. Bunday fayl lazerda material
chetidan tashqarida kesadi. Endi yopiq konturlar Sutherland–Hodgman,
ochiq chiziqlar Liang–Barsky bilan taxtaga qirqiladi.
*Natija: 80 holatning 16 tasida chiqib ketish bor edi → hozir 0.*

**2. Ustma-ust kesmalarni birlashtirish.** Qo'shni plitkalar umumiy
qirrani ikki marta chizadi — lazer o'sha chiziqni ikki marta kesadi,
material kuyadi va ish vaqti bekorga oshadi. Geometriya kesmalarga
ajratilib, takrorlari tashlanadi va qolganlari uzluksiz zanjirlarga
qayta yig'iladi (kesuvchi bosh kamroq sakraydi).
*O'lchangan: ikki marta kesiladigan yo'l **32–72% dan aynan 0%** ga
tushdi; umumiy kesish yo'li ~3 barobar qisqardi (girih: 180922 → 51860
birlik), kontur soni esa masalan penrose'da 681 → 26.*

**3. Mayda parchalarni olib tashlash.** Qirqishdan qolgan 0.3 mm dan
qisqa bo'laklar lazerda kesma emas, **kuygan nuqta** beradi (kerf o'zi
~0.1–0.2 mm) — ular tashlanadi.

### 🖼 PNG

PNG ga **`pHYs`** bo'lagi yoziladi — fizik zichlik. Ilgari u yo'q edi:
fayl nomida "300dpi" yozilgan bo'lsa ham CorelDraw / Illustrator /
bosmaxona dasturlari uni 96 dpi deb olardi va 2048 px rasm 17.3 sm
o'rniga **54 sm** bo'lib joylashardi — o'lcham 3 barobar xato chiqardi.

## Sifat nazorati — o'lchangan natijalar

Barcha raqamlar brauzerda (headless Chromium) haqiqiy eksport ustida
olingan, ilovaning o'z tekshiruvidan **mustaqil** o'lchagich bilan.

### Chok (uzilish)

1-bitli to'rda — dastgohga aynan shu boradi — **torus-chok** o'lchovi:
`x = W−1` va `x = 0` ustunlari orasidagi farqli ilmoqlar ulushi ichki
qo'shni ustunlar taqsimoti bilan solishtiriladi.

| | Natija |
|---|---|
| 40 naqsh × 4 guruh = **160 holat** | chok gumoni **0** |
| Ko'zguli guruhlar (80 holat) | chok **aynan 0 ilmoq** (x va y) |
| Ko'zgu o'qi (80 holat) | **aniq** (0.000% farq) |
| Rapport o'lchami: panel = fayl | **160/160 mos** |

**O'lchagichning o'zi ham sinovdan o'tkazilgan** (musbat nazorat): ataylab
buzilgan 4 holatning hammasini topdi — rapport 7 piksel qirqilgani,
pastki yarmi 25 piksel siljitilgani, chet ustunlari oqartirilgani va
1.13× cho'zilgani. Har birida wrap juftligi eng yomon natija bo'lib
chiqdi; normal holatda esa u ichki juftliklarning **98%** idan silliqroq.
Chizish **deterministik** (bir xil parametrda ikki marta chizilganda 0%
farq).

### Fayl formatlari

Mustaqil Python parserlari bilan:

- **TIFF** — IFD tuzilishi, teglar o'sish tartibida, keyingi IFD = 0,
  `BitsPerSample` / `SamplesPerPixel` / `RowsPerStrip` / `StripByteCounts`
  mos, `XResolution`=`YResolution`=300, `ResolutionUnit`=dyuym,
  siqilmagan; 1-bit da `PhotometricInterpretation`=WhiteIsZero,
  8-bit da BlackIsZero. **Piksellar kutilgan to'r bilan aynan bir xil.**
- **BMP** — `BITMAPINFOHEADER`, pastdan-yuqoriga tartib, qatorlar 4 baytga
  tekislangan, 1-bit da 2 rangli palitra, fayl hajmi sarlavhadagi qiymatga
  teng, px/metr = 300 dpi. **Piksellar aynan bir xil.**
- **WIF** — draft **qayta to'qib ko'rilgan**: `[THREADING]` + `[TIEUP]` +
  `[TREADLING]` dan mato qayta tiklanib, asl to'r bilan solishtirildi →
  **0 ilmoq farq**. Indekslar uzluksiz, ramka/pedal chegaradan chiqmaydi,
  `WARP`/`WEFT` iplar soni rapport o'lchamiga teng.
- **DXF** — `$INSUNITS`=4, `$ACADVER`=AC1015, `90` kodi nuqtalar soniga
  mos, chegara qutisi **aynan 0…N mm**, takroriy kontur **0**.
- **SVG** — `width`/`height` mm da, koordinatalar viewBox ichida,
  hairline 0.1 mm, DXF bilan bir xil yo'llar soni.
- **PNG** — `pHYs` bo'lagi to'g'ri joyda (IHDR dan keyin), CRC to'g'ri,
  150/300/600 dpi da fizik o'lcham aniq.

### Ma'lum cheklovlar (halol qayd)

- **Girih oilasida devor guruhi tanlash panjarani o'zgartirmaydi.** Bu
  naqshlar o'z plitka davri bilan chiziladi; guruh tanlash faqat rapport
  o'lchamiga va ko'zgu qo'llanishiga ta'sir qiladi. Girih tilingining
  o'z simmetriyasi baribir saqlanadi.
- **Maydon rejimidagi naqshlarda** (`katak8`, `hexa`, `zellige`, `xitoy`)
  geksagonal yarim-davr simmetriyasi qo'llanilmaydi — ular panjara
  nusxalari emas, uzluksiz maydon sifatida chiziladi.
- **Lazer chiqishi — chiziqlar to'ri**, alohida kesib olinadigan yopiq
  bo'laklar to'plami emas. Fizik natija bir xil (bir xil chiziqlar
  kesiladi), lekin kesish tartibi zanjirlar bo'yicha boradi.
- **WIF ramka soni** murakkab naqshda 80–100 ga yetadi — bu faqat
  Jakkardda mumkin, oddiy ramkali dastgohda emas. Ilova buni xabar qiladi.

## 3D va AR da naqsh taqsimoti

3D buyum va AR sirtlarida naqsh **bir marta cho'zib emas, rapport sifatida
takrorlanib** yotadi — tekstura eksportdagi aynan bir xil
`makeSeamlessRepeat()` dan olinadi.

**Takrorlanish soni buyum o'lchamidan hisoblanadi**, shuning uchun naqsh har
buyumda bir xil fizik o'lchamda chiqadi (o'lchangan: plitka eni 0.575–0.651
dunyo birligi, ya'ni ±6% ichida).

Ikki qat'iy shart:

1. **Aylanma yuzalarda `u` butun son bo'lishi shart** — aks holda buyum
   orqasida ulanish chizig'i paydo bo'ladi. Barcha 28 holatda (7 buyum × 4
   guruh) butun.
2. **Naqsh cho'zilmasligi kerak.** `v` yo'nalishidagi uzunlik bbox
   balandligidan emas, geometriyaning o'zidan o'lchanadi (profil/meridian
   bo'ylab): piyolada profil 2.06, balandlik esa atigi 1.4 — bbox dan
   hisoblansa naqsh ~60% cho'zilardi. Buzilish endi 14/14 holatda ±25% ichida.

AR'da gilam va pol sirtlari ham chok-suz maydondan yig'iladi. Ilgari u yerda
medalyon 3×3 qilib takrorlanar va plitkalar orasida uzilish ko'rinardi.

## Amaliy maslahat

- **Rapport o'lchami** dastgoh imkoniyatiga qarab tanlanadi (256–2048 ilmoq).
- Zichlik ~100 ilmoq/dyuym bo'lsa, 512 ilmoq ≈ 130 mm mato eni.
- Nozik chiziqli naqshlarda (Spirograf, Xitoy panjara) qoplama past bo'ladi —
  kerak bo'lsa **Chiziq qalinligi** slayderini oshiring.
- Lazer uchun **Kontur** to'ldirish rejimi eng mos (to'ldirilgan emas).
