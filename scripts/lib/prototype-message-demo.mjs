// Preview-only delivery scenarios. Both HTTP and WS execute the existing demoFixture.
import { setTimeout as delay } from 'node:timers/promises';
import { supportStateFor, supportUserView } from './prototype-demo-support.mjs';
import { demoAccountId, previewAccountId } from './prototype-demo-identity.mjs';

const root='/api/app/support';
const commandPath=/^\/api\/app\/support\/conversations(?:\/(DEMO-SUPPORT-\d+)\/(replies|read))?$/;
const receiptPath=/^\/api\/app\/support\/commands\/([^/]+)$/;
const receiptKey=(accountId,key)=>JSON.stringify([accountId,key]);
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
      const headers=request.headers?.()??{};
      const accountId=request.accountId??previewAccountId(state,headers);
      if(!accountId)return fail(401,'AUTH_REQUIRED');
      const account=supportStateFor(state,accountId);
      const receipt=receiptPath.exec(url.pathname);
      if(receipt&&request.method()==='GET') {
        const key=decodeURIComponent(receipt[1]),saved=receipts.get(receiptKey(accountId,key));
        const transfer=account.supportTransferSample;
        if(transfer?.key===key) {
          if(accountId!==(transfer.accountId??demoAccountId))return fail(404,'SUPPORT_COMMAND_NOT_FOUND');
          if(transfer.rejected)return ok(peerChangedReceipt(transfer.conversationNo,key,key));
          if(!transfer.committed)return fail(404,'SUPPORT_COMMAND_NOT_FOUND');
        }
        if(saved?.rejection)return ok(saved.rejection);
        const clearance=account.supportClearCommands?.find(row=>row.accountId===accountId&&row.key===key);
        if(clearance)return ok({resultType:'CONVERSATION_USER_CLEAR',result:structuredClone(clearance.result)});
        const conversationNo=saved?.result?.conversation.conversationNo
          ??account.supportMessageCommands?.find(row=>row.key===key&&(row.accountId??demoAccountId)===accountId)?.conversationNo;
        if(conversationNo) {
          const detail=account.supportConversations?.find(row=>row.conversation.conversationNo===conversationNo);
          return detail?ok({resultType:'conversation',result:supportUserView(account,detail)}):fail(404,'CONVERSATION_NOT_FOUND');
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
      const key=headers['idempotency-key']||headers['Idempotency-Key'];
      if(operation!=='read'&&(typeof key!=='string'||!key||input.clientMessageId!==key))return fail(400,'消息请求标识无效');
      // Versions can change during recovery; the original content and target cannot.
      const fingerprint=JSON.stringify([operation,match[1],input.conversationType,content,input.kind||'TEXT']);
      const scopedKey=receiptKey(accountId,key);
      if(operation!=='read'&&receipts.has(scopedKey)) {
        const saved=receipts.get(scopedKey);
        if(saved.fingerprint!==fingerprint)return fail(409,'消息请求标识已被使用');
        await saved.pending;
        return saved.result?ok(supportUserView(account,saved.result)):structuredClone(saved.response);
      }
      const saved={fingerprint};
      const epoch=generation,scenario=state.messageSendState||'normal';
      const execute=async()=>{
        if(operation!=='read'&&scenario==='delayed')await delay(2000);
        if(operation!=='read'&&scenario==='timeout')await delay(20000);
        if(epoch!==generation)return fail(503,'演示场景已重置，请重试');
        if(operation!=='read'&&scenario==='failed')return fail(422,'消息未发送，请重试');
        // Execute against the authenticated account's conversation fixture.
        try {
          const result=fixtureFor(url,{...request,accountId});
          if(!result?.conversation||!Array.isArray(result.messages))return fail(422,'该演示操作尚未配置');
          saved.result=structuredClone(result);
          return ok(result);
        } catch(error) {return fail(error.status||500,error.message);}
      };
      if(operation!=='read')receipts.set(scopedKey,saved);
      saved.pending=execute().then(response=>{
        saved.response=structuredClone(response);
        if(response.status!==409||receipts.get(scopedKey)!==saved)return;
        if(operation==='reply'&&response.body.message==='CONVERSATION_PEER_CHANGED'&&/^[A-Za-z0-9_-]{8,128}$/.test(input.clientMessageId)) {
          saved.rejection=peerChangedReceipt(match[1],key,input.clientMessageId);
        } else receipts.delete(scopedKey);
      });
      await saved.pending;
      if(operation!=='read'&&scenario==='unknown'&&saved.response.status===200) {
        // Lose the acknowledgement while leaving the recorded receipt readable.
        return {...fail(504,'SUPPORT_COMMAND_RESULT_UNKNOWN'),deliveryUnknown:true};
      }
      return saved.result?ok(supportUserView(account,saved.result)):structuredClone(saved.response);
    },
  };
}
