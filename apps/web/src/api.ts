export class ApiError extends Error {
  constructor(message:string, public status:number, public requestId?:string, public errorKey?:string){super(message)}
}
export async function api<T=any>(path:string, options:RequestInit={}):Promise<T>{
  let response:Response;
  try{response=await fetch(path,{credentials:'include',...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.method&&options.method!=='GET'?{'x-dgos-csrf':'web'}:{}),...options.headers}})}
  catch{throw new ApiError('Network unavailable. Check the API connection and retry.',0)}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new ApiError(body.message||body.errorKey||`Request failed (${response.status})`,response.status,body.requestId||response.headers.get('x-request-id')||undefined,body.errorKey)}
  return response.status===204?null as T:response.json();
}
export const json=(body:unknown,method='POST'):RequestInit=>({method,body:JSON.stringify(body)});
export const items=(value:any):any[]=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[];
export const message=(error:unknown)=>error instanceof Error?error.message:String(error);
export const receiptError=(error:unknown)=>error instanceof ApiError&&error.requestId?`${error.message} · request ${error.requestId}`:message(error);
