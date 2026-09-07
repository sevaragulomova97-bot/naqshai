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
