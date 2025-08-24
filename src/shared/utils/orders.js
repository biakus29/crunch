export function formatOrderId(orderId = '') {
  try {
    const tail = orderId.slice(-4).padStart(4, '0');
    return `C${tail}`;
  } catch {
    return 'C0000';
  }
}
