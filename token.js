const {sign}=require('jsonwebtoken')

const createAccessToken=(userId)=>{
    return sign({userId},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'60m'})
}



const sendAccessToken=(req,res,accesstoken)=>{
    res.send({
        accesstoken,
        email:req.body.email
    })
}


module.exports={createAccessToken,sendAccessToken}