import { EditorField } from "./def";
import { default as FilePicker } from "./filePicker";
import { default as ImagePicker } from "./imagePicker";
import { default as ObjectPickerList } from "./objectPickerList";
import { default as ObjectPickerNew } from "./objectPickerNew";
import { OpenDialog } from "@/layouts/default";
import _ from "lodash";
import { default as EditorList } from "./editorList";
import { default as TextField } from "./text-field";
import DatePicker from "./datePicker";
import i18n from "@/plugins/i18n";
import { getDate } from "@/plugins/date";

export { FilePicker, ImagePicker, ObjectPickerList, ObjectPickerNew, EditorList, TextField };

export interface Props {
  field: EditorField;
  item: any;
  onChange?: (value: any) => void;
  openDialog?: OpenDialog;
  key?: string | number | null | undefined;
  showLabel?: boolean;
}

export function computeComponent({ field, item, onChange, openDialog, key, showLabel }: Props) {
  let result: JSX.Element;
  let defaultValue = (typeof item === "object" ? item?.[field.path] : item) ?? field.defaultValue;
  let props = field.props;
  let options = field.schema?.options;
  switch (field.component) {
    case "editor-group":
      result = (
        <div className="flex flex-col rounded-xl bg-white p-4 gap-y-6">
          {field.default.map((f) =>
            computeComponent({
              field: f,
              item: item,
              onChange: (value) => {
                onChange({ ...(item ?? {}), [f.path]: value });
              },
              openDialog,
            })
          )}
        </div>
      );
      break;
    case "editor-list":
      result = <EditorList defaultItems={defaultValue} field={field} onChange={onChange} openDialog={openDialog} />;
      break;

    case "text-field":
      result = (
        <TextField
          key={key}
          inputValue={defaultValue}
          onChange={onChange}
          required={props.required}
          readOnly={props.readOnly}
          maxLength={options?.maxLength}
          minLength={options?.minLength}
          multiLine={props.multiLine}
          min={typeof options?.min === "number" ? options.min : undefined}
          max={typeof options?.max === "number" ? options.max : undefined}
          type={props?.type}
        />
      );

      break;
    case "date-picker":
      let value = getDate(defaultValue);
      result = (
        <DatePicker
          inputValue={value}
          onChange={onChange}
          required={props.required}
          readOnly={props.readOnly}
          min={typeof options?.min === "number" ? undefined : options.min}
          max={typeof options?.max === "number" ? undefined : options.max}
        />
      );
      break;
    case "checkbox":
      result = (
        <div className="flex justify-start">
          <input key={key} type="checkbox" className="size-8" checked={!!defaultValue} onChange={(e) => onChange(e.target.checked)} />
        </div>
      );
      break;
    case "group-object":
      if (field.inner) {
        result = (
          <div className="flex flex-col gap-y-6 bg-slate-100 rounded-md p-4">
            {field.inner.map((f) =>
              computeComponent({
                field: f,
                item: defaultValue,
                openDialog,
                onChange: (v) => {
                  onChange({ ...defaultValue, [f.path]: v });
                },
              })
            )}
          </div>
        );
      }

      break;
    case "file-picker":
      result = (
        <FilePicker
          openDialog={openDialog}
          defaultValue={defaultValue}
          onChange={onChange}
          multiple={props?.multiple}
          returnObject={!!!props.attachmentId}
          type={field.schema?.params?.fileType}
        />
      );
      break;
    case "image-picker":
    case "uploader":
      result = (
        <ImagePicker
          openDialog={openDialog}
          defaultValue={defaultValue}
          onChange={onChange}
          multiple={props?.multiple}
          returnObject={!!!props.attachmentId}
          type={field.schema?.params?.fileType}
        />
      );
      break;
    case "object-picker-list":
      result = (
        <ObjectPickerList
          path={props.path}
          defaultValue={defaultValue}
          onChange={onChange}
          multiple={props.multiple}
          items={props?.items}
          query={props?.query}
          translate={props?.translate}
        />
      );
      break;
    case "object-picker-new":
      result = (
        <ObjectPickerNew
          path={props.path}
          inputValue={defaultValue}
          onChange={onChange}
          multiple={props.multiple}
          items={props?.items}
          required={props?.required}
          translate={props?.translate}
        />
      );
      break;

    default:
      break;
  }
  return (
    <div className="flex flex-col gap-y-2 " key={`${field.path}_${key}`}>
      {(showLabel ?? true) && <label>{i18n.t(field.name)}</label>}
      {result}
    </div>
  );
}
