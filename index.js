import express, { json } from "express";
import cors from "cors";
import bcrypt from 'bcrypt';
import joi from "joi";
import dotenv from "dotenv";
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

    let userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().email().required(),
        password: joi.string().required(),
        passwordConfirmation: joi.string().required()
    });

    const validation = userSchema.validate(user);

    if (validation.error) {
        return res.sendStatus(422);
    }

    if (user.password === user.passwordConfirmation) {
        passwordHash = bcrypt.hashSync(user.password, 10);
    } else {
       return res.status(422).send("incorrect passwords");
    }

    delete user.passwordConfirmation;

    try {
        await mongoClient.connect();
        const db = mongoClient.db("users");
        await db.collection("usersInfos").insertOne({ ...user, password: passwordHash });
        res.sendStatus(201);
        mongoClient.close();

    } catch (e) {
        res.sendStatus(500);
        mongoClient.close();
    }
})

app.listen(5000);