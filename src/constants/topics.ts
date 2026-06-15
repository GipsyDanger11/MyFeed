/**
 * Topics the user can boost or reduce on Instagram
 * hashtag = the value fed to instagrapi (no spaces, lowercase)
 */
export type TopicDirection = "boost" | "reduce";

export interface Topic {
  id: string;
  label: string;
  hashtag: string;
  emoji: string;
}

export const TOPICS: Topic[] = [
  { id: "technology", label: "Technology", hashtag: "technology", emoji: "💻" },
  { id: "ai", label: "Artificial Intelligence", hashtag: "artificialintelligence", emoji: "🤖" },
  { id: "startups", label: "Startups", hashtag: "startups", emoji: "🚀" },
  { id: "business", label: "Business", hashtag: "business", emoji: "💼" },
  { id: "finance", label: "Finance", hashtag: "finance", emoji: "💰" },
  { id: "fitness", label: "Fitness", hashtag: "fitness", emoji: "💪" },
  { id: "health", label: "Health", hashtag: "health", emoji: "🧘" },
  { id: "education", label: "Education", hashtag: "education", emoji: "📚" },
  { id: "travel", label: "Travel", hashtag: "travel", emoji: "✈️" },
  { id: "gaming", label: "Gaming", hashtag: "gaming", emoji: "🎮" },
  { id: "design", label: "Design", hashtag: "design", emoji: "🎨" },
  { id: "photography", label: "Photography", hashtag: "photography", emoji: "📸" },
  { id: "food", label: "Food", hashtag: "food", emoji: "🍜" },
  { id: "fashion", label: "Fashion", hashtag: "fashion", emoji: "👗" },
  { id: "music", label: "Music", hashtag: "music", emoji: "🎵" },
  { id: "sports", label: "Sports", hashtag: "sports", emoji: "⚽" },
  { id: "crypto", label: "Crypto", hashtag: "crypto", emoji: "🪙" },
  { id: "science", label: "Science", hashtag: "science", emoji: "🔬" },
  { id: "nature", label: "Nature", hashtag: "nature", emoji: "🌿" },
  { id: "art", label: "Art", hashtag: "art", emoji: "🖼️" },
];

export function getTopicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}
