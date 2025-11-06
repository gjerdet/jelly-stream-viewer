-- Clean up orphaned profiles (profiles without corresponding auth.users)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned user_roles (roles without corresponding auth.users)
DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Add foreign key constraint to ensure profiles are deleted when auth user is deleted
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Add foreign key constraint to ensure user_roles are deleted when auth user is deleted
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
ADD CONSTRAINT user_roles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;