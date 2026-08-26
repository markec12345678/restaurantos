// Pomožne funkcije za online naročila — Obdelava strankinih podatkov

// ─── Izlušči podatke o stranki ───

export function extractCustomerData(
  customer: Record<string, unknown>,
  orderType: string,
) {
  const customerName = customer.fullName as string
  const customerPhone = customer.phone as string
  const customerEmail = 'email' in customer ? (customer.email as string) : ''
  const customerNotes = (customer.notes as string) || ''
  const deliveryAddress = orderType === 'delivery' && 'address' in customer
    ? `${customer.address}, ${customer.postCode} ${customer.city}` : ''

  return { customerName, customerPhone, customerEmail, customerNotes, deliveryAddress }
}

// ─── Zgradi opombe naročila ───

export function buildOrderNotes(opts: {
  orderType: string
  deliveryAddress: string
  customerNotes: string
  paymentMethod: string
  customer: Record<string, unknown>
  promoCode: string | undefined
  discount: number
}): string {
  const { orderType, deliveryAddress, customerNotes, paymentMethod, customer, promoCode, discount } = opts
  return [
    orderType === 'delivery' ? `ONLINE DOSTAVA → ${deliveryAddress}` : 'ONLINE PREVZEM',
    customerNotes ? `Opombe: ${customerNotes}` : '',
    paymentMethod === 'cash' ? 'PLAČILO: Gotovina ob prevzemu' : `PLAČILO: ${paymentMethod === 'card' ? 'Kartica' : 'Mobilno'}`,
    'preferredTime' in customer && customer.preferredTime ? `Želen čas: ${customer.preferredTime}` : '',
    promoCode ? `PROMO: ${promoCode} (-€${discount.toFixed(2)})` : '',
  ].filter(Boolean).join(' | ')
}
