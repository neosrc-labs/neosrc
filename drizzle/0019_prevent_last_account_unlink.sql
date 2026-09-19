CREATE FUNCTION prevent_last_ba_account_delete() RETURNS trigger AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD."userId", 0));

    IF (
        SELECT count(*)
        FROM "ba_account"
        WHERE "userId" = OLD."userId"
    ) <= 1 THEN
        RAISE EXCEPTION 'Cannot unlink the last account for a user'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ba_account_user_requires_account';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER preserve_last_ba_account
    BEFORE DELETE ON "ba_account"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_ba_account_delete();