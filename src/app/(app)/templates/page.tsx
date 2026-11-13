import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageEnter } from "@/components/layout/page-enter";
import { TemplatesView } from "@/components/templates/templates-view";
import { getCurrentUser } from "@/lib/auth";
import type { Platform, Template, Tone } from "@/lib/types";

export const metadata: Metadata = { title: "Templates" };

const STARTER_TEMPLATES: Array<{
  name: string;
  structure_text: string;
  default_platform: Platform;
  default_tone: Tone;
}> = [
  {
    name: "Project / Achievement Update",
    structure_text:
      "Project: {project}\nWhat I built or achieved: {achievement}\nThe challenge: {challenge}\nWhat I learned: {lesson}\nThanks to: {people}",
    default_platform: "LINKEDIN",
    default_tone: "PROFESSIONAL",
  },
  {
    name: "Internship Learning Post",
    structure_text:
      "Company / team: {company}\nRole: {role}\nThree things I learned: {lesson_1}; {lesson_2}; {lesson_3}\nA moment that stood out: {moment}\nWhat's next: {next_step}",
    default_platform: "LINKEDIN",
    default_tone: "FRIENDLY",
  },
  {
    name: "Product Launch",
    structure_text:
      "Product: {product}\nWho it is for: {audience}\nProblem it solves: {problem}\nKey features: {features}\nWhere to try it: {link}",
    default_platform: "X_TWITTER",
    default_tone: "CASUAL",
  },
  {
    name: "Thought Leadership",
    structure_text:
      "Topic: {topic}\nMy point of view: {opinion}\nEvidence or experience: {evidence}\nCommon misconception: {misconception}\nQuestion for readers: {question}",
    default_platform: "BLOG",
    default_tone: "INFORMATIVE",
  },
];

export default async function TemplatesPage() {
  const { user, supabase } = await getCurrentUser();
  if (!user) redirect("/login");

  let { data } = await supabase
    .from("templates")
    .select("id, user_id, name, structure_text, default_platform, default_tone, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Safety net: if an account was created before the DB trigger was installed, seed the 4 starter templates once.
  if (!data || data.length === 0) {
    const { data: inserted } = await supabase
      .from("templates")
      .insert(STARTER_TEMPLATES.map((t) => ({ ...t, user_id: user.id })))
      .select("id, user_id, name, structure_text, default_platform, default_tone, created_at");
    if (inserted && inserted.length > 0) data = inserted;
  }

  return (
    <PageEnter>
      <TemplatesView initialTemplates={(data ?? []) as Template[]} />
    </PageEnter>
  );
}
