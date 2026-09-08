import { ArrowLeft, ArrowRight, FileText, Mail, Scale, ShieldCheck } from 'lucide-react'
import { ReactNode } from 'react'
import { BrandMark } from './BrandMark'

export type LegalPageKind = 'privacy' | 'terms'

type LegalSection = { id: string; title: string; content: ReactNode }

const effectiveDate = '8 September 2026'

const privacySections: LegalSection[] = [
  {
    id: 'scope', title: '1. Who this policy applies to', content: <>
      <p>This Privacy Policy explains how SkinFox (“we”, “us” or “our”) handles personal data when you visit <strong>skinfox.in</strong>, create or use a SkinFox customer account, place an order, contact us, or otherwise interact with our services.</p>
      <p>SkinFox is the operator of this website. For privacy questions, requests or grievances, contact us at <a href="mailto:contact@skinfox.in">contact@skinfox.in</a>.</p>
    </>,
  },
  {
    id: 'data', title: '2. Information we collect', content: <>
      <p>We collect only information relevant to providing and improving the store. Depending on how you use SkinFox, this may include:</p>
      <ul><li><strong>Contact and account information:</strong> your mobile number, name and email address if you provide them.</li><li><strong>Order and delivery information:</strong> products selected, delivery address, order status and customer-support correspondence.</li><li><strong>Technical information:</strong> essential cookies, cart/session identifiers, device and browser information, IP-address-derived security logs, and pages or links used to reach the store.</li><li><strong>Marketing preferences:</strong> your newsletter subscription or other communications preferences.</li></ul>
      <p>Please do not send us sensitive personal information unless we specifically ask for it and explain why it is needed.</p>
    </>,
  },
  {
    id: 'use', title: '3. How we use information', content: <>
      <p>We use personal data to operate the store, provide the services you request, and meet legal obligations. This includes verifying a mobile number with a one-time password (OTP), maintaining a customer account, processing and delivering an order, responding to support requests, preventing fraud or misuse, and sending communications that you have agreed to receive.</p>
      <p>Where consent is required, we will request it. You may withdraw consent for optional communications at any time; this will not affect processing that was already lawful or information we must retain by law.</p>
    </>,
  },
  {
    id: 'cookies', title: '4. Cookies and local storage', content: <>
      <p>SkinFox uses essential cookies and local browser storage to keep your cart working, maintain a verified customer session, protect forms from misuse, and remember an affiliate referral where applicable. These are necessary to provide the shopping and account features you choose to use.</p>
      <p>We do not sell personal data. If we add non-essential analytics, advertising, payment, SMS or other third-party technologies, we will update this policy and provide any notice or choice required by applicable law.</p>
    </>,
  },
  {
    id: 'sharing', title: '5. When we share information', content: <>
      <p>We may share only the information necessary with service providers that help us host, secure and operate SkinFox. When enabled for an order, this can include delivery partners, payment providers and OTP/SMS providers. Those providers may process data only for the services they perform for us and as permitted by law.</p>
      <p>We may also disclose information where required to comply with law, enforce our terms, protect the rights, safety or security of SkinFox, our customers or others, or in connection with a lawful business transition.</p>
    </>,
  },
  {
    id: 'retention', title: '6. Retention and security', content: <>
      <p>We keep personal data only for as long as reasonably necessary for the purpose described in this policy, including support, security, accounting, tax and legal requirements. We use reasonable technical and organisational safeguards designed to protect information; however, no internet transmission or storage system can be guaranteed completely secure.</p>
      <p>Keep your device and OTP private. We will never ask you to disclose an OTP by email, social media or an unsolicited call.</p>
    </>,
  },
  {
    id: 'rights', title: '7. Your choices and rights', content: <>
      <p>Subject to applicable law, you may request access to, correction of, completion of, updating of or erasure of your personal data; withdraw consent where processing relies on consent; or ask a question or raise a grievance about our handling of your data. To make a request, write to <a href="mailto:contact@skinfox.in">contact@skinfox.in</a> from the email address or mobile number connected to your account, and include enough detail for us to verify and act on your request.</p>
      <p>We may need to retain limited information where required by law or to resolve a security, fraud or legal matter.</p>
    </>,
  },
  {
    id: 'children', title: '8. Children’s privacy', content: <>
      <p>SkinFox is not intended for children who cannot lawfully consent to personal-data processing. If you believe a child has provided personal data without appropriate authorisation, contact us and we will review the request promptly.</p>
    </>,
  },
  {
    id: 'updates', title: '9. Changes and contact', content: <>
      <p>We may update this Privacy Policy to reflect changes to our products, services or legal obligations. The effective date at the top of this page shows when it was last revised. Material changes will be communicated through this website or another appropriate channel.</p>
      <p>For questions, privacy requests or grievances, email <a href="mailto:contact@skinfox.in">contact@skinfox.in</a>.</p>
    </>,
  },
]

