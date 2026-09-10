import type { ApiClient } from './api-client';
import { ApiError } from './errors';
import type { ConversationRealtime, RealtimeSocket } from './conversation-realtime';
let current:ConversationRealtime|null=null;
export function setAppConversationRealtime(value:ConversationRealtime|null){current=value;}
export function withConversationRealtime(client:ApiClient):ApiClient {
  return { ...client, async request<T>(input:Parameters<ApiClient['request']>[0]):Promise<T>{
    const match=input.method==='POST' && /^\/api\/app\/support\/conversations(?:\/([^/?]+)\/(replies|read))?$/.exec(input.path);
    const pending=match?current?.command(match[2]==='read'?'read':match[2]==='replies'?'reply':'create',match[1]?decodeURIComponent(match[1]):undefined,input.body,input.idempotencyKey,input.signal):null;
    if(!pending)return client.request<T>(input);
    const result=await pending;
    if(result.code!==0)throw new ApiError({kind:result.code===401?'auth':'business',code:result.code,status:result.code,message:result.message??'CONVERSATION_COMMAND_FAILED'});
    return result.data as T;
  }};
}
/** SocketTask keeps this transport usable in H5 and the installed UniApp carrier. */
export function createUniRealtimeSocket(url:string):RealtimeSocket {
  const socket:RealtimeSocket={onopen:null,onmessage:null,onclose:null,onerror:null,send:data=>task.send({data}),close:()=>task.close({})};
  const task=uni.connectSocket({url,complete:()=>undefined});
  task.onOpen(()=>socket.onopen?.());
  task.onMessage(e=>{if(typeof e.data==='string')socket.onmessage?.({data:e.data});});
  task.onClose(e=>socket.onclose?.({code:e.code}));
  task.onError(()=>socket.onerror?.());
  return socket;
}
