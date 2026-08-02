// @ts-check
/**
 * Generates docs/schema-current.html from types/database.ts.
 *
 * Why this exists: schema-current.html was hand-written, and went stale within a day of being
 * written — it still described `time_minutes`, a column dropped in the redesign. This project has
 * no drift detection (`supabase db diff` needs Docker, which isn't installed), so nothing warned.
 * Generating the doc from the generated types makes the column layer true by construction.
 *
 * Division of labour:
 *   types/database.ts             — authoritative for tables, columns, types, nullability,
 *                                   defaults, enums, functions, foreign keys. Regenerated from
 *                                   the LIVE schema by `supabase gen types --linked`.
 *   scripts/schema-annotations.json — everything the generated types cannot know: unique and check
 *                                   constraints, partial indexes, RLS policies, prose notes.
 *
 * The output carries no timestamp on purpose: regenerating an unchanged schema produces a
 * byte-identical file, so `git diff` only ever shows real schema movement.
 *
 * Run: node scripts/gen-schema-doc.mjs   (wired into `npm run db:types`)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES_PATH = resolve(ROOT, "types/database.ts");
const ANNOTATIONS_PATH = resolve(ROOT, "scripts/schema-annotations.json");
const OUT_PATH = resolve(ROOT, "docs/schema-current.html");

const warnings = [];
const warn = (message) => {
  warnings.push(message);
  console.warn(`  ⚠ ${message}`);
};

// --- parsing types/database.ts ------------------------------------------------------------------

/** Members of a type literal, as a Map<name, TypeNode>. Mapped types (`[_ in never]`) yield empty. */
function members(node) {
  const out = new Map();
  if (!node || !ts.isTypeLiteralNode(node)) return out;
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.name || !member.type) continue;
    out.set(member.name.getText().replace(/^["']|["']$/g, ""), member.type);
  }
  return out;
}

/** Names of members declared optional (`foo?: …`) — in an Insert type that means nullable or defaulted. */
function optionalMembers(node) {
  const out = new Set();
  if (!node || !ts.isTypeLiteralNode(node)) return out;
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.name) continue;
    if (member.questionToken) out.add(member.name.getText().replace(/^["']|["']$/g, ""));
  }
  return out;
}

/** `Database["public"]["Enums"]["recipe_difficulty"] | null` → `recipe_difficulty | null`. */
const prettyType = (text) =>
  text
    .replace(/Database\["public"\]\["Enums"\]\["([^"]+)"\]/g, "$1")
    .replace(/Database\["public"\]\["Tables"\]\["([^"]+)"\]\["Row"\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

function parseDatabase(sourceText) {
  const source = ts.createSourceFile("database.ts", sourceText, ts.ScriptTarget.Latest, true);

  let databaseType = null;
  source.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === "Database") databaseType = node.type;
  });
  if (!databaseType) throw new Error("Could not find `export type Database` in types/database.ts");

  const publicSchema = members(databaseType).get("public");
  if (!publicSchema) throw new Error("Could not find the `public` schema in the Database type");

  const publicMembers = members(publicSchema);

  // Tables
  const tables = [];
  for (const [tableName, tableType] of members(publicMembers.get("Tables"))) {
    const tableMembers = members(tableType);
    const row = members(tableMembers.get("Row"));
    const insertOptional = optionalMembers(tableMembers.get("Insert"));

    const columns = [...row].map(([columnName, typeNode]) => {
      const text = prettyType(typeNode.getText());
      const nullable = /\|\s*null\b/.test(text);
      return {
        name: columnName,
        type: text.replace(/\s*\|\s*null\b/, ""),
        nullable,
        // A NOT NULL column that Insert lets you omit must have a database default.
        hasDefault: !nullable && insertOptional.has(columnName),
      };
    });

    // Relationships is a tuple of type literals describing outbound foreign keys.
    const relationshipsNode = tableMembers.get("Relationships");
    const foreignKeys = [];
    if (relationshipsNode && ts.isTupleTypeNode(relationshipsNode)) {
      for (const element of relationshipsNode.elements) {
        const fk = members(element);
        const literal = (key) => {
          const node = fk.get(key);
          return node
            ? node
                .getText()
                .replace(/^\[|\]$/g, "")
                .replace(/["']/g, "")
                .trim()
            : "";
        };
        foreignKeys.push({
          name: literal("foreignKeyName"),
          columns: literal("columns"),
          referencedRelation: literal("referencedRelation"),
          referencedColumns: literal("referencedColumns"),
        });
      }
    }

    tables.push({ name: tableName, columns, foreignKeys });
  }

  // Enums
  const enums = [...members(publicMembers.get("Enums"))].map(([name, node]) => ({
    name,
    values: node
      .getText()
      .split("|")
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean),
  }));

  // Functions
  const functions = [...members(publicMembers.get("Functions"))].map(([name, node]) => {
    const fn = members(node);
    const args = [...members(fn.get("Args"))].map(([argName, argType]) => `${argName}: ${prettyType(argType.getText())}`);
    const returns = fn.get("Returns") ? prettyType(fn.get("Returns").getText()) : "void";
    return { name, args, returns };
  });

  return { tables, enums, functions };
}

