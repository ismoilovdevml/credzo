import type { Metadata } from "next";
import { CredentialDetail } from "@/components/credential/CredentialDetail";

export const metadata: Metadata = { title: "Credential" };

export default function CredentialDetailPage() {
  return <CredentialDetail />;
}
