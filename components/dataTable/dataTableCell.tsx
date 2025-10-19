import { DataTableHeader } from "../editor/def";
import { useFeathers } from "@/contexts/feathers";
import _ from "lodash";
import { getThumbURL } from "../dialogs/mediaDialog";
import Link from "next/link";
import { useDataTableProvider } from "./dataTableProvider";
import { useEffect, useRef, useState } from "react";
import moment from "moment";

export interface Props {
  item: any;
  header: DataTableHeader;
}

export default function DataTableCell({ item, header }: Props) {
  const { getValue, getLink, updating } = useDataTableProvider();
  const feathers = useFeathers();

  const objectOnly = header.type === "multi";
  const [value, setValue] = useState<any>();
  const link = useRef<string | undefined>();
  let res: JSX.Element | JSX.Element[];

  useEffect(() => {
    if (!updating) setValue(getValue(item, header, objectOnly));
    link.current = getLink(item, header);
  }, [item, header, getValue, getLink, updating]);

  if (!value) return <></>;
  switch (header.type) {
    case "thumbURL":
    case "thumbItem":
      if (value) {
        res = <img key={`${header.value}`} src={getThumbURL(value, feathers)} style={{ width: 50, padding: 1 }} />;
      }
      break;
    case "thumb":
      if (typeof value === "string" && value.indexOf(",") !== -1) {
        setValue((value) => value.split(",")[0]);
      }
      res = <img key={`${header.value}`} src={getThumbURL(value, feathers)} style={{ width: 50, padding: 1 }} />;
      break;
    case "multi":
      // array
      if (header.multiple) {
        if (!value?.length) return;
        return (
          <div>
            {(value || []).map((it, index) => (
              <div key={index}>
                {(header.inner || []).map((h) => (
                  <DataTableCell key={h.value} item={it} header={h} />
                ))}
              </div>
            ))}
          </div>
        );
      } else if (value) {
        // object

        return (
          <div key={`${header.value}`}>
            {(header.inner || []).map((h) => (
              <DataTableCell key={h.value} item={value} header={h} />
            ))}
          </div>
        );
      }
      break;
    default:
      // const isDate = moment(value.toString(), moment.ISO_8601, true).isValid();
      // if (isDate) setValue((value) => moment(value).format("DD-MM-YYYY HH:mm"));
      res = <div key={`${header.value}_${value}`}>{value.toString()}</div>;
      break;
  }
  if (link.current) {
    return (
      <Link href={link.current} className="text-blue-500">
        {res}
      </Link>
    );
  }
  return res;
}
