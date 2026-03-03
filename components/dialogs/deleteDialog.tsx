import { useState } from "react";
import { DialogProps } from "./basicDialog";

interface DeleteDialogProps<T> {
  deleteItemCore: (item: T) => Promise<void>;
  item: T;
}

// TODO print out all header instead fixed name
function DeleteDialog<T extends { _id?: string; name?: string | Record<string, string> }>({ item, deleteItemCore, ...props }: DeleteDialogProps<T> & DialogProps<T>) {
  const [isDeleting, setDeleting] = useState(false);

  const getDisplayName = (item: T): string => {
    if (!item) return "";
    if (item.name) {
      if (typeof item.name === "string") return item.name;
      if (typeof item.name === "object") {
        // Handle multilingual name objects like {en: "...", hy: "...", ru: "..."}
        return (item.name as Record<string, string>).en || Object.values(item.name).find((v) => v) || "";
      }
    }
    return item._id ?? "";
  };

  const deleteItem = async () => {
    setDeleting(true);
    try {
      if (!item) return;
      await deleteItemCore(item);
      props.modalResult(true);
    } catch (error) {
      alert("Delete item fails");
      console.warn(error);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="h-full bg-slate-100 flex flex-col p-4">
      <h2 className="text-2xl">Confirm Delete?</h2>
      <p>Name: {getDisplayName(item)}</p>
      <div className="flex flex-row justify-between items-center mt-4">
        <button disabled={isDeleting} onClick={deleteItem} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 min-w-24 rounded">
          Delete
        </button>
        <button onClick={() => props.modalResult(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 min-w-24 rounded">
          Back
        </button>
      </div>
    </div>
  );
}

export default DeleteDialog;
