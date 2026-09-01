import {
  SchemaDefParamsService,
  EditorConfig as DBEditorConfig,
  SchemaDefJson,
  SchemaFieldJson,
  SchemaTypeJson,
  EditorFieldOptions,
  TypeKeyword,
} from "@/server/feathers/schema";
import _ from "lodash";

export const defHeaders = ["name", "value", "price", "status", "modifiedBy", "modified", "createdBy", "createdAt", "email"];
export const readonlyHeaders = ["modifiedBy", "modified", "createdBy", "createdAt", "_id"];
const colors = ["green", "purple", "indigo", "blue", "teal", "orange"];

function stringHash(text: string) {
  var hash = 0,
    i,
    chr;
  for (i = 0; i < text.length; i++) {
    chr = text.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export function getSearchColor(value: string) {
  return colors[Math.abs(stringHash(value || "")) % colors.length];
}

export function lookupType(type: TypeKeyword | SchemaTypeJson) {
  return typeof type === "string" ? type : type.type;
}

export function isSortable(type: string) {
  switch (type) {
    case "string":
    case "number":
    case "date":
    case "boolean":
      return true;
  }
  return false;
}

export function isEnum(field: SchemaFieldJson) {
  return lookupType(field.type) === "string" && !!field.params?.enum;
}

export function isTranslate(type: string | SchemaTypeJson) {
  if (typeof type === "string") return false;
  if (type.type !== "array") return false;
  const innerType = type.itemType;
  if (!innerType || typeof innerType === "string" || innerType.type !== "object") return false;

  return (
    innerType.fields.find((it) => it.name === "lang" && lookupType(it.type) === "string") &&
    innerType.fields.find((it) => it.name === "value" && lookupType(it.type) === "string")
  );
}

export function getDefaultHeaders(config: DBEditorConfig, def: SchemaDefJson): SchemaFieldJsonWithPath[] {
  const fields = def?.schema?.fields || [];
  const headers = config?.headers ?? [];
  if (headers.length) {
    return headers.map((fieldName) => resolveField(def, fieldName, true)).filter((it) => !!it);
  } else {
    return fields.filter((it) => {
      const type = lookupType(it.type);
      if (type === "object") return false;
      if (it.params?.index) return true;
      if (headers.indexOf(it.name) !== -1) return true;
      return false;
    });
  }
}

export type SchemaFieldJsonWithPath = SchemaFieldJson & { path?: string; headerPath?: string[] };

export function resolveField(def: SchemaDefJson, fieldName: string, resolveArray = false): SchemaFieldJsonWithPath {
  if (fieldName === "_id") {
    return {
      path: fieldName,
      headerPath: [fieldName],
      name: "_id",
      type: "id",
    };
  }
  const parts = fieldName.split(".");
  if (resolveArray && def.schema?.type === "array") {
    const child = resolveField({ schema: def.schema.itemType as any }, fieldName, resolveArray);
    if (!child) return null;
    const subpath = child.headerPath || (child.path || child.name).split(".") || [];
    return { ...child, path: fieldName, headerPath: ["*", ...subpath] };
  }
  const field = def.schema?.fields.find((it) => it.name === parts[0]);
  if (!field) return null;
  if (parts.length > 1) {
    const child = resolveField({ schema: field.type as any }, parts.splice(1).join("."), resolveArray);
    if (!child) return null;
    const subpath = child.headerPath || (child.path || child.name).split(".") || [];
    return { ...child, path: fieldName, headerPath: [parts[0], ...subpath] };
  }
  return field;
}

export function resolveRootPath(config: DBEditorConfig, serviceConfig: SchemaDefParamsService) {
  return `/${config.path || serviceConfig.path}`;
}

export function getHeaderFields(def: SchemaDefJson): SchemaFieldJson[] {
  if (!def.headerFields) {
    if (def.params?.headerFields) {
      def.headerFields = def.params?.headerFields.map((field) => resolveField(def, field)).filter((it) => !!it);
    } else {
      def.headerFields = [];
    }
  }
  return def.headerFields;
}

export function getHeaderFieldsByName(def: SchemaDefJson, names: string[]): SchemaFieldJson[] {
  return names.map((field) => resolveField(def, field)).filter((it) => !!it);
}

/** Resolve a possibly-multilingual value to a string for display.
 *
 * Translated fields are stored as {en, hy, ru}. Callers used to inline
 * `if (value && typeof value === "object" && value.en) value = value.en;`
 * which has two problems: it ignores hy/ru, so a record translated but with an
 * empty English string renders blank, and when `en` is falsy it leaves the
 * OBJECT in place - React then throws "Objects are not valid as a React child".
 */
export function displayName(value: any, language: string = "en"): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    for (const key of [language, "en", "hy", "ru"]) {
      const v = (value as any)[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  }
  return String(value);
}

/**
 * Returns the `name` field of a schema
 * @param def schema definition in json format
 */
export function getNameField(def: SchemaDefJson): SchemaFieldJson {
  if (!def.nameField) {
    def.nameField =
      def.schema?.fields?.find((it) => it.name === "name" && lookupType(it.type) === "string") ||
      // A multilingual name is an OBJECT of {en, hy, ru} string subfields, not a
      // string, so the check above misses it. Without this line the search fell
      // through to "first string field", which on Attraction is `contact` - so
      // every reference picker to a translated collection listed phone numbers,
      // and rendered blank for the records that have no phone number.
      //
      // Match a field literally called `name` whatever its shape; consumers
      // already resolve the language themselves.
      def.schema?.fields?.find((it) => it.name === "name") ||
      def.schema?.fields?.find((it) => lookupType(it.type) === "string" && !isEnum(it));
    if (def.params?.nameField ?? (def.params?.editor as any)?.nameField) {
      const field = resolveField(def, def.params?.nameField ?? (def.params?.editor as any)?.nameField, true);
      if (field) {
        def.nameField = field;
      }
    }
  }

  return def.nameField;
}

export function getNameFields(def: SchemaDefJson): SchemaFieldJsonWithPath[] {
  if (!def.nameFields) {
    if (def.params?.nameFields ?? (def.params?.editor as any)?.nameFields) {
      def.nameFields = (def.params?.nameFields ?? (def.params?.editor as any)?.nameFields)
        .map((field) => resolveField(def, field, true))
        .filter((it) => !!it);
    } else {
      def.nameFields = [];
    }
  }

  return def.nameFields;
}

export function getFieldName(field: SchemaFieldJsonWithPath, editor?: EditorFieldOptions, tp: string = "", withSuffix: boolean = false) {
  if (tp.endsWith(".$.")) tp = tp.slice(0, -3) + ".";
  const name = editor?.name ?? field.path ?? field.name;
  const type = lookupType(field.type);
  const useBasic =
    name === "modifiedBy" ||
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "date" ||
    (type === "array" && isTranslate(field.type));
  let suffix = withSuffix ? ".$" : "";

  return !useBasic || defHeaders.indexOf(name) === -1 ? tp + name + suffix : "basic." + name;
}
