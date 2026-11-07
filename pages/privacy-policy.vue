<template>
  <div class="min-h-screen bg-sand">
    <div class="section container-bm max-w-3xl !pb-28">
      <FancyHeading eyebrow="Bahama Mama Swimwear" title="Privacy *Policy*" center>
        How we collect, use and protect your information.
      </FancyHeading>
      <p class="mt-2 text-center text-xs text-ink/45">Last updated: {{ lastUpdated }}</p>

      <div class="mt-9 space-y-8 rounded-4xl bg-cream p-7 shadow-card sm:p-9">
        <section>
          <p class="text-sm leading-relaxed text-ink/70">
            Bahama Mama Swimwear ("we," "us," "our") is a made-to-order and custom swimwear business registered in
            Grenada, based in St. George. This policy explains what information we collect through this website, why
            we collect it, who we share it with, and how you can ask us about it.
          </p>
        </section>

        <section>
          <h2 class="font-display text-base font-semibold text-ink">Information We Collect</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">We only collect information you choose to give us, through one of these:</p>
          <div class="mt-4 space-y-4 text-sm leading-relaxed text-ink/70">
            <div>
              <p class="font-semibold text-ink">Creating an account</p>
              <p>Your email address and a password. Your password is handled entirely by our authentication provider
                (Supabase) — we never see or store it ourselves.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">Placing an order (checkout)</p>
              <p>Your name, email, phone number, and shipping address, plus what you ordered and your order total.
                If you opt in, we also record that you'd like marketing updates.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">Custom orders and quotes</p>
              <p>The same contact details, plus a description of what you'd like made and, where relevant,
                reference or inspiration images you (or we, on your behalf, from a conversation with you) provide.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">The Swimsuit Mixer booking</p>
              <p>Your name, email, WhatsApp number, swimsuit style and fabric selections, and body measurements
                (bust, underbust, waist, hips) needed to prepare your custom piece.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">Contacting us</p>
              <p>Your name, email, phone number (optional), and your message.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">Joining our mailing list</p>
              <p>Your email address, sent directly to our email service provider — we don't keep a separate copy
                of newsletter-only signups in our own systems.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">Payment</p>
              <p>We never see or store your card details. Payments are processed by Go2Pay, our payment provider —
                when you check out, we send them your name, email, phone and order amount to create the payment
                request, and you enter your card details directly on their secure payment page.</p>
            </div>
            <div>
              <p class="font-semibold text-ink">Technical &amp; security information</p>
              <p>To protect checkout and our booking system from automated abuse, we keep a short-lived,
                one-way-hashed version of your IP address (not the IP address itself) for rate-limiting purposes.
                Our own code doesn't set tracking cookies — we use your browser's local storage only to keep you
                signed in and remember your cart. Cloudflare Turnstile, which we use on some forms to check you're
                not a bot, may set its own cookies as part of that check — this is set and controlled by
                Cloudflare, not us.</p>
            </div>
          </div>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">How We Use Your Information</h2>
          <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/70">
            <li>To process and fulfil your order, custom piece, or Swimsuit Mixer booking</li>
            <li>To communicate with you about an order, quote, inquiry, or booking</li>
            <li>To process payment through our payment provider</li>
            <li>To send you marketing updates, only if you've opted in — you can unsubscribe at any time</li>
            <li>To protect the website and our customers from fraud and abuse</li>
            <li>To keep business and accounting records</li>
          </ul>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">We do not sell your information to anyone.</p>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">Third-Party Services We Use</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            We rely on a small number of trusted providers to run this website. Each only receives what it needs to
            do its job:
          </p>
          <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/70">
            <li><strong class="text-ink">Supabase</strong> — hosts our database, handles account sign-in, and stores uploaded images.</li>
            <li><strong class="text-ink">Go2Pay</strong> — processes payments; handles your card details directly, never us.</li>
            <li><strong class="text-ink">Brevo</strong> — sends order/booking confirmation emails and our opt-in newsletter.</li>
            <li><strong class="text-ink">Cloudflare (Turnstile)</strong> — verifies you're not a bot on our forms; processes technical/device information as part of that check.</li>
            <li><strong class="text-ink">Netlify</strong> — hosts the website itself.</li>
          </ul>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            If you're redirected to Go2Pay to complete a payment, that page operates under Go2Pay's own privacy
            practices, not ours.
          </p>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">How Long We Keep Information</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            We keep information for as long as reasonably needed for the purpose it was collected, and we periodically
            review older records against the timeframes below. This is a review process, not automatic deletion —
            removal happens when we've checked a record is no longer needed.
          </p>
          <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/70">
            <li>Checkouts that were never completed/paid — reviewed after 6 months</li>
            <li>Inquiries and quotes that didn't lead to an order — reviewed after 12 months</li>
            <li>Swimsuit Mixer bookings that were never paid for (an expired reservation) — reviewed after 3 months</li>
            <li>Completed orders and payment records — kept for the period needed to meet our accounting, warranty
              and payment-dispute obligations, which may be longer than the timeframes above</li>
          </ul>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            See "Your Choices" below if you'd like us to review or remove information sooner than these timeframes.
          </p>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">Your Choices</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            You can ask us to access, correct, or delete the personal information we hold about you at any time, by
            emailing
            <a href="mailto:hello@bmswimwear.com" class="font-semibold text-coral link-underline">hello@bmswimwear.com</a>.
            We'll confirm your identity before making a change, and we'll let you know if we're unable to delete
            something (for example, a paid order we're required to keep for accounting purposes) and why. If you'd
            like us to remove body measurements from a past Swimsuit Mixer booking while keeping the order record
            itself, let us know — we can usually do that separately.
          </p>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            You can unsubscribe from marketing emails at any time using the link in any marketing email we send, or
            by contacting us directly.
          </p>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">Children's Privacy</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            This website is intended for adults placing orders and bookings for themselves. We don't knowingly
            collect information from children.
          </p>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">Changes to This Policy</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            We may update this policy as the website changes. We'll update the "last updated" date above when we do.
          </p>
        </section>

        <section class="border-t border-ink/10 pt-6">
          <h2 class="font-display text-base font-semibold text-ink">Contact Us</h2>
          <p class="mt-3 text-sm leading-relaxed text-ink/70">
            Questions about this policy or your information?
            <a href="mailto:hello@bmswimwear.com" class="font-semibold text-coral link-underline">hello@bmswimwear.com</a>
            · St. George, Grenada
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({ title: 'Privacy Policy — Bahama Mama Swimwear' })

// Update this constant (not an auto-generated date) whenever the policy
// text itself changes, so it reflects the last real edit, not every deploy.
const lastUpdated = 'November 2026'
</script>
