DO $$ 
DECLARE 
    constraint_name text;
BEGIN
    -- Find the name of the check constraint on user_profiles.user_role
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'user_profiles'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%user_role%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE user_profiles DROP CONSTRAINT ' || constraint_name;
    END IF;

    -- Add the new constraint
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_role_check 
        CHECK (user_role IN ('super_admin', 'admin', 'lab_manager', 'researcher', 'student', 'guest', 'user'));
END $$;
