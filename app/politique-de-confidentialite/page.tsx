import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Financial Dojo",
  description: "Financial Dojo Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">
          Privacy Policy
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
          <p className="text-sm text-slate-500">
            Last updated: December 17, 2025
          </p>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Introduction</h2>
            <p>
              Financial Dojo ("we", "our", "us") is committed to protecting the privacy of your personal information. This privacy policy explains how we collect, use, disclose, and protect your information when you use our website and services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Information we collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Personal information:</strong> name, email address, phone number, payment information</li>
              <li><strong>Account information:</strong> username, password, preferences</li>
              <li><strong>Usage information:</strong> data about your use of our platform, course progress, exam results</li>
              <li><strong>Technical information:</strong> IP address, browser type, device used</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Use of information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide and improve our educational services</li>
              <li>Process your payments and manage your account</li>
              <li>Send you important communications about your account</li>
              <li>Personalize your learning experience</li>
              <li>Analyze platform usage to improve our services</li>
              <li>Comply with our legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Information sharing</h2>
            <p>
              We do not sell your personal information. We may share your information only in the following cases:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>With trusted service providers that help us operate our platform (payment processors, hosting providers)</li>
              <li>When required by law or to protect our rights</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Data security</h2>
            <p>
              We implement appropriate security measures to protect your personal information against unauthorized access, modification, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">6. Your rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Request portability of your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">7. Cookies</h2>
            <p>
              We use cookies and similar technologies to improve your experience, analyze the use of our site, and personalize content. You can manage your cookie preferences in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">8. Changes</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">9. Contact</h2>
            <p>
              For any questions regarding this privacy policy, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Financial Dojo</strong><br />
              Email : admin@dojofnancier.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}










