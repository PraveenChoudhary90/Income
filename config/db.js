import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MONGODB DATABASE IS CONNECTED");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;
