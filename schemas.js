const mongoose = require("mongoose");

const registerSchema = new mongoose.Schema(
  {
    userName: String,
    email: String,
    password: String,
  },
  {
    collection: "chatapp_users",
    timestamps: true,
  }
);
 
const chatroomSchema = new mongoose.Schema(
  {
    roomName: String,
  },
  {
    collection: "chatroom",
    timestamps: true,
  }
);

const messageSchema=new mongoose.Schema(
  {
    chatroom:mongoose.Schema.Types.ObjectId,
    user:mongoose.Schema.Types.ObjectId,
    message:String
  },
  {
    collection:"chatroomMessages"
  }
)

module.exports={registerSchema,chatroomSchema,messageSchema}

