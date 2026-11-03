import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthLayout
      headline="One vault for every credential your team touches."
      blurb="Create your account, then organise secrets into projects and invite the people who need them."
      points={[
        "Encrypted at rest, revealed only on demand",
        "Owner, editor and viewer roles per project",
        "Two-factor sign-in and session controls",
      ]}
    >
      <SignupForm />
    </AuthLayout>
  );
}
