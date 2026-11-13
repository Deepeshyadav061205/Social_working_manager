import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreateWorkspace } from "@/components/create/create-workspace";
import { isUuid } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_MODELS, getModel, getProvider } from "@/lib/llm";
import { PLATFORMS, type Platform, type Template, type Tone } from "@/lib/types";

export const metadata: Metadata = { title: "Create" };

export default async function CreatePage({
  searchParams,
}: {
  searchParams: { template?: string; history?: string; platform?: string };
}) {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: templates }] = await Promise.all([
    supabase
      .from("profiles")
      .select("default_platform, default_tone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("templates")
      .select("id, user_id, name, structure_text, default_platform, default_tone, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  let initialHistoryItem: {
    id: string;
    body: string;
    platform: Platform;
    tone: Tone;
    inputText?: string;
  } | null = null;

  if (searchParams.history && isUuid(searchParams.history)) {
    const { data: entry } = await supabase
      .from("generated_content")
      .select("id, refined_body, platform, tone, request_id")
      .eq("id", searchParams.history)
      .eq("user_id", user.id)
      .maybeSingle();

    if (entry) {
      const { data: reqRow } = await supabase
        .from("content_requests")
        .select("input_text")
        .eq("id", entry.request_id as string)
        .eq("user_id", user.id)
        .maybeSingle();

      initialHistoryItem = {
        id: entry.id as string,
        body: entry.refined_body as string,
        platform: entry.platform as Platform,
        tone: entry.tone as Tone,
        inputText: (reqRow?.input_text as string | undefined) ?? "",
      };
    }
  }

  let llmProvider = "gemini";
  let llmModel = DEFAULT_MODELS.gemini;
  try {
    const p = getProvider();
    llmProvider = p;
    llmModel = getModel(p);
  } catch {
    llmProvider = (process.env.LLM_PROVIDER ?? "gemini").trim() || "gemini";
    llmModel = (process.env.LLM_MODEL ?? "").trim() || DEFAULT_MODELS.gemini;
  }

  const initialPlatform =
    searchParams.platform && (PLATFORMS as readonly string[]).includes(searchParams.platform)
      ? (searchParams.platform as Platform)
      : null;

  return (
    <CreateWorkspace
      templates={(templates ?? []) as Template[]}
      defaultPlatform={(profile?.default_platform as Platform | undefined) ?? "LINKEDIN"}
      defaultTone={(profile?.default_tone as Tone | undefined) ?? "PROFESSIONAL"}
      initialPlatform={initialPlatform}
      initialTemplateId={searchParams.template && isUuid(searchParams.template) ? searchParams.template : null}
      initialHistoryItem={initialHistoryItem}
      llmInfo={{ provider: llmProvider, model: llmModel }}
    />
  );
}
