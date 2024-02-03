import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinaary, deleteOnCloudinary} from '../utils/services/cloudinary.service.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import JWT from "jsonwebtoken";
import sendEmail from "../utils/services/sendEmail.service.js";
import crypto from 'crypto'
// access and refresh token genrate function
const generateAccessAndRefreshTokens =  async (userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken =  user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // Assigning the refresh token to the user instance
        user.refreshToken = refreshToken;

        // Saving the user instance
        await user.save({validateBeforeSave: false}) 

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, " something went wrong while generating access and refresh token")
    }
}

//register user 
const registerUser = asyncHandler(async(req, res)=>{

    const {fullName, email, password,username} = req.body 

    //improved code
    let avatarLocalFile;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar[0]){
        avatarLocalFile = req.files.avatar[0].path;
    }else{
        // if avatat file not receive
        throw new ApiError(400, "Avatar file is required");
    }

    //upload in cloudinary
    const avatar = await uploadOnCloudinaary(avatarLocalFile);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");

    }

    // store in database 
    const user = await User.create({
        fullName,
        avatar: {public_id:avatar?.public_id, url: avatar?.url}, 
        email,
        password,
        username: username.toLowerCase()
    })

    // remove password and refresh token 
    const userIsCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!userIsCreated){
        throw new ApiError(500, "something went wrong registring the user")
    }

    // retern the response 
    return res.status(201).json(
        new ApiResponse(200, userIsCreated, "user registered successfully!!")
    );

    }) 

// login user 
const loginUser = asyncHandler( async(req,res)=>{

    // generating access and refresh token 
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(req.user._id)

    //send in cookie
    const loggedInUser = await User.findById(req.user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    //return response 
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully!!"
        )
    )
   
})


// logout user 
const logoutUser = asyncHandler( async(req, res)=>{

    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: { refreshToken: 1 }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }
    const {accessToken, refreshToken} = req.user;
    
    return res
    .status(200)
    .clearCookie("accessToken", accessToken, options)
    .clearCookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {}, //data we send empty bez we dont need
            "User logout in successfully!!"
        )
    )


})

// refresh access token 
const refreshAccessToken = asyncHandler( async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken ;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    
    
    try {
        const decodedToken = JWT.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET, 
        )
        
        const user  = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        // match token 
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        // generating new refresh access token
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, 
                    refreshToken: newRefreshToken,
                },
                "Access Token Refresh successfully !!"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

//change password function
const changeCurrentPassword = asyncHandler( async(req, res)=>{
    console.log(req.body)
    const {oldPassword, newPassword} = req.body;

    if(!oldPassword || !newPassword){
        throw new ApiError(400, "OldPassword and NewPassword are required !!");
    }

    const user = await User.findById(req.user?._id);
    // check provided oldPassword is correct or not 
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
   if(!isPasswordCorrect){
    throw new ApiError(400, "Invalid Password")
   }

   // set the password 
   user.password = newPassword;

   // save the password
   await user.save({validateBeforeSave: false})
   
   return res
   .status(200)
   .json(new ApiResponse(200,{},"Password Change Successfully!!"))
})

// forgot password
const forgotPassword = asyncHandler( async(req,res)=>{
    const { email } = req.body;

    if(!email){
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    if(!user){
        throw new ApiError(400, "Email not registered");
    }

    // generate the reset token 
    const resetToken = await user.generateForgotPasswordToken();
    console.log("reset token",resetToken)
    // save in db
    await user.save({validateBeforeSave: false})

    console.log(user);

    const resetPasswordUrl = `${process.env.CORS_ORIGIN}/reset-password/${resetToken}`;

    const subject = "Reset Password"
    const message = `You can reset your password by clicking <a href = ${resetPasswordUrl} target = "_blank">Reset your password</a>.\n If you have not requested this, kindly ignore it.`

    try {
        await sendEmail(email, subject, message)

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {resetToken},
                `Reset password token has been sent to ${email} successfully !!`
            )
        )

    } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpiry = undefined;
        // save in database
        await user.save({validateBeforeSave: false})
        console.log(error)
        throw new ApiError(
            500,
            error.message || "something went wrong while sending reset email, try again"
        )
    }


})

// reset password
const resetPassword = asyncHandler( async(req,res)=>{
    const { resetToken } = req.params;
    // extracting password from req.body
    const { password } = req.body;
    if(!password){
        throw new ApiError(400,
            "password is required")
    }

    // hashing the resetToken using sha256 since we have stored our resetToken in DB using the same algorithm
    const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')

    console.log(passwordResetToken)

    // checking token in db if it is not expire still valid
    const user = await User.findOne({
        passwordResetToken,
        passwordResetTokenExpiry: {$gt: Date.now()}
    })
    console.log("user:",user)

    if(!user){
        throw new ApiError(400,
            'Token is expired or invalid, try again')
    }

    // if token valid and not expired then update the password
    user.password = password
    user.forgotPasswordToken = undefined;
    user.forgotPasswordTokenExpiry = undefined;

    // save in db
    await user.save({validateBeforeSave: false})

    // return responce 
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            password,
            "password change successfull!!"
        )
    )

})

// get Current user 
const getCurrentUser = asyncHandler(async(req, res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully !!"
        )
    )
})

// update Account details
const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email} = req.body;
    if(!fullName || !email){
        throw new ApiError(400, "All feilds are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },{new:true}).select("-password");
    
    return res
    .status(200)
    .json(new ApiResponse(
        200,{
            user
        },
        "Account Updated successfully !!"
    ))


    
})

// update user avatar 
const updateUserAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file missing")
    }

    // delete privious avatar file on cloudinary
    const user = await User.findById(req.user?._id).select("-password -refreshToken")

    const previousAvatar = user.avatar

    if (previousAvatar.public_id) {
        await deleteOnCloudinary(previousAvatar.public_id);
    }
    
    //upload in cloudinary and get a url file so
    const avatar = await uploadOnCloudinaary(avatarLocalPath);

    // check avatar
    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar file in cloudinary")
    }

    // stote in database 
    user.avatar = { key: avatar?.public_id, url: avatar?.url };
    await user.save({ validateBeforeSave: false });
      
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar file updated successfully !!"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    forgotPassword,
    resetPassword
}