# نوا سرور منیجر

پنل مدیریت و دیپلوی فارسی برای سرورهای Ubuntu؛ با FastAPI، Docker، Nginx و رابط حرفه‌ای Next.js و RTL.

نسخهٔ فعلی: **3.1.0**

## تغییرات نسخهٔ 3.1.0

- بازطراحی مجدد رابط بر اساس داشبورد Command Center با هدر سه‌بعدی اختصاصی، کارت‌های منابع، سایدبار و صفحات عملیاتی یکپارچه
- اتصال اختیاری PostgreSQL و MongoDB از سرورهای دیگر با IP/CIDR مجاز و قوانین فایروال `DOCKER-USER`
- نمایش Remote Host، Remote Port و Connection URI آمادهٔ کپی برای دیتابیس
- ساخت بکاپ فوری برای سرویس انتخابی و مقصد سرور یا تلگرام
- ویرایش، توقف موقت، ادامه و حذف زمان‌بندی‌های بکاپ از داخل رابط
- فهرست حرفه‌ای سرویس‌ها با فیلتر، جست‌وجو و نمایش زندهٔ CPU، RAM و Disk I/O هر کانتینر
- اتصال چند دامنه به هر اپ، پشتیبانی از الگوی A، CNAME و Wildcard و گواهی مستقل Let’s Encrypt برای هر دامنه
- فایل‌منیجر کامل با آپلود، دانلود، کپی، انتقال، تغییر نام، حذف، ساخت پوشه/فایل، فشرده‌سازی و استخراج امن ZIP
- ویرایشگر کد حرفه‌ای CodeMirror با شماره خطوط، Syntax Highlighting، جست‌وجو و پشتیبانی از فایل‌های رایج
- نمایش کامل مشخصات PostgreSQL و MongoDB، URI میزبان/داخلی، SSH Tunnel و volume دائمی
- پنل جانبی Adminer برای PostgreSQL و Mongo Express برای MongoDB با دسترسی احراز هویت‌شده
- صفحات یکپارچهٔ دامنه‌ها، مسیرهای ذخیره‌سازی و پورت‌ها/مسیریابی
- رفع خطای `mkdir /root/.docker: read-only file system` با مسیر Docker config اختصاصی و قابل‌نوشتن
- نصب‌کننده و به‌روزرسان انگلیسی با Health Check، گزارش خطا و Rollback خودکار

## امکانات

- داشبورد حرفه‌ای و واکنش‌گرا با Next.js، مناسب دسکتاپ و موبایل
- نمایش زندهٔ CPU، RAM، دیسک، فضای آزاد، uptime و وضعیت Docker
- ساخت و دیپلوی Next.js، Node.js، Django، FastAPI، Flask، PHP و سایت استاتیک
- ساخت PostgreSQL و MongoDB با volume دائمی و رمز تصادفی
- فعال‌سازی کنترل‌شدهٔ دسترسی خارجی دیتابیس فقط برای IP/CIDRهای مجاز
- اجرای Docker Image دلخواه
- آپلود ZIP با درصد پیشرفت، سرعت، حجم منتقل‌شده، حجم باقی‌مانده و زمان تقریبی
- نمایش نتیجهٔ آپلود، تعداد فایل‌های استخراج‌شده، حجم نهایی سورس و تاریخچهٔ ماندگار آپلودها
- فایل‌منیجر کامل و ویرایشگر کد آنلاین با Syntax Highlighting
- تاریخچهٔ دیپلوی با مرحله، درصد پیشرفت، زمان و نتیجهٔ هر عملیات
- اعتبارسنجی سورس پیش از Build و بررسی Running ماندن کانتینر پس از دیپلوی
- جلوگیری از دیپلوی/آپلود هم‌زمان تکراری و بازیابی وضعیت عملیات قطع‌شده پس از Restart پنل
- جایگزینی اتمیک سورس هنگام Upload و Restore برای حفظ نسخهٔ قبلی در صورت خطا
- Start، Stop، Restart، Build مجدد و مشاهدهٔ لاگ کانتینر
- کنسول اجرای فرمان داخل کانتینر هر برنامه (بدون Shell مستقیم میزبان)
- اتصال هم‌زمان چند دامنه به هر اپ، Reverse Proxy در Nginx و SSL رایگان Let’s Encrypt
- بکاپ سورس و dump دیتابیس روی سرور
- ارسال بکاپ به ربات تلگرام و تست اتصال
- زمان‌بندی بکاپ با دقیقه/ساعت/روز و سیاست نگه‌داری
- ویرایش، توقف، ادامه و حذف برنامه‌های زمان‌بندی بکاپ
- دانلود، حذف و Restore بکاپ و دیپلوی دوباره
- راه‌اندازی اولیهٔ مدیر، نشست HttpOnly و رمزنگاری توکن ربات
- گزارش فعالیت و امکان ری‌استارت/خاموش‌کردن سرور با تأیید دومرحله‌ای
- نصب‌کنندهٔ ترمینالی انگلیسی با Progress، فایل لاگ، Health Check و Rollback خودکار آپدیت

