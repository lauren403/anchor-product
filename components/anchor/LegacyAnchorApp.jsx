"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BatteryLow,
  BellOff,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  ExternalLink,
  Eye,
  Footprints,
  Gauge,
  Hand,
  Heart,
  HeartHandshake,
  HeartPulse,
  Home,
  Leaf,
  Layers3,
  ListChecks,
  Menu,
  MessageCircleMore,
  MessageSquareReply,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Soup,
  Sparkles,
  Square,
  TimerReset,
  Trash2,
  Utensils,
  Waves,
  X,
} from 'lucide-react'
import {
  connectionCards,
  evidenceNotes,
  fuelIdeas,
  mealCards,
  nutritionCampaigns,
  pillars,
  programs,
  rightNowPaths,
  supportLinks,
  toolDetails,
} from './content'
import { learnSeries, learnCards } from './learn-content'
import { formatTime, getNextMoment, useAnchorStore } from './store'
import { localId } from './store'
import { MomentFinder } from './MomentFinder'
import { clearAnchorState, loadAnchorState } from '@/lib/anchor/storage'

const iconMap = { BatteryLow, BookOpen, Clock3, Eye, Footprints, Gauge, Hand, HeartHandshake, Layers3, ListChecks, MessageCircleMore, MessageSquareReply, Moon, Play, Soup, TimerReset, Utensils, Waves }
const navItems = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'plan', label: 'My plan', icon: CalendarDays },
  { id: 'checkin', label: 'Check in', icon: HeartPulse },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'more', label: 'More', icon: Menu },
]

function Brand() {
  return (
    <div className="brand" aria-label="Anchor by Body Belonging Clinic">
      <span className="brand-mark" aria-hidden="true">h</span>
      <span><strong>Anchor</strong><small>by Body Belonging Clinic</small></span>
    </div>
  )
}

function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const slides = [
    {
      eyebrow: 'A gentle ADHD companion',
      title: 'Support for the ADHD day you’re actually having.',
      body: 'Practical help for nourishment, regulation, starting, communicating, movement and understanding—without calories, streaks or shame.',
      art: <div className="orbit-art" aria-hidden="true"><span /><span /><span /><div className="orbit-anchor">h</div></div>,
    },
    {
      eyebrow: 'Private by design',
      title: 'Your information stays with you.',
      body: 'There is no account. Your check-ins, saved ideas and plan stay in this browser. Anchor does not send them to the clinic, advertisers or anyone else.',
      art: <div className="privacy-art" aria-hidden="true"><ShieldCheck /><span>stored on this device</span></div>,
    },
    {
      eyebrow: 'One small detail',
      title: 'What can Anchor call you?',
      body: 'Optional. It only makes the words feel a little warmer and it stays on this device.',
      art: (
        <label className="field onboarding-field">
          <span>First name (optional)</span>
          <input value={name} onChange={(event) => setName(event.target.value.slice(0, 40))} placeholder="First name" autoComplete="given-name" />
        </label>
      ),
    },
  ]
  const current = slides[step]

  return (
    <main className="onboarding-shell">
      <div className="onboarding-card">
        <Brand />
        <div className="progress-dots" aria-label={`Step ${step + 1} of ${slides.length}`}>
          {slides.map((_, index) => <span key={index} className={index === step ? 'active' : ''} />)}
        </div>
        <div className="onboarding-content">
          {current.art}
          <p className="eyebrow">{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p className="lead">{current.body}</p>
        </div>
        <div className="onboarding-actions">
          {step > 0 && <button className="button secondary" onClick={() => setStep((value) => value - 1)}>Back</button>}
          <button className="button primary" onClick={() => step === slides.length - 1 ? onFinish(name.trim()) : setStep((value) => value + 1)}>
            {step === slides.length - 1 ? 'Find what helps' : 'Continue'} <ChevronRight size={18} />
          </button>
        </div>
        <p className="scope-line">General wellbeing and education only · not diagnosis, treatment or medical advice.</p>
      </div>
    </main>
  )
}

function Header({ compact = false }) {
  return (
    <header className={`topbar ${compact ? 'compact' : ''}`}>
      <Brand />
      <nav className="ecosystem-nav" aria-label="Body Belonging ecosystem">
        <a href="https://adhd.bodybelongingclinic.com.au/?utm_source=anchor&utm_medium=ecosystem_navigation" target="_blank" rel="noreferrer">ADHD Hub <ExternalLink size={14} /></a>
        <a href="https://www.bodybelongingclinic.com.au/adhd-neurodivergent-support-perth.html?utm_source=anchor&utm_medium=ecosystem_navigation" target="_blank" rel="noreferrer">Clinic support <ExternalLink size={14} /></a>
      </nav>
    </header>
  )
}

