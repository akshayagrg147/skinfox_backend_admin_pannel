import { ArrowRight, Droplets, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { productPath } from '../seo/metadata'
import type { Product } from '../types'

type HydrelleRoutineComparisonProps = {
  product: Product
}

const supportingStudies = [
  {
    number: 'Study 02',
    title: 'The look of visible pores',
    copy: 'A close three-quarter view keeps natural pores visible while illustrating a softer-looking, hydrated finish.',
    src: '/products/hydrelle-pore-appearance-study-v1.webp',
    width: 1586,
    height: 992,
    alt: 'Illustrative before-and-after comparison focused on the appearance of visible pores on the same fictional adult model',
    before: 'Visible pores',
    after: 'Softer-looking texture',
  },
  {
    number: 'Study 03',
    title: 'Uneven tone & pigmentation',
    copy: 'A matching side profile illustrates pigmentation appearing less prominent and tone looking more even without changing natural skin colour.',
    src: '/products/hydrelle-pigmentation-study-v1.webp',
    width: 1537,
    height: 1023,
    alt: 'Illustrative before-and-after comparison focused on uneven pigmentation on the same fictional adult model',
    before: 'Uneven-looking tone',
    after: 'More even-looking tone',
  },
]

export function HydrelleRoutineComparison({ product }: HydrelleRoutineComparisonProps) {
  const productImage = product.storyImage ?? product.image

  return (
    <section
      className="routine-comparison section-pad"
      aria-labelledby="routine-comparison-title"
    >
      <div className="routine-comparison__glow" aria-hidden="true" />
      <div className="shell">
        <motion.header
          className="routine-comparison__heading"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.75 }}
        >
          <div>
            <p className="eyebrow"><Droplets size={14} /> Hydrelle moisture study</p>
            <h2 id="routine-comparison-title">Before the ritual.<br /><em>After the ritual.</em></h2>
          </div>
          <div className="routine-comparison__intro">
            <p>One fictional face, matching light and a deliberately subtle moisture difference—created to visualise the feeling of a moisturising step without promising a result.</p>
            <span><ShieldCheck size={15} /> Honest visual context, not a clinical claim.</span>
          </div>
        </motion.header>

        <div className="routine-comparison__stage">
          <motion.figure
            className="routine-comparison__portrait"
            initial={{ opacity: 0, scale: 0.985 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.9 }}
          >
            <img
              src="/products/hydrelle-routine-comparison-v1.webp"
              alt="Illustrative side-by-side moisture ritual visual featuring the same fictional adult model"
              width={1587}
              height={991}
              loading="lazy"
              decoding="async"
            />
            <div className="routine-comparison__labels" aria-hidden="true">
              <span><small>Before the ritual</small><strong>Natural texture</strong></span>
              <span><small>After the ritual</small><strong>Moisturised look</strong></span>
            </div>
            <figcaption>Same fictional model · matching pose and light · subtle editorial visualisation</figcaption>
          </motion.figure>

          <motion.aside
            className="routine-comparison__product"
            aria-label={`${product.name} featured product`}
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.75, delay: 0.08 }}
          >
            <span className="routine-comparison__product-kicker">The ritual companion</span>
            <div className="routine-comparison__tube-window">
              <img
                src={productImage}
                alt={`${product.name} ${product.size} moisturising lotion tube`}
                width={1023}
                height={1537}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="routine-comparison__product-copy">
              <p>{product.name}</p>
              <h3>{product.subtitle}</h3>
              <span>{product.size} · photographed SkinFox pack</span>
              <a className="button button--copper" href={productPath(product)}>
                Explore Hydrelle <ArrowRight size={16} />
              </a>
            </div>
          </motion.aside>
        </div>

        <div className="routine-comparison__studies" aria-labelledby="routine-studies-title">
          <motion.header
            className="routine-comparison__studies-heading"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.72 }}
          >
            <div>
              <span className="section-number">Pores + uneven tone</span>
              <h3 id="routine-studies-title">Two common concerns.<br /><em>Made easier to see.</em></h3>
            </div>
            <p>Explore two appearance-focused comparisons with the same fictional identity, matching light and natural skin texture on both sides.</p>
          </motion.header>

          <div
            className="routine-comparison__study-grid"
            role="list"
            aria-label="Illustrative pore and pigmentation appearance comparisons"
          >
            {supportingStudies.map((study, index) => (
              <motion.figure
                className="routine-comparison__study-card"
                key={study.src}
                role="listitem"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.22 }}
                transition={{ duration: 0.78, delay: index * 0.08 }}
              >
                <div className="routine-comparison__study-media">
                  <img src={study.src} alt={study.alt} width={study.width} height={study.height} loading="lazy" decoding="async" />
                  <div className="routine-comparison__labels routine-comparison__labels--study" aria-hidden="true">
                    <span><small>Before</small><strong>{study.before}</strong></span>
                    <span><small>After</small><strong>{study.after}</strong></span>
                  </div>
                </div>
                <figcaption>
                  <span>{study.number}</span>
                  <strong>{study.title}</strong>
                  <p>{study.copy}</p>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>

        <p className="routine-comparison__disclaimer">
          All comparisons use AI-generated fictional editorial imagery to illustrate cosmetic appearance only—not actual customer results, clinical evidence, treatment of pigmentation or a guarantee of pore reduction. Individual skin responses vary.
        </p>
      </div>
    </section>
  )
}
