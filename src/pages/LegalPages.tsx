import { Link } from 'react-router-dom';

interface LegalPageProps {
  title: string;
  subtitle: string;
  sections: { heading: string; body: string }[];
}

export function LegalPage({ title, subtitle, sections }: LegalPageProps) {
  return (
    <div className="bg-bone min-h-screen">
      <div className="border-b border-jet/10">
        <div className="container-base py-12 lg:py-16">
          <p className="section-label mb-3">Legal</p>
          <h1 className="text-display-xl">{title}</h1>
          <p className="mt-3 text-slate-500 max-w-lg">{subtitle}</p>
        </div>
      </div>

      <div className="container-narrow py-12 lg:py-16">
        <div className="prose prose-sm max-w-none space-y-8">
          {sections.map((s, i) => (
            <div key={i}>
              <h2 className="text-lg font-semibold mb-3">{s.heading}</h2>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-jet/10">
          <p className="text-xs text-slate-400">
            Business-owner and legal review is required: confirm the details on this page before relying on it.
            This page is not legal advice.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link to="/privacy" className="link-underline">Privacy Policy</Link>
            <Link to="/terms" className="link-underline">Terms & Conditions</Link>
            <Link to="/cookies" className="link-underline">Cookie Policy</Link>
            <Link to="/shipping-returns" className="link-underline">Shipping & Returns</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How AB16 Clothing collects, uses, and protects your personal data."
      sections={[
        { heading: 'Overview', body: 'AB16 Clothing ("we", "us") is committed to protecting your privacy. This policy explains what data we collect, why we collect it, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018).' },
        { heading: 'Data We Collect', body: 'The site collects the information entered for orders and account use, including name, email address, delivery details, order contents, and contact enquiries. Stripe processes card details during checkout; this website does not store card numbers. Confirm the complete data inventory, retention periods, and any additional processors before publication.' },
        { heading: 'How We Use and Share Your Data', body: 'The site uses order and contact information to process checkout, respond to enquiries, and operate accounts. Newsletter and product-interest forms also collect email addresses. The project includes Stripe checkout, Printful fulfilment, Resend email, and Supabase data/account integrations. Confirm which services are active, what information is shared with each, the legal bases, and retention periods before publication.' },
        { heading: 'Marketing Consent', body: 'The site includes newsletter and product-interest sign-up forms. Confirm how consent is recorded, how marketing messages are sent, and how recipients can withdraw consent before publication.' },
        { heading: 'Data Security', body: 'Stripe handles card details through checkout, and Supabase is used for site data and accounts. Do not rely on this description as a security assurance; confirm the actual access controls, retention, and incident procedures with the business owner.' },
        { heading: 'Your Rights', body: 'Under UK GDPR, you have the right to: access your data, correct inaccurate data, request deletion, restrict processing, data portability, and object to processing. To exercise these rights, contact us using the details on our Contact page.' },
        { heading: 'Cookies and Browser Storage', body: 'The current site code stores the shopping bag and Supabase sign-in session in browser local storage. Local storage is not a cookie. The site code reviewed for this release does not identify analytics or advertising tags; confirm any deployed third-party scripts and cookie use before publication.' },
        { heading: 'Contact', body: 'For any privacy questions or data requests, please contact us through our Contact page. We will respond within one month as required by UK GDPR.' },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      subtitle="The terms that govern your use of the AB16 Clothing website and store."
      sections={[
        { heading: 'Acceptance of Terms', body: 'Business-owner/legal review required: confirm when these terms apply and how customers are notified of and accept them.' },
        { heading: 'Orders & Payment', body: 'The current checkout displays prices in GBP and uses Stripe for payment. Confirm the legal seller, applicable taxes, order acceptance process, and any other order terms before publication.' },
        { heading: 'UK Consumer Rights', body: 'Business-owner/legal review required: confirm the applicable consumer-rights wording and references for the countries in which the store accepts orders.' },
        { heading: 'Cancellation & Returns', body: 'The site code does not establish a returns period, eligibility rules, return-postage responsibility, or refund-processing timeframe. Confirm these terms and the applicable statutory rights before publication; see Shipping & Returns for the current review status.' },
        { heading: 'Intellectual Property', body: 'Business-owner review required: confirm ownership and permitted use of the site, clothing, music, video, images, logos, and other materials before publication.' },
        { heading: 'Music Content', body: 'Business-owner/legal review required: confirm the rights holder and permitted uses for music, videos, and audio content offered on this site.' },
        { heading: 'Liability', body: 'Business-owner/legal review required: obtain appropriate liability wording. No limitation or exclusion is stated here.' },
        { heading: 'Changes to Terms', body: 'Business-owner/legal review required: confirm how changes to these terms will be communicated and when they take effect.' },
      ]}
    />
  );
}

export function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      subtitle="How we use cookies and how you can control them."
      sections={[
        { heading: 'What Are Cookies', body: 'Cookies are small text files stored on your device by a website. Depending on how a site is configured, they can support site functions or other uses.' },
        { heading: 'Current Site Storage', body: 'The current site code stores the shopping bag and Supabase sign-in session in browser local storage; these are not cookies. No analytics or advertising tags were identified in the site source reviewed for this release. Confirm the cookies and other storage used by the deployed site before publication.' },
        { heading: 'Managing Cookies', body: 'Browser settings can be used to view or remove cookies. The site currently has no in-page cookie preference control. Confirm whether non-essential cookies or similar technologies are used and implement any required consent controls before publication.' },
        { heading: 'Third-Party Services', body: 'Stripe is used for checkout. Confirm whether Stripe or any other third party sets cookies or similar technologies on the deployed site, and document the relevant services and controls before publication.' },
      ]}
    />
  );
}

export function ShippingReturnsPage() {
  return (
    <LegalPage
      title="Shipping & Returns"
      subtitle="Delivery options, timeframes, and our returns policy."
      sections={[
        { heading: 'Delivery Destinations and Charges', body: 'The current checkout accepts delivery addresses in the United Kingdom and Ireland. It charges £4.50 standard delivery, waived when the basket subtotal is at least £75, or £8.50 for express delivery. Confirm these rates and their application to each destination before publication.' },
        { heading: 'Delivery Times and Dispatch', body: 'Checkout currently labels standard delivery as 2-4 days and express as 1-2 days. Product information also displays UK 1-3 day and EU 3-7 day estimates, while checkout currently accepts UK and Ireland addresses. Confirm and reconcile these estimates and destinations before publication; do not treat them as guaranteed until verified.' },
        { heading: 'Returns and Refunds', body: 'A product detail page currently displays “30-day returns on unworn items”, but a verified returns policy was not found in the project. Confirm whether that promise is intended and provide the applicable item conditions, return method, responsibility for return postage, and refund timeframe before publication.' },
        { heading: 'How to Return', body: 'The Contact page provides a customer-support email and enquiry form. Return instructions and the return address/process have not been confirmed; obtain them from the business owner before publication.' },
        { heading: 'Faulty or Incorrect Items', body: 'Business-owner/legal review required: confirm the contact and remedy process without limiting statutory rights.' },
        { heading: 'Consumer Rights', body: 'Business-owner/legal review required: confirm the consumer-rights wording for every supported delivery destination.' },
      ]}
    />
  );
}
