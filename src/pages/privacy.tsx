import Head from "next/head";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy – BayMo</title>
        <meta name="description" content="BayMo Privacy Policy - How we collect, use, and protect your data" />
      </Head>

      <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-[#1B2F4E] mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Effective Date: April 8, 2026</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <p className="mb-4">
                REPH Innovations Corp ("BayMo," "we," "us," or "our") operates the BayMo Campaign Engine platform. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
                use our service.
              </p>
              <p className="mb-4">
                By using BayMo, you agree to the collection and use of information in accordance with this policy. 
                If you have questions, contact us at{" "}
                <a href="mailto:privacy@bahaymo.com" className="text-[#1B2F4E] underline hover:text-[#2A4A6F]">
                  privacy@bahaymo.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">1. Information We Collect</h2>
              <p className="mb-3">We collect information in the following ways:</p>
              
              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Lead Information</h3>
              <p className="mb-4">
                When leads submit inquiries through web forms, Facebook Messenger, or other channels, we collect: 
                name, phone number, email address, property preferences (type, budget, location), and any additional 
                notes or messages they provide.
              </p>

              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Conversation Data</h3>
              <p className="mb-4">
                We store all messages exchanged between leads and your agents, including message content, timestamps, 
                delivery status, and metadata about the conversation channel (email, Messenger, SMS, etc.).
              </p>

              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Usage Data</h3>
              <p className="mb-4">
                We collect information about how the service is accessed and used, including browser type, IP address, 
                pages visited, time spent on pages, and other diagnostic data.
              </p>

              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Agent Information</h3>
              <p className="mb-4">
                For users of the platform (agents, managers, admins), we collect: full name, email address, phone number, 
                role, and authentication credentials.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">2. How We Use Information</h2>
              <p className="mb-3">We use the collected information for:</p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Managing Lead Inquiries:</strong> To process, track, and respond to property inquiries and customer requests.</li>
                <li><strong>Messenger API Integration:</strong> To enable communication between leads and agents via Facebook Messenger.</li>
                <li><strong>Property Matching:</strong> To match leads with suitable properties based on their preferences and budget.</li>
                <li><strong>AI-Powered Suggestions:</strong> To provide intelligent response suggestions and automation to improve agent productivity.</li>
                <li><strong>Campaign Management:</strong> To organize, execute, and track marketing campaigns and follow-up sequences.</li>
                <li><strong>Document Generation:</strong> To create and manage documents related to property transactions.</li>
                <li><strong>Service Improvement:</strong> To analyze usage patterns and improve platform features and performance.</li>
                <li><strong>Communication:</strong> To send system notifications, updates, and support messages to platform users.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">3. Facebook Messenger Integration</h2>
              <p className="mb-4">
                BayMo integrates with Facebook Messenger to enable communication between leads and real estate agents. 
                When a lead sends a message to a connected Facebook Page:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li>We collect the lead's Page-Scoped ID (PSID), a unique identifier assigned by Facebook.</li>
                <li>We store message content, timestamps, and delivery status.</li>
                <li>Agents can view and reply to messages through the BayMo platform.</li>
                <li>We do not share message data with third parties except as described in this policy.</li>
                <li>Our use of Messenger data complies with the Facebook Platform Policy and Terms of Service.</li>
              </ul>
              <p className="mb-4">
                Leads using Messenger are subject to Facebook's own Privacy Policy. We recommend reviewing Facebook's 
                policies for information about how they handle Messenger data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">4. Data Sharing</h2>
              <p className="mb-3">We may share your information with:</p>

              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Brokerage Clients</h3>
              <p className="mb-4">
                Lead information is shared with the real estate brokerage or agency that you submitted your inquiry to. 
                They use this information to respond to your property requests.
              </p>

              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Service Providers</h3>
              <p className="mb-4">
                We use third-party service providers to support platform operations:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Supabase:</strong> Database hosting and authentication</li>
                <li><strong>Resend:</strong> Email delivery</li>
                <li><strong>OpenAI:</strong> AI-powered response suggestions and content generation</li>
                <li><strong>Anthropic:</strong> AI-powered conversation analysis and automation</li>
              </ul>
              <p className="mb-4">
                These providers are contractually obligated to use your data only for providing services to us and to 
                maintain appropriate security measures.
              </p>

              <h3 className="text-xl font-semibold text-[#1B2F4E] mb-2">Legal Requirements</h3>
              <p className="mb-4">
                We may disclose your information if required by law or in response to valid requests by public authorities 
                (e.g., court orders, government agencies).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">5. Data Retention</h2>
              <p className="mb-4">
                We retain lead information and conversation data for as long as necessary to fulfill the purposes outlined 
                in this policy, unless a longer retention period is required or permitted by law. When you request deletion 
                of your data, we will delete or anonymize it within 30 days, except where we must retain it for legal compliance.
              </p>
              <p className="mb-4">
                Agent accounts and associated data are retained for the duration of the business relationship and may be 
                retained for a reasonable period thereafter for record-keeping purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">6. Data Security</h2>
              <p className="mb-4">
                We implement appropriate technical and organizational measures to protect your information:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Encryption:</strong> All data is transmitted over HTTPS with SSL/TLS encryption.</li>
                <li><strong>Row-Level Security:</strong> Database access is restricted using row-level security policies to ensure data isolation between clients.</li>
                <li><strong>Access Controls:</strong> Platform access is restricted based on user roles and permissions.</li>
                <li><strong>Authentication:</strong> We use secure authentication mechanisms to verify user identity.</li>
                <li><strong>Regular Updates:</strong> We maintain security patches and updates to protect against vulnerabilities.</li>
              </ul>
              <p className="mb-4">
                While we strive to protect your information, no method of transmission over the internet is 100% secure. 
                We cannot guarantee absolute security but are committed to protecting your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">7. Your Rights</h2>
              <p className="mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-4">
                <li><strong>Access:</strong> You can request a copy of the personal information we hold about you.</li>
                <li><strong>Correction:</strong> You can request that we correct inaccurate or incomplete information.</li>
                <li><strong>Deletion:</strong> You can request that we delete your personal information, subject to legal retention requirements.</li>
                <li><strong>Withdraw Consent:</strong> Where we rely on your consent to process your data, you may withdraw that consent at any time.</li>
                <li><strong>Object to Processing:</strong> You can object to certain types of processing, such as direct marketing.</li>
              </ul>
              <p className="mb-4">
                To exercise these rights, contact us at{" "}
                <a href="mailto:privacy@bahaymo.com" className="text-[#1B2F4E] underline hover:text-[#2A4A6F]">
                  privacy@bahaymo.com
                </a>
                . We will respond to your request within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">8. Children's Privacy</h2>
              <p className="mb-4">
                BayMo is not intended for use by individuals under the age of 18. We do not knowingly collect personal 
                information from children. If you become aware that a child has provided us with personal information, 
                please contact us and we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">9. Changes to This Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. When we make changes, we will update the "Effective Date" 
                at the top of this page. We encourage you to review this Privacy Policy periodically to stay informed about 
                how we protect your information.
              </p>
              <p className="mb-4">
                Material changes will be communicated via email or through a prominent notice on our platform. Your continued 
                use of BayMo after such changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#1B2F4E] mb-4">10. Contact Us</h2>
              <p className="mb-4">
                If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <p className="font-semibold text-[#1B2F4E] mb-2">REPH Innovations Corp</p>
                <p className="mb-1">Email: <a href="mailto:privacy@bahaymo.com" className="text-[#1B2F4E] underline hover:text-[#2A4A6F]">privacy@bahaymo.com</a></p>
                <p>Attn: Privacy Officer</p>
              </div>
            </section>

            <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-500">
              <p>© 2026 REPH Innovations Corp. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}