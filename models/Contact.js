import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
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
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 1000,
    },
    to:{
      type:String,
      required:true
    },
    status: {
      type: String,
      enum: ["unread", "read", "replied"],
      default: "unread"
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Contact", contactSchema);
