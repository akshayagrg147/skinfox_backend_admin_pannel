/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getQuizRecommendation } from '../data/products'
import type { Product, QuizAnswer } from '../types'
import { postStorefront } from '../lib/storefrontApi'
import { ModalShell } from './ModalShell'
import { ProductVisual } from './ProductVisual'

type RoutineQuizProps = {
  open: boolean
  onClose: () => void
  onAdd: (product: Product) => void
  catalogue?: Product[]
  finder?: { questions: Array<{ key: string; prompt: string; options: Array<{ value: string; label: string; description?: string }> }> }
}

const steps = [
  {
    key: 'skinFeel' as const,
    eyebrow: 'First, choose your care',
    question: 'Where would you like your routine to begin?',
    options: [
      ['Skin', 'Protection, cleansing and focused moisture'],
      ['Hair', 'Cleansing and oil-led hair care'],
      ['Scalp', 'A slower botanical treatment ritual'],
    ],
  },
  {
    key: 'concern' as const,
    eyebrow: 'Choose one focus',
    question: 'What would you most like to shop for?',
    options: [
      ['Sun protection', 'The bright 60 g facial suncream'],
      ['Face cleansing', 'A foaming wash for acne-prone skin'],
      ['Gentle moisture', 'The compact Coco Kiss pump lotion'],
      ['Dry skin', 'A focused moisturising-lotion option'],
      ['Cleansing', 'A 300 ml hair-wash starting point'],
      ['Scalp care', 'The transparent herb treatment format'],
      ['Oiling', 'A regular botanical hair-oil moment'],
    ],
  },
  {
    key: 'ritual' as const,
    eyebrow: 'Make it yours',
    question: 'How much ritual feels realistic each day?',
    options: [
      ['Minimal', 'Two deliberate steps'],
      ['Essential', 'Three focused steps'],
      ['Immersive', 'I enjoy the full ritual'],
    ],
  },
]

export function RoutineQuiz({ open, onClose, onAdd, catalogue, finder }: RoutineQuizProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer>({})
  const complete = step === (finder?.questions.length || steps.length)
  const [apiRecommendations, setApiRecommendations] = useState<Product[] | null>(null)
  const activeSteps = finder?.questions.length ? finder.questions.map((question) => ({ ...question, eyebrow: 'Build your care edit', question: question.prompt, options: question.options.map((option) => [option.value, option.description ?? option.label] as [string, string]) })) : steps
  const recommendations = apiRecommendations ?? (catalogue ? (getQuizRecommendation(answers.concern).map((item) => catalogue.find((candidate) => candidate.id === item.id)).filter(Boolean) as Product[]) : getQuizRecommendation(answers.concern))

  useEffect(() => {
    if (!open) return
    setStep(0)
    setAnswers({})
    setApiRecommendations(null)
  }, [open])

  useEffect(() => {
    if (!complete || !finder) return
    postStorefront<any>('/care-finder/recommendations', { answers }).then((result) => {
      const items = [result.primary, ...(result.alternatives ?? [])].filter(Boolean)
      if (catalogue) setApiRecommendations(items.map((item: any) => catalogue.find((candidate) => candidate.id === item.slug || candidate.id === item.id)).filter((item: Product | undefined): item is Product => Boolean(item)))
    }).catch(() => undefined)
  }, [answers, catalogue, complete, finder])

  const select = (value: string) => {
    const current = activeSteps[step]
    setAnswers((previous) => ({ ...previous, [current.key]: value }))
    window.setTimeout(() => setStep((value) => value + 1), 170)
  }

  return (
    <ModalShell open={open} onClose={onClose} title="SkinFox ritual finder" className="quiz-modal">
      {!complete ? (
        <div className="quiz-layout">
          <div className="quiz-aside">
            <span className="quiz-aside__icon"><Sparkles size={22} /></span>
            <p>Ritual finder</p>
            <h2>A clearer routine in 60 seconds.</h2>
            <span className="quiz-aside__note">Product discovery only · no diagnosis</span>
          </div>
          <div className="quiz-content">
            <div className="quiz-progress" aria-label={`Question ${step + 1} of ${activeSteps.length}`}>
              <span><i style={{ width: `${((step + 1) / activeSteps.length) * 100}%` }} /></span>
              <b>{String(step + 1).padStart(2, '0')} / {String(activeSteps.length).padStart(2, '0')}</b>
            </div>
            <span className="eyebrow">{steps[step].eyebrow}</span>
            <h2>{steps[step].question}</h2>
            <div className="quiz-options">
              {activeSteps[step].options.map(([value, description]) => (
                <button key={value} onClick={() => select(value)} className={answers[steps[step].key] === value ? 'is-selected' : ''}>
                  <span><strong>{value}</strong><small>{description}</small></span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            {step > 0 && <button className="quiz-back" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={15} /> Back</button>}
          </div>
        </div>
      ) : (
        <div className="quiz-result">
          <span className="quiz-result__icon"><Check size={24} /></span>
          <span className="eyebrow">Your focused edit</span>
          <h2>Care that fits the way you live.</h2>
          <p>Based on your interest in <strong>{answers.concern?.toLowerCase()}</strong>, explore {recommendations.length === 1 ? 'this product' : 'these products'} and confirm the final pack directions before use.</p>
          <div className="quiz-result__products">
            {recommendations.map((product) => (
              <article key={product.id}>
                <div style={{ background: product.tint }}><ProductVisual product={product} compact /></div>
                <span><small>{product.step}</small><strong>{product.name}</strong></span>
                <button onClick={() => onAdd(product)}>Add <ArrowRight size={14} /></button>
              </article>
            ))}
          </div>
          <div className="quiz-result__actions">
            <button className="button button--dark" onClick={() => recommendations.forEach(onAdd)}>Add selected edit</button>
            <button className="button button--text" onClick={() => { setStep(0); setAnswers({}) }}><RotateCcw size={15} /> Retake quiz</button>
          </div>
          <p className="prototype-note">This product-discovery preview is not medical advice. For persistent or concerning symptoms, consult a qualified professional.</p>
        </div>
      )}
    </ModalShell>
  )
}
