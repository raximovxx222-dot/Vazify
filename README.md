# Vazify — buyurtma qidiruvi

Vazify — ochiq Telegram e’lonlarini va masofaviy ish vakansiyalarini ko‘rsatadigan, Upwork/Fiverr qidiruviga yo‘naltiradigan o‘zbekcha web-interfeys.

## Hozir ishlaydigan imkoniyatlar

- Telegram’ning ochiq web sahifalaridan oxirgi postlarni olish: `freelancery_uz`, `freelanceteam_uz`, `MaxFreelance_uz`
- Arbeitnow’ning ochiq API’sidan masofaviy e’lonlarni ko‘rsatish; har bir natijada asl manba havolasi bor
- Jobicy ochiq API’dagi masofaviy ishlarni Jobicy manbasi va asl e’lon havolasi bilan ko‘rsatish
- Olingan e’lonlarni matn bo‘yicha filtrlash
- E’lonlarni freelance zakaz, ish/vakansiya va aloqasiz post sifatida ajratish
- 30 kundan eski, yopilgan yoki muddati o‘tgan e’lonlarni yashirish; takroriy havola/matnni birlashtirish
- Dizayn, video montaj, matn/SMM, dasturlash, yordamchi ishlar, sotuv yoki boshqa yo‘nalishlar bo‘yicha moslashtiriladigan ko‘nikma filtri
- Jonli e’lonlarni saqlash va ularni keyin “Saqlanganlar” filtridan ko‘rish
- E’lon sarlavhasi qo‘shiladigan javob shablonini tahrirlash, saqlash va nusxalash
- Ruxsat berilganda, sahifa ochiq paytda paydo bo‘lgan yangi mos e’lonlar uchun brauzer bildirishnomasi
- Supabase sozlanganda email/parol orqali kirish va saqlangan e’lonlar, ko‘nikmalar hamda javob shablonini akkaunt bilan sinxronlash
- Tungi/yorug‘ ko‘rinish tanlovi: tizim sozlamasiga moslashadi va qo‘lda tanlov brauzerda saqlanadi
- Kiritilgan kalit so‘z bilan Upwork yoki Fiverr qidiruv sahifasini ochish
- Qayta yuklash tugmasi, manba holatlari va xato xabarlari

## Muhim cheklovlar

Bu loyiha ish topish yoki pul olishni kafolatlamaydi. Telegram natijalari ochiq kanal preview’laridan, Arbeitnow va Jobicy natijalari esa ularning API’laridan olinadi; masofaviy vakansiyalarning hammasi freelance zakaz emas. Har bir listing manba havolasi va atributsiyasi bilan ko‘rsatiladi.

Tasnif matndagi kalit iboralarga asoslangan avtomatik taxmin: `Zakaz + ish` filtri aloqasiz postlarni yashiradi, `Ishga aloqasiz` filtrida ularni ko‘rish mumkin. Ishonchli yakuniy tasnif uchun asl postni tekshiring. 30 kundan eski postlar, yopilgani/ijrochi topilgani yozilgan postlar va o‘tgan muddati bor e’lonlar ko‘rsatilmaydi. Takrorlar bir xil URL yoki normallashtirilgan sarlavha-matn orqali topiladi.

Supabase sozlanmagan bo‘lsa, ko‘nikma tanlovi foydalanuvchi brauzeridagi `localStorage` da saqlanadi; boshqa qurilmaga avtomatik o‘tmaydi. Supabase akkauntida saqlangan e’lonlar, ko‘nikmalar va javob shabloni qurilmalar orasida sinxronlanadi. Moslik e’lon matni yoki ish nomidagi kalit so‘zlar bilan taxminan belgilanadi.

Tungi ko‘rinish sukut bo‘yicha qurilmaning rang sxemasiga moslashadi; header tugmasi bilan o‘zgartirilgan tanlov shu brauzerda eslab qolinadi. Emoji matni iOS/macOS’da tizimdagi `Apple Color Emoji` shriftidan foydalanadi; boshqa operatsion tizimlarda o‘sha qurilmaning emoji shriftiga tushadi. Apple’ning xususiy emoji shrift fayli loyiha ichiga nusxalanmaydi.

Saqlangan e’lonlar va javob shabloni ham shu brauzerda saqlanadi; saqlangan e’lonlar eng ko‘pi bilan 100 ta bo‘ladi. Javob matnini foydalanuvchi tekshirishi va manba platformasida o‘zi yuborishi kerak — Vazify avtomatik ariza topshirmaydi. Brauzer bildirishnomasi ixtiyoriy: foydalanuvchi tugma orqali ruxsat beradi, e’lonlar esa faqat Vazify sahifasi ochiq paytda tekshiriladi. Birinchi yuklashdagi e’lonlar boshlang‘ich ro‘yxat sifatida olinadi va eski natijalar uchun bildirishnoma yuborilmaydi.

