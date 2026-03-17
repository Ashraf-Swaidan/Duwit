import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

export const ai = getAI(app, { backend: new GoogleAIBackend() })
export const model = getGenerativeModel(ai, {
  model: (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? "gemma-3-27b-it",
})

export function getModelInstance(modelName: string) {
  return getGenerativeModel(ai, { model: modelName })
}

export let analytics: ReturnType<typeof getAnalytics> | undefined

if (typeof window !== "undefined") {
  void isAnalyticsSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app)
  })
}