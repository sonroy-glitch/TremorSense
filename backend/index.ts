import  express, {Request , Response} from "express"
import { PrismaClient } from "./generated/prisma/client"
import bcrypt from "bcrypt"
const app=express()
app.use(express.json())
const prisma = PrismaClient()

app.get("/health",async (req:Request,res:Response):Promise<any>=>{
    return res.status(200).json({"msg":"Server is up and running"})
})

app.get("/",async (req:Request,res:Response):Promise<any>=>{
    return res.status(200).json({"msg":"Route is working"})
})

//Creating the Sign-up endpoint
app.post("/signup",async (req:Request,res:Response):Promise<any>=>{
    const {email,password,cane_id} = req.body
    try {
        const user = await prisma.user.findFirst({
            where:{
                email:email
                
            }
        })
        if(!user){
            const hash_password = await bcrypt.hash(password,10)
            const user_response = await prisma.user.create({
                data:{
                    email,
                    password:hash_password,
                    cane_id
                }
            })
        }
        else{
            return res.status(401).json({"msg":"Account already exists"}) 
        }
    } catch (error) {
        
    }
})

app.listen(3000)