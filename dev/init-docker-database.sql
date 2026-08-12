-- Runs once on first cluster init via /docker-entrypoint-initdb.d.
-- The primary DB (neosrc) comes from POSTGRES_DB
SELECT format('CREATE DATABASE %I', d.name)
FROM (VALUES ('e2e_test'), ('functional_test')) AS d(name)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = d.name)
\gexec
