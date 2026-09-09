# NaqshAI — autentifikatsiyani ishga tushirish (Supabase)

Ilova **ikki rejimda** ishlaydi:

| Rejim | Qachon | Nima ishlaydi |
|---|---|---|
| **Lokal (demo)** | Server sozlanmagan | Ro'yxatdan o'tish/kirish faqat **shu brauzerda**. Admin panel, Google, parol tiklash **yo'q**. |
| **Supabase (production)** | URL + anon kalit kiritilgan | Haqiqiy database, bcrypt parol, Google OAuth, rollar, status, parol tiklash, email tasdiqlash, admin panel, audit log. |

Ilova server sozlanmagan bo'lsa ham **ishlashda davom etadi** — shunchaki demo rejimida.

---

## 1. Supabase loyihasini yaratish (~5 daqiqa)

1. <https://supabase.com> da bepul hisob oching → **New project**.
2. Loyiha yaratilgach **SQL Editor** ni oching.
3. Shu papkadagi **`schema.sql`** faylini to'liq nusxalab qo'ying va **Run** bosing.
   Fayl idempotent — qayta ishga tushirsangiz ham xato bermaydi.

Bu quyidagilarni yaratadi:

- `profiles` — foydalanuvchi profillari (ism, familiya, rol, status, provider…)
- `auth_events` — audit log (kirish, chiqish, bloklash, rol o'zgarishi…)
- `patterns` — foydalanuvchi saqlagan naqshlar
- RLS siyosatlari, triggerlar va `admin_stats()` funksiyasi

> **Parol xeshlari `profiles` da saqlanmaydi.** Ularni Supabase o'zining
> `auth.users` jadvalida **bcrypt** bilan boshqaradi — biz parolni hech qachon ko'rmaymiz.
> Shuning uchun `password_hash` ustuni ataylab yaratilmagan.

## 2. Ilovani serverga ulash

**Settings → API** bo'limidan ikkita qiymatni oling:

| Supabase'dagi nomi | Bu yerda |
|---|---|
| `Project URL` | `https://xxxx.supabase.co` |
| `anon` `public` | `eyJhbGciOi…` |

Keyin ikkitadan birini tanlang:

**A) Ilova ichidan (tez):** Ilovada `👤 Kirish` → `⚙ Server sozlash (Supabase)` → ikkala qiymatni kiriting → **Saqlash**.
Qiymatlar `localStorage` da saqlanadi (har bir qurilmada bir marta).

**B) Kodga yozib qo'yish (barcha foydalanuvchilar uchun):** `index.html` ichida:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

> `anon` kaliti **maxfiy emas** — u brauzerga chiqarilishi Supabase arxitekturasida normal.
> Haqiqiy himoya serverdagi **RLS** qoidalari bilan. `service_role` kalitini esa
> **hech qachon** frontend kodiga yozmang va GitHub'ga commit qilmang.

## 3. Google orqali kirishni yoqish

1. Supabase → **Authentication → Providers → Google** → yoqing.
2. Google Cloud Console → **APIs & Services → Credentials** →
   **Create Credentials → OAuth client ID → Web application**.
3. **Authorized redirect URI** ga Supabase ko'rsatgan manzilni qo'shing:
   `https://xxxx.supabase.co/auth/v1/callback`
4. Olingan **Client ID** va **Client Secret** ni Supabase'dagi Google provider
   maydonlariga joylashtiring.
5. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: sayt manzilingiz (masalan `https://foydalanuvchi.github.io/naqshai/`)
   - **Redirect URLs**: development va production manzillarini qo'shing.

> Client **Secret** faqat Supabase tomonida saqlanadi — ilova kodiga tushmaydi.

### Hisoblarni bog'lash (account linking)
Supabase bitta email uchun bitta `auth.users` yozuvini kafolatlaydi.
Agar foydalanuvchi avval email/parol bilan ro'yxatdan o'tgan bo'lsa va keyin
o'sha email bilan Google orqali kirsa, Supabase Dashboard'dagi
**Authentication → Settings → "Link accounts with the same email"** sozlamasini
yoqib qo'ying — shunda dublikat hisob yaratilmaydi.

