-- ============================================================
-- M8 · טבלאות אופציות המקושרות לרכיבים
--
-- הכשל של המנוע הישן היה ש-BreakfastOption נשא שם וסוג בלבד —
-- אין לו קישור לרכיבים ואפילו לא עמודת מחיר, ולכן גם אילו התמלא
-- בנתונים הוא לא היה יודע לומר כמה בטטה לקנות.
-- כאן האופציה נושאת רכיבים, וזה כל ההבדל.
--
-- סיכון: אפס. שלוש טבלאות חדשות, אף טבלה קיימת לא נוגעת.
-- ביטול: DROP TABLE shop_option_ingredients, shop_product_options,
--                   shop_product_option_groups;
-- ============================================================

-- ── קבוצת בחירה: "בחר טעם" ────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_option_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_product_id uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  name            text NOT NULL,
  -- כמה בחירות מותרות. לקיש: בדיוק אחת.
  min_select      integer NOT NULL DEFAULT 1,
  max_select      integer NOT NULL DEFAULT 1,
  is_required     boolean NOT NULL DEFAULT true,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- min=0 מותר (קבוצה אופציונלית), אבל max חייב להיות לפחות 1
  -- ולא קטן מ-min. בלי זה אפשר להגדיר קבוצה שאי אפשר לספק.
  CONSTRAINT option_group_select_range CHECK (
    min_select >= 0 AND max_select >= 1 AND max_select >= min_select
  ),
  CONSTRAINT option_group_required_consistent CHECK (
    NOT is_required OR min_select >= 1
  )
);

CREATE INDEX IF NOT EXISTS option_groups_product_idx
  ON shop_product_option_groups (shop_product_id);

-- ── האופציה עצמה: "בטטה" ──────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES shop_product_option_groups(id) ON DELETE CASCADE,
  name        text NOT NULL,
  -- תוספת מחיר. אפס בכל הקטלוג הנוכחי, קיימת כדי שלא נזדקק
  -- למיגרציה ביום שתגבה תוספת על פטריות.
  price_delta numeric(10,2) NOT NULL DEFAULT 0.00,
  is_active   boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT option_name_unique_in_group UNIQUE (group_id, name)
);

CREATE INDEX IF NOT EXISTS options_group_idx ON shop_product_options (group_id);

-- ── הרכיבים של האופציה, פר גודל ───────────────────────────
-- מקושרת גם לאופציה וגם לווריאנט, כי הכמות תלויה בשתיהן:
--   קיש בטטה · מגש         → 1.5 ק"ג בטטה
--   קיש בטטה · 24 אישיות   → 2.2 ק"ג בטטה
-- קישור לאופציה בלבד היה מאלץ מספר אחד לשני הגדלים.
CREATE TABLE IF NOT EXISTS shop_option_ingredients (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id              uuid NOT NULL REFERENCES shop_product_options(id) ON DELETE CASCADE,
  shop_product_variant_id uuid NOT NULL REFERENCES shop_product_variants(id) ON DELETE CASCADE,
  ingredient_id          uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity               numeric(10,3) NOT NULL DEFAULT 0.000,

  CONSTRAINT option_ingredient_unique UNIQUE (option_id, shop_product_variant_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS option_ingredients_option_idx  ON shop_option_ingredients (option_id);
CREATE INDEX IF NOT EXISTS option_ingredients_variant_idx ON shop_option_ingredients (shop_product_variant_id);

-- ── מה נבחר בפועל בהזמנה ──────────────────────────────────
-- שדות ה-snapshot הם הלקח מהריפו הישן: הזמנה משנה שעברה חייבת
-- להציג מה בדיוק הוזמן, גם אחרי שהקטלוג השתנה או שהאופציה נמחקה.
-- לכן option_id הוא nullable עם ON DELETE SET NULL.
CREATE TABLE IF NOT EXISTS shop_order_item_options (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_order_item_id uuid NOT NULL REFERENCES shop_order_items(id) ON DELETE CASCADE,
  option_id          uuid REFERENCES shop_product_options(id) ON DELETE SET NULL,
  group_name         text NOT NULL,
  option_name        text NOT NULL,
  price_delta        numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_item_options_item_idx
  ON shop_order_item_options (shop_order_item_id);
