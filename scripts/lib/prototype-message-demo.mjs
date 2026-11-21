// Preview-only delivery scenarios. Both HTTP and WS execute the existing demoFixture.
import { setTimeout as delay } from 'node:timers/promises';
import { supportAccountId, supportUserView } from './prototype-demo-support.mjs';
import { demoAccountId, previewAccountId } from './prototype-demo-identity.mjs';

const root='/api/app/support';
const commandPath=/^\/api\/app\/support\/conversations(?:\/(DEMO-SUPPORT-\d+)\/(replies|read))?$/;
const receiptPath=/^\/api\/app\/support\/commands\/([^/]+)$/;
const ok=data=>({status:200,body:{code:0,message:'success',data}});
const fail=(status,message)=>({status,body:{code:status,message,data:null}});
const peerChangedReceipt=(conversationNo,key,clientMessageId)=>({status:'REJECTED',sent:false,conversationNo,
  operation:'APP_CONVERSATION_REPLY',idempotencyKey:key,clientMessageId,businessCode:409,businessReason:'CONVERSATION_PEER_CHANGED'});

export function createPrototypeMessages({state,fixtureFor}) {
  const receipts=new Map();
  let generation=0;
  const matches=(url,method)=>method==='POST'&&commandPath.test(url.pathname)||method==='GET'&&receiptPath.test(url.pathname);
  return {
    matches,
    reset(){generation++;receipts.clear();},
    async request(url,request) {
      const receipt=receiptPath.exec(url.pathname);
      if(receipt&&request.method()==='GET') {
        const key=decodeURIComponent(receipt[1]),saved=receipts.get(key);
        const transfer=state.supportTransferSample;
        if(transfer?.key===key) {
          const accountId=previewAccountId(state,request.headers?.()??{});
          if(!accountId)return fail(401,'AUTH_REQUIRED');
          if(accountId!==(transfer.accountId??demoAccountId))return fail(404,'SUPPORT_COMMAND_NOT_FOUND');
        }
        if(transfer?.key===key&&transfer.rejected)return ok(peerChangedReceipt(transfer.conversationNo,key,key));
        if(transfer?.key===key&&!transfer.committed)return fail(404,'SUPPORT_COMMAND_NOT_FOUND');
        if(saved?.rejection) {
          const accountId=previewAccountId(state,request.headers?.()??{});
          if(!accountId)return fail(401,'AUTH_REQUIRED');
          return accountId===saved.rejection.accountId?ok(saved.rejection.result):fail(404,'SUPPORT_COMMAND_NOT_FOUND');
        }
        const clearance=state.supportClearCommands?.find(row=>row.accountId===supportAccountId(state)&&row.key===key);
        if(clearance)return ok({resultType:'CONVERSATION_USER_CLEAR',result:structuredClone(clearance.result)});
        const conversationNo=saved?.result?.conversation.conversationNo
          ??state.supportMessageCommands?.find(row=>row.key===key)?.conversationNo;
        if(conversationNo) {
          const detail=state.supportConversations?.find(row=>row.conversation.conversationNo===conversationNo);
          return detail?ok({resultType:'conversation',result:supportUserView(state,detail)}):fail(404,'CONVERSATION_NOT_FOUND');
        }
        if(!saved)return fail(404,'SUPPORT_COMMAND_NOT_FOUND');
        return fail(409,saved.response?'SUPPORT_COMMAND_FAILED_RETRYABLE':'SUPPORT_COMMAND_IN_PROGRESS');
      }
      const match=commandPath.exec(url.pathname);
      if(!match||request.method()!=='POST')return fail(422,'该演示操作尚未配置');
      const operation=match[2]==='read'?'read':match[2]==='replies'?'reply':'create';
      const input=request.postDataJSON();
      if(!input||typeof input!=='object'||Array.isArray(input))return fail(400,'消息请求无效');
      if(operation!=='read'&&(input.attachmentId||input.kind&&input.kind!=='TEXT'))return fail(422,'演示暂不上传附件');
      if(operation==='create'&&!['SUPPORT','ADVISOR'].includes(input.conversationType))return fail(422,'该会话类型尚未配置');
      const content=operation==='create'?input.openingText:input.body;
      if(operation!=='read'&&(typeof content!=='string'||!content.trim()))return fail(400,'请输入消息内容');
      if(operation==='read'&&(!Number.isSafeInteger(input.lastSeenMessageId)||input.lastSeenMessageId<1))return fail(400,'消息读取位置无效');
      const headers=request.headers?.()||{};
      const key=headers['idempotency-key']||headers['Idempotency-Key'];
      if(operation!=='read'&&(typeof key!=='string'||!key||input.clientMessageId!==key))return fail(400,'消息请求标识无效');
      // Versions can change during recovery; the original content and target cannot.
      const fingerprint=JSON.stringify([operation,match[1],input.conversationType,content,input.kind||'TEXT']);
      const accountId=previewAccountId(state,headers);
      if(operation!=='read'&&receipts.has(key)) {
        const saved=receipts.get(key);
        if(saved.rejection&&accountId!==saved.rejection.accountId)
          return accountId?fail(404,'SUPPORT_COMMAND_NOT_FOUND'):fail(401,'AUTH_REQUIRED');
        if(saved.fingerprint!==fingerprint)return fail(409,'消息请求标识已被使用');
        await saved.pending;
        return saved.result?ok(supportUserView(state,saved.result)):structuredClone(saved.response);
      }
      const saved={fingerprint};
      const epoch=generation,scenario=state.messageSendState||'normal';
      const execute=async()=>{
        if(operation!=='read'&&scenario==='delayed')await delay(2000);
        if(operation!=='read'&&scenario==='timeout')await delay(20000);
        if(epoch!==generation)return fail(503,'演示场景已重置，请重试');
        if(operation!=='read'&&scenario==='failed')return fail(422,'消息未发送，请重试');
        // Initialize the same fixture and reject unknown targets before any business write.
        try {
          fixtureFor(new URL(root+'/conversations/cursor',url),{method:()=> 'GET'});
          if(match[1]&&!state.supportConversations?.some(row=>row.conversation.conversationNo===match[1]))return fail(404,'演示会话不存在');
          const result=fixtureFor(url,request);
          if(!result?.conversation||!Array.isArray(result.messages))return fail(422,'该演示操作尚未配置');
          saved.result=structuredClone(result);
          return ok(result);
        } catch(error) {return fail(error.status||500,error.message);}
      };
      if(operation!=='read')receipts.set(key,saved);
      saved.pending=execute().then(response=>{
        saved.response=structuredClone(response);
        if(response.status!==409||receipts.get(key)!==saved)return;
        if(accountId&&operation==='reply'&&response.body.message==='CONVERSATION_PEER_CHANGED'&&/^[A-Za-z0-9_-]{8,128}$/.test(input.clientMessageId)) {
          saved.rejection={accountId,result:peerChangedReceipt(match[1],key,input.clientMessageId)};
        } else receipts.delete(key);
      });
      await saved.pending;
      if(operation!=='read'&&scenario==='unknown'&&saved.response.status===200) {
        // Lose the acknowledgement while leaving the recorded receipt readable.
        return {...fail(504,'SUPPORT_COMMAND_RESULT_UNKNOWN'),deliveryUnknown:true};
      }
      return saved.result?ok(supportUserView(state,saved.result)):structuredClone(saved.response);
    },
  };
}
