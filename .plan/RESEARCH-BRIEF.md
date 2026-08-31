# מחקר גולמי — נכון ל-2026-08-31

## אתר א' — טעמא (הריפו הזה, `/Users/mymacbook/Desktop/prsonal/taama`)
- Next.js 16.2.9 (App Router), React 19.2.4, Tailwind v4, Drizzle ORM + postgres-js, Supabase Auth (SSR), web-push, Vercel.
- ~22k שורות ב-src. אין tests. אין drizzle migrations dir — במקום זה סקריפטים ידניים `src/db/migrate_*.ts`.
- 3 route groups: `(shop)` חנות B2C, `(dashboard)` אדמין, ועוד `/orders/[id]/print`, `/client-summary`.
- אימות: Supabase, טבלת `profiles` עם is_approved / is_admin / is_blocked. proxy.ts → utils/supabase/middleware.ts עושה gating לפי prefix של path (hardcoded list).
- מודל נתונים (src/db/schema.ts): ingredients, dishes, dish_ingredients, orders (קייטרינג/אירועים עם תמחור), order_dishes, order_purchases, profiles, shop_events, shop_products, shop_product_variants, shop_product_ingredients, shop_coupons, shop_orders, shop_order_items, shop_promotions, store_settings, saved_shopping_lists(+items), task_categories, tasks, push_subscriptions.
- **אין שום עמודת tenant/brand בשום טבלה.**
- וריאנטים = `size_type` (text) + price + stock_limit. אין option groups / modifiers.
- מבצעים = חבילת כמות לפי קטגוריה (package_qty/package_price), חישוב מוכפל גם ב-cart-context (client) וגם ב-checkout/actions (server).
- אין תשלום אונליין. איסוף עצמי בלבד (pickup_address/pickup_hours ב-store_settings). אין משלוחים בחנות.
- אין הזמנות טלפוניות, אין CRM לקוחות אמיתי, אין B2B.
- theming: `globals.css` — Template A (דשבורד) על `:root`, Template B (חנות) על `.shop-theme`. שתי הפלטות: קרם #faf7f1/#faf8f4, זית עמוק #2f3e30, זהב עתיק #8a6a20 / זהב #cfa43c. הטריק: override של סקאלת zinc/amber של Tailwind ב-CSS vars.
- שמות: "קייטרינג טַעֲמָא — נותנים טעם לאירוע", "טעמא לשבת וחג — מעדניה וקייטרינג ביתי".

## אתר ב' — שמנת מתוקה (https://www.shamenetmetuka.co.il)
- **Next.js Pages Router + tRPC + NextAuth + Vercel + Cloudinary (cloud `dxjjep7rz`) + jQuery + Nagishli (נגישלי).**
- כל העמודים CSR מלא — HTML ריק לגמרי. **אפס תוכן ל-SEO** (title/description ריקים ב-HTML הגולמי). chunk של 3.7MB.
- מיתוג: "שמנת מתוקה — קייטרינג חלבי יוקרתי כשר למהדרין בירושלים". ירושלים. WhatsApp 972583281175. IG/FB @shamenetmetuka.
- עיצוב: DaisyUI+Tailwind, פונטים Heebo + Amatic SC. פלטה: ברונזה/זהב **#b88746** (הכי נפוץ), קרם #fdf8f3/#FDF4E3/#FDF6E8/#f5e9d1, זית #6b8a47/#4a6330, זהב #d4a85c/#8b6530. meta theme-color #16a34a.
  → **הפלטה כמעט זהה לזו של טעמא (זהב+קרם+זית). זו בעיית בידול אמיתית.**
