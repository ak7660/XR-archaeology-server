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

const Page: NextPageWithLayout = ({ openDialog }: { openDialog: OpenDialog }) => {
  const router = useRouter();
  const path = useMemo(() => (typeof router.query.schema === "string" ? router.query.schema : router.query.schema?.[0]), [router]);

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
  const query = config?.filter ?? {};

  const tableRef = useRef(null);

  useEffect(() => {
    initConfig();
  }, [router.query]);

  useEffect(() => {
    setActions([
      // ...(canImport ? [{ icon: "uploadFile", altText: "import", name: "import", action: () => {} }] : []),
      // ...(canExport ? [{ icon: "download", altText: "export", name: "Export" }] : []),
      {
        icon: "refresh",
        altText: "refresh",
        name: "refresh",
        action: () => {
          tableRef.current?.refresh?.();
        },
      },
      ...(canCreate
        ? [
            {
              icon: "add",
              altText: "add",
              name: "Add",
              action: () => tableRef.current?.editItem(),
            },
          ]
        : []),
    ]);
  }, [config]);

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

  if (config) {
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
