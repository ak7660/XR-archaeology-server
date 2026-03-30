import { useMemo, useState } from "react";
import { DialogProps } from "./basicDialog";

export type AttachmentUploadType = "image" | "model";

export interface AttachmentUploadResult {
  name: string;
  file: File;
  type: AttachmentUploadType;
}

function AttachmentUploadDialog(props: DialogProps<AttachmentUploadResult | boolean>) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AttachmentUploadType>("image");
  const [file, setFile] = useState<File | null>(null);

  const canSubmit = useMemo(() => !!file, [file]);

  const submit = () => {
    if (!file) return;
    props.modalResult({
      name: name.trim() || file.name,
      file,
      type,
    });
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-md w-full max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Upload Attachment</h2>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional, defaults to file name"
            className="h-10 px-3 rounded border border-gray-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as AttachmentUploadType)} className="h-10 px-3 rounded border border-gray-300">
            <option value="image">Image</option>
            <option value="model">Model</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-700">File</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-10" />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="h-10 px-4 rounded border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200"
          onClick={() => props.modalResult(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="h-10 px-4 rounded border border-slate-900 bg-slate-900 text-white disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-700"
          style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
          onClick={submit}
          disabled={!canSubmit}
        >
          Upload
        </button>
      </div>
    </div>
  );
}

export default AttachmentUploadDialog;
