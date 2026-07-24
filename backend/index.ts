import  express, {Request , Response} from "express"
const app=express()
app.use(express.json())


app.get("/health",async (req:Request,res:Response):Promise<any>=>{
    return res.status(200).json({"msg":"Server is up and running"})
})


app.listen(3000)