# Database Migrations

This backend uses Flyway for PostgreSQL schema changes.

## How migrations work in this repo

- Flyway migration files live in `backend/src/main/resources/db/migration`.
- Files are versioned in order: `V1__...sql`, `V2__...sql`, `V3__...sql`.
- On backend startup, Flyway checks for new migration files and applies any that have not run yet.
- Hibernate is set to `validate`, not `update`, so entity changes do not change the database by themselves.

## Normal workflow

1. Change the entity class.
2. Add a new SQL migration file with the next version number.
3. Start or restart the backend.
4. Flyway applies the new migration to the configured database.

Example:

```text
Member.kt changed
-> create V3__add_member_phone_number.sql
-> start backend
-> Flyway runs V3
```

## Commands

Run backend locally:

```bash
cd backend
set -a
source ../.env
set +a
./gradlew bootRun
```

Or run with Docker:

```bash
docker compose up --build backend
```

## Rules

- Never edit an old migration that has already been applied anywhere.
- Always create a new migration file for the next schema change.
- Keep each migration focused on one logical change.
- If a new column is `NOT NULL`, add it carefully when the table already has data:
  - add the column as nullable
  - backfill existing rows
  - then add `NOT NULL` and any unique constraint

## Example migration

```sql
alter table members add column phone_number varchar(50);
```

For a table with existing rows:

```sql
alter table members add column phone_number varchar(50);

update members
set phone_number = 'unknown'
where phone_number is null;

alter table members
    alter column phone_number set not null;
```

## Tests

- Tests use H2 via `src/test/resources/application-test.yml`.
- Flyway is disabled in the test profile.
- Test schema is created with Hibernate `create-drop`.

## Current baseline

- `V1__baseline_schema.sql` represents the schema before `members.email`.
- `V2__add_member_email.sql` adds the `email` column and backfills existing rows.
