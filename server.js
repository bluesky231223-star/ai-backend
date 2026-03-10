import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";
import https from "https";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());

/* ============================= */
/* CONFIG */
/* ============================= */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const GOOGLE_SCRIPT_URL ="https://script.google.com/macros/s/AKfycbzzN_7aVDNwUt2SvXAHqmnn0nBZUUothJ4iwpKckuKXC6R_sKgb1ca5BxvV1QXZjeoT/exec";

const CONTACT_FORM_LINK = "https://algebraindia.com/contactus";


/* ============================= */
/* VECTOR KNOWLEDGE SETUP */
/* ============================= */

const DATA_DIR = "./data";
const VECTOR_FILE = path.join(DATA_DIR, "vectors.json");

const VECTOR_URL = "https://github.com/bluesky231223-star/nyra-knowledge/releases/download/v1/vectors.json";

async function downloadVectors() {

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR);
    }

    if (fs.existsSync(VECTOR_FILE)) {
        fs.unlinkSync(VECTOR_FILE);
    }

    console.log("Downloading vectors.json...");

    const writer = fs.createWriteStream(VECTOR_FILE);

    const response = await axios({
        url: VECTOR_URL,
        method: "GET",
        responseType: "stream"
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    console.log("vectors.json downloaded");

}

let vectors = [];

function cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* SEARCH KNOWLEDGE */
function searchKnowledge(queryEmbedding){

    if(!vectors.length) return "";

    const results = vectors.map(v => ({
        text: v.text,
        score: cosineSimilarity(queryEmbedding, v.embedding)
    }));

    results.sort((a,b)=>b.score-a.score);

    return results.slice(0,3).map(r=>r.text).join("\n");
}

async function loadVectors(){

    await downloadVectors();

    const raw = fs.readFileSync(VECTOR_FILE,"utf8");

vectors = JSON.parse(raw || "[]");

    console.log("Vectors loaded:", vectors.length);

}

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

async function saveToSheet(user,bot,session,email="",phone="",ip=""){

if(!GOOGLE_SCRIPT_URL) return;

const payload={
user,
bot,
session,
email,
phone,
ip
};

try{
await axios.post(GOOGLE_SCRIPT_URL,payload);
}catch(e){
console.log("Google sheet logging failed");
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
You are Assistante, the official consultant of Algebraa Business Solutions Pvt Ltd.

Speak like a professional business consultant.

IMPORTANT RULES:

• Keep answers SHORT.
• Use bullet points.
• Do NOT give long explanations unless the user asks.
• If the user asks about services → only list services.
• Explain a service ONLY if they ask specifically.

--------------------------------
COMPANY SERVICES
--------------------------------

We provide:

• Accounting & Bookkeeping
• Odoo ERP Implementation
• GST & Compliance Support
• MIS Reporting & Financial Insights
• Virtual CFO Services
• Payroll Management
• Business Process Automation
• ERP Training & Support

--------------------------------
RESPONSE RULES
--------------------------------

If user asks "services":

Reply like this:

Our core services include:

• Accounting & Bookkeeping  
• Odoo ERP Implementation  
• GST & Compliance  
• MIS Reporting  
• Virtual CFO Services  
• Payroll Management  

For full details visit:  
<a href="https://algebraindia.com/contactus" target="_blank" style="color:#2b7cff;">Contact Our Team</a>

--------------------------------
CONTACT INFO RULE
--------------------------------

If user asks contact details respond like this:

You can reach Algebraa Business Solutions here:

📞 Phone  
<a href="tel:+919442228766" style="color:#2b7cff;">+91-9442228766</a>

📧 Email  
<a href="mailto:algebraindia03@gmail.com" style="color:#2b7cff;">algebraindia03@gmail.com</a>

🌐 Website  
<a href="https://algebraindia.com/contactus" target="_blank" style="color:#2b7cff;">Submit Your Requirement</a>

--------------------------------
IMPORTANT
--------------------------------

Never say you are AI.
Never write long paragraphs.
Always keep replies clean and professional.

If a user needs detailed help, guide them to this page:
${CONTACT_FORM_LINK}
`;


         
                // CREATE EMBEDDING
        const embed = await axios.post(
        "https://openrouter.ai/api/v1/embeddings",
        {
        model:"text-embedding-3-small",
        input:message
        },
        {
        headers:{
        "Authorization":`Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type":"application/json"
        }
        }
        );
        
        const userEmbedding = embed?.data?.data?.[0]?.embedding || [];
        
        // SEARCH KNOWLEDGE
        const knowledge = searchKnowledge(userEmbedding); 
        console.log("Knowledge used:", knowledge);
        
        const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
        model:"deepseek/deepseek-chat",
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
        messages:[
            {
            role:"system",
            content: systemPrompt + "\n\nRelevant company knowledge:\n" + knowledge
            },
            {
            role:"user",
            content:message
            }
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

async function startServer(){

    await loadVectors();

    app.listen(PORT,()=>{
        console.log(`Nyra AI Server running on port ${PORT}`);
        console.log("API KEY LOADED:", OPENROUTER_API_KEY ? "YES" : "NO");
    });

}

startServer();
