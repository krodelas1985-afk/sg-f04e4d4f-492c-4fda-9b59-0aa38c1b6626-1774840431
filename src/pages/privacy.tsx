import Head from "next/head";

export default function PrivacyPolicy() {
  const effectiveDate = "July 5, 2026";

  return (
    <>
      <Head>
        <title>Privacy Policy | BaMo</title>
        <meta
          name="description"
          content="BaMo Privacy Policy — how REPH Innovations Corp collects, uses, and protects your data."
        />
        <meta name="robots" content="index,follow" />
      </Head>

      <div className="min-h-screen bg-white">
        <header className="bg-[#1A2E5A] text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <p className="text-sm uppercase tracking-widest text-[#E8660A] font-semibold mb-2">
              BaMo &middot; Bahaymo
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold">Privacy Policy</h1>
            <p className="mt-4 text-white/80">
              Effective Date: {effectiveDate} &nbsp;&middot;&nbsp; Last Updated: {effectiveDate}
            </p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-gray-700 leading-relaxed">
          <section className="mb-10">
            <p className="mb-4">
              REPH Innovations Corp ("REPH," "BaMo," "Bahaymo," "we," "us," or "our") operates
              the BaMo platform, including the Bahaymo marketplace at bahaymo.com and the BaMo
              suite of campaign, advertising, and lead-management tools. This Privacy Policy
              explains what personal information we collect, how we use and share it, and the
              rights you have under the Philippine Data Privacy Act of 2012 (Republic Act No.
              10173) and its implementing rules.
            </p>
            <p>
              By using BaMo, or by interacting with a real-estate professional or developer who
              uses BaMo to manage their leads, you acknowledge the practices described in this
              Policy. If you do not agree, please do not use the platform or submit inquiries
              through channels we operate.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">1. Who We Are</h2>
            <p className="mb-4">
              REPH Innovations Corp is a corporation organized under the laws of the Republic of
              the Philippines and registered with the Securities and Exchange Commission as an
              information technology company. We operate BaMo as a software and marketplace
              platform serving real-estate agents, brokers, and developers across the
              Philippines. We are the Personal Information Controller for data we collect
              directly through our consumer-facing surfaces, and a Personal Information
              Processor on behalf of our real-estate clients with respect to leads they bring
              into their own workspaces.
            </p>
            <p>
              You can reach our Data Protection Officer at{" "}
              <a
                href="mailto:support@bahaymo.com"
                className="text-[#1A2E5A] underline hover:text-[#E8660A]"
              >
                support@bahaymo.com
              </a>
              .
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-[#1A2E5A] mt-4 mb-2">Contact information</h3>
            <p className="mb-4">
              Name, mobile or landline phone number, email address, Facebook or Instagram
              profile identifier or display name, and any other contact handle you choose to
              share when you inquire about a property or respond to one of our messages.
            </p>

            <h3 className="text-lg font-semibold text-[#1A2E5A] mt-4 mb-2">
              Conversation content
            </h3>
            <p className="mb-4">
              The text, images, voice notes, and attachments you exchange with us or with a
              real-estate professional through Facebook Messenger, Instagram Direct, web chat
              forms, email, SMS, WhatsApp, or partner marketplaces, together with timestamps,
              channel metadata, and delivery status.
            </p>

            <h3 className="text-lg font-semibold text-[#1A2E5A] mt-4 mb-2">
              Property interest data
            </h3>
            <p className="mb-4">
              The property listings you view, save, or ask about; your stated preferences such
              as property type, location, budget range, bedrooms, intended use, financing
              readiness, and target move-in or turnover date; and any other purchase-intent
              signals you share during a conversation.
            </p>

            <h3 className="text-lg font-semibold text-[#1A2E5A] mt-4 mb-2">
              Derived lead scores and qualification data
            </h3>
            <p className="mb-4">
              We generate derived attributes about your inquiry, including a temperature label
              (for example, hot, warm, cold), a qualification score, suggested next actions,
              tags reflecting interest level or readiness, and similar internal classifications
              produced by automated systems. These derived values describe our internal
              assessment of an inquiry and are made available to the real-estate professional
              you have engaged with.
            </p>

            <h3 className="text-lg font-semibold text-[#1A2E5A] mt-4 mb-2">
              Technical and usage data
            </h3>
            <p>
              IP address, device type, browser, referring URL, and basic interaction events on
              our web surfaces, collected to operate, secure, and improve the service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">3. How We Collect It</h2>
            <p className="mb-4">
              We collect information when you message a BaMo client's page or account on
              Facebook Messenger or Instagram Direct; when you fill out a web form, landing
              page, or marketplace inquiry that is powered by BaMo; when you reply to an email,
              SMS, or WhatsApp message originated through BaMo; when a real-estate
              professional manually adds your inquiry to their workspace after speaking with
              you on another channel; and when partner marketplaces or advertising platforms
              forward an inquiry you submitted on their surface to a BaMo-connected client.
            </p>
            <p>
              Some information is generated by the platform itself — for example, lead scores,
              conversation summaries, and suggested replies created by automated processing
              described in Section 4.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">
              4. Automated Processing and AI
            </h2>
            <p className="mb-4">
              BaMo uses automated systems, including artificial intelligence, to help
              real-estate professionals respond to inquiries efficiently. Specifically, your
              data may be subject to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>
                <span className="font-semibold">AI lead scoring and qualification</span> —
                automated analysis of your conversation, stated preferences, and
                purchase-intent signals to estimate readiness and route your inquiry to the
                right person.
              </li>
              <li>
                <span className="font-semibold">AI response generation</span> — automated
                drafting and, in some cases, automated sending of replies on behalf of the
                real-estate professional you are engaging with, using the context of your
                conversation and the listings you asked about.
              </li>
              <li>
                <span className="font-semibold">AI follow-up sequencing</span> — automated
                scheduling and delivery of follow-up messages over time when you have not yet
                responded or when an appointment has not yet been booked, with content tailored
                to your stated interest.
              </li>
            </ul>
            <p>
              Decisions that materially affect you — such as which property is offered, the
              commercial terms, and any contractual obligation — are made by the human
              real-estate professional, not by the automated system. You may ask the
              professional, or contact us at the address in Section 9, to request human review
              of any outcome produced or recommended by an automated process.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">5. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To respond to your property inquiry and connect you with a relevant agent, broker, or developer.</li>
              <li>To send follow-up messages, appointment reminders, listing recommendations, and other communications related to the inquiry you initiated.</li>
              <li>To operate, maintain, secure, debug, and improve the BaMo platform and the services delivered to our real-estate clients.</li>
              <li>To produce aggregated, de-identified analytics and reporting for our clients (for example, response times, lead source performance).</li>
              <li>To comply with legal obligations, respond to lawful requests by public authorities, and enforce our terms of service.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">
              6. Sharing With Third Parties
            </h2>
            <p className="mb-4">
              We share your personal information with the following categories of third parties,
              listed by category rather than by vendor name. We do not sell your personal
              information.
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>
                <span className="font-semibold">The real-estate professional you engaged with</span>{" "}
                — the agent, broker, or developer who operates the workspace receiving your
                inquiry. They become an independent controller of your data within their own
                pipeline.
              </li>
              <li>
                <span className="font-semibold">AI processing providers</span> — providers of
                large language model and machine-learning inference services that we use to
                score leads, draft replies, and generate follow-ups.
              </li>
              <li>
                <span className="font-semibold">Cloud hosting and database infrastructure</span>{" "}
                — providers that host our application, store conversation records, and run our
                backend workloads, primarily in the Singapore region.
              </li>
              <li>
                <span className="font-semibold">Meta Platforms messaging</span> — Facebook and
                Instagram messaging infrastructure used to deliver and receive your messages
                when you contact a client through those surfaces.
              </li>
              <li>
                <span className="font-semibold">
                  Marketing automation and workflow infrastructure
                </span>{" "}
                — services that route, schedule, and deliver email, SMS, and follow-up
                sequences.
              </li>
              <li>
                <span className="font-semibold">Ad creative rendering services</span> —
                services that generate or render images, videos, and other creative assets used
                in advertising campaigns; these typically process listing content rather than
                lead data, but may incidentally process related identifiers.
              </li>
              <li>
                <span className="font-semibold">Legal, regulatory, and professional advisors</span>{" "}
                — where required by law or to protect our rights, property, and safety, or those
                of our users.
              </li>
            </ul>
            <p>
              Each third party is engaged under contractual terms that require them to process
              your information only on our instructions and to maintain appropriate security
              safeguards.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">
              7. International Data Transfers
            </h2>
            <p>
              Our primary application and database infrastructure is hosted in Singapore, and
              some of our third-party processors (including AI processing providers and
              messaging infrastructure) operate from data centers outside the Philippines. By
              using BaMo, you understand that your personal information may be transferred to,
              stored in, and processed in Singapore and other jurisdictions whose data
              protection laws may differ from those of the Philippines. Where we transfer
              personal information across borders, we use contractual safeguards consistent
              with Section 21 of the Data Privacy Act and the National Privacy Commission's
              guidance on cross-border processing.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">8. Data Retention</h2>
            <p className="mb-4">
              We retain your personal information only for as long as necessary to fulfil the
              purposes described in this Policy, including the period during which the
              real-estate professional is actively working your inquiry, plus a reasonable
              period thereafter to allow re-engagement on related listings, to handle disputes,
              and to comply with tax, accounting, and other legal obligations.
            </p>
            <p>
              When personal information is no longer required, we delete, anonymize, or
              aggregate it. Conversation records may be retained in encrypted backups for a
              limited additional period before being purged on our standard backup rotation.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3" id="data-deletion">
              9. Your Rights and How to Exercise Them
            </h2>
            <p className="mb-4">
              Under Republic Act No. 10173 (the Data Privacy Act of 2012) you have the right to
              be informed; the right to object to the processing of your personal information;
              the right to access your information; the right to rectification of inaccurate
              data; the right to erasure or blocking; the right to damages for unlawful
              processing; the right to data portability where applicable; and the right to file
              a complaint with the National Privacy Commission.
            </p>
            <p className="mb-4">
              To exercise any of these rights — including to request a copy of your data, to
              correct it, or to request that your personal information and conversation history
              be deleted from BaMo — send an email to{" "}
              <a
                href="mailto:support@bahaymo.com"
                className="text-[#1A2E5A] underline hover:text-[#E8660A]"
              >
                support@bahaymo.com
              </a>{" "}
              with the subject line <span className="font-semibold">"Data Request"</span>. Please
              include:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-4">
              <li>Your full name.</li>
              <li>The phone number, email address, or Facebook/Instagram profile you used to inquire.</li>
              <li>The name of the agent, broker, developer, or property you were in contact with, if known.</li>
              <li>The specific right you are exercising (access, correction, deletion, objection, etc.).</li>
            </ul>
            <p>
              We will acknowledge your request within a reasonable period and respond
              substantively within the timelines required by law. We may need to verify your
              identity before acting on a request. Where the data was provided to a real-estate
              professional acting as an independent controller, we may forward your request to
              that professional and assist with fulfilment.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">10. Children's Privacy</h2>
            <p>
              BaMo is not directed to children under the age of 18, and we do not knowingly
              collect personal information from minors. If you believe a minor has provided us
              with personal information, please contact us at support@bahaymo.com and we will
              take steps to delete that information.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">11. Security</h2>
            <p>
              We implement reasonable and appropriate organizational, physical, and technical
              security measures to protect personal information against accidental or unlawful
              destruction, alteration, unauthorized disclosure, or access. These include access
              controls, encryption in transit, role-based permissions, logging, and
              workspace-level isolation between clients. No method of transmission or storage
              is perfectly secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our
              practices, our services, or the law. When we make material changes, we will
              update the Effective Date and Last Updated values at the top of this page and,
              where appropriate, notify you through the channel you originally used to contact
              us. Continued use of BaMo after a change takes effect constitutes acknowledgment
              of the revised Policy.
            </p>
          </section>

          <section className="mb-2">
            <h2 className="text-2xl font-bold text-[#1A2E5A] mb-3">13. Contact Us</h2>
            <p className="mb-2">
              REPH Innovations Corp &middot; BaMo / Bahaymo
            </p>
            <p className="mb-2">
              Email:{" "}
              <a
                href="mailto:support@bahaymo.com"
                className="text-[#1A2E5A] underline hover:text-[#E8660A]"
              >
                support@bahaymo.com
              </a>
            </p>
            <p>Website: bahaymo.com</p>
          </section>

          <hr className="my-10 border-gray-200" />
          <p className="text-sm text-gray-500">
            Effective Date: {effectiveDate} &middot; Last Updated: {effectiveDate}
          </p>
        </main>
      </div>
    </>
  );
}
