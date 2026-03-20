# Duwit landing — image prompts for generative AI

Use these as **master prompts**. Adjust the model’s aspect-ratio setting to match **Technical**; add the **Negative prompt** in tools that support it.

**Brand vibe (both images):** warm, intelligent, calm—not corporate stock, not neon gamer, not childish. Think *editorial tech*, *soft daylight*, *human scale*. Primary accent: **warm amber / honey gold** (like a confident highlighter, not orange traffic cone). Plenty of **breathing room**; avoid busy backgrounds.

---

## 1) Hero image → save as `public/landing/hero.webp`

**Role on site:** Main hero beside the headline *“Turn ambition into a path you can actually walk.”* It should feel like *clarity, guidance, and forward motion*—not a literal screenshot of your app.

### Recommended specs
- **Aspect ratio:** **4:3** or **16:10** (landscape). Export **wide** (~1600px on the long edge) as **WebP**.
- **Style:** Pick **one** and stick to it for both images:
  - *Option A — Soft 3D / clay / foam* (rounded forms, gentle shadows, Apple-keynote calm), **or**
  - *Option B — Editorial flat illustration* with subtle grain and **limited palette** (cream/off-white, soft charcoal, amber/gold accents), **or**
  - *Option C — Photoreal* **staged minimal desk** (real person, shallow depth of field) — only if you can keep UI elements **abstract**, not fake product screenshots.

### Detailed prompt (copy-paste)

**Subject & composition:** A single **focused adult learner** (ambiguous ethnicity, everyday clothing) at a **clean, minimal desk** in **soft morning light** from the side. They look **engaged and calm**, slightly smiling—not exaggerated joy. On the desk: a **laptop** (screen **glowing softly**, content **abstract**: soft blurred blocks, gentle curves—**no readable text, no logos**). Around them, **floating in space** (not cluttered), **3–5 abstract “goal journey” elements**: a **winding path** or **stepping stones** made of **thin gold/amber lines**; **small rounded cards** or **nodes** connected by delicate curves; one **subtle checklist** suggested by **soft checkmarks** (no words); a **tiny spark or star** motif hinting at an AI coach—**symbolic, not sci-fi robots**. **Depth:** foreground desk sharp, floating elements **softly out of focus** so the eye goes to the person.

**Mood:** *Relief + momentum.* “I finally have a map.” Warm, trustworthy, premium ed-tech.

**Color:** Background **warm off-white** or **very light warm gray**; shadows **soft violet-gray**, accents **amber / honey gold** (#E8A849–style range, not neon); optional **hint of cool blue-gray** in shadows for contrast.

**Lighting:** **Large soft key light** from window side; **no harsh contrast**; **no blown highlights** on the laptop screen.

**Negative prompt (important):**  
text, letters, words, watermark, logo, brand name, UI screenshot, browser chrome, stock photo grin, multiple disconnected styles, cluttered background, neon colors, cyberpunk, robots, fantasy RPG, isometric city, infographic overload, chart junk, low resolution, blurry face, extra fingers, mangled hands, deformed laptop, political symbols, religious symbols, medical imagery.

### Short “remix” variant (if your model prefers brevity)

> Soft 3D editorial illustration, calm adult at minimal desk with laptop, abstract golden path and floating rounded “task” nodes around them, warm off-white background, honey-amber accents, soft window light, no text, no logos, premium learning-app aesthetic, 4:3 landscape.

---

## 2) Steps / “How it works” image → save as `public/landing/steps.webp`

**Role on site:** Sits next to the **“From first idea to last task”** section. It should read as a **simple story in one frame**: *define → work → complete*.

### Recommended specs
- **Aspect ratio:** **4:3** (matches the layout container). Same resolution band as hero.
- **Style:** **Must match the hero** (same illustration family / 3D vs flat vs photo).

### Detailed prompt (copy-paste)

**Subject & composition:** A **single panoramic visual metaphor** divided **gently into three left-to-right “chapters”** using **spacing and light**, not heavy numbered labels:

1. **Left — “Define”:** An **open conversation bubble** or **soft notebook** merging into **organized blocks** (like phases)—still **abstract**, **no text**. A **warm glow** suggests talking/planning.
2. **Center — “Work”:** A **path or bridge** of **amber stepping stones** or **connected nodes** leading right; one **open “card”** or **panel** suggesting a **lesson step** (simple iconography: small book, play symbol, or spark—**no words**).
3. **Right — “Complete”:** A **gentle summit** or **closed loop**: a **soft ribbon** completing a circle, or a **shelf / archive box** with a **subtle seal** (again **no text**), implying *finished journeys rest here*. **Optional:** a **small figure silhouette** walking the path at **tiny scale** for narrative—keep secondary.

**Mood:** *Progress without pressure.* Same calm warmth as hero.

**Color & lighting:** Identical palette to hero: **cream / warm gray** base, **amber/gold** for the path and highlights, **soft diffused light**; **no dark moody scene**.

**Depth:** Slight **atmospheric perspective**—left to right can go from **slightly cooler** to **slightly warmer** to imply completion.

**Negative prompt:**  
text, typography, numbers, watermark, logo, UI mockup with readable content, before/after split-screen cliché, climbing corporate ladder metaphor, trophy overload, gamification XP bars, coins, slot machine, neon, messy icons, inconsistent art style vs reference hero, low resolution.

### Short “remix” variant

> Same style as a warm ed-tech hero: horizontal triptych metaphor—chat/planning (left), golden learning path with lesson card (center), completed arc or calm archive (right), cream background, honey-amber accents, soft 3D or editorial illustration, no text, no logos, 4:3.

---

## Consistency checklist (run before final export)

1. **Same art direction** for both images (don’t mix photoreal hero + cartoon steps).
2. **No readable text** anywhere (generators love sneaking letters in).
3. **Compress WebP** (e.g. quality 80–85) for fast first paint.
4. **Name files exactly** `hero.webp` and `steps.webp` in `public/landing/`, or update paths in `src/pages/LandingPage.tsx`.

---

## Optional: “style anchor” sentence

If your tool allows a **reference image**, generate **hero first**, then for steps add:

> **Maintain the exact same illustration style, color palette, line weight, and lighting as the uploaded reference image.**

If no reference upload, paste the **short remix** of the hero at the top of the steps prompt and add: *“Match style to previous description.”*
