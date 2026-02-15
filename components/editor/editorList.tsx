import _ from "lodash";
import { MdAdd, MdClear, MdMenu } from "react-icons/md";
import { computeComponent } from ".";
import { OpenDialog } from "@/layouts/default";
import { EditorField } from "./def";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface Props {
  defaultItems: any[];
  field: EditorField;
  openDialog: OpenDialog;
  onChange?: (value: any[]) => void;
}

export default function EditorList({ defaultItems, field, onChange, openDialog }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [items, setItems] = useState(defaultItems);

  function setValues(items: any[]) {
    setItems(items);
    onChange?.(items);
  }

  function addItem() {
    let item = _.mapValues(_.keyBy(field.inner, "path"), "defaultValue");
    setValues([...items, item]);
  }

  function deleteItem(index: number) {
    let list = [...items];
    list.splice(index, 1);
    setValues(list);
  }

  function onDragStart(source: number) {
    dragIndex.current = source;
  }

  function onDragEnd() {
    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  function onDragEnter(index: number) {
    dragOverIndex.current = index;
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  function onDrop() {
    if (!dragIndex || !dragOverIndex) return;
    const list = [...defaultItems];
    const item = list[dragIndex.current];
    list.splice(dragIndex.current, 1);
    list.splice(dragOverIndex.current, 0, item);
    setValues(list);
  }

  return (
    <div className="rounded-xl bg-white p-4 flex flex-col gap-y-10">
      <ul className="flex flex-col gap-y-8">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex gap-x-2 items-center"
            draggable={editing}
            onDragStart={() => onDragStart(index)}
            onDragEnter={() => onDragEnter(index)}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {editing && (
              <div className="center flex-shrink-0 flex-grow-0 size-6">
                <MdMenu />
              </div>
            )}
            <div className="bg-slate-50 rounded-md p-4 w-full flex flex-col gap-6" style={editing ? { cursor: "move" } : {}}>
              {field.inner.map((f) =>
                computeComponent({
                  field: f,
                  item: item,
                  onChange: (value) => {
                    let list = [...items];
                    list[index] = { ...item, [f.path]: value };
                    setValues(list);
                  },
                  openDialog,
                })
              )}
            </div>
            {editing && (
              <div
                role="button"
                onClick={() => deleteItem(index)}
                className="rounded border-2 border-gray-700  center flex-shrink-0 flex-grow-0 size-8"
              >
                <MdClear size={24} color="gray-700" />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-x-4">
        <div role="button" className="bg-white rounded border-blue-500 border-2 flex-grow-0 w-fit" onClick={addItem}>
          <div className="flex pl-2 pr-4 py-2 gap-x-1 text-blue-500 ">
            <MdAdd size={24} color="blue-500" />
            <p>{t("basic.add")}</p>
          </div>
        </div>
        <div
          role="button"
          className="bg-white rounded border-blue-500 border-2 flex-grow-0 w-fit"
          onClick={() => {
            setEditing((value) => !value);
          }}
        >
          <div className="flex px-2 py-2 gap-x-1 text-blue-500 ">
            <p>{!editing ? t("basic.edit") : t("basic.ok")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
