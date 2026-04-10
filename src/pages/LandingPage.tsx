import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  Map,
  MessageCircle,
  Sparkles,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"

/** Swap in your file under `public/landing/` — see `public/landing/README.md`. */
const HERO_IMAGE = "/landing/hero.webp"
const STEPS_IMAGE = "/landing/steps.webp"
const WINDOWS_INSTALLER_PATH = "https://github.com/Ashraf-Swaidan/Duwit/releases/latest"

function LandingImage({
  src,
  alt,
  className,
  roundedClass = "rounded-3xl",
}: {
  src: string
  alt: string
  className?: string
  roundedClass?: string
}) {
  const [ok, setOk] = useState(true)

  if (!ok) {
    return (
      <div
        className={cn(
          "relative overflow-hidden border border-border/50 bg-muted/30",
          roundedClass,
          className,
        )}
        aria-hidden
      >
        <div className="absolute inset-0 bg-linear-to-br from-brand/20 via-brand-muted/40 to-transparent" />
        <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(circle_at_30%_20%,oklch(0.72_0.16_55),transparent_50%),radial-gradient(circle_at_80%_60%,oklch(0.55_0.12_250),transparent_45%)]" />
        <div className="relative flex h-full min-h-[200px] items-center justify-center p-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground max-w-[12rem] leading-relaxed">
            Add <span className="font-mono text-[0.65rem]">hero.webp</span> here
          </p>
        </div>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setOk(false)}
      className={cn("h-full w-full object-cover", roundedClass, className)}
      loading="lazy"
      decoding="async"
    />
  )
}

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="font-black text-lg tracking-tight">Duwit</span>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" asChild>
              <Link to="/login" search={{ redirect: undefined, mode: "login" }}>
                Sign in
              </Link>
            </Button>
            <Button size="sm" className="rounded-full px-4 font-semibold shadow-sm" asChild>
              <Link to="/login" search={{ redirect: undefined, mode: "signup" }}>
                Get started
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.72_0.16_55/0.18),transparent)]" />
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-24">
            <div className="min-w-0 space-y-6">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand/90">
                Goals, taught back to you
              </p>
              <h1
                className="text-[2.1rem] font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05]"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                Turn ambition into a path you can actually walk.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-[1.05rem]">
                Duwit is a coach for real projects: you talk through what you want, get phases and
                concrete tasks, then learn step-by-step with guidance and quick checks—without your
                finished work cluttering what’s still ahead.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" className="rounded-full px-8 font-semibold gap-2 h-12" asChild>
                  <Link to="/login" search={{ redirect: undefined, mode: "signup" }}>
                    Create free account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-6 h-12 font-semibold" asChild>
                  <Link to="/login" search={{ redirect: undefined, mode: "login" }}>
                    I already have an account
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" className="rounded-full px-6 h-12 font-semibold" asChild>
                  <a href={WINDOWS_INSTALLER_PATH} target="_blank" rel="noreferrer">
                    Download desktop (Windows)
                  </a>
                </Button>
              </div>
              <ul className="flex flex-col gap-2 pt-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                  Plans shaped by conversation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                  Tasks with built-in teaching
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                  Done goals tucked away quietly
                </li>
              </ul>
            </div>

            <div className="relative min-h-[240px] lg:min-h-[360px]">
              <div className="absolute -inset-4 rounded-[2rem] bg-linear-to-br from-brand/10 via-transparent to-brand-muted/20 blur-2xl lg:-inset-8" aria-hidden />
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border/60 shadow-lg shadow-black/[0.06] lg:aspect-auto lg:h-full lg:min-h-[340px]">
                <LandingImage
                  src={HERO_IMAGE}
                  alt="Duwit — guided goals and learning (add your image in public/landing/hero.webp)"
                  className="absolute inset-0 min-h-full"
                  roundedClass="rounded-3xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              Built for momentum, not guilt
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Most “goal apps” stop at a list. Duwit stays with you while you learn—so the plan
              feels like a guide, not a pile of unchecked boxes.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                title: "Talk it into shape",
                body: "Describe what you want in plain language. Duwit helps you clarify scope, pace, and success—then turns it into phases you can open and use.",
              },
              {
                icon: Layers,
                title: "Every task is a lesson",
                body: "Open a step, get structured guidance, practice, and light quizzes when it fits. Progress updates a living summary so the next step always knows where you are.",
              },
              {
                icon: Map,
                title: "Terrain, not chores",
                body: "Active goals stay up front. When a journey is complete, it rests on its own shelf—visible when you want it, out of the way when you don’t.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/70 bg-card/50 p-6 shadow-sm transition-shadow hover:shadow-md hover:border-brand/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/12 text-brand">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 font-bold text-base">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works + optional image */}
        <section className="border-y border-border/50 bg-muted/20">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div className="order-2 space-y-8 lg:order-1">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-brand/85">
                  How it works
                </p>
                <h2
                  className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
                  style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                >
                  From first idea to last task
                </h2>
              </div>
              <ol className="space-y-6">
                {[
                  {
                    step: "01",
                    title: "Define the goal",
                    text: "Chat on Home or follow the guided flow. Duwit captures motivation, time, and what “done” means for you.",
                  },
                  {
                    step: "02",
                    title: "Work the plan",
                    text: "Each task opens a focused space: teaching steps, your notes, and checks that reinforce what you learned.",
                  },
                  {
                    step: "03",
                    title: "Close the loop",
                    text: "Finish the line—get a real milestone moment. Completed goals move to a dedicated place so your dashboard stays about what’s next.",
                  },
                ].map((item) => (
                  <li key={item.step} className="flex gap-4">
                    <span className="font-black text-sm text-brand tabular-nums w-8 shrink-0 pt-0.5">
                      {item.step}
                    </span>
                    <div>
                      <p className="font-bold">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="order-1 lg:order-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border/60 shadow-md">
                <LandingImage
                  src={STEPS_IMAGE}
                  alt="How Duwit works — optional illustration (public/landing/steps.webp)"
                  roundedClass="rounded-3xl"
                  className="min-h-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Proof / personality */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="relative overflow-hidden rounded-3xl border border-brand/20 bg-linear-to-br from-brand-muted/35 via-background to-background px-6 py-10 sm:px-10 sm:py-12">
            <Sparkles className="absolute end-6 top-6 h-8 w-8 text-brand/25" aria-hidden />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold text-brand">Why Duwit exists</p>
              <p
                className="mt-3 text-xl leading-snug text-foreground/95 sm:text-2xl sm:leading-snug"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                “I’m done” should feel like closing a good book—not like finally clearing an inbox.
                Duwit is for people who want structure <em className="not-italic text-brand">and</em> a
                sense of companionship on the way there.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border/50 bg-muted/15">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
            <Target className="h-10 w-10 text-brand/80" strokeWidth={1.5} />
            <h2
              className="max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              Ready to name your next goal?
            </h2>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              Free to start. Sign up, say what you’re chasing, and open your first task in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="rounded-full px-8 font-semibold h-12" asChild>
                <Link to="/login" search={{ redirect: undefined, mode: "signup" }}>
                  Get started free
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-6 h-12 font-semibold" asChild>
                <Link to="/login" search={{ redirect: undefined, mode: "login" }}>
                  Sign in
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Duwit</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/login" search={{ redirect: undefined, mode: "login" }} className="font-medium hover:text-foreground">
            Sign in
          </Link>
          <Link to="/login" search={{ redirect: undefined, mode: "signup" }} className="font-medium hover:text-foreground">
            Create account
          </Link>
        </div>
      </footer>
    </div>
  )
}
