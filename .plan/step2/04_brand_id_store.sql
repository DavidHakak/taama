-- ============================================================
-- M4 · brand_id על שכבת החנות
-- בתלת-שלבים כדי שיהיה הפיך בכל נקודה:
--   א. עמודה nullable   ← אין מה להישבר   (M4, כאן)
--   ב. backfill          ← בודקים          (M4, כאן)
--   ג. SET NOT NULL      ← נועלים          (M5, יחד עם הקוד)
--
-- הנעילה הועברה ל-M5 בכוונה: NOT NULL היה מפיל כל insert קיים
-- (placeOrder, createShopProduct, createShopEvent, createShopCoupon,
--  updateStoreSettings) — אף אחד מהם לא מספק brand_id עדיין.
-- ביטול: ALTER TABLE <t> DROP COLUMN brand_id;
-- ============================================================

-- ── א. עמודות nullable ────────────────────────────────────
ALTER TABLE shop_products   ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);
ALTER TABLE shop_events     ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);
ALTER TABLE shop_orders     ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);
ALTER TABLE shop_coupons    ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);
ALTER TABLE shop_promotions ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);
ALTER TABLE store_settings  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brands(id);

-- ── ב. backfill ───────────────────────────────────────────
-- הכל שייך לטעמא, למעט 6 העוגות החלביות שעוברות לשמנת מתוקה.
UPDATE shop_products   SET brand_id = (SELECT id FROM brands WHERE slug='taama') WHERE brand_id IS NULL;
UPDATE shop_events     SET brand_id = (SELECT id FROM brands WHERE slug='taama') WHERE brand_id IS NULL;
UPDATE shop_orders     SET brand_id = (SELECT id FROM brands WHERE slug='taama') WHERE brand_id IS NULL;
UPDATE shop_coupons    SET brand_id = (SELECT id FROM brands WHERE slug='taama') WHERE brand_id IS NULL;
UPDATE shop_promotions SET brand_id = (SELECT id FROM brands WHERE slug='taama') WHERE brand_id IS NULL;
UPDATE store_settings  SET brand_id = (SELECT id FROM brands WHERE slug='taama') WHERE brand_id IS NULL;

-- בוטל 1.9.2026: 6 העוגות החלביות נמכרות בחנות השבת של טעמא ונשארות שם.
-- (ההעברה ל-shamenet בוטלה ואינה רצה.)

-- ── אינדקסים ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS shop_products_brand_idx   ON shop_products   (brand_id);
CREATE INDEX IF NOT EXISTS shop_events_brand_idx     ON shop_events     (brand_id);
CREATE INDEX IF NOT EXISTS shop_orders_brand_idx     ON shop_orders     (brand_id);
CREATE INDEX IF NOT EXISTS shop_coupons_brand_idx    ON shop_coupons    (brand_id);
CREATE INDEX IF NOT EXISTS shop_promotions_brand_idx ON shop_promotions (brand_id);

-- ── אימות ─────────────────────────────────────────────────
--  SELECT b.slug, count(*) FROM shop_products p
--    JOIN brands b ON b.id = p.brand_id GROUP BY b.slug;
--  מצופה:  taama 42