const termsSections: LegalSection[] = [
  {
    id: 'acceptance', title: '1. Agreement to these terms', content: <>
      <p>These Terms & Conditions govern your use of <strong>skinfox.in</strong>, the SkinFox storefront, customer account, affiliate links and related services. By using them, you agree to these terms and to our <a href="#privacy-policy">Privacy Policy</a>. If you do not agree, please do not use the services.</p>
      <p>SkinFox may update these terms from time to time. Continued use after an updated version takes effect means you accept the updated terms, to the extent permitted by law.</p>
    </>,
  },
  {
    id: 'store', title: '2. Store information and product content', content: <>
      <p>SkinFox presents skin, body, hair and scalp-care products, their packaging, availability and care information. Product images and descriptions are provided for general shopping information. Colours and packaging may appear differently depending on a device and may change as product information is finalised.</p>
      <p>SkinFox content is not medical advice and does not diagnose, treat, cure or prevent a medical condition. Please review labels and directions before use, perform a patch test where appropriate, and consult a qualified healthcare professional for persistent, painful or concerning symptoms.</p>
    </>,
  },
  {
    id: 'orders', title: '3. Orders, availability and pricing', content: <>
      <p>Adding an item to a bag or submitting an order request does not guarantee acceptance, stock availability or a price. We may decline, cancel or limit an order where information is inaccurate, stock is unavailable, an order appears unauthorised or fraud prevention requires it. If an accepted order must be cancelled, we will communicate using the contact details provided with the order.</p>
      <p>Where shown, an MRP is not necessarily the selling price. The applicable selling price, taxes, delivery charges, payment method and any offer terms are shown before order confirmation. Current testing flows may offer cash on delivery only; payment services will be described before they are enabled.</p>
    </>,
  },
  {
    id: 'delivery', title: '4. Delivery, cancellations, returns and refunds', content: <>
      <p>Delivery coverage, estimated delivery windows, cancellation options and return/refund eligibility may vary by product, delivery location and the condition of an item. The applicable information will be presented at checkout or with your order confirmation. Nothing in these terms limits a right that cannot lawfully be excluded under applicable consumer-protection law.</p>
      <p>To request help with an order, return, refund or cancellation, email <a href="mailto:contact@skinfox.in">contact@skinfox.in</a> with your order number and the mobile number used for the order.</p>
    </>,
  },
  {
    id: 'accounts', title: '5. Customer accounts and OTP', content: <>
      <p>Some features require sign-in by mobile OTP. You are responsible for providing accurate information and keeping your device and OTP secure. Do not share an OTP with anyone. Tell us promptly if you suspect unauthorised access. We may suspend an account or order flow where we reasonably believe it is being misused or presents a security risk.</p>
    </>,
  },
  {
    id: 'affiliate', title: '6. Affiliate referrals', content: <>
      <p>Where SkinFox offers an affiliate referral programme, referral links and wallet credits are governed by the programme terms displayed in the affiliate dashboard. A referral or wallet entry may be reviewed, held, reversed or declined where an order is cancelled, refunded, fraudulent, self-referred, duplicated or otherwise ineligible under the programme rules.</p>
    </>,
  },
  {
    id: 'use', title: '7. Acceptable use and intellectual property', content: <>
      <p>You must not interfere with the store, bypass security or OTP controls, scrape data, misuse promotions or referral links, submit false orders, impersonate another person, or use the services in a way that violates law or another person’s rights.</p>
      <p>SkinFox names, logos, product content, photographs, designs and site content are owned by or licensed to SkinFox and may not be copied, distributed or used commercially without prior written permission, except where law permits.</p>
    </>,
  },
  {
    id: 'liability', title: '8. Disclaimers and liability', content: <>
      <p>To the extent permitted by applicable law, SkinFox provides the website on an “as available” basis. We do not guarantee uninterrupted, error-free or fully secure access. We do not exclude liability where it cannot lawfully be excluded, including for rights available to consumers under applicable law.</p>
      <p>Where permitted, SkinFox will not be liable for indirect, incidental, special or consequential loss arising from use of the website or services. This does not affect statutory consumer rights.</p>
    </>,
  },
  {
    id: 'contact', title: '9. Contact, grievances and governing law', content: <>
      <p>For customer support, an order concern, a legal notice or a grievance, contact <a href="mailto:contact@skinfox.in">contact@skinfox.in</a>. We will review and respond through the contact information provided with your request.</p>
      <p>These terms are governed by the laws applicable in India. Any dispute will be subject to the jurisdiction required by applicable law. Nothing in this section prevents you from using a consumer remedy available under applicable law.</p>
    </>,
  },
]

