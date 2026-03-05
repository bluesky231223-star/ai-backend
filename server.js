import express from "express";
import cors from "cors";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = "YOUR_OPENROUTER_KEY";

const GOOGLE_SCRIPT_URL = "YOUR_GOOGLE_SCRIPT_URL";

const CONTACT_FORM_LINK = "https://algebraindia.com/contactus";

const userSessions = {};

function detectEmail(text){
    const match = text.match(/[\w\.-]+@[\w\.-]+/);
    return match ? match[0] : "";
}

function detectPhone(text){
    const match = text.match(/\+?\d[\d\s\-]{7,}\d/);
    return match ? match[0] : "";
}

async function saveToSheet(user,bot,session,email,phone,ip){

    const payload={
        user,
        bot,
        session,
        email,
        phone,
        ip
    }

    try{
        await axios.post(GOOGLE_SCRIPT_URL,payload)
    }catch(e){
        console.log("Sheet error")
    }

}

app.get("/",(req,res)=>{
    res.send("AI Chatbot running successfully!")
})

app.post("/chat",async(req,res)=>{

    const message=req.body.message
    const ip=req.ip

    const session_id=ip

    if(!userSessions[session_id]){
        userSessions[session_id]=0
    }

    userSessions[session_id]++

    const email=detectEmail(message)
    const phone=detectPhone(message)

    const systemPrompt=`You are the official AI Assistant of Algebraa Business Solutions Pvt Ltd.

Speak like a professional accounting consultant.

Never mention AI or chatbot.

Guide users to consultation.`


    try{

        const response=await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model:"deepseek/deepseek-chat",
                messages:[
                    {role:"system",content:systemPrompt},
                    {role:"user",content:message}
                ]
            },
            {
                headers:{
                    "Authorization":`Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type":"application/json"
                }
            }
        )

        const reply=response.data.choices[0].message.content

        await saveToSheet(message,reply,session_id,email,phone,ip)

        res.json({reply})

    }catch(error){

        console.log(error.response?.data || error.message)

        res.json({reply:"Server error. Please try again."})

    }

})

app.listen(3000,()=>{
    console.log("Server running on port 3000")
})