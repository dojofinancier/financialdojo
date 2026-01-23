import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Financial Dojo",
  description: "Terms of Use of the Financial Dojo",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">
          Terms and Conditions
        </h1>
        
        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
          <p className="text-sm text-slate-500">
            Last updated: December 17, 2025
          </p>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Acceptance of terms</h2>
            <p>
              By accessing and using the Financial Dojo website ("the Site"), you agree to be bound by these terms and conditions. If you do not accept these terms, please do not use the Site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Use of the service</h2>
            <p>You agree to use the Site only for lawful purposes and in a way that does not violate the rights of others. You agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and up-to-date information when registering</li>
              <li>Maintain the confidentiality of your account and password</li>
              <li>Not share your account with third parties</li>
              <li>Not use the Site for fraudulent or illegal purposes</li>
              <li>Respect all intellectual property rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Registration and account</h2>
            <p>
              To access certain services, you must create an account. You are responsible for maintaining the confidentiality of your login credentials and all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Payments and refunds</h2>
            <p>
              Prices for our courses are listed in Canadian dollars. Payments are processed securely through our payment providers.
            </p>
            <p>
              <strong>Refund policy:</strong> Refunds are available within 14 days of purchase, provided that less than 25% of the course content has been accessed. Refund requests must be submitted in writing to admin@dojofnancier.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">5. Intellectual property</h2>
            <p>
              All content on the Site, including but not limited to text, graphics, logos, images, videos, and software, is the property of Financial Dojo or its licensors and is protected by copyright and other intellectual property laws.
            </p>
            <p>
              You receive a limited, non-exclusive, non-transferable license to access and use the course content you purchased for personal and educational purposes only. You may not:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Reproduce, distribute, or share content with third parties</li>
              <li>Use content for commercial purposes</li>
              <li>Modify or create derivative works from the content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">6. Access duration</h2>
            <p>
              Access to courses is granted for the duration specified at purchase (generally 12 months). Access expires automatically at the end of the access period, unless otherwise stated.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">7. Limitation of liability</h2>
            <p>
              Financial Dojo provides the Site and its content "as is." We do not guarantee that the Site will be error-free, uninterrupted, or secure. To the extent permitted by law, we disclaim any liability for direct, indirect, incidental, or consequential damages resulting from the use of the Site.
            </p>
            <p>
              <strong>Disclaimer:</strong> The educational content provided is for information and education only. It does not constitute personalized financial, legal, or tax advice. Always consult a qualified professional for advice tailored to your situation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">8. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time, with or without notice, for violation of these terms or for any other reason we deem appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">9. Changes to terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes take effect upon posting on the Site. It is your responsibility to review these terms regularly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">10. Governing law</h2>
            <p>
              These terms are governed by the laws of Quebec and Canada. Any dispute will be submitted to the exclusive jurisdiction of the courts of Quebec.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">11. Contact</h2>
            <p>
              For any questions regarding these terms and conditions, please contact us:
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










