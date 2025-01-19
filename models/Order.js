// models/Order.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // Define the schema fields
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      owner: { type:mongoose.Schema.Types.ObjectId},
      price: { type: Number, required: true },
    },
  ],

  total: { type: String, required: true },
  shippingAddress: {
    type:String,
    required:true
  },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

export default Order;  // Default export
