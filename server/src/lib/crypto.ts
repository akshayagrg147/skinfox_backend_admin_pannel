import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id })
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)
export const signHmac = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex')
const secretKey = () => createHash('sha256').update(process.env.COOKIE_SECRET ?? 'local-only-change-this-cookie-secret-please').digest()
export const encryptSecret = (value: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}
export const decryptSecret = (value: string) => {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.')
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) return value
  try {
    const decipher = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(ivEncoded, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return value
  }
}
export const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
