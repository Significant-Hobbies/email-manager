import { onLCP, onCLS, onINP, onTTFB, onFCP } from 'web-vitals';

interface VitalMetric {
  name: string;
  value: number;
  rating: string;
  id: string;
  navigationType: string;
}

function sendToAnalytics(metric: VitalMetric) {
  const posthog = (
    window as unknown as { posthog?: { capture?: (event: string, props: object) => void } }
  ).posthog;
  if (posthog?.capture) {
    posthog.capture('web_vital', {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
      id: metric.id,
      navigation_type: metric.navigationType,
    });
  }
}

export function initVitals() {
  onLCP(sendToAnalytics);
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onFCP(sendToAnalytics);
}
