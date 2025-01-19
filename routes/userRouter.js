import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
import authMiddleware from '../middlewares/authMiddleware.js';
import Business from '../models/Business.js';
import Order from "../models/Order.js"
import { v2 as cloudinary } from 'cloudinary';
import Cart from '../models/Cart.js';
import multer from 'multer';
import path from 'path';
import Product from '../models/Product.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import debug from 'debug';
import Contact from '../models/Contact.js';

const dbgr =  debug('development:routes');
dotenv.config(
  { 
    path: '../.env' 
  }
);
const transporter = nodemailer.createTransport(
  {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
}
);
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up multer disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Folder where the file will be temporarily saved
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Use a unique filename
    }
});

const upload = multer({ storage: storage });

// Create express router
const router = express.Router();
function formatPrice(price) {
  const value = parseFloat(price); // Ensure price is a number
  if (isNaN(value)) return price; // Return the original price if it's not a valid number

  if (value >= 1e9) {
    // Billion
    return (value / 1e9).toFixed(1) + 'b';
  } else if (value >= 1e6) {
    // Million
    return (value / 1e6).toFixed(1) + 'm';
  } else if (value >= 1e5) {
    // Lac (100,000)
    return (value / 1e5).toFixed(1) + 'lac';
  } else if (value >= 1e3) {
    // Thousand
    return (value / 1e3).toFixed(1) + 'k';
  } else {
    return price; // If the value is less than 1000, return the original price
  }
}


// Protected route (accessible only with valid JWT)


// Route to render registration page (EJS template)
router.get('/protected', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ _id : req.user.userId });

    // Set in the middleware
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error: Could not fetch profile' });
  }
});

// Route to register a new user with image upload
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check for required fields
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find the user by email and include the password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (!user.verified) {
      return res.status(400).json({ message: 'Please verify your email address.' });
    }

    // Check if the password matches
    const isMatch = await bcrypt.compare.toString(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send response with token and user data
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// Login route



const generateVerificationEmail = (name, token) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <h1 style="color: #ff6d00;">Welcome, ${name}!</h1>
      <p style="color: #5a189a; font-size: 16px;">
        Thank you for registering. Please verify your email by clicking the link below:
      </p>
      <a href="${verificationLink}" style="display: inline-block; background-color: #ff6d00; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-size: 16px;">
        Verify Email
      </a>
      <p style="margin-top: 20px; font-size: 14px; color: #888;">
        If you didn’t create an account, please ignore this email.
      </p>
    </div>
  `;
};

router.post("/register", upload.single("profileImage"), async (req, res) => {
  try {
    const { name, email, password, address, phone } = req.body;

    // Validate the fields
    if (!name || !email || !password || !address || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if a profile image was uploaded
    let profileImagePath = '';
    if (req.file) {
      profileImagePath = req.file.path;
    }

    // Create user in database
    const user = new User({
      name,
      email,
      password: hashedPassword,
      profileImage: profileImagePath,
      address,
      phone,
    });
    await user.save();

    // Generate JWT for email verification
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Send verification email
    const mailOptions = {
      from: `"Squirshop Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email",
      html: generateVerificationEmail(name, token),
    };
    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: "Registration successful! Please verify your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});


