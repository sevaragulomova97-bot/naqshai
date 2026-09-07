# AI Chat — ikki rejim

## 1. «Aniq naqsh» — hech qanday sozlashsiz ishlaydi ✅

Bu **standart** rejim. API kalit, server, internet — hech biri kerak emas.
Matningizni brauzerning o'zi tahlil qiladi va naqsh parametrlariga aylantiradi.

Tushunadigan so'zlar:

| Toifa | Misollar |
|---|---|
| Naqsh turi | `girih`, `islimiy`, `xatam`, `penrose`, `mandala`, `zellige`, `koch`… |
| Rang | `oltin`, `feruza`, `zumrad`, `yoqut`, `ko'k`, `tuproq` |
| Simmetriya | `8 simmetriyali`, `12 ta`, `10 burchak` |
| Zichlik | `zich`, `siyrak` |
| Murakkablik | `murakkab`, `sodda` |
| Chiziq | `ingichka`, `qalin` |
| Takrorlash | `tessellatsiya`, `tiling`, `takror` + `p4` / `p4m` / `p6` / `p6m` |
| Boshqa | `spiral`, `qatlam` |

**Har qanday matn** naqsh beradi — ism, shahar nomi, sana ham. Matn xeshidan
deterministik parametrlar chiqariladi, ya'ni bir xil matn **doim bir xil**
naqsh beradi. Kalit so'zlar esa natijani aniqlashtiradi.

Misollar:
```
12 simmetriyali feruza islimiy, zich   → islimiy · feruza · sym 12 · zichlik 0.8
ko'k penrose sodda                     → penrose · to'q ko'k · murakkablik 2
oltin girih tessellatsiya p6m          → girih · tessellatsiya · p6m panjara
Samarqand 2026                         → shu matnga xos noyob naqsh
```

## 2. «AI erkin tasvir» (Nano Banana) — API kalit kerak

Google Gemini orqali **badiiy tasvir** chizadi (vektor emas, PNG rasm).
Ikki xil ulanish usuli bor:

### A) To'g'ridan-to'g'ri — tez, 1 daqiqa

1. <https://aistudio.google.com/apikey> → **Create API key**
2. Ilovada: Chat → **⚙ AI sozlash** → **To'g'ridan** → kalitni joylashtiring → **Saqlash**

Tayyor. Kalit faqat **shu qurilmaning** `localStorage` ida saqlanadi va
so'rov brauzerdan to'g'ridan Google'ga ketadi.

> ### «Limit tugadi» / 429 xatosi — nima uchun yangi kalitda ham chiqadi
>
> Rasm chizadigan modellar (`gemini-2.5-flash-image` va o'xshashlari)
> Google'ning **bepul rejasiga kirmaydi**. Yangi kalit olganda kvota
> nolga teng bo'ladi va Google darhol `429 RESOURCE_EXHAUSTED` qaytaradi —
> kutish yordam bermaydi. Yechim:
>
> 1. <https://aistudio.google.com/apikey> — kalit qaysi Google Cloud
>    loyihasiga tegishli ekanini ko'ring;
> 2. <https://console.cloud.google.com/billing> — o'sha loyihaga to'lov
>    usulini ulang (rasm chizish soatiga sentlar turadi);
> 3. yoki **⚙ AI sozlash → Model** da bepul rejada mavjud boshqa modelni sinang.
>
> Agar 429 **haqiqiy tezlik chegarasi** bo'lsa (daqiqasiga so'rov soni),
> ilova boshqa xabar ko'rsatadi va bir-ikki daqiqadan so'ng qayta urinish kifoya.
>
> **«Aniq naqsh» rejimi bepul, cheksiz va kalitsiz ishlaydi** — sanoat
> eksporti ham faqat shu rejim natijasidan chiqadi.

> ⚠️ **Diqqat:** saytni ommaga ochsangiz, kalitni sahifa manbasidan
> ko'rish mumkin emas (u sizning brauzeringizda), lekin **sizning**
> brauzeringizdan yuborilgan so'rovlar **sizning** kvotangizdan yechiladi.
> Ommaviy sayt uchun quyidagi (B) usulni tanlang.
> Har holda Google Cloud'da kalitga **sarf chegarasi** qo'ying.

