-- Store the additional sign-up details requested for resident accounts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age smallint,
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_age_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_valid CHECK (age IS NULL OR age BETWEEN 1 AND 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_gender_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_valid CHECK (
        gender IS NULL OR gender IN ('female', 'male', 'other', 'prefer_not_to_say')
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone, email, age, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone, ''),
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data ->> 'age', '')::smallint,
    NULLIF(NEW.raw_user_meta_data ->> 'gender', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        phone = COALESCE(NULLIF(public.profiles.phone, ''), EXCLUDED.phone),
        age = COALESCE(public.profiles.age, EXCLUDED.age),
        gender = COALESCE(public.profiles.gender, EXCLUDED.gender);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, phone, age, gender) ON public.profiles TO authenticated;