const pageCopy = {
  privacy: { label: 'Privacy Policy', lead: 'A clear explanation of the personal data SkinFox uses, why we use it, and the choices available to you.', icon: ShieldCheck, sections: privacySections, alternate: 'Terms & Conditions', alternateHash: '#terms-and-conditions' },
  terms: { label: 'Terms & Conditions', lead: 'The terms that apply when you browse SkinFox, use an account, place an order or share an affiliate link.', icon: Scale, sections: termsSections, alternate: 'Privacy Policy', alternateHash: '#privacy-policy' },
} satisfies Record<LegalPageKind, { label: string; lead: string; icon: typeof ShieldCheck; sections: LegalSection[]; alternate: string; alternateHash: string }>

export function LegalPage({ kind, onBack }: { kind: LegalPageKind; onBack: () => void }) {
  const page = pageCopy[kind]
  const PageIcon = page.icon
  return <div className="legal-page">
    <header className="legal-page__header">
      <button className="legal-page__brand" type="button" onClick={onBack} aria-label="Return to SkinFox home"><BrandMark /></button>
      <button className="legal-page__back" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to store</button>
    </header>
    <main>
      <section className="legal-page__hero">
        <div className="legal-page__hero-icon"><PageIcon size={22} /></div>
        <span>SkinFox legal</span>
        <h1>{page.label}</h1>
        <p>{page.lead}</p>
        <small>Effective date: {effectiveDate}</small>
      </section>
      <div className="legal-page__layout">
        <aside className="legal-page__contents" aria-label={`${page.label} contents`}>
          <span>On this page</span>
          <nav>{page.sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={(event) => { event.preventDefault(); document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{section.title.replace(/^\d+\.\s/, '')}</a>)}</nav>
          <a className="legal-page__alternate" href={page.alternateHash}><FileText size={15} /> Read {page.alternate}<ArrowRight size={14} /></a>
        </aside>
        <article className="legal-page__article">
          <div className="legal-page__notice"><ShieldCheck size={17} /><p>These pages explain how SkinFox operates today. They should be reviewed by a qualified legal professional before a full commercial launch, particularly after finalising the selling entity, registered address, tax details, fulfilment partners and return policy.</p></div>
          {page.sections.map((section) => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.content}</section>)}
        </article>
      </div>
    </main>
    <footer className="legal-page__footer"><span>© 2026 SkinFox</span><a href="mailto:contact@skinfox.in"><Mail size={14} /> contact@skinfox.in</a><button type="button" onClick={onBack}>Back to SkinFox</button></footer>
  </div>
}
