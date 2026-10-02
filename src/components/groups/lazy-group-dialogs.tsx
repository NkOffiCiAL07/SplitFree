import { lazyControlledDialog } from "@/components/shared/lazy-dialog";

// Group create/edit forms (react-hook-form, zod, Radix selects) load when first opened, not with the page.
export const LazyCreateGroupDialog = lazyControlledDialog(() =>
  import("./create-group-dialog").then((m) => m.CreateGroupDialog)
);
export const LazyEditGroupDialog = lazyControlledDialog(() =>
  import("./edit-group-dialog").then((m) => m.EditGroupDialog)
);
