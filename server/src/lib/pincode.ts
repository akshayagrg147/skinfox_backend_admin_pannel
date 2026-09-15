export type PincodeLocation = { city: string | null; state: string | null }

type PostalOffice = { District?: unknown; Block?: unknown; Name?: unknown; State?: unknown }
type PostalResponse = { Status?: unknown; PostOffice?: PostalOffice[] }
type FetchLike = typeof fetch

const textValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

/**
 * Resolve the customer-facing location for an Indian pincode.  This uses the
 * India Post directory only for location metadata; delivery eligibility still
 * comes from SkinFox's configured shipping provider and serviceable-pincode
 * list.
 */
export async function lookupPincode(pincode: string, fetcher: FetchLike = fetch): Promise<PincodeLocation | null> {
  const response = await fetcher(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(6_000),
  })
  if (!response.ok) return null
  const payload = await response.json().catch(() => null) as PostalResponse[] | PostalResponse | null
  const result = Array.isArray(payload) ? payload[0] : payload
  if (!result || String(result.Status).toLowerCase() !== 'success' || !Array.isArray(result.PostOffice) || !result.PostOffice.length) return null
  const office = result.PostOffice[0]
  return {
    // India Post exposes District rather than a normalized city field. It is
    // the most consistent locality value across the directory.
    city: textValue(office?.District) ?? textValue(office?.Block) ?? textValue(office?.Name),
    state: textValue(office?.State),
  }
}
