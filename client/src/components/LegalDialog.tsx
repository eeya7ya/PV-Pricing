// Terms & Conditions and Privacy Policy, shown in a modal dialog.
//
// These are standard, protective templates tailored to what this app actually
// does (Google sign-in, saved study cases, Google Analytics). Edit the
// constants below to change the operator name, contact address or dates.
// Note: this is a template, not legal advice — have it reviewed if needed.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export type LegalDoc = 'terms' | 'privacy';

const APP_NAME = 'eSpark Solar Calculator';
const OPERATOR = 'ENG. Yahya Khaled ("we", "us", "our")';
const CONTACT_EMAIL = 'support@esparksolar.dev';
const WEBSITE = 'esparksolar.dev';
const LAST_UPDATED = 'May 2026';
const GOVERNING_LAW = 'the Hashemite Kingdom of Jordan';

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mt-4 mb-1">{children}</h3>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>;
}

function Terms() {
  return (
    <div className="space-y-1">
      <P>Last updated: {LAST_UPDATED}</P>
      <P>
        These Terms &amp; Conditions ("Terms") govern your access to and use of {APP_NAME} (the
        "Service"), operated by {OPERATOR}. By accessing or using the Service you agree to be bound
        by these Terms. If you do not agree, do not use the Service.
      </P>

      <H>1. The Service</H>
      <P>
        {APP_NAME} is a tool that produces estimated solar PV system designs, electricity-bill
        comparisons, savings and return-on-investment figures based on the data you enter and on
        publicly available tariff information.
      </P>

      <H>2. Estimates only — no professional advice</H>
      <P>
        All outputs are <strong>indicative estimates for informational purposes only</strong>. They
        are not engineering, financial, legal, tax or investment advice and are not a quotation,
        guarantee or offer. Actual system performance, costs, tariffs, bills and savings depend on
        many factors and will vary. You must independently verify all results with a licensed
        engineer, your electricity distributor and other qualified professionals before making any
        decision or purchase. You rely on the outputs at your own risk.
      </P>

      <H>3. Accounts and sign-in</H>
      <P>
        You may use the Service as a guest or by signing in with your Google account. You are
        responsible for activity that occurs under your account and for keeping your Google
        credentials secure. We may suspend or terminate access that we believe violates these Terms.
      </P>

      <H>4. Acceptable use</H>
      <ul className="list-disc pl-5 space-y-1 mt-1">
        <LI>Do not use the Service for any unlawful, harmful or fraudulent purpose.</LI>
        <LI>Do not attempt to disrupt, reverse-engineer, scrape or gain unauthorized access to the Service or its data.</LI>
        <LI>Do not upload content you do not have the right to use, or that infringes others’ rights.</LI>
      </ul>

      <H>5. Intellectual property</H>
      <P>
        The Service, including its design, text, calculations and software, is owned by us and
        protected by applicable laws. You retain ownership of the data you enter. By saving a study
        case you grant us a limited licence to store and process that data to provide the Service.
      </P>

      <H>6. Disclaimer of warranties</H>
      <P>
        The Service is provided "as is" and "as available" without warranties of any kind, whether
        express or implied, including merchantability, fitness for a particular purpose,
        non-infringement, accuracy or uninterrupted availability. We do not warrant that the Service
        will be error-free or that results will be accurate or reliable.
      </P>

      <H>7. Limitation of liability</H>
      <P>
        To the maximum extent permitted by law, we shall not be liable for any indirect, incidental,
        special, consequential or punitive damages, or for any loss of profits, revenue, data, or
        goodwill, arising out of or relating to your use of (or inability to use) the Service —
        including any decision made in reliance on its outputs. Our total aggregate liability for any
        claim relating to the Service shall not exceed JOD 0 (the Service is provided free of charge).
      </P>

      <H>8. Indemnification</H>
      <P>
        You agree to indemnify and hold us harmless from any claims, damages, liabilities and
        expenses arising from your use of the Service or your breach of these Terms.
      </P>

      <H>9. Changes</H>
      <P>
        We may modify the Service or these Terms at any time. Continued use after changes take effect
        constitutes acceptance of the revised Terms.
      </P>

      <H>10. Governing law</H>
      <P>
        These Terms are governed by the laws of {GOVERNING_LAW}, without regard to conflict-of-law
        rules, and you submit to the exclusive jurisdiction of its courts.
      </P>

      <H>11. Contact</H>
      <P>Questions about these Terms? Contact us at {CONTACT_EMAIL}.</P>
    </div>
  );
}

