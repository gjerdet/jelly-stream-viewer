-- Add Jellyfin user information to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS jellyfin_username text,
ADD COLUMN IF NOT EXISTS jellyfin_user_id text;

-- Update the handle_new_user trigger to include Jellyfin data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, jellyfin_username, jellyfin_user_id)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'jellyfin_username',
    NEW.raw_user_meta_data->>'jellyfin_user_id'
  );
  
  -- First user becomes admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update existing profiles with Jellyfin data from auth.users
UPDATE public.profiles p
SET 
  jellyfin_username = (
    SELECT raw_user_meta_data->>'jellyfin_username' 
    FROM auth.users 
    WHERE id = p.id
  ),
  jellyfin_user_id = (
    SELECT raw_user_meta_data->>'jellyfin_user_id' 
    FROM auth.users 
    WHERE id = p.id
  )
WHERE jellyfin_username IS NULL;