// --- rendering --------------------------------------------------------------------------------

const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const list = (items) => (items?.length ? `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : `<p class="muted">None.</p>`);

function renderTable(table, annotation) {
  const rows = table.columns
    .map((column) => {
      const flags = [column.nullable ? `<span class="flag null">nullable</span>` : `<span class="flag notnull">not null</span>`, column.hasDefault ? `<span class="flag def">default</span>` : ""]
        .filter(Boolean)
        .join(" ");
      return `<tr><td><code>${escape(column.name)}</code></td><td><code class="type">${escape(column.type)}</code></td><td>${flags}</td></tr>`;
    })
    .join("");

  const fks = table.foreignKeys.length
    ? `<ul>${table.foreignKeys.map((fk) => `<li><code>${escape(fk.columns)}</code> → <code>${escape(fk.referencedRelation)}.${escape(fk.referencedColumns)}</code> <span class="muted">(${escape(fk.name)})</span></li>`).join("")}</ul>`
    : `<p class="muted">None — this is the root table.</p>`;

  const missing = !annotation
    ? `<p class="warn"><strong>No entry in scripts/schema-annotations.json.</strong> Constraints, indexes and notes for this table are undocumented — add them there.</p>`
    : "";

  return `
<section class="table-card">
  <h3 id="${escape(table.name)}"><code>${escape(table.name)}</code></h3>
  ${annotation?.purpose ? `<p class="purpose">${escape(annotation.purpose)}</p>` : ""}
  ${missing}
  <table>
    <thead><tr><th>Column</th><th>Type</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="grid">
    <div><h4>Foreign keys</h4>${fks}</div>
    <div><h4>Constraints <span class="hand">hand-maintained</span></h4>${list(annotation?.constraints)}</div>
    <div><h4>Indexes <span class="hand">hand-maintained</span></h4>${list(annotation?.indexes)}</div>
  </div>
  ${annotation?.notes?.length ? `<h4>Notes <span class="hand">hand-maintained</span></h4>${list(annotation.notes)}` : ""}
</section>`;
}

function render({ tables, enums, functions }, annotations) {
  const policyRows = (annotations.rls?.policies ?? [])
    .map((policy) => `<tr><td><code>${escape(policy.table)}</code></td><td><code>${escape(policy.role)}</code></td><td>${escape(policy.op)}</td><td><code>${escape(policy.expr)}</code></td></tr>`)
    .join("");

  const functionCards = functions
    .map((fn) => {
      const annotation = annotations.functions?.[fn.name];
      return `
<section class="table-card">
  <h3><code>${escape(fn.name)}(${escape(fn.args.join(", "))}) → ${escape(fn.returns)}</code></h3>
  ${annotation?.summary ? `<p class="purpose">${escape(annotation.summary)}</p>` : ""}
  ${annotation?.security ? `<p><strong>Security:</strong> <code>${escape(annotation.security)}</code></p>` : ""}
  ${annotation?.notes?.length ? list(annotation.notes) : ""}
</section>`;
    })
    .join("");

  const warningBlock = warnings.length ? `<div class="warn block"><strong>Generator warnings</strong>${list(warnings)}</div>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Current database schema</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#18181b; --muted:#71717a; --line:#e4e4e7; --card:#fafafa; --accent:#0369a1; --warnbg:#fef3c7; --warnfg:#78350f; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0b0d; --fg:#e4e4e7; --muted:#a1a1aa; --line:#27272a; --card:#141417; --accent:#7dd3fc; --warnbg:#422006; --warnfg:#fde68a; } }
  * { box-sizing: border-box; }
  body { margin:0 auto; max-width:64rem; padding:2rem 1.25rem 4rem; background:var(--bg); color:var(--fg);
         font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  h1 { font-size:1.6rem; margin:0 0 .25rem; } h2 { font-size:1.2rem; margin:2.5rem 0 .75rem; padding-bottom:.35rem; border-bottom:1px solid var(--line); }
  h3 { font-size:1rem; margin:0 0 .35rem; } h4 { font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:1rem 0 .35rem; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.875em; }
  .type { color:var(--accent); }
  .muted { color:var(--muted); } .purpose { margin:.25rem 0 .75rem; color:var(--muted); }
  .banner { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--accent); padding:.85rem 1rem; border-radius:.4rem; margin:1rem 0 0; }
  .banner code { white-space:nowrap; }
  .table-card { background:var(--card); border:1px solid var(--line); border-radius:.5rem; padding:1rem 1.15rem; margin:1rem 0; }
  .table-wrap, .table-card { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; margin:.5rem 0; }
  th, td { text-align:left; padding:.35rem .6rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:.75rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(15rem,1fr)); gap:.5rem 1.5rem; }
  ul { margin:.25rem 0; padding-left:1.1rem; } li { margin:.15rem 0; }
  .flag { font-size:.7rem; padding:.1rem .4rem; border-radius:.25rem; border:1px solid var(--line); color:var(--muted); white-space:nowrap; }
  .flag.notnull { border-color:var(--accent); color:var(--accent); }
  .hand { font-size:.6rem; text-transform:none; letter-spacing:0; background:var(--warnbg); color:var(--warnfg); padding:.05rem .35rem; border-radius:.25rem; vertical-align:middle; }
  .warn { background:var(--warnbg); color:var(--warnfg); padding:.6rem .85rem; border-radius:.35rem; }
  .warn.block { margin:1rem 0; }