`@rakhimov_x21` shaxsiy akkaunt sifatida ishlatilmaydi. Faqat foydalanuvchi ko‘rsatgan ochiq kanallar o‘qiladi; xususiy akkaunt, xususiy xabarlar yoki login ma’lumotlariga kirilmaydi. Manba saytlari mavjudlik, format yoki foydalanish qoidalarini o‘zgartirsa, manba holati xato ko‘rsatishi mumkin. Ochiq manbalardan foydalanishdan oldin tegishli shartlarni tekshiring.

Upwork va Fiverr e’lonlari avtomatik yig‘ilmaydi; qidiruv tugmalari ularning qidiruv sahifasini ochadi. Buning uchun rasmiy API ruxsati/integratsiyasi talab etilishi mumkin. Jobicy ochiq API’si bevosita manba havolasi va atributsiyani talab qiladi; kartalar shu talabga amal qiladi. Remotive e’lonlarini email/akkaunt yig‘ish orqali ko‘rsatishni cheklagani sababli, bu loyiha uchun qo‘shilmadi. Sayt buyurtmachidan haq olmaydi va sizga pul to‘lamaydi; ishga qabul qilish va to‘lov manba platformasidagi mijoz/kelishuvga bog‘liq.

## Ishga tushirish

Python 3.10 yoki yangiroq kerak. Loyiha papkasida:

```powershell
python server.py
```

So‘ng brauzerda `http://127.0.0.1:8000` ni oching. Server localhost’ga bog‘langan va tashqi manbalarni ko‘pi bilan har 10 daqiqada yangilaydi; “Yangilash” tugmasini ketma-ket bosish kamida 60 soniyalik oraliq bilan chegaralangan. Server ishlamayotganda statik UI ko‘rinadi, ammo jonli e’lonlar API’si ishlamaydi.

Ish e’lonlarini olish uchun tashqi Python kutubxonasi/API kaliti talab qilinmaydi.

## Render’da joylash

Repository rootidagi `render.yaml` Render Blueprint deployment sozlamalarini belgilaydi va bepul web service rejasidan foydalanadi. Git repository-ni Render-ga ulang yoki Render-da Blueprint yarating; Supabase sozlanmasa ham sayt ishga tushadi va ma’lumotlar brauzerda saqlanadi. Akkaunt sinxronlashini keyin yoqish uchun Render environment variables-ga `SUPABASE_URL` va `SUPABASE_ANON_KEY` ni kiriting. Render `HOST=0.0.0.0` va `PORT`-ni beradi; lokal ishga tushirish esa `127.0.0.1:8000` manzilida qoladi. Health check `/health` endpointidan foydalanadi.

## Supabase akkauntlari va sinxronlash

1. Supabase’da project yarating.
2. SQL Editor’da `supabase-schema.sql` faylini bajaring. Jadval RLS bilan himoyalangan; foydalanuvchi faqat o‘z qatorini o‘qiydi va o‘zgartiradi.
3. Render xizmatining environment variables qismiga project URL (`SUPABASE_URL`) va public publishable/anon key (`SUPABASE_ANON_KEY`) ni kiriting. **Service-role/secret key’ni hech qachon brauzerga yoki loyiha sozlamalariga qo‘ymang** — frontend faqat RLS bilan cheklangan publishable/anon key’dan foydalanadi.
4. Supabase Auth’da email/password va email tasdiqlash sozlamalarini tanlang. Tasdiqlash yoqilgan bo‘lsa, foydalanuvchi emailiga kelgan havolani bosgandan keyin kiradi.
5. Supabase Auth URL Configuration’da Render saytingiz URL’ini Site URL va redirect allow-list’ga qo‘shing.
6. Saytni Render HTTPS URL’i orqali oching. Supabase sozlanmaganida ma’lumotlar avvalgidek shu brauzerda qoladi; akkauntga kirgach e’lonlar, ko‘nikmalar va javob shabloni sinxronlanadi.

Localhost’da Supabase sinxronlashni sinash uchun PowerShell oynasida haqiqiy project URL va public anon key’ni o‘rnating, so‘ng serverni shu oynada ishga tushiring:

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY"
python server.py
```

`.env.example` faqat o‘zgaruvchi nomlarini ko‘rsatadi; `python server.py` `.env` faylini avtomatik yuklamaydi. `.env` va maxfiy kalitlarni repository’ga qo‘shmang.

Backend testlari:

```powershell
python -m unittest -v test_server
```

## Fayllar

- `index.html` — sahifa tarkibi
- `styles.css` — dizayn va responsiv qoidalar
- `app.js` — qidiruv, filtrlar, jonli natijalarni ko‘rsatish va manba sahifalariga yo‘naltirish
- `server.py` — lokal/Render statik serveri va ochiq manbalarni oluvchi JSON endpoint
- `test_server.py` — Telegram parseri, ochiq API filtri va cache testlari
- `render.yaml` — Render Blueprint deployment sozlamalari
- `supabase-schema.sql` — RLS bilan foydalanuvchi sozlamalari jadvali va siyosatlari
- `assets/vazify-logo.svg` — Vazify wordmark
- `assets/vazify-mark.svg` — ilova belgisi
