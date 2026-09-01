/** Verifies which field the editor picks to label a referenced record.
 *
 * The venue dropdown listed phone numbers because getNameField could not match a
 * multilingual `name` (an object, not a string) and fell through to "first
 * string field" - which on Attraction is `contact`.
 *
 * Run against the live schema + data:
 *   npx tsx ./scripts/check_name_field.ts
 */
import { getNameField, getNameFields, displayName } from "../contexts/schemas/utils";

const API = process.env.API_URL || "https://xr-archaeology-server-production.up.railway.app";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}` + (ok ? "" : `\n         expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`));
}

async function main() {
  const schemas = await (await fetch(`${API}/api/schemas`)).json();

  console.log("\n--- which field labels a referenced record? ---");
  for (const table of ["Attraction", "Location", "Route", "Event"]) {
    const def = schemas.schemas[table];
    if (!def) {
      console.log(`  (no schema for ${table})`);
      continue;
    }
    // getNameField caches onto the def object, so start clean each time.
    delete (def as any).nameField;
    const picked = getNameField(def as any);
    const pickedName = picked?.name;
    console.log(`  ${table.padEnd(12)} -> ${pickedName}`);
    check(`${table} labels by 'name', not another string field`, pickedName, "name");
  }

  console.log("\n--- displayName resolves multilingual values ---");
  check("plain string", displayName("Vedi Fortress"), "Vedi Fortress");
  check("prefers requested language", displayName({ en: "Fortress", hy: "Ամրոց" }, "hy"), "Ամրոց");
  check("falls back when language missing", displayName({ en: "Only English" }, "ru"), "Only English");
  check("falls back past an EMPTY english string", displayName({ en: "  ", hy: "Ամրոց" }), "Ամրոց");
  check("never returns an object", typeof displayName({ en: "", hy: "", ru: "" }), "string");
  check("all-empty becomes empty string", displayName({ en: "", hy: "", ru: "" }), "");
  check("null/undefined safe", displayName(null) + displayName(undefined), "");

  console.log("\n--- against real attraction records ---");
  const res = await (await fetch(`${API}/api/attractions?%24limit=8&%24sort%5Bname.en%5D=1`)).json();
  const def = schemas.schemas["Attraction"];
  delete (def as any).nameField;
  const field = getNameField(def as any);
  const labels = (res.data || []).map((r: any) => displayName(r[field.name]));
  labels.forEach((l: string, i: number) => console.log(`  ${String(i + 1).padStart(2)}. ${l || "(blank)"}`));
  check("no label is blank", labels.filter((l: string) => !l).length, 0);
  check("no label looks like a phone number", labels.filter((l: string) => /^[+\d][\d\s()+-]{6,}$/.test(l)).length, 0);

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
