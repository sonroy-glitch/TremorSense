import express from "express";
import bcrypt from "bcrypt";
const app = express();
app.use(express.json());
import { prisma } from "./prisma/client";
app.get("/health", async (req, res) => {
    return res.status(200).json({ "msg": "Server is up and running" });
});
app.get("/", async (req, res) => {
    return res.status(200).json({ "msg": "Route is working" });
});
//Creating the Sign-up endpoint
app.post("/signup", async (req, res) => {
    const { name, email, password, cane_id } = req.body;
    try {
        const user = await prisma.user.findFirst({
            where: {
                email: email
            }
        });
        if (!user) {
            const hash_password = await bcrypt.hash(password, 10);
            const user_response = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hash_password,
                    cane_id: cane_id
                }
            });
            return res.status(202).json({ "msg": "Account was created", "id": user_response.id });
        }
        else {
            return res.status(401).json({ "msg": "Account already exists" });
        }
    }
    catch (error) {
        return res.status(505).json({ "msg": "Internal Server Error", error });
    }
});
app.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    try {
        const response = await prisma.user.findFirst({
            where: { email }
        });
        if (email) {
            const checkPassword = await bcrypt.compare(password, response.password);
            if (checkPassword) {
                return res.status(205).json({ "msg": "Sigin successful", "id": response.id });
            }
            else {
                return res.status(402).json({ "msg": "Password is incorrect" });
            }
        }
        else {
            return res.status(401).json({ "msg": "You account does not exist" });
        }
    }
    catch (error) {
        return res.status(505).json({ "msg": "Internal Server Error", error });
    }
});
app.listen(3000);
//# sourceMappingURL=index.js.map