function Privacy() {
  return (
    <div className="space-y-1">
      <P>Last updated: {LAST_UPDATED}</P>
      <P>
        This Privacy Policy explains how {OPERATOR} collects, uses and protects your information when
        you use {APP_NAME} at {WEBSITE} (the "Service").
      </P>

      <H>1. Information we collect</H>
      <ul className="list-disc pl-5 space-y-1 mt-1">
        <LI><strong>Account information.</strong> If you sign in with Google, we receive your name, email address and profile picture from Google. We do not receive your Google password.</LI>
        <LI><strong>Study-case data.</strong> The inputs and results you choose to save (e.g. consumption figures, system configuration) are stored and linked to your account email.</LI>
        <LI><strong>Usage data.</strong> Like most websites, we collect standard analytics such as pages viewed, device and browser type, approximate location and interactions, via Google Analytics and cookies.</LI>
        <LI><strong>Guests.</strong> If you continue as a guest, your work is not saved to our servers.</LI>
      </ul>

      <H>2. How we use information</H>
      <ul className="list-disc pl-5 space-y-1 mt-1">
        <LI>To provide and operate the Service (authentication, saving and loading your study cases).</LI>
        <LI>To understand usage and improve the Service.</LI>
        <LI>To maintain security and prevent abuse.</LI>
      </ul>

      <H>3. Cookies and analytics</H>
      <P>
        We use cookies and similar technologies, including a session cookie to keep you signed in and
        Google Analytics (gtag.js) to measure usage. You can control cookies through your browser
        settings; disabling them may affect functionality. See Google’s policies for how Google
        processes analytics data.
      </P>

      <H>4. How information is shared</H>
      <P>
        We do not sell your personal information. We share data only with service providers that help
        us run the Service, namely: Google (sign-in and analytics), our hosting provider (Vercel) and
        our database provider (Neon). These providers process data on our behalf. We may also disclose
        information where required by law.
      </P>

      <H>5. Data storage and security</H>
      <P>
        Saved study cases are stored in a managed PostgreSQL database. Sessions are kept in a signed,
        HTTP-only cookie. We apply reasonable technical measures to protect your data, but no method of
        transmission or storage is completely secure, and we cannot guarantee absolute security.
      </P>

      <H>6. Data retention</H>
      <P>
        We keep your account and saved cases for as long as your account is active. You may delete your
        saved cases at any time from the Saved Cases page, or contact us to delete your account data.
      </P>

      <H>7. Your rights</H>
      <P>
        Depending on your location, you may have the right to access, correct, export or delete your
        personal data, or to object to certain processing. To exercise these rights, contact us at
        {' '}{CONTACT_EMAIL}.
      </P>

      <H>8. Children’s privacy</H>
      <P>
        The Service is not directed to children under 16, and we do not knowingly collect their
        personal data.
      </P>

      <H>9. International users</H>
      <P>
        Your data may be processed in countries other than your own, including where our service
        providers operate. By using the Service you consent to such processing.
      </P>

      <H>10. Changes to this policy</H>
      <P>
        We may update this Privacy Policy from time to time. Material changes will be reflected by
        updating the "Last updated" date above.
      </P>

      <H>11. Contact</H>
      <P>For privacy questions or requests, contact us at {CONTACT_EMAIL}.</P>
    </div>
  );
}

interface LegalDialogProps {
  doc: LegalDoc | null;
  onClose: () => void;
}

export default function LegalDialog({ doc, onClose }: LegalDialogProps) {
  return (
    <Dialog open={doc !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl" data-testid="legal-dialog">
        <DialogHeader>
          <DialogTitle>{doc === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          {doc === 'privacy' ? <Privacy /> : doc === 'terms' ? <Terms /> : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
