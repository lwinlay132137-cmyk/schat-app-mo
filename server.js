const express=require("express");
const crypto=require("crypto");
const path=require("path");
const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const PORT=process.env.PORT||3000;
const DAILY_FREE_LIMIT=Number(process.env.DAILY_FREE_LIMIT||30);

const chars={
 Mia:{style:"playful, warm, caring, lightly flirty"},
 Luna:{style:"shy, romantic, gentle, sweet"},
 Ava:{style:"smart, confident, witty, supportive"},
 Rin:{style:"bold, energetic, teasing, creative"},
 Alex:{style:"charming, funny, loyal, confident"},
 Kai:{style:"calm, mature, thoughtful, supportive"}
};

// Demo in-memory state. Replace with PostgreSQL/SQLite/Firestore/etc. in production.
const usage=new Map();
const premium=new Map();

function today(){return new Date().toISOString().slice(0,10)}
function getUsage(userId){
  const key=userId+":"+today();
  if(!usage.has(key)) usage.set(key,0);
  return usage.get(key);
}

app.get("/api/health",(_,res)=>res.json({ok:true,app:"S Chat"}));
app.get("/api/characters",(_,res)=>res.json(chars));

app.post("/api/chat",async(req,res)=>{
  const {userId,character,message}=req.body||{};
  if(!userId||!chars[character]||typeof message!=="string"||!message.trim())
    return res.status(400).json({error:"Invalid request"});

  if(!premium.get(userId) && getUsage(userId)>=DAILY_FREE_LIMIT)
    return res.status(429).json({error:"Daily free limit reached",premiumRequired:true});

  usage.set(userId+":"+today(),getUsage(userId)+1);

  // Server-side AI provider integration point.
  // Put the provider API key on the server only.
  if(!process.env.AI_API_KEY){
    return res.json({
      reply:`Hi! I'm ${character}. I'm ready to chat with you 💜`,
      demo:true,
      remaining:premium.get(userId)?null:DAILY_FREE_LIMIT-getUsage(userId)
    });
  }

  // TODO: Call your chosen AI provider here using the server-side key.
  // Do not expose AI_API_KEY to the Android/web client.
  res.json({reply:`${character}: ${message} 💜`,demo:false});
});

app.post("/api/premium/status",(req,res)=>{
  const {userId}=req.body||{};
  res.json({premium:!!premium.get(userId)});
});

app.post("/api/wavepay/create-order",(req,res)=>{
  const {userId,plan}=req.body||{};
  const plans={monthly:{amount:4999,days:30},yearly:{amount:49990,days:365}};
  if(!userId||!plans[plan]) return res.status(400).json({error:"Invalid plan"});
  const orderId="SCHAT-"+Date.now()+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();
  // TODO: call the exact official Wave merchant API supplied to your account.
  res.json({orderId,userId,plan,...plans[plan],status:"PENDING",
    configured:!!process.env.WAVE_MERCHANT_ID,
    message:"Wave merchant integration requires your approved merchant credentials/API specification."});
});

app.post("/api/wavepay/webhook",(req,res)=>{
  // TODO: verify Wave signature, order, amount and transaction status.
  // Only after verification should premium.set(userId,true) occur.
  res.json({received:true});
});

app.listen(PORT,()=>console.log(`S Chat server listening on ${PORT}`));
