import mongoose  from "mongoose";

const businessSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  businessEmail: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User
});

const Business = mongoose.model('Business', businessSchema);

export default Business;