function Navigation({ active, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button key={id} className={active === id ? 'active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => onChange(id)}>
          <Icon size={20} strokeWidth={active === id ? 2.5 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function PillarPill({ pillar, active, onClick }) {
  return (
    <button className={`pillar-pill ${active ? 'active' : ''}`} data-tone={pillar.tone} onClick={onClick} aria-pressed={active}>
      {pillar.label}
    </button>
  )
}

function PathCard({ item, favourite, onOpen, onFavourite }) {
  const Icon = iconMap[item.icon] || Sparkles
  const pillar = pillars.find((entry) => entry.id === item.pillar)
  return (
    <article className="path-card" data-tone={pillar?.tone}>
      <div className="path-card-top">
        <span className="path-icon"><Icon size={22} /></span>
        <button className="icon-button" aria-label={favourite ? `Remove ${item.title} from favourites` : `Save ${item.title}`} onClick={() => onFavourite(item.id)}>
          <Heart size={18} fill={favourite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button className="card-button" onClick={() => onOpen(item.id)}>
        <span className="card-pillar">{pillar?.label} · {item.duration}</span>
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
        <span className="card-link">Open <ChevronRight size={16} /></span>
      </button>
    </article>
  )
}

function NextMoment({ rhythm, onPlan }) {
  const next = getNextMoment(rhythm)
  return (
    <div className="next-moment">
      <div>
        <span className="mini-label">Coming up</span>
        <strong>{next ? next.label : 'No rhythm moments set'}</strong>
        <span>{next ? `${next.tomorrow ? 'tomorrow · ' : ''}${formatTime(next.time)}` : 'Shape your day when you are ready'}</span>
      </div>
      <button className="round-button" onClick={onPlan} aria-label="Edit my rhythm"><CalendarDays size={20} /></button>
    </div>
  )
}

function Today({ state, onOpen, onNavigate, softened, onShowEverything, onEndHarderWeek }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const favouritePaths = rightNowPaths.filter((item) => state.favourites.includes(item.id)).slice(0, 3)
  const wearOffSoon = (() => {
    const [h, m] = state.medicationWindow.split(':').map(Number)
    const target = h * 60 + m
    const now = hour * 60 + new Date().getMinutes()
    return Math.abs(target - now) <= 120
  })()

  return (
    <div className="view-stack">
      <section className="welcome-block">
        <p className="eyebrow">{greeting}{state.name ? `, ${state.name}` : ''}</p>
        <h1>What would help right now?</h1>
        <p className="lead">No perfect plan. Just one place to begin.</p>
      </section>

      {softened && (
        <section className="gentle-banner" aria-label="A gentler week">
          <p className="eyebrow">A gentler week</p>
          <p className="gentle-lead">This might be a harder stretch — so Anchor is keeping things gentle with you. Lower the bar where you can, and be kind to yourself. A real person is right here whenever you want one.</p>
          <div className="gentle-actions">
            <button className="button primary" onClick={() => onNavigate('more')}>Reach a real person <ChevronRight size={16} /></button>
          </div>
          <div className="gentle-links">
            <button className="text-button" onClick={onShowEverything}>Show me everything</button>
            <button className="text-button" onClick={onEndHarderWeek}>I&rsquo;m through this week</button>
          </div>
        </section>
      )}

      <MomentFinder />

      <NextMoment rhythm={state.rhythm} onPlan={() => onNavigate('plan')} />

      {wearOffSoon && (
        <button className="feature-card evening-card" onClick={() => onOpen('med-appetite')}>
          <span className="mini-label">Around your appetite-support window</span>
          <strong>Would making eating easier help?</strong>
          <span>A familiar option before things get loud can reduce the steps.</span>
          <span className="card-link">Open gentle support <ChevronRight size={16} /></span>
        </button>
      )}

      {state.oneThing && (
        <div className="one-thing-card">
          <span className="mini-label">The one thing you chose</span>
          <strong>{state.oneThing}</strong>
          <button onClick={() => onNavigate('plan')}>Change it</button>
        </div>
      )}

      {favouritePaths.length > 0 && (
        <section>
          <div className="section-heading"><div><p className="eyebrow">Saved for you</p><h2>Your familiar starting points</h2></div></div>
          <div className="saved-row">
            {favouritePaths.map((item) => <button key={item.id} onClick={() => onOpen(item.id)}><strong>{item.title}</strong><ChevronRight size={16} /></button>)}
          </div>
        </section>
      )}

      <section>
        <div className="section-heading">
          <div><p className="eyebrow">Choose what is happening</p><h2>Meet the day where it is</h2></div>
          <button className="text-button" onClick={() => onNavigate('explore')}>See all</button>
        </div>
        <div className="right-now-grid">
          {rightNowPaths.slice(0, 8).map((item) => {
            const Icon = iconMap[item.icon] || Sparkles
            const tone = pillars.find((pillar) => pillar.id === item.pillar)?.tone
            return (
              <button key={item.id} className="right-now-button" data-tone={tone} onClick={() => onOpen(item.id)}>
                <Icon size={20} />
                <span>{item.title}</span>
                <ChevronRight size={16} />
              </button>
            )
          })}
        </div>
      </section>

      {learnSeries.length > 0 && (() => {
        const featured = learnSeries[new Date().getDate() % learnSeries.length]
        return (
          <section>
            <button className="feature-card learn-today-card" onClick={() => onNavigate('learn')}>
              <span className="mini-label">A gentle read</span>
              <strong>{featured.title}</strong>
              <span className="learn-today-sub">{featured.sub}</span>
              <span className="card-link">Open Learn <ChevronRight size={16} /></span>
            </button>
          </section>
        )
      })()}

      <section className="program-strip">
        <div><p className="eyebrow">Guided company</p><h2>You do not have to start alone.</h2></div>
        <button className="button cream" onClick={() => onOpen('program:eat-with-me')}><Play size={18} /> Eat with me · 10 min</button>
      </section>

      <ScopeNote />
    </div>
  )
}

function FuelFinder({ savedIds, onToggle }) {
  const [effort, setEffort] = useState('all')
  const [texture, setTexture] = useState('all')
  const visible = fuelIdeas.filter((idea) =>
    (effort === 'all' || idea.effort === effort) && (texture === 'all' || idea.texture.includes(texture)),
  )
  return (
    <section className="fuel-finder">
      <div className="section-heading"><div><p className="eyebrow">A workable idea</p><h2>Filter by access—not “healthiness”.</h2></div></div>
      <div className="filter-row" aria-label="Fuel idea filters">
        <label><span>Effort</span><select value={effort} onChange={(event) => setEffort(event.target.value)}><option value="all">Any effort</option><option value="none">No preparation</option><option value="assemble">Assemble only</option><option value="microwave">Microwave</option><option value="cook">A little cooking</option></select></label>
        <label><span>Texture</span><select value={texture} onChange={(event) => setTexture(event.target.value)}><option value="all">Any texture</option><option value="smooth">Smooth</option><option value="soft">Soft</option><option value="crunchy">Crunchy</option><option value="sippable">Sippable</option><option value="mixed">Mixed</option></select></label>
      </div>
      <div className="fuel-grid">
        {visible.map((idea) => (
          <article className="fuel-card" key={idea.id}>
            <div><span className="mini-label">{idea.time} min · {idea.effort}</span><h3>{idea.title}</h3><p>{idea.description}</p></div>
            <button className="save-button" aria-pressed={savedIds.includes(idea.id)} onClick={() => onToggle(idea.id)}>
              <Heart size={17} fill={savedIds.includes(idea.id) ? 'currentColor' : 'none'} /> {savedIds.includes(idea.id) ? 'Saved' : 'Save'}
            </button>
          </article>
        ))}
      </div>
      <p className="small-note">These are general ideas, not a meal plan. Allergies, medical conditions, swallowing safety, pregnancy and individual nutrition needs require advice from your treating practitioner or APD.</p>
    </section>
  )
}

function MealLibrary({ savedIds, onToggle, onOpen }) {
  const [effort, setEffort] = useState('all')
  const [appetite, setAppetite] = useState('all')
  const visible = mealCards.filter((meal) =>
    (effort === 'all' || meal.effort === effort) && (appetite === 'all' || meal.appetite === appetite),
  )
  return (
    <section className="meal-library">
      <div className="meal-library-intro">
        <div><p className="eyebrow">Meals for real ADHD days</p><h2>See it. Understand it. Make the easiest version.</h2></div>
        <p>No “ADHD superfoods”. Each card explains what the combination offers, what the evidence cannot promise, and how to remove steps.</p>
      </div>
      <div className="filter-row compact-filters" aria-label="Meal filters">
        <label><span>Effort</span><select value={effort} onChange={(event) => setEffort(event.target.value)}><option value="all">Any effort</option><option value="assemble">Assemble only</option><option value="cook">A little cooking</option></select></label>
        <label><span>Appetite</span><select value={appetite} onChange={(event) => setAppetite(event.target.value)}><option value="all">Any appetite</option><option value="low">Quiet or low</option><option value="steady">More available</option></select></label>
      </div>
      <div className="meal-grid">
        {visible.map((meal) => (
          <article className="meal-card" key={meal.id}>
            <button className="meal-image-button" onClick={() => onOpen(`meal:${meal.id}`)} aria-label={`Open ${meal.title}`}>
              <img src={meal.image} alt={meal.alt} loading="lazy" />
              <span>Real photograph · {meal.time} · {meal.effort}</span>
            </button>
            <div className="meal-card-copy">
              <p className="meal-campaign-hook">{meal.campaignHook}</p>
              <button className="meal-title-button" onClick={() => onOpen(`meal:${meal.id}`)}><strong>{meal.title}</strong><span>{meal.description}</span><em>Plate, parts + easier version <ChevronRight size={15} /></em></button>
              <div className="meal-ingredient-preview" aria-label={`Key parts in ${meal.title}`}>
                {meal.ingredients.slice(0, 4).map((ingredient) => <span key={ingredient}>{ingredient.split('—')[0]}</span>)}
              </div>
              <button className="save-button" aria-pressed={savedIds.includes(meal.id)} onClick={() => onToggle(meal.id)}>
                <Heart size={17} fill={savedIds.includes(meal.id) ? 'currentColor' : 'none'} /> {savedIds.includes(meal.id) ? 'Saved' : 'Save'}
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="small-note">Real, licensed photography is used in this working release and credited inside each meal. The final paid campaign collection should be commissioned as one coherent Anchor shoot. General education only; these are not meal plans, prescriptions or treatments for ADHD.</p>
    </section>
  )
}

function NutritionCampaignRail({ onOpen }) {
  return (
    <section className="campaign-rail" aria-labelledby="campaign-rail-title">
      <div className="campaign-rail-heading">
        <div><p className="eyebrow">Made for the sentence in your head</p><h2 id="campaign-rail-title">Start with the ADHD moment—not a nutrition lecture.</h2></div>
        <p>Each campaign opens directly into a bounded Anchor tool, so the post, ad and product experience keep the same promise.</p>
      </div>
      <div className="campaign-grid">
        {nutritionCampaigns.map((campaign) => (
          <button key={campaign.id} className="campaign-card" data-tone={campaign.tone} onClick={() => onOpen(campaign.action)}>
            <span>{campaign.label}</span>
            <strong>{campaign.headline}</strong>
            <p>{campaign.body}</p>
            <em>{campaign.cta} <ChevronRight size={16} /></em>
          </button>
        ))}
      </div>
      <p className="small-note">Recognition is not diagnosis. Campaign wording avoids personal-attribute claims and does not imply that a food, app or routine treats ADHD.</p>
    </section>
  )
}

function ConnectionDeck() {
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState('talk')
  const card = connectionCards[index]
  const next = () => setIndex((value) => (value + 1) % connectionCards.length)
  return (
    <section className="connection-deck">
      <div className="deck-intro">
        <div><p className="eyebrow">Anchor connection cards · digital beta</p><h2>A prompt, not a performance.</h2></div>
        <p>Use alone or together. Pass, pause, write or change channels at any time.</p>
      </div>
      <div className="deck-body">
        <div className="deck-card" aria-live="polite">
          <span>{card.theme} · {index + 1} of {connectionCards.length}</span>
          <strong>{card.prompt}</strong>
          <p>{card.bridge}</p>
        </div>
        <div className="deck-controls">
          <fieldset className="choice-group"><legend>How would you like to respond?</legend><div>{['talk', 'write', 'text', 'pass'].map((option) => <button type="button" key={option} className={mode === option ? 'selected' : ''} onClick={() => setMode(option)} aria-pressed={mode === option}>{option}</button>)}</div></fieldset>
          <button className="button cream" onClick={next}>Next card <ChevronRight size={18} /></button>
        </div>
      </div>
      <p className="small-note">These cards support reflection and communication. They do not assess a relationship or make unsafe conversations safer.</p>
    </section>
  )
}

function Explore({ state, onOpen, onFavourite, onToggleFuel, onToggleMeal }) {
  const [activePillar, setActivePillar] = useState('all')
  const [query, setQuery] = useState('')
  const visiblePaths = rightNowPaths.filter((item) => {
    const matchesPillar = activePillar === 'all' || item.pillar === activePillar
    const haystack = `${item.title} ${item.subtitle} ${item.pillar}`.toLowerCase()
    return matchesPillar && haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div className="view-stack">
      <section className="page-intro">
        <p className="eyebrow">A smaller library, built around use</p>
        <h1>Explore what might help</h1>
        <p className="lead">Search by what is happening—not by what you should achieve.</p>
      </section>
      <label className="search-field"><Search size={19} /><span className="sr-only">Search Anchor</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a feeling, barrier or tool" /></label>
      <div className="pillar-row" aria-label="Filter by support type">
        <button className={`pillar-pill ${activePillar === 'all' ? 'active' : ''}`} onClick={() => setActivePillar('all')}>Everything</button>
        {pillars.map((pillar) => <PillarPill key={pillar.id} pillar={pillar} active={activePillar === pillar.id} onClick={() => setActivePillar(pillar.id)} />)}
      </div>
      {visiblePaths.length ? <div className="path-grid">{visiblePaths.map((item) => <PathCard key={item.id} item={item} favourite={state.favourites.includes(item.id)} onOpen={onOpen} onFavourite={onFavourite} />)}</div> : <div className="empty-state"><Leaf /><h2>No exact match</h2><p>Try a shorter word, or choose Everything.</p></div>}

      {(activePillar === 'all' || activePillar === 'nourish') && !query && <NutritionCampaignRail onOpen={onOpen} />}

      {(activePillar === 'all' || activePillar === 'nourish') && !query && <MealLibrary savedIds={state.savedMealIds} onToggle={onToggleMeal} onOpen={onOpen} />}

      {(activePillar === 'all' || activePillar === 'nourish') && !query && <FuelFinder savedIds={state.savedFuelIds} onToggle={onToggleFuel} />}

      {(activePillar === 'all' || activePillar === 'connect') && !query && <ConnectionDeck />}

      {(activePillar === 'all' || ['nourish', 'regulate', 'begin', 'connect', 'move'].includes(activePillar)) && !query && (
        <section>
          <div className="section-heading"><div><p className="eyebrow">Guided programs</p><h2>A little company while you begin</h2></div></div>
          <div className="program-grid">
            {programs.filter((program) => activePillar === 'all' || program.pillar === activePillar).map((program) => {
              const Icon = iconMap[program.icon] || Play
              return <button key={program.id} className="program-card" onClick={() => onOpen(`program:${program.id}`)}><span><Icon size={21} /></span><strong>{program.title}</strong><small>{program.subtitle}</small><em>{program.minutes} min <ChevronRight size={15} /></em></button>
            })}
          </div>
        </section>
      )}

      {(activePillar === 'all' || activePillar === 'understand') && !query && (
        <section className="evidence-preview">
          <div><p className="eyebrow">Evidence, not certainty</p><h2>Understand what Anchor is built on.</h2><p>Every research note separates established guidance, mixed evidence and professional scope.</p></div>
          <button className="button secondary" onClick={() => onOpen('research')}>Open the evidence guide <BookOpen size={18} /></button>
        </section>
      )}
    </div>
  )
}

function Plan({ state, update, onToggleFuel, onToggleMeal, onOpen }) {
  const savedFuels = fuelIdeas.filter((idea) => state.savedFuelIds.includes(idea.id))
  const savedMeals = mealCards.filter((meal) => state.savedMealIds.includes(meal.id))
  function updateRhythm(id, patch) {
    update({ rhythm: state.rhythm.map((item) => item.id === id ? { ...item, ...patch } : item) })
  }
  function addMoment() {
    update({ rhythm: [...state.rhythm, { id: localId(), label: 'Another gentle moment', time: '12:00', enabled: true }] })
  }
  return (
    <div className="view-stack">
      <section className="page-intro"><p className="eyebrow">A scaffold, not a scorecard</p><h1>My plan</h1><p className="lead">Shape Anchor around your actual day. You can change any of it.</p></section>

      <section className="settings-card">
        <div className="settings-heading"><div><p className="eyebrow">Just one thing</p><h2>What is the next visible step?</h2></div><Sparkles /></div>
        <label className="field"><span>Keep it small and concrete</span><input value={state.oneThing} onChange={(event) => update({ oneThing: event.target.value.slice(0, 120) })} placeholder="e.g. put the plate on the bench" /></label>
      </section>

      <section className="settings-card">
        <div className="settings-heading"><div><p className="eyebrow">Your day, gently shaped</p><h2>Eating rhythm</h2></div><Clock3 /></div>
        <p>These are opportunities, not commands. Move them around work, sleep and medication. Missing one never breaks anything.</p>
        <div className="rhythm-list">
          {state.rhythm.map((item) => (
            <div className="rhythm-row" key={item.id}>
              <button className={`toggle-dot ${item.enabled ? 'on' : ''}`} onClick={() => updateRhythm(item.id, { enabled: !item.enabled })} aria-label={`${item.enabled ? 'Turn off' : 'Turn on'} ${item.label}`} aria-pressed={item.enabled}>{item.enabled && <Check size={14} />}</button>
              <input className="rhythm-label" value={item.label} onChange={(event) => updateRhythm(item.id, { label: event.target.value.slice(0, 60) })} aria-label="Moment name" />
              <input type="time" value={item.time} onChange={(event) => updateRhythm(item.id, { time: event.target.value })} aria-label={`Time for ${item.label}`} />
              <button className="icon-button" onClick={() => update({ rhythm: state.rhythm.filter((entry) => entry.id !== item.id) })} aria-label={`Remove ${item.label}`}><X size={17} /></button>
            </div>
          ))}
        </div>
        <button className="text-button add-button" onClick={addMoment}><Plus size={17} /> Add a moment</button>
      </section>

      <section className="settings-card two-fields">
        <div className="settings-heading"><div><p className="eyebrow">Personal anchors</p><h2>Make support easier to recognise</h2></div><Heart /></div>
        <label className="field"><span>What is caring for yourself for?</span><input value={state.why} onChange={(event) => update({ why: event.target.value.slice(0, 120) })} placeholder="e.g. being present with people I love" /></label>
        <label className="field"><span>When does appetite often become easier or harder?</span><input type="time" value={state.medicationWindow} onChange={(event) => update({ medicationWindow: event.target.value })} /></label>
        <p className="small-note">This time only changes when Anchor offers general appetite support. It does not advise on medication timing or dosing.</p>
      </section>

      <section className="settings-card">
        <div className="settings-heading"><div><p className="eyebrow">Saved meal cards</p><h2>Your visual meal shelf</h2></div><Utensils /></div>
        {savedMeals.length ? <div className="saved-meal-list">{savedMeals.map((meal) => <div key={meal.id}><button onClick={() => onOpen(`meal:${meal.id}`)}><img src={meal.image} alt="" /><span><strong>{meal.title}</strong><small>{meal.time} · {meal.effort}</small></span></button><button className="icon-button" onClick={() => onToggleMeal(meal.id)} aria-label={`Remove ${meal.title}`}><X size={17} /></button></div>)}</div> : <div className="empty-inline"><p>No meal cards saved yet. Save the combinations that feel realistic enough to recognise on a low-decision day.</p><button className="text-button" onClick={() => onOpen('nothing-manageable')}>Find a starting point <ChevronRight size={16} /></button></div>}
      </section>

      <section className="settings-card">
        <div className="settings-heading"><div><p className="eyebrow">Saved fuel ideas</p><h2>Your low-decision shelf</h2></div><Soup /></div>
        {savedFuels.length ? <div className="saved-fuel-list">{savedFuels.map((idea) => <div key={idea.id}><button onClick={() => onOpen('nothing-manageable')}><strong>{idea.title}</strong><span>{idea.time} min · {idea.effort}</span></button><button className="icon-button" onClick={() => onToggleFuel(idea.id)} aria-label={`Remove ${idea.title}`}><X size={17} /></button></div>)}</div> : <div className="empty-inline"><p>No saved ideas yet. Save the options you can usually tolerate so they are easier to find on a hard day.</p><button className="text-button" onClick={() => onOpen('nothing-manageable')}>Find a starting point <ChevronRight size={16} /></button></div>}
      </section>

      <div className="notice-card"><BellOff /><div><strong>Reminders while Anchor is closed are not in this release.</strong><p>We will not pretend browser reminders are reliable. A later opt-in notification service needs privacy and clinical-governance review first.</p></div></div>
    </div>
  )
}

function CheckIn({ state, addCheckin }) {
  const [form, setForm] = useState({ pattern: '', brain: '', body: '', energy: '', fuel: '', note: '', spark: '' })
  const [saved, setSaved] = useState(false)
  const canSave = form.pattern || form.brain || form.body || form.energy || form.fuel || form.note || form.spark
  const recent = [...state.checkins].reverse().slice(0, 5)
  function save() {
    if (!canSave) return
    addCheckin(form)
    setForm({ pattern: '', brain: '', body: '', energy: '', fuel: '', note: '', spark: '' })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }
  function downloadSummary() {
    const rows = state.checkins.slice(-20)
    const counts = rows.reduce((acc, item) => {
      if (item.pattern) acc[item.pattern] = (acc[item.pattern] || 0) + 1
      return acc
    }, {})
    const lines = [
      'Anchor appointment preparation',
      `Created: ${new Intl.DateTimeFormat('en-AU', { dateStyle: 'long' }).format(new Date())}`,
      '',
      'This is a user-created reflection from up to 20 local check-ins. It is not a diagnosis or clinical record.',
      '',
      'Patterns noticed:',
      ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, count]) => `- ${label}: ${count}`),
      '',
      'Notes to discuss:',
      ...rows.filter((item) => item.note).map((item) => `- ${item.createdAt?.slice(0, 10) || 'Earlier'}: ${item.note}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `anchor-appointment-prep-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return (
    <div className="view-stack">
      <section className="page-intro"><p className="eyebrow">No numbers, no scores</p><h1>How are you, really?</h1><p className="lead">Notice what is here. You do not have to turn it into a result.</p></section>
      <section className="checkin-card">
        <ChoiceGroup label="What keeps happening today?" help="Choose the closest fit, or leave it blank." value={form.pattern} onChange={(pattern) => setForm({ ...form, pattern })} options={['Conversation loop', 'Reply shame', 'Task stuck', 'Lost in focus', 'Eating slipped away', 'Sensory overload']} />
        <ChoiceGroup label="How is your brain feeling?" value={form.brain} onChange={(brain) => setForm({ ...form, brain })} options={['Steady', 'Foggy', 'Wired', 'Low', 'Okay']} />
        <ChoiceGroup label="Any body cues?" help="Curiosity only. Faint and unsure both count." value={form.body} onChange={(body) => setForm({ ...form, body })} options={['Nothing yet', 'A whisper', 'Clearly hungry', 'Not sure']} />
        <ChoiceGroup label="Energy right now?" value={form.energy} onChange={(energy) => setForm({ ...form, energy })} options={['Low', 'Steady', 'Wired']} />
        <ChoiceGroup label="Have you had something to eat today?" value={form.fuel} onChange={(fuel) => setForm({ ...form, fuel })} options={['Yes', 'A little', 'Not yet', 'Prefer not to say']} />
        <label className="field"><span>A note, just for you (optional)</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value.slice(0, 500) })} placeholder="A word about the day" rows="3" /></label>
        <label className="field"><span>Notice a spark (optional)</span><small>A small moment of ease, connection or okay.</small><input value={form.spark} onChange={(event) => setForm({ ...form, spark: event.target.value.slice(0, 180) })} placeholder="e.g. sun through the window" /></label>
        <button className="button primary full" disabled={!canSave} onClick={save}>{saved ? <><Check size={18} /> Saved on this device</> : 'Save my check-in'}</button>
      </section>
      {recent.length > 0 && <section><div className="section-heading"><div><p className="eyebrow">Recent noticing</p><h2>No trend line. Just your own words.</h2></div><button className="button secondary" onClick={downloadSummary}><Download size={17} /> Appointment prep</button></div><div className="recent-list">{recent.map((item) => <article key={item.id || item.createdAt}><time>{item.createdAt ? new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(item.createdAt)) : 'Earlier check-in'}</time><strong>{[item.pattern, item.brain, item.energy, item.fuel].filter(Boolean).join(' · ') || 'A check-in'}</strong>{item.note && <p>{item.note}</p>}{item.spark && <span>✦ {item.spark}</span>}</article>)}</div><p className="small-note">The download is generated in this browser and is yours to choose whether to share.</p></section>}
      <ScopeNote />
    </div>
  )
}

function ChoiceGroup({ label, help, value, onChange, options }) {
  return (
    <fieldset className="choice-group"><legend>{label}</legend>{help && <p>{help}</p>}<div>{options.map((option) => <button type="button" key={option} className={value === option ? 'selected' : ''} onClick={() => onChange(option)} aria-pressed={value === option}>{value === option && <Check size={14} />}{option}</button>)}</div></fieldset>
  )
}

function Learn() {
  const [openSeries, setOpenSeries] = useState(null)
  const [openCard, setOpenCard] = useState(null)

  if (openCard) {
    const card = learnCards.find((c) => c.id === openCard)
    const series = learnSeries.find((s) => s.id === card.set)
    return (
      <div className="view-stack learn-view">
        <button className="text-button learn-back" onClick={() => setOpenCard(null)}><ArrowLeft size={16} /> {series ? series.title : 'Back'}</button>
        <section className="learn-card-full">
          <p className="eyebrow">{card.tag}</p>
          <h1>{card.gist}</h1>
          {card.body.map((para, i) => <p key={i} className="learn-body">{para}</p>)}
          {card.safety && card.care && (
            <div className="learn-care"><p className="eyebrow">A gentle word</p><p>{card.care}</p></div>
          )}
          <div className="learn-help"><p className="eyebrow">What can gently help</p><p>{card.help}</p></div>
          <div className="learn-talk"><p className="eyebrow">Worth a conversation</p><p>{card.talk}</p></div>
          {card.safety && (
            <section className="learn-support">
              <div className="section-heading"><div><p className="eyebrow">If things feel hard</p><h2>Reach a real person</h2></div></div>
              <div className="support-grid">{supportLinks.map((link) => <a key={link.label} href={link.href} className="support-card"><div><strong>{link.label}</strong><span>{link.detail}</span></div><b>{link.phone}</b></a>)}</div>
              <a className="button primary full" href="https://www.halaxy.com/profile/ms-lauren-lynch/social-worker/1772313" target="_blank" rel="noreferrer">Book a free Body Belonging intro call <ExternalLink size={17} /></a>
            </section>
          )}
          <p className="learn-honesty">{card.honesty}</p>
        </section>
      </div>
    )
  }

  if (openSeries) {
    const series = learnSeries.find((s) => s.id === openSeries)
    const cards = learnCards.filter((c) => c.set === openSeries)
    return (
      <div className="view-stack learn-view">
        <button className="text-button learn-back" onClick={() => setOpenSeries(null)}><ArrowLeft size={16} /> All series</button>
        <section className="page-intro"><p className="eyebrow">A gentle series</p><h1>{series.title}</h1><p className="lead">{series.sub}</p></section>
        <section className="learn-card-list">
          {cards.map((card) => (
            <button key={card.id} className="learn-card" onClick={() => setOpenCard(card.id)}>
              <span className="learn-card-tag">{card.tag}{card.safety && <em className="learn-flag">care</em>}</span>
              <strong>{card.gist}</strong>
              <span className="card-link">Open <ChevronRight size={16} /></span>
            </button>
          ))}
        </section>
      </div>
    )
  }

  return (
    <div className="view-stack learn-view">
      <section className="page-intro"><p className="eyebrow">Gentle, evidence-honest, ED-safe</p><h1>Learn</h1><p className="lead">Short reads about your ADHD brain across its hormonal seasons — across a month, and across a life. Never medical advice; always a person you can reach.</p></section>
      <section className="learn-series-list">
        {learnSeries.map((series) => {
          const count = learnCards.filter((c) => c.set === series.id).length
          return (
            <button key={series.id} className="learn-series-card" onClick={() => setOpenSeries(series.id)}>
              <span className="learn-series-mark"><BookOpen size={19} /></span>
              <strong>{series.title}</strong>
              <small>{series.sub}</small>
              <em>{count} cards <ChevronRight size={15} /></em>
            </button>
          )
        })}
      </section>
    </div>
  )
}

function More({ state, reset, update }) {
  const [confirmReset, setConfirmReset] = useState(false)
  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), product: state, recommendations: loadAnchorState() }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `anchor-data-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return (
    <div className="view-stack">
      <section className="page-intro"><p className="eyebrow">Clear boundaries, visible support</p><h1>More</h1><p className="lead">Privacy, evidence, support and the people behind Anchor.</p></section>
      <section>
        <div className="section-heading"><div><p className="eyebrow">If things feel hard</p><h2>Reach a real person</h2></div></div>
        <div className="support-grid">{supportLinks.map((link) => <a key={link.label} href={link.href} className="support-card"><div><strong>{link.label}</strong><span>{link.detail}</span></div><b>{link.phone}</b></a>)}</div>
        <a className="button primary full" href="https://www.halaxy.com/profile/ms-lauren-lynch/social-worker/1772313" target="_blank" rel="noreferrer">Book a free Body Belonging intro call <ExternalLink size={17} /></a>
      </section>

      <section className="settings-card">
        <div className="settings-heading"><div><p className="eyebrow">Optional · private · on your device</p><h2>Cycle-aware gentleness</h2></div><HeartHandshake /></div>
        <p>If some weeks feel like a headwind — more fog, a shorter fuse, heavier feelings — Anchor can lean gentler with you when you say so. No dates, no tracking, no numbers: just one tap when a harder week arrives, and off again when it passes.</p>
        <div className="rhythm-row gentle-setting-row">
          <button className={`toggle-dot ${state.gentleness?.enabled ? 'on' : ''}`} onClick={() => update({ gentleness: { enabled: !state.gentleness?.enabled, harderWeek: state.gentleness?.enabled ? false : Boolean(state.gentleness?.harderWeek) } })} aria-label={`${state.gentleness?.enabled ? 'Turn off' : 'Turn on'} cycle-aware gentleness`} aria-pressed={Boolean(state.gentleness?.enabled)}>{state.gentleness?.enabled && <Check size={14} />}</button>
          <span className="rhythm-label">Turn on cycle-aware gentleness</span>
        </div>
        {state.gentleness?.enabled && (
          <>
            <div className="rhythm-row gentle-setting-row">
              <button className={`toggle-dot ${state.gentleness?.harderWeek ? 'on' : ''}`} onClick={() => update({ gentleness: { ...state.gentleness, harderWeek: !state.gentleness?.harderWeek } })} aria-label={`${state.gentleness?.harderWeek ? 'Turn off' : 'Turn on'} harder week`} aria-pressed={Boolean(state.gentleness?.harderWeek)}>{state.gentleness?.harderWeek && <Check size={14} />}</button>
              <span className="rhythm-label">I&rsquo;m in a harder week right now</span>
            </div>
            <p className="small-note">When this is on, Anchor greets you more gently and keeps support close on your Today screen. You can tap &ldquo;Show me everything&rdquo; there any time — it only ever softens, never asks more of you.</p>
          </>
        )}
        <p className="small-note">This lives only on your device. It changes gentleness and how close support sits — nothing else. Anchor never links it to food, weight or your body.</p>
      </section>

      <section className="settings-card privacy-section">
        <div className="settings-heading"><div><p className="eyebrow">Private by design</p><h2>Your data, on your device</h2></div><ShieldCheck /></div>
        <p>Anchor does not require an account. This release keeps your plan, check-ins, saved ideas and program history in this browser’s local storage. Body Belonging Clinic cannot see it.</p>
        <p className="small-note">Clearing site data, using private browsing or changing devices can remove it. Export a copy if you want one.</p>
        <div className="button-row"><button className="button secondary" onClick={exportData}><Download size={17} /> Export my data</button><button className="button danger" onClick={() => setConfirmReset(true)}><Trash2 size={17} /> Delete from this device</button></div>
      </section>

      <section>
        <div className="section-heading"><div><p className="eyebrow">Evidence register</p><h2>What this release is built on</h2></div></div>
        <div className="evidence-list">{evidenceNotes.map((note) => <article key={note.id}><span className="evidence-status">{note.status}</span><p className="eyebrow">{note.label}</p><h3>{note.title}</h3><p>{note.summary}</p><footer><span>Reviewed {note.reviewed}</span><a href={note.url} target="_blank" rel="noreferrer">{note.source} <ExternalLink size={14} /></a></footer></article>)}</div>
      </section>

      <section className="lived-method-card">
        <p className="eyebrow">Built from how ADHD is actually described</p>
        <h2>Recognition without turning anyone’s story into content.</h2>
        <p>Anchor’s situation-first language is newly written from recurring, de-identified themes heard across ADHD assessment and therapeutic work, then checked against qualitative research. It does not reproduce case notes, direct quotations or identifiable combinations of personal information.</p>
        <p className="small-note">Seeing yourself in a card can feel validating. It is not an ADHD diagnosis, and none of these experiences belongs exclusively to ADHD.</p>
      </section>

      <section className="founder-card">
        <div className="founder-mark">h</div>
        <div><p className="eyebrow">From Body Belonging Clinic</p><h2>ADHD, eating and brain health—held together.</h2><p>Anchor is led by Lauren Lynch, Accredited Mental Health Social Worker and ANZAED Credentialed Eating Disorder Clinician. It is designed to explore nutrition and ADHD without creating more rules, shame, restriction or body distress.</p><p className="small-note">This is a founder-led general wellbeing release. Individualised nutrition material and future clinical programs require APD, medical and regulatory review before publication.</p><a href="https://adhd.bodybelongingclinic.com.au/" target="_blank" rel="noreferrer">Visit the ADHD Hub <ExternalLink size={15} /></a></div>
      </section>

      <ScopeNote />
      {confirmReset && <ConfirmDialog title="Delete Anchor data from this device?" body="This removes your check-ins, plan, saved ideas, recommendation patterns and program history from this browser. It cannot be undone." confirm="Delete my data" onCancel={() => setConfirmReset(false)} onConfirm={() => { clearAnchorState(); reset(); setConfirmReset(false) }} />}
    </div>
  )
}

function ScopeNote() {
  return <div className="scope-note"><ShieldCheck size={18} /><p><strong>Anchor is a general wellbeing and education tool.</strong> It does not diagnose ADHD, provide treatment, monitor your health or replace advice from a GP, prescriber, APD or therapist.</p></div>
}

function MealModal({ meal, onClose, saved, onToggle }) {
  if (!meal) return null
  return (
    <div className="meal-detail">
      <div className="modal-actions"><button className="icon-button" onClick={onClose} aria-label="Close"><ArrowLeft /></button><button className="icon-button" onClick={() => onToggle(meal.id)} aria-label={saved ? 'Remove meal from saved' : 'Save meal'}><Heart fill={saved ? 'currentColor' : 'none'} /></button></div>
      <img className="meal-hero" src={meal.image} alt={meal.alt} />
      {meal.photo && <p className="photo-credit">Photograph: <a href={meal.photo.url} target="_blank" rel="noreferrer">{meal.photo.photographer} · {meal.photo.source} <ExternalLink size={12} /></a></p>}
      <div className="meal-detail-heading"><p className="eyebrow">{meal.campaignHook || `${meal.time} · ${meal.effort}`}</p><h1>{meal.title}</h1><p className="lead">{meal.description}</p></div>
      <section className="meal-detail-section"><p className="eyebrow">Start with</p><ul className="ingredient-list">{meal.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}</ul></section>
      {meal.components && <section className="meal-detail-section"><p className="eyebrow">What each part brings</p><div className="component-grid">{meal.components.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>}
      <section className="simplest-card"><p className="eyebrow">The fewest-step version</p><p>{meal.simplest}</p></section>
      <section className="meal-detail-section"><p className="eyebrow">Why this combination can be useful</p><div className="why-grid">{meal.why.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <div className="clinical-note"><ShieldCheck /><p>{meal.note}</p></div>
      <ScopeNote />
    </div>
  )
}

function ToolModal({ toolId, onClose, onAction, favourite, onFavourite, savedMeal, onToggleMeal }) {
  if (toolId.startsWith('meal:')) {
    const meal = mealCards.find((item) => item.id === toolId.replace('meal:', ''))
    return <Modal onClose={onClose}><MealModal meal={meal} onClose={onClose} saved={savedMeal} onToggle={onToggleMeal} /></Modal>
  }
  if (toolId.startsWith('program:')) {
    const program = programs.find((item) => item.id === toolId.replace('program:', ''))
    return <Modal onClose={onClose}><GuidedTimer program={program} onComplete={() => onAction({ action: 'complete-program', id: program.id })} /></Modal>
  }
  const tool = toolDetails[toolId]
  if (!tool) return null
  return (
    <Modal onClose={onClose}>
      <div className="tool-detail">
        <div className="modal-actions"><button className="icon-button" onClick={onClose} aria-label="Close"><ArrowLeft /></button><button className="icon-button" onClick={() => onFavourite(toolId)} aria-label={favourite ? 'Remove from favourites' : 'Save to favourites'}><Heart fill={favourite ? 'currentColor' : 'none'} /></button></div>
        <p className="eyebrow">{tool.eyebrow}</p><h1>{tool.title}</h1><p className="lead">{tool.intro}</p>
        <div className="tool-steps">{tool.steps.map(([number, title, body]) => <article key={`${number}-${title}`}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        {tool.note && <div className="clinical-note"><ShieldCheck /><p>{tool.note}</p></div>}
        <button className="button primary full" onClick={() => onAction(tool.cta)}>{tool.cta.label} <ChevronRight size={18} /></button>
        <ScopeNote />
      </div>
    </Modal>
  )
}

function GuidedTimer({ program, onComplete }) {
  const [remaining, setRemaining] = useState((program?.minutes || 5) * 60)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const completionReported = useRef(false)
  const complete = finished || remaining <= 0
  useEffect(() => {
    if (!running || remaining <= 0) return undefined
    const timer = window.setInterval(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [running, remaining])
  useEffect(() => {
    if (remaining === 0 && !finished && !completionReported.current) {
      completionReported.current = true
      onComplete()
    }
  }, [remaining, finished, onComplete])
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const progress = 1 - remaining / ((program?.minutes || 5) * 60)
  return (
    <div className="timer-view">
      <p className="eyebrow">Guided company · {program?.minutes || 5} minutes</p><h1>{complete ? 'That is enough.' : program?.title}</h1><p className="lead">{complete ? 'You made contact with the thing. There is nothing else to earn.' : program?.prompt}</p>
      <div className="timer-ring" style={{ '--progress': `${progress * 360}deg` }}><div><strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong><span>{running ? 'stay with what is here' : complete ? 'complete' : 'ready when you are'}</span></div></div>
      {!complete ? <div className="timer-controls"><button className="button primary" onClick={() => setRunning((value) => !value)}>{running ? <><Pause size={18} /> Pause</> : <><Play size={18} /> {remaining < (program?.minutes || 5) * 60 ? 'Continue' : 'Begin'}</>}</button><button className="button secondary" onClick={() => { completionReported.current = false; setRunning(false); setFinished(false); setRemaining((program?.minutes || 5) * 60) }}><RotateCcw size={17} /> Restart</button><button className="text-button" onClick={() => { setRunning(false); setFinished(true); if (!completionReported.current) { completionReported.current = true; onComplete() } }}><Square size={15} /> Finish here</button></div> : <div className="completion-spark"><Sparkles /><p>Stopping here is complete.</p></div>}
      <p className="small-note">The timer stays on this screen. It does not record what you eat, do or achieve.</p>
    </div>
  )
}

function Modal({ children, onClose }) {
  const sheetRef = useRef(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const listener = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', listener)
    const frame = window.requestAnimationFrame(() => sheetRef.current?.querySelector('button, a[href], input, select, textarea')?.focus())
    return () => {
      document.removeEventListener('keydown', listener)
      window.cancelAnimationFrame(frame)
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={sheetRef} className="modal-sheet" role="dialog" aria-modal="true" aria-label="Anchor support panel">{children}</section></div>
}

function ConfirmDialog({ title, body, confirm, onCancel, onConfirm }) {
  return <Modal onClose={onCancel}><div className="confirm-dialog"><div className="warning-icon"><Trash2 /></div><h2>{title}</h2><p>{body}</p><div className="button-row"><button className="button secondary" onClick={onCancel}>Keep my data</button><button className="button danger" onClick={onConfirm}>{confirm}</button></div></div></Modal>
}

export default function App() {
  const { state, hydrated, update, toggleFavourite, toggleFuel, toggleMeal, addCheckin, completeProgram, reset } = useAnchorStore()
  const initialCampaign = () => {
    if (typeof window === 'undefined') return null
    const hashMoment = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('moment')
    const queryMoment = new URLSearchParams(window.location.search).get('moment')
    if (hashMoment || queryMoment) return null
    const id = new URLSearchParams(window.location.search).get('campaign')
    return nutritionCampaigns.find((item) => item.id === id) || null
  }
  const [tab, setTab] = useState(() => initialCampaign() ? 'explore' : 'today')
  const [activeTool, setActiveTool] = useState(() => initialCampaign()?.action || null)
  // Session-only un-soften. Cycle-aware gentleness is a nudge, never a lock:
  // "Show me everything" restores the full app for this session without changing
  // the saved setting. Resets on reload, as the design intends.
  const [showEverything, setShowEverything] = useState(false)

  const title = useMemo(() => navItems.find((item) => item.id === tab)?.label, [tab])
  useEffect(() => { document.title = `${title} · Anchor` }, [title])

  if (!hydrated) return <main className="loading-shell" aria-label="Loading Anchor"><Brand /><span>Finding a gentle place to begin…</span></main>
  if (!state.onboarded) return <Onboarding onFinish={(name) => update({ name, onboarded: true })} />

  function navigate(next) { setTab(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function handleAction(cta) {
    if (cta.action === 'complete-program') { completeProgram(cta.id); return }
    const programMap = {
      timer: 'eat-with-me',
      'talk-timer': 'say-the-thing',
      'reply-timer': 'say-the-thing',
      'starter-timer': 'five-minute-start',
      'sort-timer': 'tab-sort',
      'landing-timer': 'hyperfocus-landing',
      'shame-timer': 'repair-pause',
      'offstage-timer': 'off-stage',
      'sensory-timer': 'sensory-anchor',
      'move-timer': 'four-minute-reset',
      'wind-timer': 'evening-soften',
    }
    if (programMap[cta.action]) { setActiveTool(`program:${programMap[cta.action]}`); return }
    if (cta.action === 'fuel-finder') { setActiveTool(null); navigate('explore'); return }
    if (cta.action === 'plan' || cta.action === 'one-thing') { setActiveTool(null); navigate('plan'); return }
    if (cta.action === 'evidence') { setActiveTool(null); navigate('more') }
  }

  return (
    <div className="app-shell">
      <Header />
      <Navigation active={tab} onChange={navigate} />
      <main id="main-content" className="content-shell">
        {tab === 'today' && <Today state={state} onOpen={setActiveTool} onNavigate={navigate} softened={Boolean(state.gentleness?.enabled && state.gentleness?.harderWeek && !showEverything)} onShowEverything={() => setShowEverything(true)} onEndHarderWeek={() => update({ gentleness: { ...state.gentleness, harderWeek: false } })} />}
        {tab === 'explore' && <Explore state={state} onOpen={setActiveTool} onFavourite={toggleFavourite} onToggleFuel={toggleFuel} onToggleMeal={toggleMeal} />}
        {tab === 'plan' && <Plan state={state} update={update} onToggleFuel={toggleFuel} onToggleMeal={toggleMeal} onOpen={setActiveTool} />}
        {tab === 'checkin' && <CheckIn state={state} addCheckin={addCheckin} />}
        {tab === 'learn' && <Learn />}
        {tab === 'more' && <More state={state} reset={reset} update={update} />}
      </main>
      {activeTool && <ToolModal toolId={activeTool} onClose={() => setActiveTool(null)} onAction={handleAction} favourite={state.favourites.includes(activeTool)} onFavourite={toggleFavourite} savedMeal={state.savedMealIds.includes(activeTool.replace('meal:', ''))} onToggleMeal={toggleMeal} />}
    </div>
  )
}
