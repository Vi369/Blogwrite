import {v2 as cloudinary} from 'cloudinary';

//config      
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret:  process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCoudinary = async (localFilePath)=>{
    if(!localFilePath) return null
    try {
        const responce = await cloudinary.uploader.upload(localFilePath,{
            folder: "blogwrite",
            resource_type: "auto"
        })
        return responce
    } catch (error) {
        console.log("uploadOnCloudinary func Error:", error)
        return null
    }
}

// delete on cloudinary 
const deleteOnCloudinary = async(public_id, resource_type = "image")=>{
    if(!public_id) return null
    try {
        return await cloudinary.uploader.destroy(
            public_id,{resource_type} 
        )
    } catch (error) {
        console.log("deleteOnCloudinary func Error: ", error)
        return null
    }
}



export {
    uploadOnCoudinary,
    deleteOnCloudinary
}

