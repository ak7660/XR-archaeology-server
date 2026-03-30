import { NextPageWithLayout } from "./_app";

import { Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DefaultLayout, { OpenDialog } from "@/layouts/default";
import DataTable from "@/components/dataTable/dataTable";
import { EditorField } from "@components/editor/def";
import { EditorConfig } from "@/contexts/schemas/def";
import { useHeaderContext } from "@/contexts/header";
import { useSchemasContext } from "@/contexts/schemas";
import { useRouter } from "next/router";
import _ from "lodash";
import { computeComponent } from "@components/editor";
import { useViewSetting } from "@/contexts/viewSettings";
import { useFeathers } from "@/contexts/feathers";
import { getThumbURL } from "@/components/dialogs/mediaDialog";
import { MdDelete } from "react-icons/md";
import { AttachmentUploadResult } from "@/components/dialogs/attachmentUploadDialog";

const Page: NextPageWithLayout = ({ openDialog }: { openDialog: OpenDialog }) => {
  const router = useRouter();
  const path = useMemo(() => (typeof router.query.schema === "string" ? router.query.schema : router.query.schema?.[0]), [router]);
  const feathers = useFeathers();

  const schemas = useSchemasContext();
  const { setActions } = useHeaderContext();

  const { state: settings } = useViewSetting();
  const setting = settings?.[path];

  const [config, setConfig] = useState<EditorConfig>();
  const canImport = config?.import ?? false;
  const canCreate = config?.create ?? false;
  const canPatch = config?.patch ?? false;
  const canClone = config?.clone ?? false;
  const canRemove = config?.remove ?? false;
  const canExport = config?.export ?? false;

  const headers = useMemo(
    () =>
      setting?.headers
        ? [...(config?.headers ?? []), ...(config?.extraHeaders ?? [])].filter((it) => setting.headers.includes(it.value))
        : config?.headers ?? [],
    [setting, config]
  );

  const [fields, setFields] = useState<EditorField[]>([]);
  const [attachmentType, setAttachmentType] = useState<"all" | "image" | "model">("all");
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const isAttachmentsPage = path === "attachments";

  const query = useMemo(() => {
    const base = { ...(config?.filter ?? {}) };
    if (isAttachmentsPage && attachmentType !== "all") {
      base.type = attachmentType;
    }
    if (isAttachmentsPage && attachmentSearch.trim()) {
      base.name = {
        $regex: attachmentSearch.trim(),
        $options: "i",
      };
    }
    return base;
  }, [config, isAttachmentsPage, attachmentType, attachmentSearch]);

  const tableRef = useRef(null);

  const toText = useCallback((value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((it) => toText(it)).filter((it) => !!it).join(", ");
    if (typeof value === "object") {
      const localized = value.en ?? value.hy ?? value.ru;
      if (typeof localized === "string" || typeof localized === "number" || typeof localized === "boolean") {
        return String(localized);
      }
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return "";
  }, []);

  useEffect(() => {
    if (path) {
      initConfig();
    }
  }, [router.query]);

  const uploadAttachment = useCallback(
    async (payload: AttachmentUploadResult) => {
      setUploadingAttachment(true);
      try {
        const data = new FormData();
        data.append("file", payload.file, payload.name.trim() || payload.file.name);
        await feathers.post(`attachments/upload?type=${encodeURIComponent(payload.type)}`, data, {});
        tableRef.current?.refresh?.();
      } catch (error) {
        console.warn("Upload attachment failed", error);
        alert("Upload attachment failed");
      } finally {
        setUploadingAttachment(false);
      }
    },
    [feathers]
  );

  const openAttachmentUploadDialog = useCallback(async () => {
    const result = await openDialog({
      component: import("@components/dialogs/attachmentUploadDialog"),
      props: {},
      className: "w-11/12 max-w-xl",
    });
    if (!result || result === false) return;
    await uploadAttachment(result as AttachmentUploadResult);
  }, [openDialog, uploadAttachment]);

  useEffect(() => {
    setActions([
      {
        icon: "refresh",
        altText: "basic.refresh",
        name: "basic.refresh",
        action: () => {
          tableRef.current?.refresh?.();
        },
      },
      ...(isAttachmentsPage
        ? [
            {
              icon: "add",
              altText: "basic.add",
              name: "basic.add",
              action: () => openAttachmentUploadDialog(),
            },
          ]
        : []),
      ...(!isAttachmentsPage && canCreate
        ? [
            {
              icon: "add",
              altText: "basic.add",
              name: "basic.add",
              action: () => tableRef.current?.editItem(),
            },
          ]
        : []),
    ]);
  }, [config, canCreate, isAttachmentsPage, openAttachmentUploadDialog]);

  function initConfig() {
    const route = "/" + path;
    const config = schemas.lookupRoute(route);

    if (!config) {
      console.warn(`Route not found ${route}`);
      return;
    }

    const fields = schemas.sortFields(config.fields ?? []);
    setFields(fields);
    setConfig(config);
  }

  const renderEditor = (item: any, setItem: Dispatch<SetStateAction<any>>) => {
    return fields.map((field) => {
      return computeComponent({
        field,
        item,
        onChange: (value: any) => {
          if (field.component === "editor-group") {
            // editor-group onChange passes the complete updated item
            setItem(value);
          } else {
            setItem((item) => ({ ...item, [field.path]: value }));
          }
        },
        openDialog,
      });
    });
  };

  const showViewSetting = useCallback(
    async function showViewSetting() {
      await openDialog({
        component: import("@components/dialogs/viewSettingsDialog"),
        props: { path, config },
        className: "edit-dialog",
      });
    },
    [path, config]
  );

  const deleteAttachment = useCallback(
    async (item: any) => {
      if (!item?._id) return;
      if (!confirm("Delete this attachment?")) return;
      try {
        await feathers.service("attachments").remove(item._id);
        tableRef.current?.refresh?.();
      } catch (error) {
        console.warn("Delete attachment failed", error);
        alert("Delete attachment failed");
      }
    },
    [feathers]
  );

  const renderAttachmentItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isImage = item?.type === "image";
      const viewURL = item?._id && feathers.apiURL ? `${feathers.apiURL}/attachments/${item._id}` : "";
      const itemName = toText(item?.name) || "Unnamed";
      const itemType = toText(item?.type) || "file";
      const sizeText = item?.size ? `${Math.round(item.size / 1024)} KB` : "";

      return (
        <div role="listitem" key={index} id={`${index}`} className="w-full h-32 border-b border-gray-200 px-3 py-2 overflow-hidden">
          <div className="h-full w-full flex items-center gap-4 overflow-hidden">
            <div
              className="h-20 w-20 min-h-20 min-w-20 max-h-20 max-w-20 shrink-0 rounded bg-slate-50 border border-gray-200 overflow-hidden flex items-center justify-center"
              style={{ width: 80, height: 80, minWidth: 80, minHeight: 80, maxWidth: 80, maxHeight: 80 }}
            >
              {isImage ? (
                <img src={getThumbURL(item, feathers)} alt={itemName || "attachment"} className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-gray-600 px-2 text-center leading-tight truncate w-full">{itemType}</div>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="font-medium text-sm truncate">{itemName}</div>
              <div className="text-xs text-gray-500 mt-1">{sizeText}</div>
            </div>

            <div className="shrink-0 flex items-center gap-2 ml-2">
              {viewURL ? (
                <a href={viewURL} target="_blank" rel="noreferrer" className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm">
                  View
                </a>
              ) : null}
              <button type="button" className="px-3 py-1 rounded text-red-600 hover:bg-red-50" onClick={() => deleteAttachment(item)}>
                <MdDelete size={18} />
              </button>
            </div>
          </div>
        </div>
      );
    },
    [feathers, deleteAttachment, toText]
  );

  if (config) {
    if (!isAttachmentsPage) {
      return (
        <DataTable
          ref={tableRef}
          path={config.service}
          default={config.defaultValue}
          canClone={canClone}
          canEdit={canPatch}
          canRemove={canRemove}
          query={query}
          idProperty="_id"
          noPaginate={typeof config.paginate === "boolean" && !config.paginate}
          headers={headers}
          editor={renderEditor}
          openDialog={openDialog}
          showViewSetting={showViewSetting}
          config={config}
        />
      );
    }

    return (
      <div className="h-full min-h-0 w-full flex flex-col gap-3 overflow-hidden">
        <div className="px-4 pt-2 pb-2 bg-white border border-gray-200 rounded flex flex-col md:flex-row gap-2 items-stretch md:items-end">
          <div className="flex flex-col gap-1 md:w-80">
            <label className="text-sm text-gray-600">Search attachments</label>
            <input
              type="text"
              value={attachmentSearch}
              onChange={(e) => setAttachmentSearch(e.target.value)}
              placeholder="Search by name"
              className="h-9 px-2 rounded border border-gray-300"
            />
          </div>
          <div className="flex flex-col gap-1 md:w-52">
            <label className="text-sm text-gray-600">Type filter</label>
            <select
              value={attachmentType}
              onChange={(e) => setAttachmentType(e.target.value as "all" | "image" | "model")}
              className="h-9 px-2 rounded border border-gray-300"
            >
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="model">Models</option>
            </select>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <DataTable
            ref={tableRef}
            path={config.service}
            default={config.defaultValue}
            canClone={false}
            canEdit={false}
            canRemove={canRemove}
            query={query}
            idProperty="_id"
            noPaginate={typeof config.paginate === "boolean" && !config.paginate}
            showHeader={false}
            endSpacerHeight={96}
            headers={headers}
            editor={renderEditor}
            openDialog={openDialog}
            showViewSetting={undefined}
            config={config}
            renderItem={renderAttachmentItem}
            showSearch={false}
          />
        </div>
      </div>
    );
  } else {
    return (
      <div className=" flex flex-col h-full w-full justify-center items-center">
        <div className="flex flex-col gap-4 text-center items-center">
          <h1 className="text-2xl text-gray-400 ">Loading...</h1>
          <div className="loader mb-10" />
        </div>
      </div>
    );
  }
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <DefaultLayout>{page}</DefaultLayout>;
};

export default Page;
