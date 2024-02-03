import { Router } from "express";
import { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    forgotPassword,
    resetPassword} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {loginValidator, registerValidator} from '../middlewares/userValidation.middleware.js'
const router = Router()

router.route('/register').post(
    upload.upload.single('avatar'),
    registerValidator,
    registerUser
)

router.route('/login').post(loginValidator,loginUser)

//secure route
router.route('/logout').post(verifyJWT, logoutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/change-password').post(verifyJWT,changeCurrentPassword)
router.route('/current-user-details').get(verifyJWT, getCurrentUser)
router.route('/update-account-details').patch(verifyJWT,updateAccountDetails)
router.route('/update-profileimage').patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route('/reset').post(forgotPassword)
//params se data 
// router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route('/reset/:resetToken').post(resetPassword)



export default router ;
