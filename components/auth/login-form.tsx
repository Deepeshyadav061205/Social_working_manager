"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validators";

type Values = z.infer<typeof loginSchema>;

/** Only allow same-site relative redirects after login (prevents open redirects). */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(
    params.get("error") === "config"
      ? "The server is missing its Supabase configuration. See README → Supabase setup."
      : params.get("error") === "confirm"
        ? "That confirmation link is invalid or has expired."
        : null
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        setFormError(friendlyAuthError(error.message));
        return;
      }
      toast.success("Welcome back!");
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (e) {
      setFormError(friendlyAuthError(e instanceof Error ? e.message : null));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          {...register("email")}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby="password-error"
          {...register("password")}
        />
      </Field>
      <Button type="submit" variant="primary" className="w-full" size="lg" loading={isSubmitting}>
        Log in
      </Button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-blue underline decoration-yellow/70 underline-offset-4 hover:text-foreground">
          Create an account
        </Link>
      </p>
    </form>
  );
}