- מפת נתיבים (מ-_buildManifest): `/`, `/about`, `/menu`, `/breakfast`, `/galery`(שגיאת כתיב), `/contact`, `/terms`, `/privacy`, `/account`, `/fonts`, `/auth/google-signin`, `/auth/popup-callback`, `/checkout/cartInspectionPage`, `/checkout/details`, `/checkout/payment`, `/checkout/b2b`, `/checkout/b2b/details`, `/dashboard`, `/dashboard/orders`, `/dashboard/payments`, `/dashboard/products`, `/dashboard/catalog`, `/dashboard/customers`, `/dashboard/customers/[id]`, `/dashboard/messages`, `/dashboard/phone-orders`, `/dashboard/breakfast`, `/dashboard/breakfast/combos`, `/dashboard/breakfast/options`, `/dashboard/breakfast/orders`, `/dashboard/breakfast/phone-orders`.
- `/menu` ו-`/breakfast` מציגים מודאל **"האתר נמצא כרגע בבניה"** → הליבה המסחרית לא באמת חיה.
- קטגוריות מוצר: מגשי אירוח, קישים, סלטים, קינוחים, מאפים (פיצות, לחמניות אישיות, פוקאצ'ות), כריכים (סביח, פריקסה, טורטיות, בורקסים), תוספות חמות (חצילים קלויים, בצל ממולא, אנטיפסטי, פלטת ירקות), שתייה, לחמים, רטבים.
- **מודול ארוחות בוקר = קונפיגורטור רב-שלבי**: "חבילות בוקר" → בחר לחם / בחר רוטב / בחר תוספות, כללי min/max ("יש לבחור לפחות N", "ניתן לבחור עד N", "בחר X מתוך Y"), "העדפות תזונתיות", הערות/אלרגיות. ב-dashboard: `breakfast/combos` + `breakfast/options` → **מודל option-groups/modifiers שאין בטעמא בכלל.**
- **B2B**: "בחר את החברה שלך" / "יש לבחור חברה", מסלול checkout נפרד `/checkout/b2b`. מינימום הזמנה ₪400.
- **חלון הזמנה**: "ניתן להזמין ליום למחרת עד 14:00. לאחר 14:00 נדרשת הזמנה מראש של יומיים." ולידציה: לפחות יומיים קדימה, לא בעבר. → lead-time דינמי, לא cutoff יחיד כמו בטעמא.
- **סטטוסי הזמנה**: בהמתנה → בהכנה → נשלח → נמסר. (טעמא: New/... שונה)
- **משלוחים**: "יעד המשלוח" — יש משלוח, בשונה מטעמא (איסוף בלבד).
- **תשלום**: `/checkout/payment` קיים; מוזכרים "ספקי סליקה ותשלום" בתנאים.
- אימות: אימייל+סיסמה, Google, שכחתי סיסמה, הרשמה (שם פרטי/משפחה/טלפון/אימייל). **NextAuth — לא Supabase.**
- דשבורד: הזמנות, תשלומים, מוצרים, קטלוג, לקוחות (+כרטיס לקוח), הודעות, הזמנות טלפוניות, וכל אלה שוב בנפרד ל-breakfast.
- i18n: יש "שנה שפה" אבל locales=["en"] בלבד — לא ממומש.
- robots.txt חוסם /dashboard/ /checkout/ /api/auth/ /api/trpc/. sitemap.xml סטטי עם 10 עמודים.

## מיפוי מושגי בין השניים
| טעמא | שמנת מתוקה |
|---|---|
| shop_products + variants | products / catalog |
| shop_events (אירוע מכירה לשבת) | אין מקבילה — במקום זה תאריך משלוח + lead time |
| הזמנות לשבת | ארוחות בוקר (breakfast) |
| מגשי אירוח (בשרי) | מגשי אירוח (חלבי) |
| orders (קייטרינג/אירועים) | checkout/b2b + phone-orders |
| shop_promotions (חבילות) | breakfast combos |
| — | option groups / modifiers |
| — | תשלום אונליין |
| — | הזמנות טלפוניות |
| — | CRM לקוחות |
| — | משלוחים |
| ingredients + costing + shopping list | אין |
| tasks / broadcast / push | אין |
