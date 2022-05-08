import express, { json } from "express";
import cors from "cors";
import bcrypt from 'bcrypt';
import joi from "joi";
import dotenv from "dotenv";
import { v4 as uuid } from 'uuid';
import { MongoClient } from "mongodb";

const app = express();
app.use(json());
app.use(cors());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

app.post("/register", async (req, res) => {
    let passwordHash;

    let user = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirmation: req.body.passwordConfirmation
    }

    const getEmail = user.email;

    let userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().email().required(),
        password: joi.string().required(),
        passwordConfirmation: joi.string().required(),
    });

    const validation = userSchema.validate(user);

    if (validation.error) {
        console.log(validation.error)
        console.log(user)
        return res.status(422).send("preencha todos os campos corretamente")
    }

    if (user.password === user.passwordConfirmation) {
        passwordHash = bcrypt.hashSync(user.password, 10);
    } else {
        return res.status(422).send("preencha todos os campos corretamente");
    }

    delete user.passwordConfirmation;
    try {
        await mongoClient.connect();
        const db = mongoClient.db("users");
        const contains = await db.collection("userInfos").findOne({ getEmail });
        if (!contains) {
            await db.collection("userInfos").insertOne({ ...user, password: passwordHash });
            console.log(user)
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
    const token = uuid();

    try {
        mongoClient.connect();
        const db = mongoClient.db("users");
        const user = await db.collection('userInfos').findOne({ email });
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = uuid.v4();
            await db.collection("sessions").insertOne({
                userId: user._id,
                token
            })
            res.send(token);
        } else {
            return res.status(422).send("senha ou usuário incorretos");
        }
    } catch(e) {
        return res.sendStatus(500)
    }

})

app.listen(5000);