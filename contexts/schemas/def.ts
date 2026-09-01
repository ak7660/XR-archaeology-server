import { DataTableHeader, EditorField, SearchField } from "@components/editor/def";
import {
  SchemaDefParamsService,
  EditorConfig as DBEditorConfig,
  SchemaDefJson,
  EditorFieldOptions,
  SchemaFieldJson,
  SchemaTypeJson,
} from "@/server/feathers/schema";
import _ from "lodash";
import {
  SchemaFieldJsonWithPath,
  defHeaders,
  getDefaultHeaders,
  getFieldName,
  getHeaderFields,
  getHeaderFieldsByName,
  getNameField,
  getNameFields,
  getSearchColor,
  isEnum,
  isSortable,
  lookupType,
  readonlyHeaders,
  resolveField,
  resolveRootPath,
} from "./utils";
import { SchemaHelper } from "./schemaHelper";

export class EditorConfig {
  // CURD
  create?: boolean;
  patch?: boolean;
  remove?: boolean;
  export?: boolean;
  import?: boolean;
  clone?: boolean;

  // toolbar buttons
  actions?: {
    icon: string;
    altText: string;
    action: string;
  }[];
  // data table header
  headers?: DataTableHeader[];
  // hidden table headers
  extraHeaders?: DataTableHeader[] = [];

  // editor fields
  fields?: EditorField[];

  searchFields: SearchField[];
  // text search fields
  textFields: string[];

  group?: string;
  groupIcon?: string;

  // page name
  name?: string;
  targetPath?: string;

  // page url
  rootPath: string;
  icon?: string;
  order?: number;

  // service path
  service?: string;
  path?: string;

  filter?: Record<string, any>;
  menu?: boolean;
  linkedTable?: {
    table: string;
    service: string;
    field: string;
  };
  defaultSort?: string;
  defaultSortDesc?: boolean;
  defaultValue?: any;
  paginate: boolean;
  roles: string[];

  // i18n translation key
  tp: string;
  [key: string]: any;

  constructor(public parent: SchemaHelper, public serviceConfig: SchemaDefParamsService, public def: SchemaDefJson, public config: DBEditorConfig) {
    const { path, paginate } = serviceConfig;
    this.tp = "pages." + (config.path || path) + ".";
    this.name = config.name ? this.tp + config.name : this.tp + "$";

    this.filter = config.filter;

    this.icon = config.icon;
    this.group = config.group;
    this.groupIcon = config.groupIcon;
    this.service = config.service || path;
    this.path = path;
    this.rootPath = resolveRootPath(config, serviceConfig);

    this.create = config.readOnly ?? config.create ?? true;
    this.patch = config.readOnly ?? config.patch ?? true;
    this.remove = config.readOnly ?? config.remove ?? true;
    this.export = config.export ?? true;
    this.import = config.readOnly ?? config.import ?? true;
    this.clone = config.readOnly ?? config.create ?? true;

    this.actions = config.actions?.map((action) => ({ altText: this.tp + action.name, icon: action.icon, action: this.tp + action.name })) ?? [];
    this.order = config.order ?? 999;
    this.menu = config.menu ?? true;
    this.paginate = paginate;
    this.roles = config.roles ? (Array.isArray(config.roles) ? config.roles : [config.roles]) : [];

    const headerFields = getDefaultHeaders(config, def);
    this.headers = headerFields.map((it) => this.getHeader(it)).filter((it) => !!it);

    let jsonFields = def?.schema?.fields || [];
    this.fields = jsonFields.map((it) => this.convertField(it)).filter((it) => !!it);

    this.updateDefaultValue();
    this.updateSearchFields();
  }

