import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    <AuthLayout
      headline="Welcome back to your team’s vault."
      blurb="Credentials, environments and access — all where you left them."
      points={[
        "Encrypted credentials for 60+ services",
        "Role-based access per project",
        "Every reveal recorded in the audit log",
      ]}
    >
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </AuthLayout>
  );
}
