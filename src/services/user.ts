import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface UserProfile {
  nickname?: string
  preferredLanguage?: string // e.g. "en", "ar"
  preferredTone?: "casual" | "neutral" | "formal"
  ageRange?: string
  preferredLearningStyle?: "video" | "text" | "hands-on" | "mixed"
}

interface UserDoc {
  email?: string
  displayName?: string
  createdAt?: string
  profile?: UserProfile
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as UserDoc
  return data.profile ?? null
}

