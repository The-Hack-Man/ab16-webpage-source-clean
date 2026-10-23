# Supabase migration history

## `ai_mastering_jobs` reproducibility

`20261020234000_ai_mastering_schema.sql` now creates the mastering-jobs base
table before applying its RLS policies and indexes. That definition is
idempotent and is used when building a fresh database from the checked-in
migration history.

The source edit was made after that migration version had already been applied
to the configured production project. Production records that version as
applied, so it will not rerun the edited historical file. Production was
reconciled separately by the forward-only migration
`20261021120000_repair_ai_mastering_jobs.sql`; its remote migration history
records that migration as applied too. Do not change migration history to make
the source edit appear newly applied, and do not reset or drop the production
database.

For another existing environment, first inspect its actual table schema and
records. If its recorded migration history includes
`20261020234000_ai_mastering_schema.sql`, use a reviewed forward-only schema
repair rather than expecting the edited historical file to run. The repair
migration is guarded against incompatible core column types, but it is not a
replacement for inspecting that environment before applying changes.

The source change does not alter the migration contents already recorded as
applied remotely. Fresh-database replay should be validated against a
disposable local Supabase database, not production.
