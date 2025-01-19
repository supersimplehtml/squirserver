import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/mongoDB.js";
import debug from "debug";
import morgan from "morgan";
import flash from 'connect-flash';
import userRoutes from "./routes/userRouter.js";
import path from "path";
import businessRouter from "./routes/businessRouter.js"
import { fileURLToPath } from 'url';
import expressSession from 'express-session';
import cors from 'cors';
import User from "./models/User.js";
import jwt from "jsonwebtoken"
// Load environment variables
dotenv.config({ path: "./.env" });

// Define __dirname manually for ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbgr = debug("development:server");
const port = process.env.PORT || 3000;
const app = express();

// Connect to the database
connectDB();

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set views folder for EJS templates
app.set('views', path.join(__dirname, 'views'));
// ({
//   origin: 'http://localhost:5173', // Replace with your frontend's URL (e.g., http://localhost:3000)
//   credentials: true,  // Allow credentials such as cookies or authorization headers
// })

app.use(cors());
// Middleware
app.use(morgan("dev"));
app.use(expressSession({
    secret: "qasdrtgbjiuygfvbnmk",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
// Serve static files like CSS, JS, and images from the "public" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // <-- Corrected static folder path
if (process.env.NODE_ENV === "production"){
  app.use(express.static(path.join(__dirname, "../frontend/build")));
  app.get("*",(req,res) => {
    res.sendFile(path.resolve(__dirname,'../frontend/build', 'index.html'))
  })
}

 app.use(express.json()); // Enable JSON parsing
app.use(express.urlencoded({ extended: true })); // Enable extended URL encoding
app.use(flash()); // Enable flash middleware

// Routes
app.use("/api/v1/process/", userRoutes);
app.use("/api/v1/", businessRouter);
app.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ error: "Invalid token or user not found" });
    }

    // Mark user as verified
    user.verified = true;
    await user.save();

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Token expired or invalid. Please try again." });
  }
});

// Start server
app.listen(port, () => {
  dbgr(`Server is running on port ${port}`);
});