## نیازمندی سرور

- Ubuntu Server 22.04 یا 24.04
- حداقل 2 GB RAM و 20 GB دیسک (برای Build پروژه‌های Next.js بهتر است 4 GB RAM باشد)
- دسترسی `root` یا `sudo`
- یک رکورد A اصلی یا Wildcard و در صورت نیاز رکوردهای CNAME برای دامنه‌های اپ‌ها
- باز بودن پورت‌های 22، 80 و 443

## نصب

### نصب مستقیم از GitHub Release

بعد از انتشار فایل `nova-server-manager.tar.gz` در آخرین Release مخزن، این دستور کل پنل را نصب می‌کند:

```bash
NOVA_TMP="$(mktemp -d)" \
&& curl -fsSL "https://github.com/amirrezanp/nova-server-manager/releases/latest/download/nova-server-manager.tar.gz" \
| tar -xz -C "$NOVA_TMP" \
&& sudo bash "$NOVA_TMP/install.sh"
```

نصب‌کننده یک رابط ترمینالی مرحله‌بندی‌شده و کاملاً انگلیسی نمایش می‌دهد. خروجی کامل عملیات نیز برای عیب‌یابی در
`/var/log/nova-server-manager-install.log` ذخیره می‌شود.

پوشهٔ پروژه را روی سرور کپی و فقط این دستور را اجرا کنید:

```bash
cd nova-server-manager && sudo bash install.sh
```

نصب با دامنه و HTTPS در همان یک دستور:

```bash
sudo NOVA_DOMAIN=panel.example.com NOVA_EMAIL=admin@example.com bash install.sh
```

اسکریپت، Python، Docker، Nginx و Certbot را نصب می‌کند، سرویس systemd می‌سازد و پنل را پشت Nginx روی پورت 80/443 قرار می‌دهد. پس از پایان، آدرس نمایش‌داده‌شده را باز و حساب مدیر اولیه را ایجاد کنید.

برای تبدیل نصب به دستور `curl`، پروژه را در GitHub/GitLab منتشر کنید و از archive نسخه استفاده کنید:

```bash
curl -fsSL https://example.com/nova.tar.gz -o /tmp/nova.tar.gz \
  && sudo mkdir -p /tmp/nova-install \
  && sudo tar -xzf /tmp/nova.tar.gz -C /tmp/nova-install --strip-components=1 \
  && cd /tmp/nova-install && sudo NOVA_DOMAIN=panel.example.com NOVA_EMAIL=admin@example.com bash install.sh
```

آدرس `example.com` را با آدرس Release خودتان جایگزین کنید.

## اولین دیپلوی

1. از بخش «برنامه‌ها»، «برنامه جدید» را بزنید.
2. نوع برنامه و پورت داخلی را انتخاب کنید.
3. فایل ZIP پروژه را آپلود کنید. فایل‌های پروژه می‌توانند داخل یک پوشهٔ اصلی ZIP باشند.
4. در صورت نیاز دستور اجرا و متغیرهای محیطی را وارد کنید.
5. «دیپلوی» را بزنید و نتیجه را در تب «لاگ‌ها» ببینید.
6. رکورد DNS را مطابق راهنمای تب «دامنه» تنظیم و سپس HTTPS را فعال کنید.

