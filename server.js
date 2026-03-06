import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());
app.use(express.json());

/* ============================= */
/* CONFIG */
/* ============================= */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "";

const CONTACT_FORM_LINK = "https://algebraindia.com/contactus";

/* ============================= */
/* SESSION STORAGE */
/* ============================= */

const userSessions = {};

/* ============================= */
/* HELPERS */
/* ============================= */

function detectEmail(text){
    const match = text.match(/[\w\.-]+@[\w\.-]+/);
    return match ? match[0] : "";
}

function detectPhone(text){
    const match = text.match(/\+?\d[\d\s\-]{7,}\d/);
    return match ? match[0] : "";
}

/* ============================= */
/* SAVE TO GOOGLE SHEETS */
/* ============================= */

async function saveToSheet(user,bot,session,email,phone,ip){

    if(!GOOGLE_SCRIPT_URL) return;

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
        console.log("Google sheet logging failed")
    }

}

/* ============================= */
/* HEALTH CHECK */
/* ============================= */

app.get("/",(req,res)=>{
    res.send("Nyra AI Backend Running")
})

/* ============================= */
/* CHAT ENDPOINT */
/* ============================= */

app.post("/chat",async(req,res)=>{

    try{

        const message = req.body.message || "";
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        if(!message){
            return res.json({reply:"Please send a message."})
        }

        const session_id = ip;

        if(!userSessions[session_id]){
            userSessions[session_id] = 0;
        }

        userSessions[session_id]++;

        const email = detectEmail(message);
        const phone = detectPhone(message);

        const systemPrompt = `
You are Nyra, the official AI consultant of Algebraa Business Solutions Pvt Ltd.

You speak like a professional accounting consultant.

You help businesses with:
• Accounting
• Bookkeeping
• GST
• MIS reports
• Financial consulting

Never say you are AI.

If a user needs detailed help, guide them to this page:
${CONTACT_FORM_LINK}
`;

        const response = await axios.post(
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
                    "HTTP-Referer":"https://algebraindia.com",
                    "X-Title":"Nyra AI",
                    "Content-Type":"application/json"
                }
            }
        )

        const reply = response.data.choices[0].message.content;

        await saveToSheet(message,reply,session_id,email,phone,ip);

        res.json({reply});

    }catch(error){

        console.log("AI ERROR:", error.response?.data || error.message);

        res.json({reply:"⚠ AI server temporary issue. Please try again."})

    }

})

/* ============================= */
/* START SERVER */
/* ============================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
    console.log(`Nyra AI Server running on port ${PORT}`);
    console.log("API KEY LOADED:", OPENROUTER_API_KEY ? "YES" : "NO");
});
