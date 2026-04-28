const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    invoiceId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    eventName: { type: String },
    packageDetails: { type: String },
    items: [{
        description: { type: String },
        quantity: { type: Number },
        rate: { type: Number },
        amount: { type: Number }
    }],
    totalAmount: { type: Number, required: true },
    advancePayment: { type: Number, default: 0 },
    advanceDate: { type: Date },
    installments: [{
        amount: { type: Number },
        date: { type: Date },
        description: { type: String }
    }],
    fullPayment: { type: Number }, // Still useful as a total reference or final payment
    fullPaymentDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
