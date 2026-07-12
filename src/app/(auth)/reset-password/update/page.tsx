import type { Metadata } from "next";
import { Suspense } from "react";
import { UpdatePasswordContent } from "./update-password-form";

export const metadata: Metadata = { title: "Update password" };

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordContent />
    </Suspense>
  );
}
