import { Hero } from '../sections/hero';
import { ReplacesStrip } from '../sections/replaces-strip';
import { ProblemSolution } from '../sections/problem-solution';
import { Features } from '../sections/features';
import { HowItWorks } from '../sections/how-it-works';
import { Byoak } from '../sections/byoak';
import { Pricing } from '../sections/pricing';
import { Faq } from '../sections/faq';
import { Cta } from '../sections/cta';
import { usePageMeta } from '../lib/use-page-meta';

export default function HomePage() {
  usePageMeta({
    title: 'Scan My Order — QR menus, POS & kitchen display in one subscription',
    description:
      'Scan My Order replaces your QR menu app, POS, kitchen display and payment aggregator with one platform. Bring your own payment gateway and keep 100% of every order.',
  });

  return (
    <>
      <Hero />
      <ReplacesStrip />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      <Byoak />
      <Pricing />
      <Faq />
      <Cta />
    </>
  );
}