  /**
   * Returns a table header given a field
   * @param field
   * @param editor
   */
  getHeader(field: SchemaFieldJsonWithPath, editor?: EditorFieldOptions, tp?: string): DataTableHeader {
    if (!editor && field.params.$editor) {
      editor = field.params.$editor || {};
    }
    editor = editor || {};
    tp ??= this.tp;

    const type = lookupType(field.type);
    let header: DataTableHeader = {
      value: field.path || field.name,
      sortable: isSortable(type),
      multiple: field.headerPath && field.headerPath.includes("*"),
    };
    header.hideEmpty = editor.hideEmpty;

    header.flex = editor.headerFlex ?? 1;
    let needSuffix = false;
    switch (type) {
      case "array":
        if (typeof field.type === "object") {
          const itype = field.type.itemType;
          if (lookupType(itype) === "object" && typeof itype === "object") {
            needSuffix = true;
          }
        }
        break;
      case "object":
        if (typeof field.type === "object") {
          needSuffix = true;
        }
        break;
    }
    header.text = getFieldName(field, editor, tp, needSuffix);
    if (editor.sortField) {
      header.sortField = editor.sortField;
      header.sortable = true;
    }

    switch (type) {
      case "object":
        if (editor.nameFields) {
          header.type = "multi";
          header.inner = [];
          const nameFields = Array.isArray(editor.nameFields) ? editor.nameFields : [editor.nameFields];
          for (let name of nameFields) {
            const f = resolveField({ schema: field.type } as any, name, true);
            if (!f) continue;
            const sub = this.getHeader({ ...f, path: header.value + "." + (f.path || f.name) });
            if (!sub) continue;
            sub.value = name;
            header.inner.push(sub);
          }
        }
        break;
      case "string":
        if (isEnum(field)) {
          let rootName = defHeaders.indexOf(field.name) === -1 ? getFieldName(field, editor, tp) : `${field.name}`;
          if (!rootName.startsWith("enum.")) rootName = "enum." + rootName;
          if (rootName.endsWith(".$")) rootName = rootName.slice(0, -2);
          header.enumList = _.fromPairs(_.map(field.params?.enum, (f) => [f, `${rootName}.${f}`]));
        }
        break;
      case "id":
        const path = this.parent.getRefPath(field);
        const table = this.parent.getRefTable(field);
        if (path && table) {
          if (path === "attachments") {
            if (field.params?.fileType === "image") {
              header.type = "thumb";
            } else if (field.params?.fileType === "model") {
              // TODO convert header type to handle model
              return null;
            } else {
              return null;
            }
          } else {
            let overridedFormat = false;
            header.source = path;
            header.source = path;
            header.linkSource = this.parent.getEditorPath(path) ?? null;
            if (!header.linkSource) header.noLink = true;
            else header.linkSource = header.linkSource.substring(1);
            header.trailingSlash = false;

            if (field.params.$editor) {
              let editor = field.params.$editor;
              header.limit = editor.headerLimit;
              header.unique = editor.headerUnique;

              if (editor.objectFormat) {
                header.path = null;
                overridedFormat = true;
              }
            }

            if (!overridedFormat) {
              let headers: SchemaFieldJson[];
              if (editor?.nameFields) {
                const nameFields = Array.isArray(editor.nameFields) ? editor.nameFields : editor.nameFields.split(",");
                headers = getHeaderFieldsByName(table, nameFields);
              }
              if (!headers) {
                headers = getHeaderFields(table);
              }
              if (headers.length) {
                header.path = null;
                header.type = "multi";
                header.inner = headers.map((header) => this.getHeader(header));
              } else {
                const nameField = getNameField(table);
                if (nameField) {
                  header.path = nameField.name;
                }

                const nameFields = getNameFields(table);
                if (nameFields?.length) {
                  header.paths = nameFields.map((nameField) => nameField.name);
                }
              }
            }
          }
        }

        break;
      case "array":
        if (typeof field.type === "object") {
          const itype = field.type.itemType;
          Object.assign(
            header,
            this.getHeader(
              {
                ...field,
                params: <any>field.type.options,
                type: itype,
              },
              editor
            ),
            {
              multiple: true,
            }
          );
        }
        break;
      default:
        break;
    }
    return header;
  }