router.put('/edit-profile', authMiddleware, async (req, res) => {
  const { name, email, address, phone, profileImage } = req.body;
  const userEmail = req.user.userId; 
// Assuming `id` is part of the JWT payload

  try {
    const updatedData = {};

    if (name) updatedData.name = name;
    
    if (address) updatedData.address = address;
    if (phone) updatedData.phone = phone;
    
    // Handle profile image upload (if applicable)
    if (profileImage) {
      const result = await cloudinary.uploader.upload(profileImage, {
        folder: 'profile_images',
      });
      updatedData.profileImage = result.secure_url; // Store the image URL
    }

    // Use findOneAndUpdate to find user by email and update profile
    const user = await User.findOneAndUpdate(
      { _id: userEmail }, // Find the user by email
      { $set: updatedData }, // Update the user fields
      { new: true, runValidators: true } // Return the updated document and validate the input
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (err) {
    dbgr(err);
    res.status(500).json({ message: 'An error occurred while updating the profile' });
  }
});
// Route to handle contact form submissions
router.post('/contact', async (req, res) => {
  const { name, email, message, to } = req.body;

  try {
    // Create new contact document
    const contact = new Contact({
      name,
      email, 
      message,
      to,
      status: 'unread'
    });

    // Save to database
    await contact.save();

    // Send confirmation email to sender
    const senderMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Thank you for your message',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Hello ${name},</h2>
            <p style="color: #34495e; line-height: 1.6;">Thank you for reaching out to us. We have received your message and our team will review it promptly. We aim to respond within 1-2 business days.</p>
            <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0;">
              <p style="color: #7f8c8d; margin: 0;">Your message:</p>
              <p style="color: #34495e; margin: 10px 0;">${message}</p>
            </div>
            <p style="color: #34495e; margin-top: 20px;">Best regards,</p>
            <p style="color: #34495e; font-weight: bold;">The Squiirshop Team</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(senderMailOptions);

    // Find recipient user by name
    const recipientUser = await User.findOne({ name: to });

    if (recipientUser) {
      // Send email to recipient
      const recipientMailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientUser.email,
        subject: 'New Customer Inquiry',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
              <h2 style="color: #2c3e50; margin-bottom: 20px;">Hello ${recipientUser.name},</h2>
              <p style="color: #34495e; line-height: 1.6;">You have received a new customer inquiry.</p>
              <div style="background-color: #ffffff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="color: #34495e; margin: 5px 0;"><strong>From:</strong> ${name}</p>
                <p style="color: #34495e; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                <div style="margin: 15px 0; border-left: 4px solid #3498db; padding-left: 15px;">
                  <p style="color: #7f8c8d; margin: 0;">Message:</p>
                  <p style="color: #34495e; margin: 10px 0;">${message}</p>
                </div>
              </div>
              <p style="color: #34495e; margin-top: 20px;">Best regards,</p>
              <p style="color: #34495e; font-weight: bold;">Squiirshop Notifications</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(recipientMailOptions);
    }

    res.status(200).json({ message: 'Contact form submitted successfully' });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Error submitting contact form' });
  }
});
router.post("/product", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    // Extract owner from JWT token
    const owner = req.user.userId;
    console.log(owner);
    console.log(req.body);

    // Validate required fields
    const { name, description, price } = req.body;

    if (!name || !description || !price || !req.file) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Convert price to a string and format it
    let sprice = price.toString();
    console.log(sprice);

    // Upload image to Cloudinary
    

    // Create and save the product
    const product = new Product({
      name,
      description,
      price: sprice, // Save formatted price
      image: req.file.path, // Use the secure Cloudinary URL
      owner,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error adding product" });
  }
});
// Update a product
router.put("/editproduct:id", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price } = req.body;

    // Validate required fields
    if (!name || !description || !price) {
      return res.status(400).json({ error: "All fields are required" });
    }

    let imageUrl = undefined;
    
    // If a new image is uploaded, upload it to Cloudinary
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;  // URL of the uploaded image on Cloudinary
    }
    const id = req.params.id;
    const cleanId = id.replace(/^:/, '');
    // Find and update the product
    const product = await Product.findByIdAndUpdate(
      cleanId,
      { name, description, price, image: imageUrl },
      { new: true }
    );

    // If product not found, return an error
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product); // Send updated product as the response
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating product" });
  }
});

// Delete a product
router.delete("/delproduct:id", async (req, res) => {
  try {
    const id = req.params.id;
    const cleanId = id.replace(/^:/, ''); // Removes leading colon

    await Product.findByIdAndDelete(cleanId);
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting product" });
    console.log(error);
  }
});
router.get("/products", async (req, res) => {
  try {
    // Find all products and populate the owner field with the owner's details
    const products = await Product.find().populate('owner','name profileImage'); // 'owner' is the reference to the User model and 'username' is the field you want

    // Log the products for debugging
    console.log(products);

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching products" });
  }
});

router.get("/product",authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({owner: req.user.userId});
   
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Error fetching products" });
  }
});

