import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, CircleAlert, Clock3, RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatPrice, getQuizRecommendation } from '../data/products'
import type { Product } from '../types'
import { getStorefront, postStorefront } from '../lib/storefrontApi'
import { ModalShell } from './ModalShell'
import { ProductVisual } from './ProductVisual'
import { CareGuide } from './CareGuide'
import { PhotoCapture } from './PhotoCapture'
import './care-guide.css'

type Answer = string | string[]
type Condition = { key: string; equals?: string; in?: string[]; not?: string[] }
type FinderOption = { value: string; label: string; description?: string; condition?: Condition | null }
type FinderQuestion = { key: string; prompt: string; selectionMode?: 'single' | 'multi'; required?: boolean; condition?: Condition | null; options: FinderOption[] }
type RecommendationItem = { product: Product; role: 'essential' | 'optional'; reason: string; frequency: string; days: string[]; timeOfDay: string; instructions: string; guidanceStatus: 'approved' | 'needs_review' }
type RecommendationResult = {
  package: { name: string; description: string; items: RecommendationItem[]; totalPaise: number; mrpTotalPaise: number; savingsPaise: number } | null
  summary: { careArea: string; primaryGoal: string | null; secondaryGoals: string[] }
  routine: { weeklyPlan: Array<{ day: string; steps: Array<{ productId: string; productName: string; timeOfDay: string; stepOrder?: number | null; guidanceStatus: string }> }>; repeatForDays: number }
  guidanceReview: Array<{ productId: string; productName: string; message: string }>
  explanation: string
  disclaimer: string
  guidanceNote: string
}

type PhotoAnalysis = { configured: boolean; usable: boolean; observations: string[]; answers: Record<string, Answer>; note: string; remaining?: number; limit?: number }
type PhotoQuota = { configured: boolean; allowed: boolean; remaining: number; limit: number }

type RoutineQuizProps = {
  open: boolean
  onClose: () => void
  onAdd: (product: Product) => void
  catalogue?: Product[]
  finder?: { config?: { intro?: string; resultTitle?: string; resultDescription?: string; packageNames?: Record<string, string>; disclaimer?: string; guidanceNote?: string } | null; questions: Array<{ key: string; prompt: string; selectionMode?: 'single' | 'multi'; required?: boolean; condition?: Condition | null; options: FinderOption[] }> }
}

const fallbackQuestions: FinderQuestion[] = [
  { key: 'careArea', prompt: 'What would you like help with?', options: [['skin', 'Face & skin', 'Protection, cleansing and moisture.'], ['body', 'Body', 'Comfort-focused everyday moisture.'], ['hair', 'Hair', 'Cleansing and botanical hair care.'], ['scalp', 'Scalp', 'A slower scalp and hair ritual.']].map(([value, label, description]) => ({ value, label, description })) },
  { key: 'mainConcern', prompt: 'What would you most like to shop for?', options: [['sun_protection', 'Sun protection', 'The bright facial protection step.'], ['face_cleansing', 'Face cleansing', 'A focused foaming cleanse.'], ['dry_skin', 'Dry-skin comfort', 'A generous moisturising step.'], ['hair_cleansing', 'Hair cleansing', 'A gentle regular wash.'], ['scalp_care', 'Scalp care', 'A transparent herb treatment format.'], ['hair_oiling', 'Hair oiling', 'A botanical oil-led ritual.']].map(([value, label, description]) => ({ value, label, description })) },
  { key: 'routinePreference', prompt: 'How much ritual feels realistic each day?', options: [['simple', 'Keep it simple', 'One or two deliberate steps.'], ['complete', 'Essential / complete routine', 'I enjoy a considered multi-step ritual.']].map(([value, label, description]) => ({ value, label, description })) },
]

const conditionMatches = (condition: Condition | null | undefined, answers: Record<string, Answer>) => {
  if (!condition) return true
  const answer = answers[condition.key]
  const values = Array.isArray(answer) ? answer : answer ? [answer] : []
  if (condition.equals && !values.includes(condition.equals)) return false
  if (condition.in?.length && !values.some((value) => condition.in?.includes(value))) return false
  if (condition.not?.some((value) => values.includes(value))) return false
  return true
}