  /**
   * Returns an editor input field (frontend) given a field in json format
   */
  convertField(field: SchemaFieldJsonWithPath, tp?: string): EditorField {
    tp ??= this.tp;
    let defaultValue = field.params?.default;
    const type = lookupType(field.type);

    let editor: EditorFieldOptions = {};
    if (field.params?.$editor) {
      editor = field.params.$editor;
    } else if (typeof field.type === "object") {
      if (typeof field.type.itemType === "object") {
        editor = field.type?.itemType?.params?.$editor ?? {};
      }
    }

    if (editor.hidden && !editor.search) {
      return null;
    }
    const props: any = {};
    let component = "";
    let inner: EditorField[];
    let needSuffix = false;
    if (field.params?.required) props.required = true;

    const innerTP = getFieldName(field, editor, tp);

    switch (type) {
      case "boolean":
        component = "checkbox";
        break;
      case "number":
      case "string":
        if (isEnum(field)) {
          component = (field.params?.enum?.length > 20 && !editor.props?.picker) || editor.props?.list ? "object-picker-list" : "object-picker-new";
          let rootName = innerTP;
          if (rootName.startsWith("basic.")) rootName = rootName.slice(6);
          if (!rootName.startsWith("enum.")) rootName = "enum." + rootName;
          if (rootName.endsWith(".$")) rootName = rootName.slice(0, -2);

          props.items = field.params?.enum.map((value) => ({ _id: value, name: { $t: rootName + "." + value } }));
          props.translate = true;
          props.name = [{ field: "name", translate: true }];
        } else {
          component = "text-field";
          if (type === "number") {
            props.type = "number";
          }
          if (editor.props?.multiLine) {
            props.multiLine = true;
          }
        }
        break;
      case "date":
        component = "date-picker";
        props["date-time"] = !(field.params?.dateOnly ?? false);
        break;
      case "id":
        const ref = field.params?.ref;
        if (ref === "Attachment") {
          props.attachment = true;
          props.attachmentId = true;
          component = field.params?.fileType === "image" ? "image-picker" : "file-picker";
        } else {
          const refTable = this.parent.getRefTable(field);
          const path = this.parent.getRefPath(field);
          if (path) {
            component = editor?.props?.picker ? "object-picker-new" : "object-picker-list";
            props.path = path;
            // A single `id` field is one reference, not a list. Only the array
            // branch below sets multiple = true, so without this the pickers
            // fell back to their own defaults - and they disagreed, which made
            // single refs behave as multi-selects in the list picker.
            props.multiple = false;
            // Let a schema restrict or order the options, e.g.
            //   venue: { type: "id", ref: "Attraction",
            //            $editor: { props: { query: { $sort: { "name.en": 1 } } } } }
            if (editor?.props?.query) props.query = editor.props.query;
            const nameField = getNameField(refTable);
            const nameFields = getNameFields(refTable);

            const extraFields = (refTable.schema?.fields || []).filter(
              (it) => it.name !== nameField?.name && !nameFields.find((f) => f.name === it.name)
            );

            // TODO convert nameField to be searchable
          } else {
            component = "text-field";
          }
        }
        break;
      case "array":
        defaultValue = [];
        if (typeof field.type === "object") {
          const itype = field.type.itemType;

          switch (lookupType(itype)) {
            case "object":
              // list of embedded object
              component = "editor-list";
              if (typeof itype === "object") {
                needSuffix = true;

                inner = _.map(itype.fields, (f) => this.convertField(f, innerTP + ".")).filter((it) => !!it);
                props.itemFields = inner;
                if (!props.default) {
                  props.default = Object.fromEntries(inner.map((it) => [it.path, it.defaultValue]));
                }
              }
              break;
            default:
              // try to multiple
              const f = this.convertField(
                {
                  ...field,
                  params: <any>field.type.options,
                  type: itype,
                },
                tp
              );
              if (!f) return null;
              if (f.component === "file-picker" || f.component === "image-picker") {
                f.component = "uploader";
              } else if (f.component === "text-field") {
                f.component = "combobox";
              } else if (f.component === "translate-box") {
                component = "editor-list";
                props.default = [];
                inner = [f];
                f.path = "item";

                break;
              } else if (f.component === "date-picker") {
                component = "editor-list";
                props["date-time"] = !(field.params?.dateOnly ?? false);
                inner = [f];
                f.path = "item";

                f.defaultValue = null;
                break;
              }
              f.props.multiple = true;
              if (f.header) f.header.multiple = true;
              return f;
          }
        }
        break;
      case "object":
        if (typeof field.type === "object") {
          needSuffix = true;
          inner = _.map(field.type.fields, (f) => this.convertField(f, innerTP + ".")).filter((it) => !!it);
        }
        if (inner) {
          defaultValue = _.merge({}, ...inner.map((it) => (it.defaultValue ? { [it.path]: it.defaultValue } : {})));
        }
        component = "group-object";
        break;
      default:
        console.warn("No suitable editor for", type);
        return null;
    }
    const name = getFieldName(field, editor, tp, needSuffix);
    if (readonlyHeaders.indexOf(name) !== -1) {
      props.readOnly = true;
    }
    const result: EditorField = {
      component,
      name,
      props,
      type,
      defaultValue,
      schema: field,
      path: field.path || field.name,
      inner,
    };
    if (editor.props) _.assign(result.props, editor.props);
    result.optional = editor.optional;
    result.sort = editor.sort;
    result.gp = editor.gp;
    result.group = editor.group;

    if (result.component === "editor-list" && !result.inner.filter((it) => !!it).length) {
      return null;
    }

    if (result.props?.readOnly) {
      result.props.clearable = false;
    }

    if (editor.hidden) {
      return null;
    }
    return result;
  }

