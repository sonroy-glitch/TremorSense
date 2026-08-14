import  express, {Request , Response} from "express"
import { PrismaClient } from "./generated/prisma/client"
import bcrypt from "bcrypt"
const app=express()
app.use(express.json())
import { prisma } from "./prisma/client"
import { findNextToken } from "typescript/unstable/ast"

app.get("/health",async (req:Request,res:Response):Promise<any>=>{
    return res.status(200).json({"msg":"Server is up and running"})
})

app.get("/",async (req:Request,res:Response):Promise<any>=>{
    return res.status(200).json({"msg":"Route is working"})
})

//Creating the Sign-up endpoint
app.post("/signup",async (req:Request,res:Response):Promise<any>=>{
    const {name,email,password,cane_id} = req.body
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
                    name,
                    email,
                    password:hash_password,
                    cane_id:cane_id
                }
            })
            return res.status(202).json({"msg":"Account was created","id":user_response.id})
        }
        else{
            return res.status(401).json({"msg":"Account already exists"}) 
        }
    } catch (error) {
        return res.status(505).json({"msg":"Internal Server Error",error})
    }
})
app.post("/signin",async(req:Request,res:Response):Promise<any>=>{
    const {email,password}=req.body
    try {
        const response = await prisma.user.findFirst({
            where:{email}
        })
        if (email){
            const checkPassword= await bcrypt.compare(password,response.password)
            if(checkPassword){
                return res.status(201).json({"msg":"Sigin successful","id":response.id})
            }
            else{
                return res.status(402).json({"msg":"Password is incorrect"})
            }
        }
        else{
            return res.status(401).json({"msg":"You account does not exist"})
        }
    } catch (error) {
        return res.status(505).json({"msg":"Internal Server Error",error})
    }
})


app.listen(3000)