### B) Proksi-server (Cloudflare Worker) — ommaviy sayt uchun to'g'ri yechim

Kalit serverda qoladi, brauzerga umuman tushmaydi.

**1-qadam.** <https://dash.cloudflare.com> → **Workers & Pages** → **Create Worker**.
Quyidagi kodni qo'ying:

```js
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST')
      return new Response(JSON.stringify({ error: 'Faqat POST' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

    // oddiy himoya: ilova tokeni
    if (env.APP_TOKEN && request.headers.get('X-App-Token') !== env.APP_TOKEN)
      return new Response(JSON.stringify({ error: 'Ruxsat yo\'q' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    let prompt = '';
    try { prompt = (await request.json()).prompt || ''; } catch (e) {}
    if (!prompt.trim())
      return new Response(JSON.stringify({ error: 'Matn bo\'sh' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const model = env.MODEL || 'gemini-2.5-flash-image';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    if (!r.ok)
      return new Response(JSON.stringify({ error: data?.error?.message || `HTTP ${r.status}` }),
        { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });

    // birinchi rasmni ajratib olamiz
    let image = null, mime = 'image/png';
    for (const c of data.candidates || []) {
      for (const p of c?.content?.parts || []) {
        const inl = p.inlineData || p.inline_data;
        if (inl?.data) { image = inl.data; mime = inl.mimeType || inl.mime_type || mime; break; }
      }
      if (image) break;
    }
    if (!image)
      return new Response(JSON.stringify({ error: 'Javobda rasm topilmadi' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ image, mime }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
```

**2-qadam.** Worker → **Settings → Variables** da qo'shing:

| Nom | Qiymat | Turi |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio kalitingiz | **Secret** (Encrypt) |
| `APP_TOKEN` | O'zingiz o'ylab topgan maxfiy so'z | **Secret** (Encrypt) |
| `ALLOWED_ORIGIN` | Sayt manzilingiz, masalan `https://siz.github.io` | Text |
| `MODEL` | `gemini-2.5-flash-image` (ixtiyoriy) | Text |

**3-qadam.** Ilovada: **⚙ AI sozlash** → **Proksi-server** → Worker URL va
APP_TOKEN ni kiriting → **Saqlash**.

## Xato xabarlari

Ilova avval tushunarli xabar beradi, ostida esa **«Google javobi (texnik)»**
bo'limi bo'ladi — uni ochsangiz Google'ning o'z matnini ko'rasiz
(to'liq log brauzer konsolida ham qoladi):

| Holat | Xabar |
|---|---|
| Kalit noto'g'ri | «API kalit noto'g'ri — tekshirib qayta kiriting» |
| Model nomi xato | «Model topilmadi — «Model» maydonidagi nomni tekshiring» |
| Tezlik chegarasi | «So'rovlar chegarasi — 1–2 daqiqadan so'ng qayta urining» |
| Bepul rejada model yo'q | «Bu model bepul rejada mavjud emas — to'lov (billing) yoqilishi kerak» + qadamma-qadam yo'riqnoma |
| Model matn qaytardi | «Model rasm o'rniga matn qaytardi: …» |
| Internet yo'q | «Serverga ulanib bo'lmadi — internetni tekshiring» |

## Sinov holati

**Tekshirilgan** (mock server bilan, brauzerda):
- so'rov manzili, `x-goog-api-key` sarlavhasi va `{contents:[{parts:[{text}]}]}` tanasi
- javobdan rasm ajratib olish (`candidates[].content.parts[].inlineData`)
- Worker javob formati (`{image, mime}`) ham qo'llab-quvvatlanishi
- 4 xato yo'li (400 / 404 / 429 / matn javobi) va ularning xabarlari
- rasmni yuklab olish
- «Aniq naqsh» rejimi — kalitsiz ishlashi va matn tahlili

**Tekshirilmagan:** haqiqiy Google API chaqiruvi — bu ishlab chiqish
muhitidan tashqi tarmoqqa chiqish yopiq. So'rov/javob shakli Google
hujjatlariga muvofiq yozilgan; agar model nomi kelajakda o'zgarsa,
**⚙ AI sozlash → Model** maydonidan yangisini kiritish kifoya
(kodni o'zgartirish shart emas).
