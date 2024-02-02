import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import crypto from "crypto"
const userSchema = new Schema(
    {
        username: {
            type: String,
            required: [true, 'username must be required'],
            unique: true,
            lowercase: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowecase: true,
            trim: true, 
        },
        fullName: {
            type: String,
            required: [true, 'Name is required'],
            minlength: [4, 'username must be at least 4 characters'],
            trim: true, 
            index: true
        },
        avatar: {
            public_id:{
                type: String
            },
            url:{
                type: String
            }
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
        },
        refreshToken: {
            type: String
        },
        passwordResetToken:{
            type: String
        },
        passwordResetTokenExpiry:{
            type: Date
        },
    },
    {
        timestamps: true
    }
)


userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

// is password is correct method
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

// generate access token method
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

// generate refresh token method
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

// generate forgot and reset password token
userSchema.methods.generateForgotPasswordToken = function(){
    const resetToken = crypto.randomBytes(20).toString('hex')
    // hash the generate resetToken with sh256 algoritham and store in the database 
    this.passwordResetToken = crypto.createHash('sha256')
    .update(resetToken)
    .digest('hex');
    // expiry time 
    this.passwordResetTokenExpiry = Date.now() + 15*60*1000
    return resetToken
}

export const User = mongoose.model("User", userSchema)