import { frontPage, type FrontPageEnd, type FrontPageStory } from './presenters'

/**
 * Tomorrow's front page, reporting on the session just closed.
 *
 * One paper, two stories: the winner above the fold and the loser in the column
 * beside them, which is the same left-to-right order the table underneath reads
 * in. A market that has a tape and a calendar of dated trading days may as well
 * have a press.
 *
 * Stock Market only. Black Swan has no prices, no tape and no dates — a business
 * paper reporting on it would be a costume borrowed from the other mode.
 *
 * Every word on it is decided by `frontPage`; this places them. That is the whole
 * arrangement: the page is a value, and what happens here is markup.
 */
export function Newspaper({
  ends,
  fieldSize,
  roundIndex,
  seriesStart,
}: {
  ends: readonly FrontPageEnd[]
  fieldSize: number
  roundIndex: number
  seriesStart: number
}) {
  const { masthead, stories } = frontPage({ seriesStart, roundIndex, fieldSize, ends })

  return (
    <section className="newspaper" aria-label={`${masthead.title}, front page`}>
      <header className="newspaper-masthead">
        <h3 className="newspaper-title">{masthead.title}</h3>
        {/* One line, always. The imprint is the half that goes when the paper is
            too narrow to hold all four — see the container query. */}
        <p className="newspaper-dateline">
          <span>{masthead.edition}</span>
          <span className="newspaper-date">{masthead.date}</span>
          <span className="newspaper-imprint">{masthead.volume}</span>
          <span className="newspaper-imprint">{masthead.price}</span>
        </p>
      </header>

      <div className="newspaper-stories">
        {stories.map((story) => (
          <Story key={story.tone} story={story} />
        ))}
      </div>
    </section>
  )
}

function Story({ story }: { story: FrontPageStory }) {
  return (
    <article className="newspaper-story" data-tone={story.tone}>
      <p className="newspaper-kicker">{story.kicker}</p>
      <h4 className="newspaper-headline">{story.headline}</h4>
      <p className="newspaper-deck">{story.deck}</p>
    </article>
  )
}