## 4. Birinchi administratorni tayinlash

Odatdagidek ro'yxatdan o'ting, so'ng **SQL Editor** da:

```sql
update public.profiles
set role = 'super_admin'
where lower(email) = lower('siz@pochta.uz');
```

Endi profilingizda **🛡 Foydalanuvchilarni boshqarish** tugmasi paydo bo'ladi.

## 5. Email tasdiqlash

Supabase → **Authentication → Providers → Email** → *Confirm email* yoqilgan bo'lsa,
ro'yxatdan o'tgan foydalanuvchi «Email manzilingizni tasdiqlang» xabarini oladi va
havolani bosmaguncha kira olmaydi. Bepul rejadagi jo'natish limiti past —
production uchun **Settings → Authentication → SMTP** orqali o'z SMTP'ingizni ulang.

---

## Rollar va status

**Rollar:** `user` · `researcher` · `teacher` · `admin` · `super_admin`
**Status:** `active` · `blocked` · `pending` · `deactivated`

- `admin` va `super_admin` — admin panelga kira oladi.
- `super_admin` rolini faqat `super_admin` bera/olib qo'ya oladi.
- `blocked` yoki `deactivated` foydalanuvchi kirgan zahoti tizimdan chiqariladi.

**Muhim:** bu tekshiruvlar frontendda *ham* bor, lekin haqiqiy himoya — serverda:
`schema.sql` dagi RLS siyosatlari va `protect_privileged_columns` triggeri.
Oddiy foydalanuvchi to'g'ridan-to'g'ri API ga so'rov yuborsa ham server rad etadi.

## Xavfsizlik — nima qilingan, nima sizning zimmangizda

**Ilovada bajarilgan:**
- Parol xeshi (bcrypt) — Supabase tomonida, biz parolni ko'rmaymiz
- Server tomonidagi avtorizatsiya (RLS) — frontendga ishonilmaydi
- Rol/status ustunlarini himoyalovchi trigger
- Kirish xatolarida hisob bor-yo'qligini oshkor qilmaydigan umumiy xabar
- Parol tiklashda ham email mavjudligi oshkor qilinmaydi
- XSS: barcha foydalanuvchi matni `escHTML()` orqali chiqariladi
- SQL injection: Supabase klienti parametrlangan so'rovlar ishlatadi
- Texnik xatolar foydalanuvchiga ko'rsatilmaydi (faqat konsolga)
- Audit log: `auth_events` jadvali

**Supabase Dashboard'da siz yoqishingiz kerak:**
- **Rate limiting / brute-force** — Authentication → Rate Limits
- **SMTP** — ishonchli email yetkazish uchun
- **Session muddati** — Authentication → Sessions
- **HTTPS** — GitHub Pages / hostingingiz avtomatik beradi

