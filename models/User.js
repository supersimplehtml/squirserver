import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 50,
    },
 
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
  
    address: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      match: [/^\d{10,15}$/, "Please enter a valid phone number"],
    },
    profileImage: {
      type: String,
      default: "https://res-console.cloudinary.com/dd9bl8abz/media_explorer_thumbnails/707a6c8eb6d2b6b8710f4112fa69270a/detailed", // Store the URL of the profile image
    },
    verified: { type: Boolean, default: false },
    
    Business: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }

);

export default mongoose.model("User", userSchema);
