import { createContext, useCallback, useContext, useState } from "react";
import { DataTableHeader } from "../editor/def";
import _ from "lodash";
import { useFeathers } from "@/contexts/feathers";

/**
 * @property {boolean} updating is used to call render
 */
interface DataTableContext<T> {
  getValue: (item: T, header: DataTableHeader, objectOnly?: boolean) => any;
  getLink: (item: T, header: DataTableHeader) => string;
  updating: boolean;
}

type FetchItem = {
  source: string;
  header: DataTableHeader;
  id: string;
  idProperty: string;
  prefix: string;
};

const DataTableStore = createContext<DataTableContext<any>>(undefined);

interface Props {
  children?: React.ReactNode;
}

export const DataTableProvider = ({ children }: Props) => {
  var fetchItems: FetchItem[] | null = null;
  const pendingFetch: Promise<void>[] = [];
  var fetchCache: Record<string, any> = {};
  const [updating, setUpdating] = useState(false);
  const feathers = useFeathers();

  const getValueByPath = useCallback((item: any, path: string | string[]) => {
    if (Array.isArray(path)) {
      for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (key === "*") {
          if (Array.isArray(item)) {
            if (i + 1 < path.length) {
              return item.map((it) => getValueByPath(it, path.slice(i + 1)));
            } else {
              return item;
            }
          } else {
            return [];
          }
        } else if (item != null) {
          item = item[key];
        }
      }
    } else {
      return _.get(item, path);
    }
  }, []);

  const getValue = useCallback((item: any, header: DataTableHeader, objectOnly?: boolean) => {
    const value = header.value ? getValueByPath(item, header.value) : item;

    let list = header.multiple ? value || [] : [value];

    if (header.unique) {
      list = Array.from(new Set(list));
    }

    let limitReached = false;

    if (header.limit && list.length > header.limit) {
      list = list.slice(0, header.limit);
      limitReached = true;
    }

    if (list && !Array.isArray(list)) {
      list = [list];
    }

    const values = list.map((value) => {
      const pathList = header.paths ?? [header.path || "name"];
      const prefix = pathList.join("/") + "_" || "";
      const idProperty = header.idProperty || "_id";

      let sItem: any = null;
      if (header.source) {
        sItem = fetchCache[prefix + value];

        if (sItem === undefined) {
          fetchCache = { ...fetchCache, [prefix + value]: { value: null } };

          queuePending();
          if (value) {
            fetchItems ??= [];
            fetchItems.push({
              source: header.source,
              header,
              prefix,
              id: value,
              idProperty,
            });
          }
          if (objectOnly || header.objectOnly) return null;
        } else if (sItem?.value === null) {
          if (objectOnly || header.objectOnly) return null;
          sItem = null;
        } else {
          sItem = sItem?.value;
        }
      }

      if (typeof value !== "number" && typeof value !== "boolean" && !value) {
        return value;
      }

      const result = pathList.map((path) => {
        let cur = value;
        if (sItem) {
          cur = path !== null ? _.get(sItem, path) : sItem;
        }
        // Handle multi-language objects - use English value
        if (cur && typeof cur === "object" && cur.en) {
          cur = cur.en;
        }
        return cur;
      });

      if (objectOnly || header.objectOnly) {
        return result[0];
      } else {
        return result.filter((it) => typeof it === "number" || !!it).join("/");
      }
    });

    if (objectOnly || header.objectOnly) {
      return header.multiple ? values : values[0];
    } else {
      if (limitReached) values.push("...");
      return values.map((value) => (value === undefined ? "" : value)).join(",");
    }
  }, []);

  const queuePending = () => {
    if (!fetchItems) {
      setUpdating(true);
      fetchItems = [];
      const fetchPromise = (async () => {
        await Promise.resolve();
        const fetches = [...fetchItems];
        fetchItems = null;
        const types = _.groupBy(fetches, (it) => it.prefix + it.source);

        await Promise.all(
          _.map(types, async (it, s) => {
            const { header, prefix, idProperty, source } = it[0];
            const service = feathers.service(source);
            // Split fetching list into chunk of 100 (or less)
            const chunks = _.chunk(it, 100);
            for (let chunk of chunks) {
              const ids = chunk.map((it) => it.id);

              try {
                const items = await service.find({
                  query: {
                    [idProperty]: {
                      $in: ids,
                    },
                    $limit: 100,
                    $populate: header.populate,
                  },
                });

                for (let data of items.data) {
                  const store = fetchCache[prefix + data[idProperty]];

                  if (store) {
                    store.value = data;
                    fetchCache = { ...fetchCache, [prefix + data[idProperty]]: store };
                  }
                }
              } catch (error) {
                console.warn(`Error fetching ${source}: ${idProperty} = ${ids.join(",")}`, error);
              }
            }
          })
        );
      })();
      const finalize = () => {
        const list = [...pendingFetch];
        const index = list.indexOf(fetchPromise);
        index !== -1 && list.splice(index, 1);
        pendingFetch.splice(0, pendingFetch.length);
        pendingFetch.push(...list);
        setUpdating(false);
      };
      fetchPromise.then(finalize, finalize);
      pendingFetch.push(fetchPromise);
    }
  };

  const getLink = useCallback((item: any, header: DataTableHeader) => {
    if (header.noLink || header.multiple) return;
    let value, source: string;

    if (header.linkSource) {
      value = getValueByPath(item, header.value);
      source = header.linkSource;
      if (!source) return;
    } else if (header.source) {
      value = getValueByPath(item, header.value);
      const pathList = header.paths ?? [header.path ?? "name"];
      const idProperty = header.idProperty ?? "_id";

      if (value && typeof value === "object") value = value[idProperty];
    } else {
      return;
    }
    if (header.direct) {
      // Direct link for opening editor dialog
      return `${source}${header.trailingSlash ?? true ? "/" : ""}edit${value}`;
    }
    if (!value) return;
    return `${source}${header.trailingSlash ?? true ? "/" : ""}?editor=${value}`;
  }, []);

  return <DataTableStore.Provider value={{ getValue, getLink, updating }}>{children}</DataTableStore.Provider>;
};

export const useDataTableProvider = () => {
  const provider = useContext(DataTableStore);
  if (!provider) throw Error("useDataTableProvider() muse be inside the DataTableProvider");
  return provider;
};
