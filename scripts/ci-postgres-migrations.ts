import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import { classifyMigrationSql, validateHistory, validateMigrationName, type MigrationFile } from "../src/lib/migration-ci-validator"

const root = process.cwd()
const baseInput = process.env.GITHUB_BASE_SHA
const head = process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA
const dbUrl = process.env.DATABASE_URL
if (!head || !/^[0-9a-f]{40}$/.test(head)) throw new Error("CI requires an exact immutable head SHA")
if (!dbUrl || !/^postgresql:\/\/ci:ci@127\.0\.0\.1:5432\/ci$/.test(dbUrl) || process.env.DIRECT_URL !== dbUrl) throw new Error("CI requires the fixed disposable PostgreSQL URL")
const run = (command: string, args: string[], env = process.env) => {
  try { return execFileSync(command, args, { cwd: root, env: { PATH: env.PATH, NODE_ENV: "test", DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }
  catch { throw new Error(`CI authoritative command failed: ${command}`) }
}
const base = baseInput === "0000000000000000000000000000000000000000" || !baseInput ? run("git", ["merge-base", "origin/main", head]) : baseInput
if (!/^[0-9a-f]{40}$/.test(base)) throw new Error("CI requires an exact immutable base SHA")
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex")
const shaAt = (ref: string, path: string) => createHash("sha256").update(execFileSync("git", ["show", `${ref}:${path}`])).digest("hex")
const files = (ref: string): MigrationFile[] => {
  const names = run("git", ["ls-tree", "-r", "--name-only", ref, "prisma/migrations"]).trim().split("\n").filter((x) => x.endsWith("/migration.sql"))
  return names.map((path) => ({ path, sha256: shaAt(ref, path) }))
}
const baseFiles = files(base)
const headFiles = files(head)
const historyFailures = validateHistory(baseFiles, headFiles, "")
if (historyFailures.length) throw new Error(`BLOCKED: ${historyFailures.join("; ")}`)
const changed = run("git", ["diff", "--name-status", `${base}...${head}`, "--", "prisma/migrations"]).trim()
if (run("git", ["diff", "--name-only", `${base}...${head}`, "--", "prisma/migrations/migration_lock.toml"]).trim()) throw new Error("BLOCKED: migration lock changed")
const additions = changed ? changed.split("\n").filter((x) => x.startsWith("A\t") && x.endsWith("/migration.sql")) : []
for (const line of additions) {
  const path = line.slice(2)
  const name = path.split("/")[2]
  if (!name || validateMigrationName(name).length || !classifyMigrationSql(readFileSync(join(root, path), "utf8")).accepted) throw new Error("BLOCKED: added migration is not a recognized additive migration")
}
const lock = readFileSync(join(root, "prisma/migrations/migration_lock.toml"), "utf8")
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8")
if (!/^\s*provider\s*=\s*"postgresql"\s*$/m.test(lock) || !/^\s*provider\s*=\s*"postgresql"\s*$/m.test(schema)) throw new Error("BLOCKED: PostgreSQL provider required")
if (JSON.parse(readFileSync(join(root, "node_modules/prisma/package.json"), "utf8")).version !== "5.22.0" || JSON.parse(readFileSync(join(root, "node_modules/@prisma/client/package.json"), "utf8")).version !== "5.22.0") throw new Error("BLOCKED: Prisma version mismatch")
const baseline = join(root, "prisma/migrations/20260824000000_postgresql_baseline/migration.sql")
if (!existsSync(baseline) || sha(baseline) !== "7d3db2caa21892dc0324044a2ee27ef66a3fbc0b033e5fec5c0e25181468f3bd") throw new Error("BLOCKED: canonical baseline checksum mismatch")
const temp = resolve("/tmp", `migration-ci-${process.pid}`)
rmSync(temp, { recursive: true, force: true }); mkdirSync(temp, { recursive: true })
try {
  const archive = execFileSync("git", ["archive", base, "prisma/schema.prisma", "prisma/migrations"], { cwd: root })
  execFileSync("tar", ["-x", "-f", "-", "-C", temp], { input: archive, stdio: ["pipe", "ignore", "ignore"] })
  const baseSchema = join(temp, "prisma/schema.prisma")
  run("node", ["./node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", baseSchema])
  run("node", ["./node_modules/prisma/build/index.js", "migrate", "deploy"])
  const status = run("node", ["./node_modules/prisma/build/index.js", "migrate", "status"])
  if (!/database schema is up to date/i.test(status)) throw new Error("BLOCKED: schema status is not clean")
  const diff = run("node", ["./node_modules/prisma/build/index.js", "migrate", "diff", "--from-url", dbUrl, "--to-schema-datamodel", "prisma/schema.prisma", "--script"])
  if (!diff.includes("This is an empty migration")) throw new Error("BLOCKED: schema diff is not empty")
  const metadataQuery = "select coalesce(string_agg(migration_name||':'||checksum||':'||coalesce(finished_at::text,'')||':'||coalesce(rolled_back_at::text,''),',' order by migration_name),'') from _prisma_migrations"
  const headMetadata = run("psql", [dbUrl, "-Atqc", metadataQuery])
  run("node", ["./node_modules/prisma/build/index.js", "migrate", "deploy"])
  const after = run("psql", [dbUrl, "-Atqc", metadataQuery])
  if (headMetadata.trim() !== after.trim()) throw new Error("BLOCKED: second head deploy changed migration metadata")
  const appliedNames = run("psql", [dbUrl, "-Atqc", "select count(*)||'|'||coalesce(string_agg(migration_name,',' order by migration_name),'') from _prisma_migrations"])
  const expectedNames = headFiles.map((file) => file.path.split("/")[2]).sort().join(",")
  if (appliedNames.trim().split("|")[1] !== expectedNames) throw new Error("BLOCKED: migration metadata names do not match committed history")
  const actualChecksums = run("psql", [dbUrl, "-Atqc", "select string_agg(migration_name||':'||checksum,',' order by migration_name) from _prisma_migrations"])
  const expectedChecksums = headFiles.map((file) => `${file.path.split("/")[2]}:${file.sha256}`).sort().join(",")
  if (actualChecksums.trim() !== expectedChecksums) throw new Error("BLOCKED: migration metadata checksums do not match committed history")
  console.log(`migration_ci=PASS base_history=${baseFiles.length} head_additions=${additions.length} metadata=${appliedNames.trim()} checksums=exact schema_diff=empty second_deploy=no-op`)
} finally { rmSync(temp, { recursive: true, force: true }) }
