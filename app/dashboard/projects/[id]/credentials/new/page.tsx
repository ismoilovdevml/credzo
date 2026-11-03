import { Suspense } from "react";
import type { Metadata } from "next";
import { FormSkeleton } from "@/components/credential-form/FormChrome";
import { NewCredentialScreen } from "@/components/credential-form/NewCredentialScreen";

export const metadata: Metadata = { title: "New credential" };

export default async function NewCredentialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // useSearchParams (?type=, ?prefill=) needs a Suspense boundary.
    <Suspense fallback={<FormSkeleton />}>
      <NewCredentialScreen projectId={id} />
    </Suspense>
  );
}
