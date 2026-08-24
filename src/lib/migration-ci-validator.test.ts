import { describe, expect, it } from "vitest"
import { classifyMigrationSql, validateHistory, validateMigrationName, type MigrationFile } from "./migration-ci-validator"

describe("disposable migration CI validator", () => {
  it("accepts unchanged history plus one valid additive migration", () => {
    const base: MigrationFile[] = [{ path: "prisma/migrations/20260824000000_postgresql_baseline/migration.sql", sha256: "base" }]
    expect(validateHistory(base, [...base, { path: "prisma/migrations/20260901000000_add_note/migration.sql", sha256: "new" }], "20260901000000_add_note")).toEqual([])
  })
  it("rejects changed, deleted, renamed, or multiple historical migrations", () => {
    const base: MigrationFile[] = [{ path: "prisma/migrations/20260824000000_postgresql_baseline/migration.sql", sha256: "base" }]
    expect(validateHistory(base, [{ ...base[0], sha256: "changed" }], "")).not.toEqual([])
    expect(validateHistory(base, [], "")).not.toEqual([])
    expect(validateHistory(base, [...base, { path: "prisma/migrations/20260901000000_a/migration.sql", sha256: "a" }, { path: "prisma/migrations/20261001000000_b/migration.sql", sha256: "b" }], "")).not.toEqual([])
  })
  it.each([
    ["additive", "ALTER TABLE \"User\" ADD COLUMN \"note\" TEXT;", true],
    ["referential actions", "ALTER TABLE \"A\" ADD CONSTRAINT fk FOREIGN KEY (id) REFERENCES \"B\"(id) ON UPDATE CASCADE ON DELETE RESTRICT;", true],
    ["data", "UPDATE \"User\" SET name='x';", false],
    ["destructive", "DROP TABLE \"User\";", false],
    ["sqlite", "CREATE TABLE x (id INTEGER PRIMARY KEY AUTOINCREMENT, createdAt DATETIME);", false],
    ["unknown", "DO $$ BEGIN PERFORM unsafe(); END $$;", false],
  ])("classifies %s", (_name, sql, accepted) => expect(classifyMigrationSql(sql).accepted).toBe(accepted))
  it("requires timestamped migration names and rejects path injection", () => {
    expect(validateMigrationName("20260901000000_add_note")).toEqual([])
    expect(validateMigrationName("../../evil")).not.toEqual([])
    expect(validateMigrationName("not-a-migration")).not.toEqual([])
  })
})
