const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: String, required: true, index: true }, // 'егэ' | 'огэ'
    amountRub: { type: Number, required: true },

    status: {
      type: String,
      required: true,
      enum: ['created', 'pending', 'succeeded', 'failed', 'canceled'],
      default: 'created',
      index: true,
    },

    provider: { type: String, required: true, default: 'test' }, // test | stripe | yookassa
    providerPaymentId: { type: String, default: null }, // id платежа в провайдере
    providerPayload: { type: Object, default: {} }, // сырые данные от провайдера

    idempotencyKey: { type: String, default: null, index: true }, // защита от дублей
  },
  { timestamps: true }
);

// один “успешный доступ” на курс (можно потом расширить до подписок)
PaymentSchema.index(
  { userId: 1, course: 1, status: 1 },
  { partialFilterExpression: { status: 'succeeded' } }
);

module.exports = mongoose.model('Payment', PaymentSchema);