## چند دامنه روی یک IP

برای میزبانی ده‌ها اپ به چند IP نیاز ندارید. همهٔ دامنه‌ها می‌توانند به یک IP برسند و Nginx با استفاده از نام
دامنه (`Host`) درخواست را به کانتینر درست هدایت می‌کند. سه الگوی پشتیبانی‌شده:

```text
# روش مستقیم؛ تکرار یک IP در چند رکورد A کاملاً معتبر است
app1.example.com    A       203.0.113.10
app2.example.com    A       203.0.113.10

# روش CNAME پیشنهادی برای مدیریت ساده‌تر
server.example.com  A       203.0.113.10
app1.example.com    CNAME   server.example.com
app2.example.com    CNAME   server.example.com

# روش Wildcard برای زیردامنه‌های متعدد
*.apps.example.com  A       203.0.113.10
```

دامنهٔ ریشه مثل `example.com` معمولاً نمی‌تواند CNAME استاندارد داشته باشد؛ برای آن از A/AAAA یا قابلیت
ALIAS/ANAME/CNAME Flattening سرویس DNS استفاده کنید. بعد از تنظیم DNS، هر دامنه را در صفحهٔ اپ اضافه کنید.
نوا برای هر دامنه فایل Nginx و گواهی مستقل می‌سازد؛ بنابراین خرابی صدور SSL یک دامنه روی دامنه‌های دیگر اثر ندارد.

## اتصال دیتابیس از سرور دیگر

دیتابیس‌ها در حالت پیش‌فرض فقط روی `127.0.0.1` منتشر می‌شوند. در صفحهٔ دیتابیس، قسمت «اتصال از سرورهای دیگر»
را باز کنید، IP سرورهای مجاز را به‌شکل `203.0.113.25` یا CIDR مانند `198.51.100.0/24` وارد و دسترسی را فعال کنید.
نوا کانتینر را با همان volume دائمی بازسازی می‌کند، پورت را روی میزبان منتشر می‌کند و در زنجیرهٔ
`DOCKER-USER` تمام IPهای خارج از فهرست را مسدود می‌کند. بازکردن `0.0.0.0/0` مجاز نیست.

اگر شرکت ارائه‌دهندهٔ VPS دارای Cloud Firewall یا Security Group است، همان پورت و IPهای مجاز را آنجا نیز
تعریف کنید. مشخصات Host، Port، نام دیتابیس، نام کاربری، رمز عبور و Connection URI در همان صفحه نمایش داده می‌شوند.

### پیش‌فرض فریم‌ورک‌ها

| نوع | پورت | دستور پیش‌فرض |
|---|---:|---|
| Next.js | 3000 | `npm start` |
| Node.js | 3000 | `npm start` |
| Django | 8000 | `gunicorn config.wsgi:application --bind 0.0.0.0:8000` |
| FastAPI | 8000 | `uvicorn main:app --host 0.0.0.0 --port 8000` |
| Flask | 8000 | `gunicorn --bind 0.0.0.0:8000 app:app` |
| PHP | 80 | Apache |
| Static | 80 | Nginx |
| PostgreSQL | 5432 | Image رسمی |
| MongoDB | 27017 | Image رسمی |

اگر نام ماژول Django یا FastAPI متفاوت است، دستور اجرا را هنگام ساخت برنامه عوض کنید. اگر پروژه `Dockerfile` داشته باشد، همان فایل به جای Dockerfile تولیدی نوا استفاده می‌شود.

## بکاپ تلگرام

1. با `@BotFather` ربات بسازید و Token بگیرید.
2. یک پیام به ربات خودتان بفرستید.
3. Token و Chat ID عددی مدیر را در «بکاپ‌ها ← تنظیم اتصال» وارد کنید.
4. «تست ارسال» را بزنید.
5. یک زمان‌بندی با مقصد «تلگرام» بسازید.