router.post("/addcart", authMiddleware, async (req, res) => {
  try {
    // Check if the product already exists in the cart for the user
    const existingCartItem = await Cart.findOne({
      product: req.body.productId,
      user: req.user.userId,
    });

    if (existingCartItem) {
      // If the product already exists, increment its quantity
      existingCartItem.quantity += 1;
      await existingCartItem.save();
      return res.status(200).json({ message: "Product quantity updated", cartItem: existingCartItem });
    }

    // If the product doesn't exist, create a new cart item
    const newCartItem = new Cart({
      product: req.body.productId,
      quantity: 1,
      user: req.user.userId,
    });

    await newCartItem.save(); // Save the new cart item to the database
    res.status(201).json({ message: "Product added to cart", cartItem: newCartItem });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ error: "Failed to add product to cart" });
  }
});

router.get("/cart",authMiddleware, async (req, res) => {
  try {
    // Fetch the cart items for the authenticated user
    const cart = await Cart.find({ user: req.user.userId });

    // Fetch product details and include quantity
    const productsWithQuantity = await Promise.all(
      cart.map(async (item) => {
        const product = await Product.findById(item.product); // Assuming `productId` exists in Cart
        return {
          product, // Product details
          quantity: item.quantity, // Quantity from cart
        };
      })
    );

    // Send the products with quantity as a response
    res.status(200).json(productsWithQuantity);
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error("Error fetching cart products and quantities:", error);
    res.status(500).json({ message: "Error fetching cart products and quantities" });
  }
});

