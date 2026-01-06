import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | SportZen',
  description: 'Terms and conditions for using the SportZen platform',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="prose prose-invert prose-gray max-w-none">
          <p className="text-gray-400 mb-6">
            Last updated: January 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300">
              By accessing and using SportZen ("the Platform"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p className="text-gray-300">
              SportZen is a turf booking platform that connects players with sports facility owners.
              We provide an online marketplace for discovering, booking, and managing sports facility reservations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">3. User Accounts</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must be at least 18 years old to create an account</li>
              <li>One person may not maintain more than one account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">4. Booking and Payments</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>All bookings require a 10% advance payment to confirm</li>
              <li>The remaining 90% is to be paid at the venue</li>
              <li>Advance payments are processed through secure payment gateways</li>
              <li>Prices are displayed in BDT (Bangladeshi Taka)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">5. Cancellation Policy</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>More than 24 hours before booking: Full refund (minus processing fee)</li>
              <li>6-24 hours before booking: 50% refund (minus processing fee)</li>
              <li>Less than 6 hours before booking: No refund</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">6. User Conduct</h2>
            <p className="text-gray-300 mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Use the platform for any unlawful purpose</li>
              <li>Submit false or misleading information</li>
              <li>Interfere with the proper functioning of the platform</li>
              <li>Attempt to gain unauthorized access to other accounts</li>
              <li>Post fake reviews or ratings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">7. Reviews and Ratings</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Reviews can only be submitted for completed bookings with verified check-ins</li>
              <li>Reviews must be honest and based on actual experiences</li>
              <li>We reserve the right to remove reviews that violate our guidelines</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-300">
              SportZen acts as an intermediary between players and facility owners.
              We are not responsible for the quality of facilities, injuries, or disputes between parties.
              Our liability is limited to the amount of fees paid to us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">9. Changes to Terms</h2>
            <p className="text-gray-300">
              We may modify these terms at any time. Continued use of the platform after changes
              constitutes acceptance of the modified terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">10. Contact</h2>
            <p className="text-gray-300">
              For questions about these terms, please contact us at support@sportzen.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
