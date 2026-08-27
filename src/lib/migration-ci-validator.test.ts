import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { classifyMigrationSql, validateHistory, validateMigrationName, type MigrationFile } from "./migration-ci-validator"

const workflow = readFileSync(".github/workflows/postgresql-migrations.yml", "utf8")

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

  it("uses exact event SHAs for pull_request and push", () => {
    expect(workflow).toContain('HEAD_SHA: ${{ github.event_name == \'pull_request\' && github.event.pull_request.head.sha || github.sha }}')
    expect(workflow).toContain('BASE_SHA: ${{ github.event_name == \'pull_request\' && github.event.pull_request.base.sha || github.event.before }}')
    expect(workflow).toContain('BASE_SHA="$(git merge-base origin/main "$HEAD_SHA")"')
  })

  it("fails closed for invalid or unavailable git objects before diff", () => {
    expect(workflow).toContain("sha_pattern='^[0-9a-f]{40}$'")
    expect(workflow).toContain('git cat-file -e "$BASE_SHA^{commit}"')
    expect(workflow).toContain('git cat-file -e "$HEAD_SHA^{commit}"')
    expect(workflow).toContain('Invalid migration diff SHA selection')
    expect(workflow).not.toContain("|| true")
  })

  it("captures git diff successfully before classifying relevant paths", () => {
    expect(workflow).toContain('changed_files="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")"')
    expect(workflow).toContain("prisma/migrations/*|scripts/ci-postgres-migrations.ts")
    expect(workflow).toContain(".github/workflows/postgresql-migrations.yml|package.json|package-lock.json)")
    expect(workflow).not.toContain("git diff --name-only \"$BASE_SHA\" \"$HEAD_SHA\" | grep")
  })

  it("makes detector failure fail the stable gate", () => {
    expect(workflow).toContain('DETECTOR_RESULT: ${{ needs.detect.result }}')
    expect(workflow).toContain('if [ "$DETECTOR_RESULT" != "success" ]; then')
    expect(workflow).toContain('if: always()')
  })
})
