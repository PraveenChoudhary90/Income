import User from "../models/UserModel.js";

// Generate unique referral code
const generateReferralCode = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";

  // 3 random letters
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }

  // 3 random numbers
  for (let i = 0; i < 3; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }

  // Shuffle code to mix letters + numbers
  code = code.split('').sort(() => 0.5 - Math.random()).join('');

  return "REF" + code; // e.g. REF5A7B2
};




export const register = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    let referredById = null;

    // Agar referral code diya hai, user ka ObjectId find karo
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode });
      if (referrer) {
        referredById = referrer._id; // ObjectId
      } else {
        return res.status(400).json({ message: "Invalid referral code" });
      }
    }

    const newUser = await User.create({
      name,
      email,
      password,
      referralCode: generateReferralCode(), // aapka function
      referredBy: referredById // ObjectId set
    });

    res.json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};




// Get user by ID
export const getUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Get User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// Get all users (optional admin)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};




// Get all users referred by a referral code
export const getReferrals = async (req, res) => {
  try {
    const { referralCode } = req.params;
    const users = await User.find({ referredBy: referralCode });
    res.json(users);
  } catch (error) {
    console.error("Get Referrals Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
