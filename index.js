import express, { json } from "express";
import cors from "cors";
import bcrypt from 'bcrypt';
import joi from "joi";
import dotenv from "dotenv";
import { v4 } from 'uuid';
import { MongoClient } from "mongodb";

const app = express();
app.use(json());
app.use(cors());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

app.post("/register", async (req, res) => {
    let passwordHash;

    const { name, email, password, passwordConfirmation } = req.body

    const user = {
        name,
        email,
        password,
        passwordConfirmation
    }

    let userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().email().required(),
        password: joi.string().required(),
        passwordConfirmation: joi.string().required(),
    });

    const validation = userSchema.validate(user);

    if (validation.error) {
        return res.status(422).send("preencha todos os campos corretamente")
    }

    if (user.password === user.passwordConfirmation) {
        passwordHash = bcrypt.hashSync(user.password, 10);
    } else {
        return res.status(422).send("senhas divergentes");
    }

    delete user.passwordConfirmation;

    try {
        await mongoClient.connect();
        const db = mongoClient.db("users");
        const contains = await db.collection("userInfos").findOne({ email });
        if (!contains) {
            await db.collection("userInfos").insertOne({ ...user, password: passwordHash });
            res.sendStatus(201);
        } else {
            res.status(409).send("usuário já cadastrado")
        }
        mongoClient.close();

    } catch (e) {
        res.sendStatus(500);
        mongoClient.close();
    }
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        await mongoClient.connect();
        const db = mongoClient.db("users");
        const user = await db.collection("userInfos").findOne({ email });
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = v4();
            console.log(token)
            await db.collection("sessions").insertOne({
                userId: user._id,
                token
            })
            res.send(token);
        } else {
            res.status(422).send("senha ou usuário incorretos");
        }
        mongoClient.close();
    } catch (e) {
        res.sendStatus(500)
        mongoClient.close();
    }

})

app.post("/wallet", async (req, res) => {
    const { value, description, token } = req.body;
    const { userId } = req.headers;
    const infos = {
        userId,
        value,
        description,
        day: dayjs().format('DD/MM')
    }

    const infosSchema = joi.object({
        value: joi.string().required(),
        description: joi.string.required(),
    });

    const validation = infosSchema.validate(infos);

    if (validation.error) {
        console.log(validation.error)
        console.log(user)
        return res.status(422).send("preencha todos os campos corretamente")
    }

    try {
        await mongoClient.connect();
        const db = mongoClient.db("users");
        const verification = await db.collection("sessions").findOne({ token });

        if (!verification) {
            res.sendStatus(409);
        }

        const userCollection = mongoClient.db("userWallet");
        const contains = userCollection.findOne({ userId });
        if (!contains) {
            const insert = await db.collection("userWallet").insertOne({infos})
        } else {
            await userCollection.updateOne({...infos, })
        }
        res.sendStatus(201);
        mongoClient.close();

    } catch (e) {
        res.sendStatus(500)
        mongoClient.close();
    }
})

app.get("/wallet", async (req, res) => {
    const { token } = req.headers;
    const userArray = [];
    const userWallet = {
        name: '',
        userId: '',
        infos: ''
    }

    try {
        await mongoClient.connect();
        const searchToken = await db.collection("sessions").findOne({ token });
        const ID = searchToken._id;
        const getUser = await db.collection("userInfos").findOne({ _id: new ObjectId(ID) });

        if (!getUser) {
            return res.sendStatus(409);
        }

        const userName = getUser.name;
        const userDB = await db.collection("userWallet").findOne({ userId: new ObjectId(ID)}).toArray();

        for (let i = 0; i < userDB.length; i++) {
            userArray.push(userDB[i])
        }
        res.send(userArray);
    }
    catch (e) {
        console.log(e);
    }
})

app.delete("/wallet", async (req, res) => {
    const { token } = req.body;

    try {
        await mongoClient.connect();
        const db = mongoClient.db("users");
        const user = await db.collection("sessions").findOne({ token });

        if (!user) {
            res.sendStatus(409);
        } 

        await db.collection("sessions").deleteOne({ user })
        res.sendStatus(201);

    } catch(e) {
        console.log(e);
    }
})

app.listen(5000);