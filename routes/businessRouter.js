import express from "express";
import Business from "../models/Business.js"; // Import the model
import authenticate from '../middlewares/authMiddleware.js'; // JWT authentication middleware
import User from "../models/User.js";

const router = express.Router();

// POST: Start a Business
router.post('/business', authenticate, async (req, res) => {
  const { businessName, description } = req.body;
  const owner = req.user.userId;
  
  try {
    const user = await User.findById(owner);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!businessName || !description) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingBusiness = await Business.findOne({ email: user.email });
    if (existingBusiness) {
      return res.status(400).json({ message: 'A business with this email already exists.' });
    }

    const newBusiness = new Business({
      businessName,
      businessEmail: user.email,
      description,
      phone: user.phone,
      address: user.address,
      owner,
    });

    await newBusiness.save();

    // Update the user model to reflect the business status
    user.Business = true;
    await user.save();

    res.status(201).json({ message: 'Business created successfully!', business: newBusiness });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while creating business.' });
  }
});

export default router;
