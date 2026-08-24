export type MigrationFile = { path: string; sha256: string }

export function validateMigrationName(name: string): string[] {
  return /^\d{14}_[a-z0-9][a-z0-9_-]*$/.test(name) ? [] : ["invalid migration name"]
}

export function validateHistory(base: MigrationFile[], head: MigrationFile[], expectedNew: string): string[] {
  const failures: string[] = []
  const headByPath = new Map(head.map((file) => [file.path, file.sha256]))
  for (const file of base) if (headByPath.get(file.path) !== file.sha256) failures.push("historical migration changed or removed")
  const additions = head.filter((file) => !base.some((old) => old.path === file.path))
  const folders = [...new Set(additions.map((file) => file.path.match(/^prisma\/migrations\/([^/]+)\//)?.[1]).filter(Boolean))] as string[]
  if (folders.length !== 0 && (folders.length !== 1 || (expectedNew && folders[0] !== expectedNew) || additions.some((file) => !file.path.endsWith(`/migration.sql`)))) failures.push("unexpected or ambiguous migration additions")
  if (folders.length === 0 && expectedNew) failures.push("expected migration was not added")
  return failures
}

export function classifyMigrationSql(sql: string): { accepted: boolean; reason: string } {
  const clean = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim()
  const ddlForForbiddenScan = clean.replace(/\bON\s+(?:UPDATE|DELETE)\b/gi, "REFERENTIAL_ACTION")
  if (!clean || /\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|DO|COPY|ALTER\s+TYPE)\b/i.test(ddlForForbiddenScan)) return { accepted: false, reason: "data, destructive, or procedural SQL" }
  const statements = clean.split(";").map((x) => x.trim()).filter(Boolean)
  if (!statements.length) return { accepted: false, reason: "empty SQL" }
  const allowed = statements.every((statement) => /^(?:ALTER\s+TABLE\s+"?[A-Za-z_][\w$]*"?\s+ADD\s+(?:COLUMN\s+"?[A-Za-z_][\w$]*"?\s+[^;]+|CONSTRAINT\s+"?[A-Za-z_][\w$]*"?\s+FOREIGN\s+KEY\s*\([^)]*\)\s+REFERENCES\s+[^;]+)|CREATE\s+(?:UNIQUE\s+)?INDEX\s+"?[A-Za-z_][\w$]*"?\s+ON\s+|CREATE\s+TABLE\s+"?[A-Za-z_][\w$]*"?\s*\()/i.test(statement))
  return allowed ? { accepted: true, reason: "recognized additive PostgreSQL DDL" } : { accepted: false, reason: "unknown SQL; requires elevated review" }
}