> Token `localStorage` da saqlanadi (statik saytda HttpOnly cookie imkonsiz —
> buning uchun alohida backend kerak bo'lardi). Bu SPA'lar uchun standart
> yondashuv; XSS'dan himoya shuning uchun muhim.

## Lokalda ishga tushirish

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

`file://` orqali ochmang — OAuth va ba'zi brauzer API'lari ishlamaydi.
Supabase → **URL Configuration → Redirect URLs** ga `http://localhost:8000` ni qo'shing.

## Productionga chiqarish

Loyiha — bitta statik `index.html`. Build talab qilinmaydi.

- **GitHub Pages:** Settings → Pages → Source: branch tanlang. Sayt
  `https://<foydalanuvchi>.github.io/naqshai/` da ochiladi.
- Supabase → **URL Configuration** ga shu manzilni **Site URL** va
  **Redirect URLs** sifatida qo'shing.

## Environment variables

Bu loyihada `.env` fayli **ishlatilmaydi** — statik sayt uchun build bosqichi yo'q.
Faqat ikkita ochiq qiymat kerak (yuqoridagi 2-bo'limga qarang):

| Qiymat | Maxfiymi | Qayerda |
|---|---|---|
| `SUPABASE_URL` | yo'q | `index.html` yoki ilova sozlamalari |
| `SUPABASE_ANON_KEY` | yo'q | `index.html` yoki ilova sozlamalari |
| `service_role` kaliti | **HA** | Faqat Supabase Dashboard'da qoladi |
| Google Client Secret | **HA** | Faqat Supabase Dashboard'da qoladi |

## Boshqa foydalanuvchilar uchun ishlashi

Database **ko'p foydalanuvchili**: har kim ro'yxatdan o'tadi va faqat o'z
naqshlarini ko'radi (RLS: `user_id = auth.uid()`).

> ⚠️ **Eng muhim shart.** Supabase manzili va kaliti ikki joydan o'qiladi:
> avval brauzerdagi `localStorage`, keyin `index.html` dagi doimiylar.
> Agar siz ularni faqat **⚙ Server sozlash** oynasidan kiritsangiz, bu
> faqat SIZNING brauzeringizga yoziladi — saytga kirgan boshqa odamlarda
> server ulanmaydi va ular lokal rejimda qoladi.
>
> Hamma uchun ishlashi uchun `index.html` ichidagi ikki qatorga yozing:
>
> ```js
> const SUPABASE_URL = 'https://xxxx.supabase.co';
> const SUPABASE_ANON_KEY = 'eyJhbGciOi...';   // "anon public"
> ```
>
> `anon` kaliti maxfiy emas — u brauzerga chiqarilishi Supabase
> arxitekturasida normal, himoya RLS orqali serverda. `service_role`
> kalitini esa hech qachon bu yerga yozmang.

### Sig'im

Bitta saqlangan naqsh ≈ **11 KB** (ko'rinish rasmi JPEG 0.85 + parametrlar).
Bir foydalanuvchida eng ko'pi 48 ta → ~0.5 MB.

| Reja | Hajm | Taxminan |
|---|---|---|
| Bepul | 500 MB | ~**975** to'la foydalanuvchi (48 tadan) |
| Pro ($25/oy) | 8 GB | ~15 000 |

Amalda ko'pchilik 48 tagacha yetmaydi, shuning uchun bepul rejada bir
necha ming foydalanuvchi bemalol sig'adi. Oylik faol foydalanuvchi
chegarasi bepul rejada 50 000.

## Naqshlar hisobda saqlanishi

Supabase ulanganda va foydalanuvchi kirgan bo'lsa, saqlangan naqshlar
`public.patterns` jadvaliga yoziladi — ya'ni ular **boshqa qurilmada ham**
ochiladi. Server sozlanmagan yoki mehmon bo'lsa — faqat shu brauzerda
(`localStorage`).

| Holat | Naqshlar qayerda |
|---|---|
| Mehmon | shu brauzerda |
| Lokal rejim (server sozlanmagan) | shu brauzerda |
| Supabase + kirgan | **hisobda (bulutda)** |

Yon paneldagi profil kartasi va profil oynasi buni ochiq yozib turadi,
shuning uchun foydalanuvchi naqshlari qayerda ekanini har doim biladi.

**Mehmon naqshlari yo'qolmaydi:** birinchi marta kirganda ular avtomatik
hisobga ko'chiriladi va lokal ro'yxat tozalanadi.

Xavfsizlik serverda: RLS siyosati
`user_id = auth.uid() and public.is_active()` shartini qo'yadi — har kim
faqat o'z naqshlarini ko'radi va o'zgartiradi, bloklangan foydalanuvchi
esa hech narsa yoza olmaydi. Mijozdagi tekshiruvlar faqat qulaylik uchun.

### Tekshirilgan oqim

Supabase REST/Auth protokolini taqlid qiluvchi mahalliy server bilan
uchdan-uchgacha sinaldi:

- email orqali ro'yxatdan o'tish → hisobga kirish
- mehmonning 2 ta naqshi hisobga ko'chirildi, lokal ro'yxat tozalandi
- naqsh saqlash → jadvalga yozildi (3 ta), o'chirish → 2 ta qoldi
- Google tugmasi `signInWithOAuth({provider:'google'})` ni to'g'ri
  `redirectTo` bilan chaqiradi
- **boshqa brauzer kontekstida** (yangi "qurilma") kirishdan oldin 0 ta
  naqsh, kirgandan keyin 2 tasi bulutdan yuklandi
- 0 JS xato