محدودیت ارسال مستقیم در این نسخه 49 MB است. بکاپ بزرگ همچنان روی سرور ساخته می‌شود و وضعیت خطا در پنل ثبت خواهد شد.

## نگه‌داری

```bash
# وضعیت سرویس
sudo systemctl status nova-server-manager

# لاگ پنل
sudo journalctl -u nova-server-manager -f

# ری‌استارت پنل (نه کل سرور)
sudo systemctl restart nova-server-manager

# بررسی تمدید SSL
sudo certbot renew --dry-run
```

برای آپدیت، نسخهٔ جدید را Extract و از همان پوشه اجرا کنید:

```bash
sudo bash update.sh
```

برای آپدیت مستقیم از آخرین GitHub Release:

```bash
NOVA_TMP="$(mktemp -d)" \
&& curl -fsSL "https://github.com/amirrezanp/nova-server-manager/releases/latest/download/nova-server-manager.tar.gz" \
| tar -xz -C "$NOVA_TMP" \
&& sudo bash "$NOVA_TMP/update.sh"
```

فایل دیتابیس پنل و اطلاعات برنامه‌ها در `/var/lib/nova-server-manager` نگه‌داری می‌شوند و به‌روزرسانی آن‌ها را حذف نمی‌کند.
پیش از هر آپدیت نیز یک Snapshot از دیتابیس در `/var/lib/nova-server-manager/update-snapshots` ساخته می‌شود.
آپدیت‌کننده پیش از جایگزینی فایل‌ها یک Snapshot بازیابی می‌سازد و اگر Health Check نسخه جدید ناموفق باشد،
کد و دیتابیس قبلی را به‌صورت خودکار برمی‌گرداند. گزارش کامل در
`/var/log/nova-server-manager-update.log` قرار می‌گیرد.

## توسعهٔ رابط Next.js

برای تغییر رابط کاربری، Node.js نسخهٔ 20.9 یا جدیدتر لازم است:

```powershell
cd frontend
npm install
npm run dev
```

رابط توسعه روی `http://localhost:3000` اجرا می‌شود و درخواست‌های API را باید به بک‌اند محلی متصل کنید. قبل از انتشار، خروجی استاتیک Next.js را داخل برنامهٔ Python بسازید:

```powershell
cd frontend
npm run lint
npm run build:python
```

دستور آخر پوشهٔ `app/static` را با خروجی جدید جایگزین می‌کند؛ بنابراین سرور برای اجرای پنل به Node.js نیاز ندارد.

## اجرای بک‌اند روی Windows

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\run-dev.ps1
```

سپس `http://127.0.0.1:8787` را باز کنید. امکانات Docker، Nginx، دامنه و کنترل سیستم فقط در Ubuntu کامل هستند.

## امنیت

- پنل با دسترسی root اجرا می‌شود چون Docker، Nginx و کنترل سرویس سیستم را مدیریت می‌کند؛ فقط مدیر قابل اعتماد باید حساب داشته باشد.
- پنل Uvicorn فقط روی `127.0.0.1` گوش می‌دهد و Nginx ورودی عمومی است.
- بدون HTTPS رمز عبور را روی اینترنت وارد نکنید.
- فایل `.env` باید permission برابر 600 داشته باشد.
- توکن تلگرام با کلیدی مشتق‌شده از `NOVA_SECRET_KEY` رمز می‌شود.
- پورت دیتابیس‌ها فقط روی `127.0.0.1` publish می‌شود و همهٔ کانتینرها عضو شبکهٔ خصوصی `nova-network` هستند؛ نام میزبان دیتابیس، نام کانتینر مثل `nova-my-db` است.
- از خود پوشهٔ `/var/lib/nova-server-manager` نیز به‌صورت خارج از سرور بکاپ دوره‌ای بگیرید.

## API و سلامت

- مستندات API بعد از ورود: `/api/docs`
- Health check: `/api/health`
- نسخه: `3.1.0`
