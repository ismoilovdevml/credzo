import type { Metadata } from "next";
import { GeneratorScreen } from "@/components/generator/GeneratorScreen";

export const metadata: Metadata = { title: "Generator & share" };

export default function GeneratorPage() {
  return <GeneratorScreen />;
}
