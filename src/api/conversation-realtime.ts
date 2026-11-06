/** Wire contract shared with the M3 client. No tokens in URLs or persistent message cache. */
import { createAbortController } from "@/lib/abort-controller-compat";
export interface RealtimeSocket {
  onopen: (()=>void)|null; onmessage: ((event:{data:string})=>void)|null;
  onclose: ((event:{code:number})=>void)|null; onerror: (()=>void)|null;
  send(data:string):void; close():void;
}
export interface RealtimeEnvelope { code:number; message?:string; data:unknown }
export interface RealtimePresence { conversationNo:string; online:boolean; typing:boolean; expiresIn?:number }
interface Options {
  url:string; ticket:(signal:AbortSignal)=>Promise<{ticket:string}>; socket:(url:string)=>RealtimeSocket;
  reconcile:(signal:AbortSignal)=>Promise<void>; state?:(ready:boolean,terminal:boolean)=>void;
  presence?:(value:RealtimePresence|null)=>void;
  scopeInvalidated?:(customerId:number)=>void;
  authRejected?:()=>void;
  configInvalidated?:()=>void;
}
type Timer=ReturnType<typeof setTimeout>;
export class ConversationRealtime {
  ready=false;
  private stopped=true; private terminal=false; private epoch=0; private attempts=0; private lifecycle=0;
  private connection:RealtimeSocket|null=null; private controller=createAbortController(); private fallback=createAbortController();
  private retryTimer?:Timer; private pollTimer?:Timer; private heartbeatTimer?:Timer; private deadline?:Timer; private eventTimer?:Timer;private stableTimer?:Timer;
  private pending=new Map<string,{resolve:(value:RealtimeEnvelope)=>void;reject:(error:Error)=>void;timer:Timer}>();
  private eventIds=new Set<string>(); private dirty=false; private syncing=false; private authenticated=false;
  private watched:string|null=null; private lastTyping=0; private lastPong=0; private sequence=0;
  private reauthSupported=false; private reauthTimer?:Timer; private reauthQueued=false;
  constructor(private readonly options:Options){}
  start(){if(!this.stopped)return;this.stopped=false;this.terminal=false;this.attempts=0;this.lifecycle++;this.fallback=createAbortController();this.connect();this.poll(this.lifecycle);}
  stop(){this.stopped=true;this.lifecycle++;this.disconnect(false);this.fallback.abort();clearTimeout(this.pollTimer);this.options.presence?.(null);}
  /** Keep watches and pending acknowledgements on a ready socket during rotation. */
  renewCredentials(){
    if(this.stopped)return;
    if(!this.ready||!this.reauthSupported){
      this.disconnect(false);
      void this.connect();
      return;
    }
    if(this.reauthTimer!==undefined){this.reauthQueued=true;return;}
    const epoch=this.epoch;
    const signal=this.controller.signal;
    this.reauthTimer=setTimeout(()=>{if(epoch===this.epoch)this.disconnect(true);},8000);
    void this.options.ticket(signal).then(({ticket})=>{
      if(epoch===this.epoch)this.send({type:'reauth',ticket});
    }).catch(()=>{if(epoch===this.epoch)this.disconnect(true);});
  }
  watch(no:string|null){this.watched=no;if(this.authenticated)this.send({type:'watch',conversationNo:no});}
  typing(active:boolean){
    if(!this.ready||!this.watched)return;
    if(active && Date.now()-this.lastTyping<1200)return;
    this.lastTyping=Date.now();this.send({type:'typing',conversationNo:this.watched,active});
  }
  command(operation:string,conversationNo:string|undefined,body:unknown,idempotencyKey?:string,signal?:AbortSignal):Promise<RealtimeEnvelope>|null {
    if(!this.ready||!this.connection)return null;
    if(signal?.aborted)return Promise.reject(new Error('CONVERSATION_DELIVERY_UNKNOWN'));
    const requestId=`c${Date.now()}_${++this.sequence}`;
    return new Promise((resolve,reject)=>{
      const abort=()=>{const p=this.pending.get(requestId);if(p){this.pending.delete(requestId);p.reject(new Error('CONVERSATION_DELIVERY_UNKNOWN'));}};
      const timer=setTimeout(abort,12000);
      const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
      this.pending.set(requestId,{resolve:v=>{done();resolve(v)},reject:e=>{done();reject(e)},timer});
      signal?.addEventListener('abort',abort,{once:true});
      try{this.send({type:'command',requestId,operation,conversationNo,body,idempotencyKey});}catch{abort();}
    });
  }
  private send(value:unknown){this.connection?.send(JSON.stringify(value));}
  private setReady(value:boolean){this.ready=value;this.options.state?.(value,this.terminal);}
  private rejectCredentials(terminal=false){
    this.disconnect(true,terminal);
    this.options.authRejected?.();
  }
  private disconnect(retry:boolean,terminal=false){
    this.epoch++;this.controller.abort();this.fallback.abort();this.fallback=createAbortController();this.connection?.close();this.connection=null;
    this.authenticated=false;this.syncing=false;this.dirty=false;this.terminal=terminal;
    for(const timer of [this.retryTimer,this.heartbeatTimer,this.deadline,this.eventTimer,this.stableTimer,this.reauthTimer])clearTimeout(timer);
    this.reauthSupported=false;this.reauthTimer=undefined;this.reauthQueued=false;
    this.pending.forEach(p=>p.reject(new Error('CONVERSATION_DELIVERY_UNKNOWN')));this.pending.clear();
    this.setReady(false);this.options.presence?.(null);
    if(retry&&!this.stopped&&!terminal){const delay=Math.min(30000,1000*2**Math.min(this.attempts++,5)*(0.8+Math.random()*0.4));this.retryTimer=setTimeout(()=>this.connect(),delay);}
  }
  private async connect(){
    if(this.stopped||this.terminal)return;
    const epoch=++this.epoch;this.controller=createAbortController();const signal=this.controller.signal;
    const current=()=>!this.stopped&&epoch===this.epoch&&!signal.aborted;
    this.deadline=setTimeout(()=>{if(current())this.disconnect(true)},15000);
    try{
      const ticket=await this.options.ticket(signal);if(!current())return;
      const socket=this.options.socket(this.options.url);this.connection=socket;
      socket.onopen=()=>{if(current())this.send({type:'auth',ticket:ticket.ticket})};
      socket.onclose=({code})=>{if(current()){if(code===4401)this.rejectCredentials();else this.disconnect(true);}};
      socket.onerror=()=>{if(current())this.disconnect(true)};
      socket.onmessage=e=>{
        if(!current())return;
        try{
          const f=JSON.parse(e.data);
          switch(f.type){
            case 'ready':
              if(this.authenticated)break;
              clearTimeout(this.deadline);this.fallback.abort();this.authenticated=true;this.lastPong=Date.now();this.watch(this.watched);
              this.reauthSupported=f.reauth===true;
              this.dirty=true;void this.sync(epoch);this.heartbeat(epoch);break;
            case 'reauth-ready':
              if(this.reauthTimer===undefined)break;
              clearTimeout(this.reauthTimer);this.reauthTimer=undefined;
              if(this.reauthQueued){this.reauthQueued=false;this.renewCredentials();}
              break;
            case 'pong':this.lastPong=Date.now();break;
            case 'ack':{const p=this.pending.get(f.requestId);if(p){this.pending.delete(f.requestId);p.resolve(f.result)}break;}
            case 'event':
              if(typeof f.eventId!=='string'||this.eventIds.has(f.eventId))break;
              this.eventIds.add(f.eventId);if(this.eventIds.size>2048)this.eventIds.delete(this.eventIds.values().next().value!);
              if(f.eventType==='PLATFORM_CONFIG_CHANGED'){this.options.configInvalidated?.();break;}
              this.dirty=true;if(!this.syncing){clearTimeout(this.eventTimer);this.eventTimer=setTimeout(()=>void this.sync(epoch),80)}break;
            case 'presence':if(f.conversationNo===this.watched)this.options.presence?.(f);break;
            case 'scope-invalidated':
              if(f.reason==='ASSIGNMENT_CHANGED' && Number.isSafeInteger(f.customerId) && f.customerId>0)
                this.options.scopeInvalidated?.(f.customerId);
              break;
            case 'error':
              if(f.code===401||f.code===403)this.rejectCredentials(this.reauthTimer===undefined);
              else this.disconnect(true);
              break;
          }
        }catch{this.disconnect(true);}
      };
    }catch(e){if(current()){const code=(e as {status?:number;code?:number}).status??(e as {code?:number}).code;this.disconnect(true,code===401||code===403);}}
  }
  private async sync(epoch:number){
    if(this.syncing||!this.authenticated)return;
    this.syncing=true;const signal=this.controller.signal;
    try{
      do{this.dirty=false;await this.options.reconcile(signal);}while(this.dirty&&epoch===this.epoch&&!signal.aborted);
      if(epoch===this.epoch&&!signal.aborted){
        const wasReady=this.ready;this.setReady(true);
        if(!wasReady)this.stableTimer=setTimeout(()=>{if(epoch===this.epoch)this.attempts=0;},30000);
      }
    }catch{if(epoch===this.epoch)this.disconnect(true);}
    finally{if(epoch===this.epoch)this.syncing=false;}
  }
  private heartbeat(epoch:number){
    this.heartbeatTimer=setTimeout(()=>{
      if(epoch!==this.epoch||this.stopped)return;
      if(Date.now()-this.lastPong>45000){this.disconnect(true);return;}
      try{this.send({type:'ping'});this.heartbeat(epoch);}catch{this.disconnect(true);}
    },15000);
  }
  private poll(lifecycle:number){
    this.pollTimer=setTimeout(async()=>{
      if(this.stopped||this.terminal||lifecycle!==this.lifecycle)return;
      if(!this.ready&&!this.authenticated){
        // The fallback has its own cancellation scope; connection recovery cancels stale snapshots.
        const signal=this.fallback.signal;
        if(!signal.aborted)try{await this.options.reconcile(signal);}catch{/* next bounded poll retries */}
      }
      if(!this.stopped&&lifecycle===this.lifecycle)this.poll(lifecycle);
    },5000);
  }
}
