import type { Metadata } from "next";
import { MembersScreen } from "@/components/members/MembersScreen";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return <MembersScreen />;
}
