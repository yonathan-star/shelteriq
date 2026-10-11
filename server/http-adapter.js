export function nodeHandler(GET,POST){return async function handler(req,res){
  try{
    const proto=req.headers['x-forwarded-proto']==='http'?'http':'https';
    const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
    let body;
    if(req.method!=='GET'&&req.method!=='HEAD'){
      if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
      else {const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>16000){res.statusCode=413;res.end();return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
    }
    const request=new Request(`${proto}://${req.headers.host}${req.url}`,{method:req.method,headers,...(body!==undefined?{body}:{})});
    const response=req.method==='GET'?await GET(request):req.method==='POST'?await POST(request):new Response(null,{status:405});
    res.statusCode=response.status;for(const [key,value] of response.headers)res.setHeader(key,value);res.end(await response.text());
  }catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Service unavailable; try again later'}));}
};}
