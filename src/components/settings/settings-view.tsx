"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Save, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { createClient } from "@/lib/supabase/client";
import {
  PLATFORMS,
  PLATFORM_LABEL,
  TONES,
  TONE_LABEL,
  type Profile,
} from "@/lib/types";
import { apiFetch } from "@/lib/utils";
import { passwordSchema, profileSchema } from "@/lib/validators";

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function SettingsView({
  email,
  initialProfile,
}: {
  email: string;
  initialProfile: Profile;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: initialProfile.full_name ?? "",
      defaultPlatform: initialProfile.default_platform,
      defaultTone: initialProfile.default_tone,
      blogCmsUrl: initialProfile.blog_cms_url ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const saveProfile = async (values: ProfileValues) => {
    try {
      await apiFetch<{ profile: Profile }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      toast.success("Settings saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    }
  };

  const changePassword = async (values: PasswordValues) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw new Error(error.message);
      passwordForm.reset();
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await apiFetch("/api/settings", { method: "DELETE" });
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      toast.success("Your account has been deleted.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account.");
      setDeleting(false);
    }
  };

  const defaultPlatform = profileForm.watch("defaultPlatform");
  const defaultTone = profileForm.watch("defaultTone");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your profile, default creation preferences, and account security.
        </p>
      </div>

      {/* Profile & Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-yellow" aria-hidden /> Profile & defaults
          </CardTitle>
          <CardDescription>
            Signed in as <strong className="text-foreground">{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(saveProfile)} noValidate className="space-y-5">
            <Field
              label="Full name"
              htmlFor="settings-name"
              error={profileForm.formState.errors.fullName?.message}
            >
              <Input
                id="settings-name"
                maxLength={80}
                {...profileForm.register("fullName")}
              />
            </Field>

            <div className="space-y-1.5">
              <Label>Default platform</Label>
              <ChipGroup
                label="Default platform"
                value={defaultPlatform}
                options={PLATFORMS}
                onChange={(v) =>
                  profileForm.setValue("defaultPlatform", v, { shouldValidate: true })
                }
                renderIcon={(p) => <PlatformIcon platform={p} />}
                renderLabel={(p) => PLATFORM_LABEL[p]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Default tone</Label>
              <ChipGroup
                label="Default tone"
                value={defaultTone}
                options={TONES}
                onChange={(v) =>
                  profileForm.setValue("defaultTone", v, { shouldValidate: true })
                }
                renderLabel={(t) => TONE_LABEL[t]}
              />
            </div>

            <Field
              label="Blog CMS URL (optional)"
              htmlFor="settings-cms"
              hint="Used by the Blog transfer dialog to give you a one-click 'Open CMS' button (must start with https://)."
              error={profileForm.formState.errors.blogCmsUrl?.message}
            >
              <Input
                id="settings-cms"
                type="url"
                placeholder="https://your-cms.example.com/posts/new"
                {...profileForm.register("blogCmsUrl")}
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              loading={profileForm.formState.isSubmitting}
            >
              <Save /> Save preferences
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue" aria-hidden /> Change password
          </CardTitle>
          <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(changePassword)} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="New password"
                htmlFor="new-password"
                error={passwordForm.formState.errors.password?.message}
              >
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("password")}
                />
              </Field>
              <Field
                label="Confirm new password"
                htmlFor="confirm-new-password"
                error={passwordForm.formState.errors.confirmPassword?.message}
              >
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("confirmPassword")}
                />
              </Field>
            </div>
            <Button
              type="submit"
              variant="secondary"
              loading={passwordForm.formState.isSubmitting}
            >
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Delete account</CardTitle>
          <CardDescription>
            Permanently deletes your profile, generated content, drafts, templates, connections and
            calendar entries. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmDialog
            title="Permanently delete your account?"
            description="All your drafts, generation history, templates, calendar entries and connected tokens will be erased immediately."
            confirmLabel="Delete my account"
            onConfirm={deleteAccount}
          >
            <Button type="button" variant="danger" loading={deleting}>
              <Trash2 /> Delete account
            </Button>
          </ConfirmDialog>
        </CardContent>
      </Card>
    </div>
  );
}
