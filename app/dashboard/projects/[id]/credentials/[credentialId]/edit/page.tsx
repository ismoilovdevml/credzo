import type { Metadata } from "next";
import { EditCredentialScreen } from "@/components/credential-form/EditCredentialScreen";

export const metadata: Metadata = { title: "Edit credential" };

export default async function EditCredentialPage({
  params,
}: {
  params: Promise<{ id: string; credentialId: string }>;
}) {
  const { id, credentialId } = await params;
  return <EditCredentialScreen projectId={id} credentialId={credentialId} />;
}
