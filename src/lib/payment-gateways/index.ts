// ============================================
// PAYMENT GATEWAYS — Public API
// ============================================
export type {
  PaymentGateway,
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  GatewayCapabilities,
  GatewayType,
  WebhookEvent,
} from './base'
export { BasePaymentGateway } from './base'
export { StripeGateway } from './providers/stripe'
export { PayPalGateway } from './providers/paypal'
export { CashGateway } from './providers/cash'
export {
  GatewayFactory,
  registerGateway,
  getRegisteredGateways,
  isGatewayRegistered,
  processPayment,
  refundPayment,
  capturePayment,
  checkAllGatewaysHealth,
} from './factory'
