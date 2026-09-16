import { Link } from 'react-router-dom';
import { ArrowRight01Icon } from 'hugeicons-react';
import { Button } from '@smo/ui';
import { steps } from '../data/site';
import { SectionHeading } from '../components/section-heading';
import { Reveal, RevealGroup, RevealItem } from '../components/reveal';
import { Tilt, TiltLayer } from '../components/tilt';
import { Panel } from '../components/panel';

// Each step sits one level further back and to the right — a staircase in Z.
const POSE = [
  'lg:[transform:perspective(1400px)_rotateY(-10deg)_translateZ(40px)]',
  'lg:[transform:perspective(1400px)_rotateY(-10deg)_translateZ(0px)] lg:ml-10',
  'lg:[transform:perspective(1400px)_rotateY(-10deg)_translateZ(-40px)] lg:ml-20',
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 container mx-auto px-4 py-20 md:px-8 md:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            eyebrow="How it works"
            title="Live in an afternoon, not a quarter."
            body="No hardware to buy, no integrations to wire. Three steps and your first table is taking orders."
          />
          <Reveal delay={0.1} className="mt-8">
            <Button asChild className="depth-2">
              <Link to="/contact">
                Start onboarding
                <ArrowRight01Icon />
              </Link>
            </Button>
          </Reveal>
        </div>

        <RevealGroup as="ol" className="grid gap-5 lg:origin-left" stagger={0.12}>
          {steps.map((s, i) => (
            <RevealItem as="li" key={s.step}>
              <div className={POSE[i]}>
                <Tilt max={5} lift={10}>
                  <Panel depth={i === 0 ? 3 : 2} className="flex gap-5 p-5 sm:gap-6 sm:p-6">
                    <TiltLayer depth={36}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary font-elsie text-lg text-primary-foreground depth-2">
                        {s.step}
                      </span>
                    </TiltLayer>
                    <TiltLayer depth={14} className="flex-1">
                      <h3 className="text-lg font-semibold">{s.title}</h3>
                      <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{s.body}</p>
                    </TiltLayer>
                  </Panel>
                </Tilt>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
