import { useState } from "react"
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react"

interface FlashCard {
  front: string
  back: string
}

interface FlashcardsData {
  cards?: FlashCard[]
}

export function FlashcardsWidget({
  data,
  title,
}: {
  data: Record<string, unknown>
  title?: string
}) {
  const flashcardsData = data as FlashcardsData
  const initialCards = flashcardsData.cards || []

  const [cards, setCards] = useState(initialCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [seen, setSeen] = useState(new Set<number>())

  const currentCard = cards[currentIndex]

  const handlePrev = () => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : cards.length - 1))
    setIsFlipped(false)
  }

  const handleNext = () => {
    setSeen((s) => new Set([...s, currentIndex]))
    setCurrentIndex((i) => (i < cards.length - 1 ? i + 1 : 0))
    setIsFlipped(false)
  }

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setCurrentIndex(0)
    setSeen(new Set())
    setIsFlipped(false)
  }

  const allSeen = seen.size === cards.length

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">No flashcards</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      {title && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}

      <div
        className="relative h-48 cursor-pointer rounded-lg border bg-background p-6 shadow-sm transition-all duration-300 [perspective:1000px]"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className={`flex h-full items-center justify-center text-center transition-transform duration-300 [transform-style:preserve-3d] ${
            isFlipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div
            className={`flex w-full flex-col items-center justify-center [backface-visibility:hidden]`}
          >
            <p className="text-xs font-semibold uppercase text-muted-foreground">Front</p>
            <p className="mt-3 text-2xl font-bold">{currentCard.front}</p>
          </div>

          <div
            className={`absolute flex w-full flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]`}
          >
            <p className="text-xs font-semibold uppercase text-muted-foreground">Back</p>
            <p className="mt-3 max-h-32 overflow-y-auto text-sm text-muted-foreground">
              {currentCard.back}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          className="rounded-lg border p-2 hover:bg-muted disabled:opacity-50"
          disabled={cards.length <= 1}
          aria-label="Previous card"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {cards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx)
                setIsFlipped(false)
              }}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? "w-6 bg-brand"
                  : seen.has(idx)
                    ? "w-2 bg-brand/40"
                    : "w-2 bg-border"
              }`}
              aria-label={`Go to card ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="rounded-lg border p-2 hover:bg-muted disabled:opacity-50"
          disabled={cards.length <= 1}
          aria-label="Next card"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {currentIndex + 1} / {cards.length}
        </div>
        <button
          onClick={handleShuffle}
          className="flex items-center gap-1 rounded-lg border px-3 py-1 hover:bg-muted"
          aria-label="Shuffle cards"
        >
          <Shuffle className="h-3 w-3" />
          Shuffle
        </button>
      </div>

      {allSeen && (
        <div className="rounded-lg bg-green-500/10 px-3 py-2 text-center text-sm font-medium text-green-700 dark:text-green-400">
          ✓ You've seen all cards!
        </div>
      )}
    </div>
  )
}
