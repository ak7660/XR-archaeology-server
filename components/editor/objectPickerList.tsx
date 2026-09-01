import { useFeathers } from "@/contexts/feathers";
import { useSchemasContext } from "@/contexts/schemas";
import { getNameField, getNameFields } from "@/contexts/schemas/utils";
import { SchemaFieldJson } from "@/server/feathers/schema";
import _ from "lodash";
import { useEffect, useLayoutEffect, useState } from "react";
import { MdClear } from "react-icons/md";
import DataList from "../data-list";
import { t } from "i18next";

export interface ObjectPickerListProps<T extends Record<string, any>, K extends keyof T> {
  path: string;
  idProperty?: K;
  multiple?: boolean; // default true
  items?: T[];
  returnObject?: boolean;
  query?: any;
  defaultValue?: T[K] | T | (T[K] | T)[];
  onChange?: (value: T[K] | T | (T[K] | T)[]) => void;
  translate?: boolean; //  translated enum
}

function ObjectPickerList<T extends Record<string, any>, K extends keyof T>(props: ObjectPickerListProps<T, K>) {
  const [showMenu, setShowMenu] = useState(false);
  const [nameFields, setNameFields] = useState<SchemaFieldJson[]>([]);
  const [items, setItems] = useState<T[]>([]);
  const [selectedItems, setSelectedItems] = useState<T[] | null>(null);

  const schemas = useSchemasContext();
  const feathers = useFeathers();
  // `multiple` defaults to FALSE, matching ObjectPickerNew.
  //
  // It used to default to true, so any single-reference field rendered by this
  // picker (Event.venue, for one) behaved as a multi-select: picking a venue
  // added a chip instead of replacing the current one, and onChange emitted an
  // array into a field that stores a single id. def.ts only sets
  // props.multiple = true for array fields, so a single ref arrives here as
  // undefined and silently took the wrong default.
  const { path, idProperty = "_id", multiple = false, returnObject = false, translate = false } = props;

  useLayoutEffect(() => {
    updateResolve();
    syncData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const defaultValue = Array.isArray(props.defaultValue) ? props.defaultValue || [] : [props.defaultValue];
      const resolved = await Promise.all(
        defaultValue
          .filter((it) => !!it)
          .map(async (value) => {
            if (typeof value !== "string") return value;
            const found = items.find((it) => it[idProperty] === value);
            if (found) return found;
            // The stored value is not in `items`. With a `query` in play that is
            // expected - the record simply falls outside the filter - and
            // returning the bare id string made the chip render "[DELETED]" for
            // a perfectly valid selection. Fetch it directly so an existing
            // value always displays, whatever the filter allows.
            try {
              return await feathers.service(path).get(value);
            } catch {
              return value;
            }
          })
      );
      if (!cancelled) setSelectedItems(resolved.filter((it) => !!it) as T[]);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [items, props.defaultValue]);

  const updateResolve = async () => {
    if (path) {
      await schemas.init();
      const refRoute = schemas.lookupRoute(path);
      const refTable = refRoute?.def;
      if (!refTable) return;
      const nameField = getNameField(refTable);
      const nameFields = getNameFields(refTable);

      if (nameFields.length) {
        setNameFields(nameFields);
      } else if (nameField) {
        setNameFields([nameField]);
      }
    }
  };

  const syncData = async () => {
    if (props.items) {
      setItems(props.items);
      return;
    }
    if (path) {
      try {
        const data = await feathers.service(path).find({
          query: { ...(props.query || {}), $paginate: false },
        });
        setItems(data);
      } catch (error) {
        const data = await feathers.service(path).find({
          query: { ...(props.query || {}) },
        });
        if (Array.isArray(data)) {
          setItems(data);
        } else {
          setItems(data.data);
        }
      }
    }
  };

  const pickItem = (item: T) => {
    const index = selectedItems.findIndex((it) => it[idProperty] === item[idProperty]);
    const items = [...selectedItems];
    if (index !== -1) {
      items.splice(index, 1);
    } else {
      if (!multiple) items.splice(0, items.length);
      items.push(item);
    }
    let res = items;
    if (!returnObject) {
      res = res.map((it) => _.get(it, idProperty));
    }

    setSelectedItems(items);
    props.onChange(multiple ? res : res[0]);
  };

  const renderMenuItem = ({ item, index }: { item: T; index: number }) => {
    const idx = selectedItems.findIndex((it) => it[idProperty] === item[idProperty]);
    const isActive = idx !== -1;
    
    let fallbackName = item["name"];
    if (translate) fallbackName = t(_.get(item, ["name", "$t"])) || "";
    if (fallbackName && typeof fallbackName === "object" && fallbackName.en) {
      fallbackName = fallbackName.en;
    }
    
    return (
      <div key={item[idProperty]} className={`item ${isActive ? "item-active" : ""} text-gray-900`} onClick={() => pickItem(item)}>
        {nameFields.length > 0 ? (
          nameFields.map((field) => {
            let value = item[field.name];
            // Handle multi-language objects - use English value
            if (value && typeof value === "object" && value.en) {
              value = value.en;
            }
            return (
              <div key={field.name} className="flex-grow text-gray-900">
                {value}
              </div>
            );
          })
        ) : (
          <div className="flex-grow text-gray-900">
            {fallbackName ?? "[DELETED]"}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="object-picker scrollable" onClick={() => setShowMenu((show) => !show)}>
        {/* chip */}
        <div className="flex gap-x-2">
          {(selectedItems || []).map((item, index) => {
            let name = nameFields.length ? item[nameFields[0].name] : item["name"];
            if (translate) name = t(_.get(item, ["name", "$t"])) || "";
            // Handle multi-language objects - use English value
            if (name && typeof name === "object" && name.en) {
              name = name.en;
            }
            const isDeleted = name === undefined || name === null;
            name ??= "[DELETED]";
            return (
              <div key={index} className="bg-gray-50 flex rounded items-center gap-x-3 px-2 chip text-gray-900">
                {/* Colour stated explicitly rather than inherited. ObjectPickerNew
                    already does this; here the non-deleted branch set no colour at
                    all, so the label took whatever an ancestor happened to define -
                    and when that matched the surrounding surface the text became
                    unreadable. */}
                <div className={isDeleted ? "text-gray-500" : "text-gray-900"}>{name}</div>
                <button type="button" onClick={() => pickItem(item)}>
                  <MdClear size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* menu */}
      {showMenu && (
        <div>
          <div className="absolute left-0 right-0 top-10 object-picker-menu z-20">
            {/* `query` was previously dropped here, so a schema could not
                restrict or order the options a picker offered - the menu always
                listed the whole collection in insertion order. */}
            <DataList path={path} query={props.query} renderItem={renderMenuItem} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ObjectPickerList;
