/** Format a paise amount without hiding fractional rupees returned by a carrier quote. */
export const formatCheckoutPaise = (value: number) => {
  const paise = Math.max(0, Math.round(value))
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}
