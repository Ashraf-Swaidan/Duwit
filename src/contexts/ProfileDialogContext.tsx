import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useRouterState } from "@tanstack/react-router"
import { useAuth } from "@/hooks/useAuth"
import {
  getUserProfile,
  shouldShowProfileOnboarding,
  type UserProfile,
} from "@/services/user"
import { ProfileOnboardingDialog } from "@/components/ProfileOnboardingDialog"

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname === "/goals" ||
    pathname === "/new-goal" ||
    pathname.startsWith("/plan/")
  )
}

export type ProfileDialogContextValue = {
  profile: UserProfile | null
  profileLoading: boolean
  /** True after first profile fetch when the profile wizard is not blocking the app */
  tutorialCanStart: boolean
  refreshProfile: () => Promise<void>
  /** Opens the same wizard used at onboarding, prefilled from Firestore */
  openPreferencesEditor: () => void
}

const ProfileDialogContext = createContext<ProfileDialogContextValue | null>(null)

export function ProfileDialogProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  /** False until the first getUserProfile for this session completes — avoids treating null as "no profile" before Firestore returns. */
  const [initialProfileResolved, setInitialProfileResolved] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"onboarding" | "edit">("onboarding")

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    try {
      const p = await getUserProfile(user.uid)
      setProfile(p)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
      setInitialProfileResolved(true)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setProfile(null)
      setInitialProfileResolved(false)
      return
    }
    setInitialProfileResolved(false)
    void refreshProfile()
  }, [user, authLoading, refreshProfile])

  useEffect(() => {
    if (!user || authLoading || profileLoading || !initialProfileResolved) return
    if (!isProtectedPath(pathname)) return
    if (!shouldShowProfileOnboarding(profile)) return
    setDialogMode("onboarding")
    setDialogOpen(true)
  }, [user, authLoading, profileLoading, initialProfileResolved, profile, pathname])

  const openPreferencesEditor = useCallback(() => {
    setDialogMode("edit")
    setDialogOpen(true)
  }, [])

  const tutorialCanStart = initialProfileResolved && !shouldShowProfileOnboarding(profile)

  const value = useMemo<ProfileDialogContextValue>(
    () => ({
      profile,
      profileLoading,
      tutorialCanStart,
      refreshProfile,
      openPreferencesEditor,
    }),
    [profile, profileLoading, tutorialCanStart, refreshProfile, openPreferencesEditor],
  )

  return (
    <ProfileDialogContext.Provider value={value}>
      {children}
      {user && (
        <ProfileOnboardingDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) void refreshProfile()
          }}
          uid={user.uid}
          initialProfile={profile}
          mode={dialogMode}
          onCompleted={() => void refreshProfile()}
        />
      )}
    </ProfileDialogContext.Provider>
  )
}

export function useProfileDialog(): ProfileDialogContextValue {
  const ctx = useContext(ProfileDialogContext)
  if (!ctx) {
    throw new Error("useProfileDialog must be used within ProfileDialogProvider")
  }
  return ctx
}
