import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Create your workspace</h1>
      <p className="mb-8 mt-2 text-muted">Start turning ideas into polished posts.</p>
      <RegisterForm />
    </>
  );
}
