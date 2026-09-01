-- ============================================================
-- M5 · תיקון מפתחות שנשברים עם מותג שני
-- ⚠ שינוי מפתחות על טבלאות קיימות. להריץ בנפרד מ-M4,
--   ורק אחרי ש-M4 אומת.
-- ============================================================

-- ── shop_coupons.code הוא UNIQUE גלובלי ───────────────────
-- כרגע 'SHABBAT10' יכול להיות שייך רק לאחד משני המותגים.
-- upper() כדי שהייחודיות תהיה חסינה לאותיות, כמו הקוד שכבר
-- עושה code.trim().toUpperCase() בשני מקומות.
ALTER TABLE shop_coupons DROP CONSTRAINT IF EXISTS shop_coupons_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS shop_coupons_brand_code_key
  ON shop_coupons (brand_id, upper(code));

-- ── store_settings.key הוא PK גלובלי ──────────────────────
-- כתובת האיסוף של טעמא הייתה מופיעה גם באתר החלבי.
ALTER TABLE store_settings DROP CONSTRAINT IF EXISTS store_settings_pkey;
ALTER TABLE store_settings ADD PRIMARY KEY (brand_id, key);

-- ── אימות ─────────────────────────────────────────────────
--  \d shop_coupons
--  \d store_settings

-- ── נעילת brand_id (הועבר לכאן מ-M4) ──────────────────────
-- להריץ רק אחרי שהקוד מספק brand_id בכל ה-inserts.
ALTER TABLE shop_products   ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE shop_events     ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE shop_orders     ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE shop_coupons    ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE shop_promotions ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE store_settings  ALTER COLUMN brand_id SET NOT NULL;
