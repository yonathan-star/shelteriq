// Local adapter for the same private handler deployed under /api on Vercel.
export function privateAI(env) {
  return {
    name: "shelteriq-private-ai",
    apply: "serve",
    configureServer(server) {
      process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || "";
      process.env.GEMINI_MODEL = env.GEMINI_MODEL || "gemini-3.6-flash";
      process.env.SHELTERIQ_LOCAL_REVIEW = "true";
      server.middlewares.use(async (req,res,next) => {
        const path=req.url?.split("?")[0];
        if (!["/api/assist","/api/hub"].includes(path)) return next();
        try {
          const { GET, POST }=path === "/api/assist" ? await import("../api/assist.js") : await import("../api/hub.js");
          let response;
          if (req.method === "GET") response=await GET(new Request(`http://${req.headers.host}${req.url}`,{headers:req.headers}));
          else if (req.method === "POST") {
            const chunks=[];
            let size=0;
            for await (const chunk of req) {
              size+=chunk.length;
              if (size>16000) { res.writeHead(413); res.end(); return; }
              chunks.push(chunk);
            }
            const request=new Request(`http://${req.headers.host}${req.url}`,{method:"POST",headers:req.headers,body:Buffer.concat(chunks)});
            response=await POST(request);
          } else response=new Response(null,{status:405,headers:{Allow:"GET, POST"}});
          res.writeHead(response.status,Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch {
          console.warn("ShelterIQ assist: local handler unavailable");
          res.writeHead(503,{"Content-Type":"application/json"});
          res.end(JSON.stringify({error:"AI service unavailable"}));
        }
      });
    },
  };
}