const displayValue = (value: string | null | undefined) => (value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const savingsLabel = (product: Product) => product.price !== null && product.mrp !== null && product.mrp > product.price ? `Save ${formatPrice(product.mrp - product.price)}` : null

function localRecommendation(answers: Record<string, Answer>, catalogue: Product[]): RecommendationResult {
  const concern = typeof answers.mainConcern === 'string' ? answers.mainConcern : typeof answers.concern === 'string' ? answers.concern : undefined
  const legacyConcern: Record<string, string> = { sun_protection: 'Sun protection', face_cleansing: 'Face cleansing', dry_skin: 'Dry skin', body_moisture: 'Gentle moisture', hair_cleansing: 'Cleansing', scalp_care: 'Scalp care', hair_oiling: 'Oiling' }
  const recommended = concern ? getQuizRecommendation(legacyConcern[concern] ?? concern).map((item) => catalogue.find((candidate) => candidate.id === item.id)).filter((item): item is Product => Boolean(item)) : []
  const items = recommended.map((product): RecommendationItem => ({ product, role: 'essential', reason: product.benefit, frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review' }))
  const totalPaise = items.reduce((sum, item) => sum + (item.product.price ?? 0) * 100, 0)
  const mrpTotalPaise = items.reduce((sum, item) => sum + (item.product.mrp ?? item.product.price ?? 0) * 100, 0)
  const careArea = typeof answers.careArea === 'string' ? answers.careArea : 'skin'
  return { package: items.length ? { name: ({ skin: 'The Skin Reset', body: 'The Body Comfort Edit', hair: 'The Hair Ritual', scalp: 'The Scalp Pause' } as Record<string, string>)[careArea] ?? 'Your SkinFox care edit', description: 'A considered cosmetic care edit based on the answers you shared.', items, totalPaise, mrpTotalPaise, savingsPaise: Math.max(0, mrpTotalPaise - totalPaise) } : null, summary: { careArea, primaryGoal: concern ?? null, secondaryGoals: [] }, routine: { weeklyPlan: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({ day, steps: [] })), repeatForDays: 30 }, guidanceReview: items.map((item) => ({ productId: item.product.id, productName: item.product.name, message: 'Usage directions need final brand approval before launch.' })), explanation: items.length ? 'Your edit is assembled from the answers you shared.' : answers.sensitivity === 'concerning' ? 'We are pausing product suggestions because you mentioned persistent or concerning symptoms. Please speak with a qualified medical professional.' : 'There is no product match yet. Try another answer or browse the collection.', disclaimer: 'Cosmetic care guidance only. This consultation is not a medical diagnosis. For persistent, painful or concerning symptoms, consult a qualified professional.', guidanceNote: 'Follow the final product pack directions. Unsupported usage claims are not shown.' }
}

const acknowledge = (label: string, isLast: boolean) =>
  isLast ? `${label} — that’s everything I need. Putting your edit together.` : `${label} — noted. Next question.`

const guideMessage = (step: number, total: number) => {
  if (total <= 1) return 'Hi, I’m your SkinFox care guide. Tell me what you’re looking for and I’ll suggest a routine that fits.'
  if (step === 0) return 'Hi, I’m your SkinFox care guide. Tell me a little about what you’re looking for, and I’ll help you find a routine that fits.'
  if (step >= total - 1) return 'Almost there. One more answer and I’ll put your care edit together.'
  return 'Thank you — that helps me narrow the collection down. A few more questions to go.'
}

const PhotoReference = ({ photo, onRetake, onRemove }: { photo: string; onRetake: () => void; onRemove: () => void }) => (
  <figure className="care-photo-reference">
    <img src={photo} alt="Your reference photo" />
    <figcaption>
      <strong>Your reference photo</strong>
      <small>Used for this check only</small>
      <span>
        <button type="button" onClick={onRetake}><Camera size={13} aria-hidden="true" /> Retake</button>
        <button type="button" onClick={onRemove}><Trash2 size={13} aria-hidden="true" /> Remove</button>
      </span>
    </figcaption>
  </figure>
)

export function RoutineQuiz({ open, onClose, onAdd, catalogue = [], finder }: RoutineQuizProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [addedIds, setAddedIds] = useState<string[]>([])
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoStepOpen, setPhotoStepOpen] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null)
  const [quota, setQuota] = useState<PhotoQuota | null>(null)
  const [limitMessage, setLimitMessage] = useState('')
  const [reply, setReply] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const speakTimer = useRef<number | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const requestVersion = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const serverFinder = finder?.questions?.some((question) => question.key === 'careArea') ? finder : null
  const questions = useMemo(() => (serverFinder?.questions?.length ? serverFinder.questions : fallbackQuestions), [serverFinder])
  const activeQuestions = useMemo(() => questions.filter((question) => conditionMatches(question.condition, answers)), [answers, questions])
  const activeQuestion = activeQuestions[Math.min(step, Math.max(0, activeQuestions.length - 1))]
  const isLast = Boolean(activeQuestion && step === activeQuestions.length - 1)
  const selected = activeQuestion ? answers[activeQuestion.key] : undefined

  useEffect(() => {
    requestVersion.current += 1
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    setAdvancing(false)
    if (!open) return
    try {
      const saved = JSON.parse(sessionStorage.getItem('skinfox-care-finder-session') ?? 'null') as { answers?: Record<string, Answer>; result?: RecommendationResult } | null
      if (saved?.result && saved.answers) {
        setAnswers(saved.answers)
        setResult(saved.result)
        setStep(0)
        setLoading(false)
        setAddedIds([])
        setPhoto(null)
        setPhotoStepOpen(false)
        setAnalysing(false)
        setAnalysis(null)
        return
      }
    } catch { /* ignore an old or malformed consultation session */ }
    setStep(0)
    setAnswers({})
    setResult(null)
    setLoading(false)
    setAddedIds([])
    setPhoto(null)
    setPhotoStepOpen(true)
    setAnalysing(false)
    setAnalysis(null)
    setReply('')
    setSpeaking(false)
  }, [open])

  useEffect(() => () => {
    requestVersion.current += 1
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    if (speakTimer.current !== null) window.clearTimeout(speakTimer.current)
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    void getStorefront<PhotoQuota>('/care-finder/photo-analysis')
      .then((response) => { if (active) setQuota(response) })
      .catch(() => { if (active) setQuota(null) })
    return () => { active = false }
  }, [open])

  const currentStage = result ? 'result' : photoStepOpen ? 'photo' : activeQuestion?.key
  useEffect(() => {
    if (!open) return
    setAdvancing(false)
    const focusTimer = window.setTimeout(() => {
      const heading = headingRef.current
      const panel = heading?.closest<HTMLElement>('[role="dialog"]')
      if (panel) panel.scrollTop = 0
      heading?.focus({ preventScroll: true })
    }, 60)
    return () => window.clearTimeout(focusTimer)
  }, [currentStage, open])

  useEffect(() => {
    if (!open || !result) return
    try { sessionStorage.setItem('skinfox-care-finder-session', JSON.stringify({ answers, result })) } catch { /* storage is optional */ }
  }, [answers, open, result])

  const finish = async (nextAnswers: Record<string, Answer>) => {
    const version = ++requestVersion.current
    setLoading(true)
    try {
      if (serverFinder && !import.meta.env.MODE.includes('test')) {
        const response = await postStorefront<RecommendationResult>('/care-finder/recommendations', { answers: nextAnswers })
        if (version !== requestVersion.current) return
        setResult(response)
        void postStorefront('/care-finder/events', { event: 'completed', answers: nextAnswers, recommendations: response }).catch(() => undefined)
      } else setResult(localRecommendation(nextAnswers, catalogue))
    } catch { if (version === requestVersion.current) setResult(localRecommendation(nextAnswers, catalogue)) }
    finally { if (version === requestVersion.current) { setLoading(false); setAdvancing(false) } }
  }

  const acceptPhoto = async (image: string) => {
    setPhoto(image)
    setPhotoStepOpen(false)
    setAnalysing(true)
    setAnalysis(null)
    const version = ++requestVersion.current
    try {
      const response = await postStorefront<PhotoAnalysis>('/care-finder/photo-analysis', { image, mediaType: 'image/jpeg' })
      if (version !== requestVersion.current) return
      setAnalysis(response)
      if (typeof response.remaining === 'number') setQuota((current) => (current ? { ...current, remaining: response.remaining!, allowed: response.remaining! > 0 } : current))
      const merged = { ...answers, ...(response.usable ? response.answers : {}) }
      setAnswers(merged)
      // Skip straight past anything the photo already answered.
      const remaining = questions.filter((question) => conditionMatches(question.condition, merged))
      const nextIndex = remaining.findIndex((question) => merged[question.key] === undefined)
      if (nextIndex === -1 && remaining.length) await finish(merged)
      else setStep(Math.max(0, nextIndex))
    } catch (cause) {
      if (version !== requestVersion.current) return
      const message = cause instanceof Error ? cause.message : ''
      if (/photo limit|photo checks/i.test(message)) {
        setLimitMessage(message)
        setQuota((current) => (current ? { ...current, allowed: false, remaining: 0 } : current))
        setPhoto(null)
        setPhotoStepOpen(true)
      }
      setAnalysis({ configured: false, usable: false, observations: [], answers: {}, note: '' })
    } finally {
      if (version === requestVersion.current) setAnalysing(false)
    }
  }

  const continueFrom = (nextAnswers: Record<string, Answer>) => {
    const nextQuestions = questions.filter((question) => conditionMatches(question.condition, nextAnswers))
    if (step >= nextQuestions.length - 1) void finish(nextAnswers)
    else setStep((current) => Math.min(current + 1, nextQuestions.length - 1))
  }

  const speak = (line: string) => {
    if (speakTimer.current !== null) window.clearTimeout(speakTimer.current)
    setSpeaking(true)
    setReply(line)
    speakTimer.current = window.setTimeout(() => { speakTimer.current = null; setSpeaking(false) }, 420)
  }

  const select = (value: string) => {
    if (!activeQuestion || advancing || loading) return
    const deselecting = activeQuestion.selectionMode === 'multi' && Array.isArray(selected) && selected.includes(value)
    const chosen = activeQuestion.options.find((option) => option.value === value)
    if (chosen && !deselecting) speak(acknowledge(chosen.label, isLast))
    const nextAnswers = { ...answers, [activeQuestion.key]: activeQuestion.selectionMode === 'multi' ? (Array.isArray(selected) ? selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] : [value]) : value }
    setAnswers(nextAnswers)
    if (activeQuestion.selectionMode !== 'multi') {
      setAdvancing(true)
      advanceTimer.current = window.setTimeout(() => { advanceTimer.current = null; continueFrom(nextAnswers) }, 150)
    }
  }

  const edit = () => { setResult(null); setAddedIds([]); setReply(''); setStep(Math.max(0, activeQuestions.length - 1)) }
  const restart = () => { setResult(null); setAnswers({}); setAddedIds([]); setStep(0); setPhoto(null); setPhotoStepOpen(true); setAnalysis(null); setAnalysing(false); setReply('') }
  const addItem = (product: Product) => { if (addedIds.includes(product.id)) return; onAdd(product); setAddedIds((current) => [...current, product.id]) }
  const packageItems = result?.package?.items ?? []
  const addRoutine = () => packageItems.forEach((item) => addItem(item.product))
  const purchasableItems = packageItems.filter((item) => item.product.price !== null)
  const routineInBag = purchasableItems.length > 0 && purchasableItems.every((item) => addedIds.includes(item.product.id))
  const packageTotalLabel = result?.package && result.package.totalPaise > 0 ? formatPrice(result.package.totalPaise / 100) : 'Confirm at launch'
  const config = finder?.config

  useEffect(() => {
    if (activeQuestions.length && step >= activeQuestions.length) setStep(activeQuestions.length - 1)
  }, [activeQuestions.length, step])

  return <ModalShell open={open} onClose={onClose} title="Find my care" className="care-finder-modal">
    {!result ? <div className="care-finder-layout">
      <aside className="care-finder-aside" aria-label="Meet your care guide">
        <span className="care-finder-kicker"><Sparkles size={15} aria-hidden="true" /> Find my care</span>
        <CareGuide variant="sidebar" speaking={speaking} message={loading ? 'Bringing your answers together into one considered routine…' : analysing ? 'Reading your photo now — one moment.' : reply || guideMessage(step, activeQuestions.length)} />
        <div className="care-finder-aside__details"><span><Clock3 size={15} aria-hidden="true" /> A few thoughtful questions</span><span><ShieldCheck size={15} aria-hidden="true" /> Cosmetic care, at your pace</span></div>
      </aside>
      <section className="care-finder-content" aria-busy={loading}>
        <div className="care-finder-mobile-guide"><CareGuide variant="compact" message="Let’s find your everyday care, together." /></div>
        {photo && !photoStepOpen && <div className="care-finder-photo-slot"><PhotoReference photo={photo} onRetake={() => setPhotoStepOpen(true)} onRemove={() => setPhoto(null)} /></div>}
        {photoStepOpen ? <PhotoCapture onCapture={(image) => void acceptPhoto(image)} onSkip={() => setPhotoStepOpen(false)} remaining={quota?.configured === false ? 0 : quota?.remaining} limit={quota?.limit} limitMessage={limitMessage} /> : analysing ? <div className="care-finder-loading" role="status" aria-live="polite">
          <span className="care-finder-loading__icon"><Sparkles size={26} aria-hidden="true" /></span>
          <h2>Reading your photo…</h2><p>Looking at what’s visible, then lining up a few questions.</p>
          <div className="care-finder-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </div> : loading ? <div className="care-finder-loading" role="status" aria-live="polite">
          <span className="care-finder-loading__icon"><Sparkles size={26} aria-hidden="true" /></span>
          <h2>Finding your care essentials…</h2><p>Bringing your answers together into a considered routine.</p>
          <div className="care-finder-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </div> : activeQuestion ? <>
          <div className="care-finder-progress">
            <div><span>YOUR CARE, STEP BY STEP</span><b>{String(step + 1).padStart(2, '0')} <i>/ {String(activeQuestions.length).padStart(2, '0')}</i></b></div>
            <div className="care-finder-progress__track" role="progressbar" aria-label="Care finder progress" aria-valuemin={0} aria-valuemax={activeQuestions.length} aria-valuenow={step + 1} aria-valuetext={`Question ${step + 1} of ${activeQuestions.length}`}><span style={{ width: `${((step + 1) / activeQuestions.length) * 100}%` }} /></div>
          </div>
          {analysis?.usable && analysis.observations.length > 0 && <div className="care-photo-findings">
            <span className="care-photo-findings__kicker"><Sparkles size={14} aria-hidden="true" /> From your photo</span>
            <ul>{analysis.observations.map((observation) => <li key={observation}><Check size={14} aria-hidden="true" />{observation}</li>)}</ul>
            <p>{analysis.note}</p>
          </div>}
          <div className="care-finder-question" key={activeQuestion.key}>
            <h2 ref={headingRef} tabIndex={-1}>{activeQuestion.prompt}</h2>
            <p className="care-finder-hint">{activeQuestion.selectionMode === 'multi' ? 'Choose all that feel relevant to you.' : 'Choose the answer that feels most like you.'}</p>
            <div className="care-finder-options" role="group" aria-label={activeQuestion.prompt}>
              {activeQuestion.options.filter((option) => conditionMatches(option.condition, answers)).map((option) => {
                const isSelected = Array.isArray(selected) ? selected.includes(option.value) : selected === option.value
                return <button type="button" key={option.value} onClick={() => select(option.value)} className={isSelected ? 'is-selected' : ''} aria-pressed={isSelected} disabled={advancing}>
                  <span className="care-finder-option__copy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
                  <span className={`care-finder-option__mark ${activeQuestion.selectionMode === 'multi' ? 'care-finder-option__mark--multi' : ''}`} aria-hidden="true">{isSelected ? <Check size={16} /> : activeQuestion.selectionMode !== 'multi' ? <ArrowRight size={16} /> : null}</span>
                </button>
              })}
            </div>
          </div>
          <div className="care-finder-navigation">
            {step > 0 ? <button type="button" className="care-finder-text-button" disabled={advancing} onClick={() => { setReply(''); setStep((value) => Math.max(0, value - 1)) }}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : <span className="care-finder-navigation__note">Made around your needs.</span>}
            {activeQuestion.selectionMode === 'multi' ? <button type="button" className="care-finder-primary-button" onClick={() => continueFrom(answers)} disabled={activeQuestion.required !== false && (!Array.isArray(selected) || selected.length === 0)}>{isLast ? 'Show my care edit' : 'Continue'} <ArrowRight size={16} aria-hidden="true" /></button> : <span className="care-finder-navigation__note">Select to continue <ArrowRight size={13} aria-hidden="true" /></span>}
          </div>
          {activeQuestion.required === false && activeQuestion.selectionMode === 'multi' && (!Array.isArray(selected) || selected.length === 0) && <p className="care-finder-optional-note">This question is optional. Continue whenever you’re ready.</p>}
        </> : <div className="care-finder-empty"><CircleAlert size={28} aria-hidden="true" /><h2 ref={headingRef} tabIndex={-1}>Let’s try that again.</h2><p>We couldn’t load your questions. Please refresh the page and reopen Find my care.</p></div>}
        <p className="care-finder-disclaimer">Your guide to SkinFox cosmetic products. Not a medical consultation.</p>
      </section>
    </div> : <div className="care-finder-result">
      <header className="care-finder-result__header">
        <div className="care-finder-result__guide"><CareGuide variant="compact" message={result.package ? 'A thoughtful starting point, shaped around your answers.' : 'The right care sometimes starts with a little more guidance.'} /></div>
        <span className="care-finder-kicker">Your personalised care edit</span>
        <h2 ref={headingRef} tabIndex={-1}>{config?.resultTitle ?? 'Your personalised SkinFox routine'}</h2>
        <p>{result.package?.description ?? result.explanation}</p>
        <div className="care-finder-tags"><span>{displayValue(result.summary.careArea)}</span>{result.summary.primaryGoal && <span>{displayValue(result.summary.primaryGoal)}</span>}{result.summary.secondaryGoals.map((goal) => <span key={goal}>{displayValue(goal)}</span>)}</div>
      </header>
      {result.package ? <>
        <section className="care-edit" aria-label={result.package.name}>
          <div className="care-edit__header"><div><span className="care-finder-kicker">Your recommended essentials</span><h3>{result.package.name}</h3><p>Care that fits the way you live.</p></div><div className="care-edit__total"><small>Complete routine</small><strong>{packageTotalLabel}</strong>{result.package.mrpTotalPaise > result.package.totalPaise && <span>MRP <s>{formatPrice(result.package.mrpTotalPaise / 100)}</s></span>}{result.package.savingsPaise > 0 && <b>Save {formatPrice(result.package.savingsPaise / 100)}</b>}</div></div>
          <div className="care-edit__items">{packageItems.map((item, index) => <article className="care-edit-item" key={item.product.id}>
            <div className="care-edit-item__visual" style={{ background: item.product.tint }}><ProductVisual product={item.product} compact /></div>
            <div className="care-edit-item__copy"><div className="care-edit-item__meta"><span>Step {String(index + 1).padStart(2, '0')} · {item.role}</span><span>{item.product.size}</span></div><h4>{item.product.name}</h4><p>{item.reason}</p><div className="care-edit-item__guidance"><span><Clock3 size={13} aria-hidden="true" />{item.frequency}</span><span>{item.days.join(', ')}</span><span>{item.timeOfDay}</span></div><p className="care-edit-item__directions">{item.instructions}</p></div>
            <div className="care-edit-item__price"><strong>{item.product.price !== null ? formatPrice(item.product.price) : 'At launch'}</strong>{savingsLabel(item.product) && <small>{savingsLabel(item.product)}</small>}<button type="button" aria-label={`${addedIds.includes(item.product.id) ? 'Added' : 'Add'} ${item.product.name} to bag`} onClick={() => addItem(item.product)} disabled={item.product.price === null || addedIds.includes(item.product.id)}>{item.product.price === null ? 'At launch' : addedIds.includes(item.product.id) ? 'In bag' : 'Add to bag'} {addedIds.includes(item.product.id) ? <Check size={15} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}</button></div>
          </article>)}</div>
          <div className="care-edit__actions"><button type="button" className="care-finder-primary-button" onClick={addRoutine} disabled={!purchasableItems.length || routineInBag}>{!purchasableItems.length ? 'Not available yet' : routineInBag ? 'Routine in bag' : 'Add complete routine'}{routineInBag ? <Check size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}</button><button type="button" className="care-finder-text-button" onClick={edit}>Edit answers</button><span role="status" className="care-edit__bag-status">{addedIds.length > 0 ? `${addedIds.length} ${addedIds.length === 1 ? 'product' : 'products'} added to your bag` : ''}</span></div>
        </section>
        <section className="care-week" aria-label={`${result.routine.repeatForDays} day care routine`}>
          <div className="care-week__heading"><span className="care-week__icon"><CalendarDays size={23} aria-hidden="true" /></span><div><span className="care-finder-kicker">A little consistency goes a long way</span><h3>Your {result.routine.repeatForDays}-day care rhythm.</h3><p>Use this week as your guide, and always follow your product’s directions.</p></div></div>
          <div className="care-week__grid">{result.routine.weeklyPlan.map((day) => <div className="care-week-day" key={day.day}><strong>{day.day}</strong>{day.steps.length ? <ol>{day.steps.map((stepItem) => <li key={`${stepItem.productId}-${stepItem.timeOfDay}-${stepItem.stepOrder ?? ''}`}><span>{stepItem.productName}</span>{stepItem.timeOfDay !== 'As directed' && <small>{stepItem.timeOfDay}</small>}</li>)}</ol> : <p>Follow pack directions</p>}</div>)}</div>
          {result.guidanceReview.length > 0 && <div className="care-week__note"><CircleAlert size={18} aria-hidden="true" /><p><strong>A note on your routine</strong>{result.guidanceNote} Please follow the product label while detailed usage guidance is being reviewed.</p></div>}
        </section>
      </> : <div className="care-finder-empty"><span className="care-finder-empty__icon"><CircleAlert size={28} aria-hidden="true" /></span><h3>{answers.sensitivity === 'concerning' ? 'Your wellbeing comes first.' : 'Let’s find a better starting point.'}</h3><p>{result.explanation}</p><button type="button" className="care-finder-primary-button" onClick={edit}>Review my answers <ArrowLeft size={16} aria-hidden="true" /></button></div>}
      <p className="care-finder-result__disclaimer"><ShieldCheck size={18} aria-hidden="true" />{result.disclaimer}</p><div className="care-finder-result__actions"><button type="button" className="care-finder-text-button" onClick={restart}><RotateCcw size={16} aria-hidden="true" /> Start again</button><button type="button" className="care-finder-text-button" onClick={onClose}>Browse collection <ArrowRight size={16} aria-hidden="true" /></button></div>
    </div>}
  </ModalShell>
}