router.delete("/cart/:id",authMiddleware, async (req, res) => {
  const id = req.params.id;

  // Check if the ID is a valid ObjectId
  console.log(id);

  try {
    // Attempt to delete the item from the cart
    const deletedItem = await Cart.findOneAndDelete({product:id, user:req.user.userId})

    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Respond with a success message
    return res.status(200).json({ message: "Item removed successfully" });
  } catch (err) {
    // Catch any database or other errors
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});
router.post('/checkout', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  // Debugging user ID
  try {
      // Fetch the user's cart
      const cart = await Cart.find({ user: userId });
      // Debugging cart items

      if (!cart || cart.length === 0) {
          return res.status(400).json({ message: 'Cart is empty.' });
      }

      // Extract product IDs from cart items
      const cartItems = cart.map(item => item.product._id || item.product); // Ensure you're getting the product ID
      // Find the products using the extracted IDs
      const products = await Product.find({ '_id': { $in: cartItems } });

      // Calculate the total price based on the products in the cart
      const total = cart.reduce((acc, item) => {
          const product = products.find(p => p._id.toString() === item.product.toString());
          if (product) {
              return acc + product.price * item.quantity;
          }
          return acc;
      }, 0);

      // Debugging the total

      // Retrieve user's shipping address (assuming it's stored in the user's profile)
      const user = await User.findById(userId);
      if (!user) {
          return res.status(400).json({ message: 'User not found.' });
      }

      const shippingAddress = user.address || {}; // Assuming shipping address is part of the user model
      if (!shippingAddress) {
          return res.status(400).json({ message: 'Shipping address is required.' });
      }

      // Create the order
      const newOrder = new Order({
          user: userId,
          items: cart.map(item => {
              const product = products.find(p => p._id.toString() === item.product.toString());
              return {
                  product: item.product,
                  quantity: item.quantity,
                  owner: product.owner,  // Save the owner of the product
                  price: product.price,
              };
          }),
          total,
          shippingAddress,
      });

      // Save the order
      await newOrder.save();

      // Optionally, reduce stock
    

      // Clear the user's cart after checkout
      await Cart.deleteMany({ user: userId });
      console.log('Cart cleared for user:', userId);

      // Send email to sellers
      for (let item of cart) {
          const product = await Product.findById(item.product);
          console.log(item.product)

          if (product) {
              const sellerId = product.owner; // Seller's ID (assumed to be stored in the product)
              const seller = await User.findById(sellerId);
              
              if (seller) {
                  // Set up the email transporter
                  // Prepare the email content with styling
                  const mailOptions = {
                      from: 'demondeath42@gmail.com', // Sender's email
                      to: seller.email, // Seller's email
                      subject: 'New Order Notification',
                      html: `
                          <html>
                              <body style="font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; color: #333;">
                                  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff; border-radius: 10px; border: 1px solid #ddd;">
                                      <h2 style="color: #ff6d00;">New Order Received!</h2>
                                      <p style="font-size: 16px;">Hello <strong>${seller.name}</strong>,</p>
                                      <p style="font-size: 16px;">You have received a new order! Please find the order details below:</p>

                                      <h3 style="color: #3c096c;">Order Details</h3>
                                      <p><strong>Order ID:</strong> ${newOrder._id}</p>
                                      <p><strong>Total:</strong> $${newOrder.total}</p>
                                      <p><strong>Shipping Address:</strong> ${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.country}, ${shippingAddress.postalCode}</p>

                                      <h3 style="color: #3c096c;">Ordered Products</h3>
                                      <ul>
                                          ${cart.map(item => {
                                              const productDetails = products.find(p => p._id.toString() === item.product.toString());
                                              return `
                                                  <li style="font-size: 16px;">
                                                      <strong>${productDetails.name}</strong> x${item.quantity} - $${productDetails.price * item.quantity}
                                                  </li>
                                              `;
                                          }).join('')}
                                      </ul>

                                      <p style="font-size: 16px; color: #ff6d00;">Thank you for being a part of our marketplace!</p>
                                      <p style="font-size: 16px; color: #3c096c;">Best regards,<br>The SquirShop Team</p>
                                  </div>
                              </body>
                          </html>
                      `,
                  };

                  // Send the email
                  await transporter.sendMail(mailOptions);
                  console.log(`Email sent to seller: ${seller.email}`);
              } else {
                  console.log('Seller not found for product:', product.name);
              }
          }
      }

      // Send success response
      res.status(201).json({
          message: 'Checkout successful!',
          orderId: newOrder._id,
          total: newOrder.total,
          items: newOrder.items,
      });
  } catch (error) {
      console.error('Checkout Error:', error);
      res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});
router.get('/seller-orders', authMiddleware, async (req, res) => {
    const sellerId = req.user.userId; // Assuming userId is available from auth middleware

    try {
        // Fetch all products owned by the seller
        const sellerProducts = await Product.find({ owner: sellerId });

        if (!sellerProducts || sellerProducts.length === 0) {
            return res.status(404).json({ message: 'You do not have any products listed.' });
        }

        // Get product IDs owned by the seller
        const sellerProductIds = sellerProducts.map(product => product._id.toString());

        // Fetch all carts that contain the seller's products
        const carts = await Order.find({
            'items.product': { $in: sellerProductIds }
        });
        console.log(carts)

        if (!carts || carts.length === 0) {
            return res.status(404).json({ message: 'No carts found for your products.' });
        }

        // Extract user IDs and product IDs from the carts
        const orders = [];
        for (const cart of carts) {
            const relevantItems = cart.items.filter(item =>
                sellerProductIds.includes(item.product.toString())
            );

            // Fetch user details for each cart
            const user = await User.findById(cart.user);

            if (relevantItems.length > 0 && user) {
                orders.push({
                    userId: cart.user,
                    userName: user.name,
                    items: relevantItems.map(item => {
                        const product = sellerProducts.find(p => p._id.toString() === item.product.toString());
                        return {
                            productName: product.name,
                            quantity: item.quantity,
                            price: product.price,
                        };
                    }),
                });
            }
        }
        console.log(orders)
        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for your products.' });
        }

        // Send response
        res.status(200).json({
            message: 'Orders retrieved successfully.',
            orders,
        });
    } catch (error) {
        console.error('Error fetching seller orders:', error);
        res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
});


router.get('/recentcomments',authMiddleware, async (req, res) => {
  try {
    const name = User.findById(req.user.userId)
    const comments = await Contact.find({to: name.name}).sort({ createdAt: -1 }).limit(5); // Populate product info
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/recentproducts',authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({owner:req.user.userId}).sort({ createdAt: -1 }).limit(5); // Fetch 5 most recent products
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

   
export default router;
