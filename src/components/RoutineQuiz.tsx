import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleAlert, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatPrice, getQuizRecommendation } from '../data/products'
import type { Product } from '../types'
import { postStorefront } from '../lib/storefrontApi'
import { ModalShell } from './ModalShell'
import { ProductVisual } from './ProductVisual'

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

export function RoutineQuiz({ open, onClose, onAdd, catalogue = [], finder }: RoutineQuizProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [addedIds, setAddedIds] = useState<string[]>([])
  const serverFinder = finder?.questions?.some((question) => question.key === 'careArea') ? finder : null
  const questions = useMemo(() => (serverFinder?.questions?.length ? serverFinder.questions : fallbackQuestions), [serverFinder])
  const activeQuestions = useMemo(() => questions.filter((question) => conditionMatches(question.condition, answers)), [answers, questions])
  const activeQuestion = activeQuestions[Math.min(step, Math.max(0, activeQuestions.length - 1))]
  const isLast = Boolean(activeQuestion && step === activeQuestions.length - 1)
  const selected = activeQuestion ? answers[activeQuestion.key] : undefined

  useEffect(() => {
    if (!open) return
    try {
      const saved = JSON.parse(sessionStorage.getItem('skinfox-care-finder-session') ?? 'null') as { answers?: Record<string, Answer>; result?: RecommendationResult } | null
      if (saved?.result && saved.answers) {
        setAnswers(saved.answers)
        setResult(saved.result)
        setStep(0)
        setLoading(false)
        setAddedIds([])
        return
      }
    } catch { /* ignore an old or malformed consultation session */ }
    setStep(0)
    setAnswers({})
    setResult(null)
    setLoading(false)
    setAddedIds([])
  }, [open])

  useEffect(() => {
    if (!open || !result) return
    try { sessionStorage.setItem('skinfox-care-finder-session', JSON.stringify({ answers, result })) } catch { /* storage is optional */ }
  }, [answers, open, result])

  const finish = async (nextAnswers: Record<string, Answer>) => {
    setLoading(true)
    try {
      if (serverFinder && !import.meta.env.MODE.includes('test')) {
        const response = await postStorefront<RecommendationResult>('/care-finder/recommendations', { answers: nextAnswers })
        setResult(response)
        void postStorefront('/care-finder/events', { event: 'completed', answers: nextAnswers, recommendations: response }).catch(() => undefined)
      } else setResult(localRecommendation(nextAnswers, catalogue))
    } catch { setResult(localRecommendation(nextAnswers, catalogue)) }
    finally { setLoading(false) }
  }

  const continueFrom = (nextAnswers: Record<string, Answer>) => {
    const nextQuestions = questions.filter((question) => conditionMatches(question.condition, nextAnswers))
    if (step >= nextQuestions.length - 1) void finish(nextAnswers)
    else setStep((current) => Math.min(current + 1, nextQuestions.length - 1))
  }

  const select = (value: string) => {
    if (!activeQuestion) return
    const nextAnswers = { ...answers, [activeQuestion.key]: activeQuestion.selectionMode === 'multi' ? (Array.isArray(selected) ? selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] : [value]) : value }
    setAnswers(nextAnswers)
    if (activeQuestion.selectionMode !== 'multi') window.setTimeout(() => continueFrom(nextAnswers), 150)
  }

  const edit = () => { setResult(null); setAddedIds([]); setStep(Math.max(0, activeQuestions.length - 1)) }
  const restart = () => { setResult(null); setAnswers({}); setAddedIds([]); setStep(0) }
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

  return <ModalShell open={open} onClose={onClose} title="SkinFox ritual finder" className="quiz-modal">
    {!result ? <div className="quiz-layout">
      <aside className="quiz-aside"><span className="quiz-aside__icon"><Sparkles size={22} /></span><p>Personalised consultation</p><h2>Find a clearer routine.</h2><span className="quiz-aside__note">A few thoughtful questions · cosmetic discovery only</span></aside>
      <section className="quiz-content" aria-busy={loading}>
        {activeQuestion ? <>
          <div className="quiz-progress" aria-label={`Question ${step + 1} of ${activeQuestions.length}`}><span><i style={{ width: `${((step + 1) / activeQuestions.length) * 100}%` }} /></span><b>Question {String(step + 1).padStart(2, '0')} / {String(activeQuestions.length).padStart(2, '0')}</b></div>
          <span className="eyebrow">{step === 0 ? 'Start with what matters' : 'Shape your care edit'}</span><h2>{activeQuestion.prompt}</h2>
          <div className={`quiz-options ${activeQuestion.selectionMode === 'multi' ? 'quiz-options--multi' : ''}`}>
            {activeQuestion.options.filter((option) => conditionMatches(option.condition, answers)).map((option) => { const isSelected = Array.isArray(selected) ? selected.includes(option.value) : selected === option.value; return <button type="button" key={option.value} onClick={() => select(option.value)} className={isSelected ? 'is-selected' : ''} aria-pressed={isSelected}><span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>{activeQuestion.selectionMode === 'multi' ? <span className="quiz-option-check">{isSelected ? <Check size={15} /> : null}</span> : <ArrowRight size={18} />}</button> })}
          </div>
          {activeQuestion.selectionMode === 'multi' && <button type="button" className="button button--dark quiz-continue" onClick={() => continueFrom(answers)} disabled={activeQuestion.required !== false && (!Array.isArray(selected) || selected.length === 0)}>{isLast ? 'Show my care edit' : 'Continue'} <ArrowRight size={15} /></button>}
          {step > 0 && <button type="button" className="quiz-back" onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={15} /> Back</button>}
          {!activeQuestion.required && activeQuestion.selectionMode === 'multi' && (!Array.isArray(selected) || selected.length === 0) && <p className="quiz-skip-note">This is optional. You can continue without selecting a second focus.</p>}
        </> : <div className="care-no-match"><CircleAlert size={24} /><h2>We could not load the consultation.</h2><p>Please refresh the page and try again.</p></div>}
      </section>
    </div> : <div className="quiz-result">
      <span className="quiz-result__icon">{result.package ? <Check size={24} /> : <CircleAlert size={24} />}</span><span className="eyebrow">Your personalised care edit</span><h2>{config?.resultTitle ?? 'Your personalised SkinFox routine'}</h2><p className="quiz-result__intro">{result.package?.description ?? result.explanation}</p>
      <div className="care-summary-chips"><span>{displayValue(result.summary.careArea)}</span>{result.summary.primaryGoal && <span>{displayValue(result.summary.primaryGoal)}</span>}{result.summary.secondaryGoals.map((goal) => <span key={goal}>{displayValue(goal)}</span>)}</div><p className="quiz-result__legacy-copy">Care that fits the way you live.</p>
      {result.package ? <>
        <section className="care-package" aria-label={result.package.name}><div className="care-package__header"><div><span className="eyebrow">Recommended package</span><h3>{result.package.name}</h3></div><div className="care-package__total"><strong>{packageTotalLabel}</strong>{result.package.savingsPaise > 0 && <small>Save {formatPrice(result.package.savingsPaise / 100)}</small>}</div></div>{result.package.mrpTotalPaise > result.package.totalPaise && <p className="care-package__mrp">MRP <s>{formatPrice(result.package.mrpTotalPaise / 100)}</s> · offer prices shown above</p>}
          <div className="care-package__items">{packageItems.map((item) => <article className="care-package__item" key={item.product.id}><div className="care-package__item-visual" style={{ background: item.product.tint }}><ProductVisual product={item.product} compact /></div><div className="care-package__item-copy"><div className="care-package__item-meta"><span className={`care-package__label care-package__label--${item.role}`}>{item.role}</span><span>{item.product.size}</span></div><h4>{item.product.name}</h4><p>{item.reason}</p><div className="care-package__item-guidance"><span>{item.frequency}</span><span>{item.days.join(', ')}</span><span>{item.timeOfDay}</span></div><p className="care-package__item-instructions">{item.instructions}</p></div><div className="care-package__item-price"><strong>{item.product.price !== null ? formatPrice(item.product.price) : 'At launch'}</strong>{savingsLabel(item.product) && <small>{savingsLabel(item.product)}</small>}<button type="button" onClick={() => addItem(item.product)} disabled={item.product.price === null || addedIds.includes(item.product.id)}>{item.product.price === null ? 'At launch' : addedIds.includes(item.product.id) ? 'In bag' : 'Add'} <ArrowRight size={14} /></button></div></article>)}</div>
          <div className="care-package__actions"><button type="button" className="button button--dark" onClick={addRoutine} disabled={!purchasableItems.length || routineInBag}>{!purchasableItems.length ? 'Unavailable at launch' : routineInBag ? 'Routine in bag' : 'Add complete routine'}</button><button type="button" className="button button--text" onClick={edit}>Edit answers</button></div>
        </section>
        <section className="care-routine" aria-label="30 day care routine"><div className="care-routine__heading"><div><span className="eyebrow">Your rhythm</span><h3>Repeat this weekly plan for 30 days.</h3></div><CalendarDays size={21} /></div><div className="care-routine__grid">{result.routine.weeklyPlan.map((day) => <div className="care-day" key={day.day}><strong>{day.day.slice(0, 3)}</strong>{day.steps.length ? <div className="care-day__steps">{day.steps.map((stepItem) => <span key={stepItem.productId}>{stepItem.stepOrder ? `${stepItem.stepOrder}. ` : ''}{stepItem.productName}{stepItem.timeOfDay !== 'As directed' ? ` · ${stepItem.timeOfDay}` : ''}</span>)}</div> : <small>Pack directions</small>}</div>)}</div>{result.guidanceReview.length > 0 && <div className="care-guidance-note"><CircleAlert size={16} /><p><strong>Final guidance check</strong>{result.guidanceNote} Individual usage directions are pending final brand approval.</p></div>}</section>
      </> : <div className="care-no-match"><CircleAlert size={24} /><h3>No suitable product yet.</h3><p>{result.explanation}</p><button type="button" className="button button--dark" onClick={edit}>Edit answers</button></div>}
      <p className="prototype-note">{result.disclaimer}</p><div className="quiz-result__actions"><button type="button" className="button button--text" onClick={restart}><RotateCcw size={15} /> Start again</button><button type="button" className="button button--text" onClick={onClose}>Browse collection</button></div>
    </div>}
  </ModalShell>
}
