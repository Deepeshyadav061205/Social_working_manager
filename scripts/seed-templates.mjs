#!/usr/bin/env node
/**
 * Dev-only seed script: creates the 4 starter templates for a user ID passed on the CLI.
 * Note: New users automatically receive starter templates via the database signup trigger
 * in supabase/migrations/001_init.sql.
 *
 * Usage:
 *   npm run seed:templates -- <user-uuid>
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2];

if (!url || !service || !userId) {
  console.error("Usage: npm run seed:templates -- <user-uuid>");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const templates = [
  {
    user_id: userId,
    name: "Project / Achievement Update",
    structure_text:
      "Project: {project}\nWhat I built or achieved: {achievement}\nThe challenge: {challenge}\nWhat I learned: {lesson}\nThanks to: {people}",
    default_platform: "LINKEDIN",
    default_tone: "PROFESSIONAL",
  },
  {
    user_id: userId,
    name: "Internship Learning Post",
    structure_text:
      "Company / team: {company}\nRole: {role}\nThree things I learned: {lesson_1}; {lesson_2}; {lesson_3}\nA moment that stood out: {moment}\nWhat's next: {next_step}",
    default_platform: "LINKEDIN",
    default_tone: "FRIENDLY",
  },
  {
    user_id: userId,
    name: "Product Launch",
    structure_text:
      "Product: {product}\nWho it is for: {audience}\nProblem it solves: {problem}\nKey features: {features}\nWhere to try it: {link}",
    default_platform: "X_TWITTER",
    default_tone: "CASUAL",
  },
  {
    user_id: userId,
    name: "Thought Leadership",
    structure_text:
      "Topic: {topic}\nMy point of view: {opinion}\nEvidence or experience: {evidence}\nCommon misconception: {misconception}\nQuestion for readers: {question}",
    default_platform: "BLOG",
    default_tone: "INFORMATIVE",
  },
];

const { error } = await admin.from("templates").insert(templates);
if (error) {
  console.error("Failed to seed templates:", error.message);
  process.exit(1);
}
console.log(`Seeded 4 starter templates for user ${userId}.`);