</style>
</head>
<body>

<h1>Current database schema</h1>
<p class="muted">Public schema of the linked Supabase project.</p>

<div class="banner">
  <strong>Generated file — do not edit by hand.</strong><br />
  Columns, types, nullability, defaults, enums, functions and foreign keys are derived from
  <code>types/database.ts</code>, which <code>npm run db:types</code> regenerates from the
  <em>live</em> schema. Items badged <span class="hand">hand-maintained</span> come from
  <code>scripts/schema-annotations.json</code>, because the generated types carry no constraint,
  index or policy information — update that file in the same commit as any migration that changes one.<br />
  Regenerate: <code>npm run db:types</code>.
</div>

${warningBlock}

<h2>Tables</h2>
${tables.map((table) => renderTable(table, annotations.tables?.[table.name])).join("")}

<h2>Enums</h2>
${enums.length ? enums.map((enumType) => `<p><code>${escape(enumType.name)}</code> — ${enumType.values.map((value) => `<code>'${escape(value)}'</code>`).join(" · ")}</p>`).join("") : '<p class="muted">None.</p>'}

<h2>Functions</h2>
${functionCards || '<p class="muted">None.</p>'}

<h2>Row-level security <span class="hand">hand-maintained</span></h2>
<p>${escape(annotations.rls?.summary ?? "")}</p>
<h4>Table grants</h4>
${list(annotations.rls?.grants)}
<h4>Policies</h4>
<div class="table-wrap">
<table>
  <thead><tr><th>Table</th><th>Role</th><th>Operation</th><th>Expression</th></tr></thead>
  <tbody>${policyRows}</tbody>
</table>
</div>

</body>
</html>
`;
}

// --- main -------------------------------------------------------------------------------------

console.log("Generating docs/schema-current.html from types/database.ts…");

const parsed = parseDatabase(readFileSync(TYPES_PATH, "utf8"));
const annotations = JSON.parse(readFileSync(ANNOTATIONS_PATH, "utf8"));

// Drift between the generated types and the hand-maintained sidecar, in both directions.
for (const table of parsed.tables) {
  if (!annotations.tables?.[table.name]) warn(`Table "${table.name}" exists in types/database.ts but has no entry in scripts/schema-annotations.json.`);
}
for (const name of Object.keys(annotations.tables ?? {})) {
  if (!parsed.tables.some((table) => table.name === name)) warn(`scripts/schema-annotations.json documents table "${name}", which no longer exists in types/database.ts. Remove it.`);
}

writeFileSync(OUT_PATH, render(parsed, annotations), "utf8");

console.log(`  ${parsed.tables.length} tables · ${parsed.enums.length} enums · ${parsed.functions.length} functions`);
console.log(warnings.length ? `  Done, with ${warnings.length} warning(s) — see above and in the generated page.` : "  Done, no drift between types and annotations.");
