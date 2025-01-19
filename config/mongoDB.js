import mongoose from "mongoose";
import debug from "debug";
import dotenv from "dotenv";
const dbgr = debug("development:mongoose");
dotenv.config({ path: "./.env" });
const connectDB = async ()=> {
    try {
        const conn = await mongoose.connect("mongodb+srv://tech:tech@overall.9m3puug.mongodb.net/squiirshop");
        dbgr(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        dbgr(`Error: ${err.message}`);
        process.exit(1);
    }
};

export default connectDB;
