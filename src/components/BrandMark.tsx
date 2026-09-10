export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="SkinFox home">
      <img className="brand-mark__image" src="/brand/skinfox-logo.png" alt="" width={1200} height={538} decoding="async" />
    </span>
  )
}
