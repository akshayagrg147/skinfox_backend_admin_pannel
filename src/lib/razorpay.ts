export type RazorpaySuccess = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  image?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  notes?: Record<string, string>
  theme?: { color: string }
  handler: (response: RazorpaySuccess) => void
  modal?: { ondismiss: () => void; confirm_close?: boolean }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void; on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void }
  }
}

let checkoutScript: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (checkoutScript) return checkoutScript
  checkoutScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-skinfox-razorpay]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Secure payment could not be loaded.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.skinfoxRazorpay = 'true'
    script.onload = () => resolve()
    script.onerror = () => { checkoutScript = null; reject(new Error('Secure payment could not be loaded. Check your connection and try again.')) }
    document.head.appendChild(script)
  })
  return checkoutScript
}

export async function openRazorpayCheckout(options: Omit<RazorpayOptions, 'handler' | 'modal'>): Promise<RazorpaySuccess> {
  await loadRazorpayCheckout()
  if (!window.Razorpay) throw new Error('Secure payment is temporarily unavailable.')
  return new Promise((resolve, reject) => {
    let completed = false
    const checkout = new window.Razorpay!({
      ...options,
      handler: (response) => { completed = true; resolve(response) },
      modal: { confirm_close: true, ondismiss: () => { if (!completed) reject(new Error('Payment window closed. No waitlist place was activated.')) } },
    })
    checkout.on('payment.failed', (response) => reject(new Error(response.error?.description || 'Payment failed. No waitlist place was activated.')))
    checkout.open()
  })
}
