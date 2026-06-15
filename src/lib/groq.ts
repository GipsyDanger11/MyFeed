/**
 * Mobile-side Groq client for the "Suggest Topics" AI feature.
 *
 * Calls the same Groq chat completions endpoint the Python worker uses
 * (see automation/groq_client.py) but from the device. The free tier
 * has plenty of headroom for the demo — in production you'd proxy this
 * through a backend to keep the key off the client.
 *
 * The key is read from app.json → `extra.groqApiKey`. If the call fails
 * (no key, network error, parse error) we return an empty list so the
 * UI can show "Suggestions unavailable" without breaking the flow.
 */
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  groqApiKey?: string;
  groqApiUrl?: string;
  groqModel?: string;
};

const GROQ_API_KEY = (process.env.EXPO_PUBLIC_GROQ_API_KEY as string | undefined) || extra.groqApiKey || "";
const GROQ_API_URL =
  (process.env.EXPO_PUBLIC_GROQ_API_URL as string | undefined) ||
  extra.groqApiUrl ||
  "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL =
  (process.env.EXPO_PUBLIC_GROQ_MODEL as string | undefined) ||
  extra.groqModel ||
  "llama-3.3-70b-versatile";

const API_URL = GROQ_API_URL;
const MODEL = GROQ_MODEL;

/**
 * The exact list the prompt tells the model to pick from. Keep in sync
 * with the labels in src/constants/topics.ts.
 */
const ALLOWED_TOPICS = [
  "Technology",
  "Artificial Intelligence",
  "Startups",
  "Business",
  "Finance",
  "Fitness",
  "Health",
  "Education",
  "Travel",
  "Gaming",
  "Design",
  "Photography",
  "Food",
  "Fashion",
  "Music",
  "Sports",
  "Crypto",
  "Science",
  "Nature",
  "Art",
] as const;

export type SuggestedTopic = (typeof ALLOWED_TOPICS)[number];

/** True when the app has a Groq key configured. UI can hide the feature when false. */
export function isGroqConfigured(): boolean {
  return GROQ_API_KEY.length > 0;
}

export async function suggestTopics(description: string): Promise<SuggestedTopic[]> {
  if (!description.trim()) return [];
  if (!isGroqConfigured()) {
    throw new Error("Suggestions unavailable");
  }
  const prompt =
    `Based on this description: ${description}\n` +
    `Suggest 5 Instagram interest categories from this list only: ` +
    `[${ALLOWED_TOPICS.join(", ")}]\n\n` +
    `Return ONLY a JSON array like: ` +
    `['Technology', 'AI', 'Startups']. ` +
    `No explanation, no markdown, just raw JSON.`;

  let text: string;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) {
      throw new Error(`Groq ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    text = (data.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    throw new Error("Suggestions unavailable");
  }

  // Groq sometimes wraps the JSON in ```json ... ``` fences — strip them.
  const fenced = text.match(/```(?:json)?\s*(\[.*?\])\s*```/s);
  const clean = (fenced ? fenced[1] : text).trim();
  if (!clean.startsWith("[")) {
    throw new Error("Suggestions unavailable");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Suggestions unavailable");
  }
  if (!Array.isArray(parsed)) throw new Error("Suggestions unavailable");

  // Filter to allowed topics so the model can't sneak in junk.
  const allowed = new Set<string>(ALLOWED_TOPICS as readonly string[]);
  return parsed
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s): s is SuggestedTopic => allowed.has(s))
    .slice(0, 5);
}
