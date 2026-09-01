-- ============================================================
-- M1 · טבלת המותגים
-- סיכון: אפס. תוספת בלבד, אף טבלה קיימת לא נוגעת.
-- ביטול: DROP TABLE brands;
-- ============================================================

CREATE TABLE IF NOT EXISTS brands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  tagline      text,

  -- כשרות מוצהרת. זו נקודת האמת שכל השאר נבדק מולה.
  kashrut      text NOT NULL CHECK (kashrut IN ('meat','dairy','parve')),

  -- מנגנון "להסתיר מותג" שביקשת. hidden = לא מוגש כלל.
  status       text NOT NULL DEFAULT 'hidden'
               CHECK (status IN ('live','paused','hidden')),

  primary_domain text,
  theme_key      text,
  position       integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO brands (slug, name, tagline, kashrut, status, theme_key, position) VALUES
  ('taama',    'קייטרינג טעמא', 'נותנים טעם לאירוע',            'meat',  'live',   'taama',    1),
  ('shamenet', 'שמנת מתוקה',    'קייטרינג חלבי כשר למהדרין',    'dairy', 'hidden', 'shamenet', 2)
ON CONFLICT (slug) DO NOTHING;