  private updateDefaultValue() {
    // gather default values
    let defaultValue = {};
    for (let field of this.fields) {
      defaultValue[field.path] = field.defaultValue;
    }
    this.defaultValue = defaultValue;
  }

  private updateSearchFields() {
    const searchFields: SearchField[] = [];
    const editFields = [...this.fields];
    const textFields: string[] = [];

    for (const field of editFields) {
      if (!field) return;
      const path = field.path;
      let conds: string[] = [];
      const f = _.cloneDeep(field);
      f.props.readOnly = false;
      switch (f.component) {
        case "checkbox":
          conds = ["eq", "ne"];
          break;
        case "text-field":
          if (lookupType(f.schema.type) === "id") continue;
          if (f.props.type === "number") conds = ["lt", "gt", "lte", "gte", "eq", "ne", "inRange"];
          else {
            conds = ["contains", "notContains"];
            textFields.push(path);
          }
          break;
        case "date-picker":
          conds = ["inRange", "lt", "gt", "lte", "gte", "eq", "ne"];
          break;
        case "object-picker-list":
        case "object-picker-new":
          conds = ["in", "nin"];
          break;

        case "image-picker":
        case "file-picker":
        case "uploader":
          continue;

        default:
          continue;
      }
      f.props.required = false;
      f.props.clearable = true;
      f.props.hideDetails = true;
      const header = this.getHeader(f.schema);
      if (header) {
        if (f.props.multiple) header.multiple = true;
        // update extra headers here. so that some object value will not be displayed in data table.
        // for example editor-list.
        if (!this.headers.find((it) => it.value === header.value)) {
          this.extraHeaders.push({ ...header });
        }
        header.value = "";
        searchFields.push({
          name: field.name,
          path: path,
          edit: f,
          conds,
          cond: conds[0],
          header,
          color: getSearchColor(path),
          value1: undefined,
          value2: undefined,
        });
      }
    }
    this.searchFields = searchFields;
    this.textFields = textFields;
  }
}
