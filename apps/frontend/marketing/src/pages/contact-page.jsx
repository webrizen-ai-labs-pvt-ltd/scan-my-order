import { useState } from 'react';
import { Mail01Icon, CheckmarkCircle02Icon, ArrowRight01Icon } from 'hugeicons-react';
import { Button, Input, Label } from '@smo/ui';
import { cn } from '@smo/ui/lib/utils';
import { links } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { Reveal } from '../components/reveal';
import { usePageMeta } from '../lib/use-page-meta';

const STORE_COUNTS = ['1', '2–5', '6–15', '16+'];

const FIELDS = {
  restaurant: { label: 'Restaurant or brand name', required: true },
  name: { label: 'Your name', required: true },
  email: { label: 'Work email', required: true, type: 'email' },
  phone: { label: 'Phone (optional)', type: 'tel', autoComplete: 'tel' },
  city: { label: 'City', required: true },
};

function validate(values) {
  const errors = {};
  for (const [key, cfg] of Object.entries(FIELDS)) {
    if (cfg.required && !values[key]?.trim()) errors[key] = `${cfg.label} is required.`;
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
}

// Composes a prefilled mailto: link — no backend endpoint exists for leads yet.
function buildMailto(values) {
  const subject = `Onboarding request — ${values.restaurant}`;
  const body = [
    `Restaurant: ${values.restaurant}`,
    `Name: ${values.name}`,
    `Email: ${values.email}`,
    `Phone: ${values.phone || '-'}`,
    `City: ${values.city}`,
    `Locations: ${values.stores}`,
    '',
    values.message || '',
  ].join('\n');
  return `mailto:${links.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const fieldClass = 'h-11';
const textareaClass =
  'flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm';

export default function ContactPage() {
  usePageMeta({
    title: 'Apply for onboarding — Scan My Order',
    description: 'Tell us about your restaurant and we will set up your brand, menu and QR codes with you during beta.',
  });

  const [values, setValues] = useState({
    restaurant: '',
    name: '',
    email: '',
    phone: '',
    city: '',
    stores: STORE_COUNTS[0],
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const update = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      document.getElementById(`field-${firstError}`)?.focus();
      return;
    }
    window.location.href = buildMailto(values);
    setSubmitted(true);
  };

  return (
    <section className="container mx-auto px-4 pt-16 pb-24 md:px-8 md:pt-24 md:pb-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Apply for onboarding"
            title="Tell us about your restaurant."
            body="Beta seats are free and limited. We reply within one business day and set up your brand, menu and QR codes with you on a call."
          />

          <Reveal delay={0.1} className="mt-8 space-y-4 text-sm">
            <p className="flex items-start gap-2.5">
              <CheckmarkCircle02Icon size={18} className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
              No credit card, no contract during beta
            </p>
            <p className="flex items-start gap-2.5">
              <CheckmarkCircle02Icon size={18} className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
              Bring your own Razorpay keys — keep 100% of revenue
            </p>
            <p className="flex items-start gap-2.5">
              <CheckmarkCircle02Icon size={18} className="mt-0.5 shrink-0 text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
              Print-ready table QR codes on day one
            </p>
          </Reveal>

          <Reveal delay={0.15} className="mt-10 soft-border bg-card p-5 shadow-soft-in dark:shadow-soft-in-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prefer email?</p>
            <a
              href={`mailto:${links.contactEmail}`}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium hover:text-yellow-700 dark:hover:text-yellow-400"
            >
              <Mail01Icon size={16} aria-hidden="true" />
              {links.contactEmail}
            </a>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          {submitted ? (
            <div className="soft-border bg-card p-8 shadow-soft-in dark:shadow-soft-in-dark" role="status">
              <CheckmarkCircle02Icon size={32} className="text-yellow-700 dark:text-yellow-400" aria-hidden="true" />
              <h2 className="mt-4 font-elsie text-2xl">Almost there.</h2>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">
                Your email app should have opened with the request prefilled. Hit send and we’ll be in touch within
                one business day. If nothing opened, write to us directly at{' '}
                <a href={`mailto:${links.contactEmail}`} className="font-medium underline underline-offset-2">
                  {links.contactEmail}
                </a>
                .
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
                Edit my details
              </Button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              noValidate
              className="soft-border bg-card p-6 shadow-soft-in dark:shadow-soft-in-dark sm:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                {Object.entries(FIELDS).map(([key, cfg]) => (
                  <div key={key} className={cn('grid gap-1.5', key === 'restaurant' && 'sm:col-span-2')}>
                    <Label htmlFor={`field-${key}`}>{cfg.label}</Label>
                    <Input
                      id={`field-${key}`}
                      type={cfg.type || 'text'}
                      autoComplete={cfg.autoComplete}
                      value={values[key]}
                      onChange={update(key)}
                      required={cfg.required}
                      aria-invalid={!!errors[key]}
                      aria-describedby={errors[key] ? `error-${key}` : undefined}
                      className={cn(fieldClass, errors[key] && 'border-destructive focus-visible:ring-destructive')}
                    />
                    {errors[key] && (
                      <p id={`error-${key}`} className="text-xs text-destructive">
                        {errors[key]}
                      </p>
                    )}
                  </div>
                ))}

                <div className="grid gap-1.5">
                  <Label htmlFor="field-stores">Number of locations</Label>
                  <select
                    id="field-stores"
                    value={values.stores}
                    onChange={update('stores')}
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                  >
                    {STORE_COUNTS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="field-message">Anything we should know? (optional)</Label>
                  <textarea
                    id="field-message"
                    value={values.message}
                    onChange={update('message')}
                    placeholder="Cuisine, current tools, when you’d like to go live…"
                    className={textareaClass}
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="mt-6 w-full">
                Send request
                <ArrowRight01Icon />
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                This opens your email app with the details prefilled.
              </p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
