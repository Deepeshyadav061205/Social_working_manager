"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, MailCheck } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/validators";

type Values = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async ({ fullName, email, password }: Values) => {
    setFormError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) {
        setFormError(friendlyAuthError(error.message));
        return;
      }
      // Supabase returns a user with no identities when the email is already registered.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setFormError(friendlyAuthError("User already registered"));
        return;
      }
      if (!data.session) {
        // Email confirmation is enabled on the Supabase project.
        setConfirmEmail(email);
        return;
      }
      toast.success("Account created — welcome!");
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setFormError(friendlyAuthError(e instanceof Error ? e.message : null));
    }
  };

  if (confirmEmail) {
    return (
      <div role="status" className="rounded-card border border-line bg-surface-1 p-6">
        <MailCheck className="h-8 w-8 text-yellow" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold text-foreground">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <strong className="text-foreground">{confirmEmail}</strong>. Click it to activate
          your account, then log in.
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}
      <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} aria-describedby="fullName-error" {...register("fullName")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby="email-error" {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-error"
          {...register("password")}
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby="confirmPassword-error"
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" variant="primary" className="w-full" size="lg" loading={isSubmitting}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue underline decoration-yellow/70 underline-offset-4 hover:text-foreground">
          Log in
        </Link>
      </p>
    </form>
  );
}
