import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | SportZen',
  description: 'Privacy policy for the SportZen platform',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-gray max-w-none">
          <p className="text-gray-400 mb-6">
            Last updated: January 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-gray-300">
              SportZen ("we", "our", or "us") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-white mb-2">Personal Information</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 mb-4">
              <li>Name and email address</li>
              <li>Phone number</li>
              <li>Payment information (processed securely through payment gateways)</li>
              <li>Location data (when you search for nearby facilities)</li>
            </ul>

            <h3 className="text-lg font-medium text-white mb-2">Usage Information</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Booking history and preferences</li>
              <li>Device and browser information</li>
              <li>IP address and approximate location</li>
              <li>Interaction data with our platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Process and manage your bookings</li>
              <li>Send booking confirmations and reminders</li>
              <li>Improve our services and user experience</li>
              <li>Communicate updates and promotional offers (with your consent)</li>
              <li>Prevent fraud and ensure platform security</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">4. Information Sharing</h2>
            <p className="text-gray-300 mb-4">We may share your information with:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li><strong>Facility Owners:</strong> To facilitate your bookings</li>
              <li><strong>Payment Processors:</strong> To process secure payments</li>
              <li><strong>Service Providers:</strong> Who help us operate our platform</li>
              <li><strong>Legal Authorities:</strong> When required by law</li>
            </ul>
            <p className="text-gray-300 mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Security</h2>
            <p className="text-gray-300">
              We implement appropriate technical and organizational measures to protect your personal information.
              However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">6. Your Rights</h2>
            <p className="text-gray-300 mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your data (subject to legal requirements)</li>
              <li>Opt-out of marketing communications</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">7. Cookies</h2>
            <p className="text-gray-300">
              We use cookies and similar technologies to enhance your experience, analyze usage patterns,
              and deliver personalized content. You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">8. Data Retention</h2>
            <p className="text-gray-300">
              We retain your personal information for as long as necessary to provide our services,
              comply with legal obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">9. Children's Privacy</h2>
            <p className="text-gray-300">
              Our platform is not intended for children under 18. We do not knowingly collect personal
              information from children. If you believe we have collected information from a child,
              please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes through the platform or via email.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">11. Contact Us</h2>
            <p className="text-gray-300">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-gray-300 mt-2">
              Email: privacy@sportzen.com<br />
              Address: Dhaka, Bangladesh
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
