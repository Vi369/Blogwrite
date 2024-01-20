export const asyncHandler  = (reqeustHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(reqeustHandler(req, res,next).catch((error)=> next(error)))
    }
}