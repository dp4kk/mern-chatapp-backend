require("dotenv/config");
const express = require("express");
const cors = require("cors");
const cookieParser=require('cookie-parser')
//login register
const mongoose = require("mongoose");
// const ChatUsers=require('./schemas') //importing the users schema
// const chatroom=require('./schemas') //importing the chatroom schema
const { chatroomSchema, registerSchema, messageSchema } = require("./schemas");
const app = express();
const { hash, compare } = require("bcryptjs");
const {
  createAccessToken,
  sendAccessToken,
} = require("./token");
//socket
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);
const { verify } = require("jsonwebtoken");

//defining schema
const ChatUsers = mongoose.model("ChatUsers", registerSchema);
const chatRoom = mongoose.model("chatroom", chatroomSchema);
const Message = mongoose.model("message", messageSchema);

app.use(cors({ credentials: true, origin: true }));
app.options("*", cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser())
const url =
  "mongodb+srv://deepak:mongodb797@cluster0.urwx4.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

try {
  {
    mongoose.connect(
      url,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
      () => console.log("database connected")
    );
  }
} catch (error) {
  console.log("database could not connect");
}

//middleware for checking duplicates while registering
checkDuplicateEmailUsername = (req, res, next) => {
  const { userName, email } = req.body;

  ChatUsers.findOne({ userName: userName }).exec((err, user) => {
    try {
      if (err) {
        throw new Error({ message: err });
      } else if (user) {
        throw new Error("Username already exists");
      }
      ChatUsers.findOne({ email: email }).exec((err, user) => {
        try {
          if (err) {
            throw new Error({ message: err });
          } else if (user) {
            throw new Error("Email already exists");
          }
        } catch (error) {
          res.status(401).send({ error: `${error.message}` });
          return;
        }
        next();
      });
    } catch (error) {
      res.status(401).send({ error: `${error.message}` });
    }
  });
};
//endpoint for registering new user
app.post("/register", [checkDuplicateEmailUsername], async (req, res) => {
  try {
    const { userName, email, password } = req.body;
    const hashedPassword = await hash(password, 8);
    const emailRegex =
      /@gmail.com|@yahoo.com|@hotmail.com|@outlook.com|@live.com/;
    if (!emailRegex.test(email)) {
      throw new Error("Email not supported");
    }
    const User = new ChatUsers({
      userName,
      email,
      password: hashedPassword,
    });

    await User.save()
      .then(() => {
        res.status(200).send({ message: "Registered Successfully" });
      })
      .catch((err) => {
        res.status(400).send({ message: err });
      });
  } catch (error) {
    res.send({ error: `${error.message}` });
  }
});

//endpoint for logging in new user
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await ChatUsers.findOne({ email: email });
    if (!user) {
      throw new Error("Email does not exist");
    }
    const valid = await compare(password, user.password);
    if (!valid) {
      throw new Error("Incorrect Password");
    } else if (valid) {
      const accessToken = createAccessToken(user._id);
      sendAccessToken(req, res, accessToken);
    }
  } catch (error) {
    res.status(400).send({ error: `${error.message}` });
  }
});

//middleware to check verified user for creating chatroom
checkAuth = async (req, res, next) => {
  try {
    if (!req.headers.authorization) throw new Error("Forbidden");
    const token = req.headers.authorization.split(" ")[1];
    const payload = verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.payload = payload;

    next();
  } catch (error) {
    res.send({ error: `${error.message}` });
  }
};

//endpoint for creating a chatroom
app.post("/chatroom", [checkAuth], async (req, res) => {
  try {
    const { roomName } = req.body;
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(roomName))
      throw new Error("Chatroom name should only contain alphabets");
    const chatroomExists = await chatRoom.findOne({ roomName });
    if (chatroomExists)
      throw new Error("Chatroom with that name already exists");

    const Chatroom = new chatRoom({
      roomName,
    });
    await Chatroom.save()
      .then(() => res.send({ message: "Chatroom created successfully" }))
      .catch((err) => res.send({ error: `${err.message}` }));
  } catch (error) {
    res.send({ error: `${error.message}` });
  }
});
//endpoint for getting all the chatroom
app.get("/getchatroom", async (req, res) => {
  const chatrooms = await chatRoom.find({});

  res.send(chatrooms);
});

//midddleware for io authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token;
    const payload = await verify(token, process.env.ACCESS_TOKEN_SECRET);
    socket.userId = payload.userId;
    next();
  } catch (error) {
    console.log(error);
  }
});

io.on("connection", async (socket) => {
  console.log("connected:" + socket.userId);
  const userz = await ChatUsers.findOne({ _id: socket.userId });
  socket.on("disconnect", () => {
    console.log("Disconnected" + socket.userId);
    socket.broadcast.emit("newMessage", {
      data: `${userz.userName} left the chat!!`,
    });
  });

  socket.on("joinRoom", ({ chatroomId }) => {
    socket.join(chatroomId);
    socket.emit("newMessage", {
      data: `Welcome to the room, ${userz.userName} !!`,
    });
    socket.broadcast
      .to(chatroomId)
      .emit("newMessage", { data: `${userz.userName} joined the chat!!` });
    console.log("A user joined :" + chatroomId);
  });

  socket.on("leaveRoom", ({ chatroomId }) => {
    socket.leave(chatroomId);
    console.log("A user left :" + chatroomId);
    socket.broadcast
      .to(chatroomId)
      .emit("newMessage", { data: `${userz.userName} left the chat!!` });
  });

  socket.on("chatroomMessage", async ({ chatroomId, message }) => {
    if (message.trim().length > 0) {
      const user = await ChatUsers.findOne({ _id: socket.userId });
      const newMessage = new Message({
        chatroom: chatroomId,
        user: socket.userId,
        message,
      });
      io.to(chatroomId).emit("newMessage", {
        message,
        name: user.userName,
        userId: socket.userId,
      });
      // await newMessage.save()
    }
  });
});

app.get("/", (req, res) => {
  res.send("CHECK CHECK CHECK");
});

httpServer.listen(process.env.PORT || 5000, () => {
  console.log("listening at port 5000");
});
