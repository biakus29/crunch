// Simple wrapper around Facebook Pixel (fbq)
export function trackViewContent({ id, name, price, currency = 'XAF' }) {
  if (!window || !window.fbq) return;
  const value = typeof price === 'number' ? price : Number(price) || 0;
  window.fbq('track', 'ViewContent', {
    content_ids: [id],
    content_name: name,
    content_type: 'product',
    value,
    currency,
  });
}

export function trackPageView() {
  if (!window || !window.fbq) return;
  window.fbq('track', 'PageView');
}
