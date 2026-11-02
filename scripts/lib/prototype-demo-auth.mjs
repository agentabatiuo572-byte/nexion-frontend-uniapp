// Loopback preview only. OAuth handoff/receipt model ported from App e1e96526,
// c44d6526 scripts/oauth-provider.h5.e2e.mjs; no real provider or SMS is contacted.
import { randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export const authDemoDefaults = {authState:'signed-in',oauthState:'signup',registrationState:'normal'};
export const authDemoOptions = {
  authState:[['signed-in','已登录'],['signed-out','未登录（验证登录/注册）']],
  oauthState:[['signup','第三方新账号'],['existing','第三方已有账号'],['invite-refused','授权后邀请码被拒'],['device-limit','第三方注册设备上限'],['ip-limit','第三方注册 IP 上限']],
  registrationState:[['normal','正常注册'],['captcha','发码需滑块'],['captcha-invalid','发码 ticket 无效后重新验证'],['device-limit','注册设备上限'],['ip-limit','注册 IP 上限']],
};

// Small generated PNGs keep the slider fixture visible without image downloads.
function png(width,height,pixel) {
  const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1;}return (n^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const type=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  const rows=Buffer.alloc(height*(1+width*3));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixel(x,y).forEach((v,c)=>rows[y*(1+width*3)+1+x*3+c]=v);
  return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const background=png(300,150,(x,y)=>x>=150&&x<190&&y>=55&&y<95?[15,20,30]:[40+Math.floor(x/5),65+Math.floor(y/4),100]);
const piece=png(40,40,()=>[198,255,58]);

export function createAuthDemo(state) {
  const flows=new Map(),challenges=new Map(),tickets=new Set(),otps=new Map();
  const trace=[];
  const existing={userId:900001,countryCode:'+86',phone:'13800000000',nickname:'Alex',onboardingComplete:true};
  const ok=data=>({status:200,body:{code:0,message:'OK',data}});
  const fail=(status,message)=>({status,body:{code:status,message,data:null}});
  const receipt=code=>({sponsorCode:code?.startsWith('NX')?code:null,sponsorDisplayName:code?.startsWith('NX')?'M•••':null,sourceEnvironment:'PRODUCTION',giftStatus:'PENDING_REVIEW',giftUsdt:5,giftNex:20});
  function session(user,registrationReceipt) {
    state.authState='signed-in';state.authUser=user;
    return ok({accessToken:'local-demo-token',refreshToken:null,tokenType:'Bearer',user,...(registrationReceipt?{registrationReceipt}:{})});
  }
  return {
    trace,
    reset(){flows.clear();challenges.clear();tickets.clear();otps.clear();delete state.authUser;delete state.captchaInvalidReturned;},
    handles(path){return path.startsWith('/auth/users/')||path.startsWith('/api/auth/captcha/');},
    handle(url,method,headers,body) {
      const path=url.pathname;
      if(method==='POST'&&!['/auth/users/refresh','/auth/users/logout','/auth/users/session/discard'].includes(path)) {
        trace.push({path,installationId:headers['x-nexgrid-installation-id']??'',clientSurface:headers['x-nexgrid-client-surface']??'',executionSupported:headers['x-nexgrid-execution-supported']??'',refreshMode:headers['x-nexion-refresh-mode']??'',captchaTicketPresent:!!body.captchaTicket,sponsorCode:body.sponsorCode??null});
      }
      if(path==='/auth/users/refresh')return state.authState==='signed-in'?session(state.authUser??existing):fail(401,'USER_REFRESH_TOKEN_REQUIRED');
      if(['/auth/users/logout','/auth/users/session/discard'].includes(path)){state.authState='signed-out';delete state.authUser;return ok(null);}
      if(path.endsWith('/oauth/provider/available'))return ok(['GOOGLE','APPLE','TELEGRAM']);
      if(path.endsWith('/oauth/provider/start')) {
        const flowId='OIDC-'+randomBytes(16).toString('hex'),flowKey=randomBytes(32).toString('base64url'),receipt=randomBytes(32).toString('base64url'),browserState=randomBytes(32).toString('base64url');
        flows.set(flowId,{flowId,flowKey,receipt,browserState,provider:body.provider,sponsorCode:body.sponsorCode,approved:false});
        return ok({flowId,flowKey,expiresInSec:600,authorizationUrl:url.origin+'/auth/users/oauth/provider/authorize/'+browserState});
      }
      if(path.includes('/oauth/provider/authorize/')) {
        const flow=[...flows.values()].find(f=>f.browserState===path.split('/').at(-1));
        if(!flow)return fail(404,'OAUTH_FLOW_INVALID');
        return {status:200,html:`<!doctype html><meta charset="utf-8"><title>Mock ${flow.provider}</title><h1>Mock ${flow.provider}</h1><p>Local preview authorization only.</p><button id="approve">Approve</button><script>document.getElementById('approve').onclick=async()=>{await fetch('/auth/users/oauth/provider/preview-approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({flowId:${JSON.stringify(flow.flowId)}})});window.opener.postMessage(${JSON.stringify({type:'uvel-oauth',flowId:flow.flowId,receipt:flow.receipt})},${JSON.stringify(url.origin)});};</script>`};
      }
      if(path.endsWith('/oauth/provider/preview-approve')) {const flow=flows.get(body.flowId);if(!flow)return fail(404,'OAUTH_FLOW_INVALID');flow.approved=true;return ok(null);}
      if(path.endsWith('/oauth/provider/status')||path.endsWith('/oauth/provider/complete')) {
        const flow=flows.get(body.flowId);
        if(!flow||flow.flowKey!==body.flowKey)return fail(422,'OAUTH_FLOW_INVALID');
        const verified=flow.approved&&body.receipt===flow.receipt;
        if(path.endsWith('/status'))return ok({status:verified?'VERIFIED':'PENDING',provider:flow.provider,displayName:verified?'Preview identity':null});
        if(!verified)return fail(422,'OAUTH_RECEIPT_INVALID');
        if(!/^[A-Za-z0-9._:-]{1,128}$/.test(headers['x-nexgrid-installation-id']??'')||headers['x-nexgrid-execution-supported']!=='false'||headers['x-nexion-refresh-mode']!=='cookie')return fail(422,'LOGIN_INSTALLATION_INVALID');
        if(state.oauthState==='invite-refused')return fail(422,'USER_REGISTRATION_SPONSOR_INVALID');
        if(state.oauthState==='device-limit')return fail(409,'USER_REGISTRATION_DEVICE_LIMIT');
        if(state.oauthState==='ip-limit')return fail(409,'USER_REGISTRATION_K1_IP_LIMIT');
        if(state.oauthState==='existing')return session(existing);
        return session({...existing,countryCode:'',phone:'',nickname:'Preview identity'},receipt(flow.sponsorCode));
      }
      if(path==='/api/auth/captcha/challenge') {
        const challengeId='PREVIEW-'+randomBytes(16).toString('hex');challenges.set(challengeId,body.scene);
        return ok({challengeId,backgroundImage:background,pieceImage:piece,width:300,height:150,pieceWidth:40,pieceHeight:40,pieceY:55,expiresInSec:120});
      }
      if(path==='/api/auth/captcha/verify') {
        if(challenges.get(body.challengeId)!==body.scene||Math.abs(body.offsetX-150)>8)return fail(422,'USER_CAPTCHA_INVALID');
        challenges.delete(body.challengeId);const ticket='PREVIEW-'+randomBytes(24).toString('hex');tickets.add(ticket);
        return ok({ticket,expiresInSec:120});
      }
      const otpSend=path.match(/^\/auth\/users\/(register|login|password-reset)\/otp\/send$/);
      if(otpSend) {
        if(otpSend[1]==='register'&&['captcha','captcha-invalid'].includes(state.registrationState)) {
          if(!body.captchaTicket)return fail(428,'USER_CAPTCHA_REQUIRED');
          if(!tickets.delete(body.captchaTicket))return fail(422,'USER_CAPTCHA_TICKET_INVALID');
          if(state.registrationState==='captcha-invalid'&&!state.captchaInvalidReturned){state.captchaInvalidReturned=true;return fail(422,'USER_CAPTCHA_TICKET_INVALID');}
        }
        const prefix={register:'REG',login:'LOGIN','password-reset':'RESET'}[otpSend[1]];
        const challengeNo=prefix+'-'+randomBytes(16).toString('hex');otps.set(challengeNo,body.countryCode+body.phone);
        return ok({challengeNo,resendAfterSec:1,deliveryHint:'***'+body.phone.slice(-4)});
      }
      if(path==='/auth/users/login')return session(existing);
      if(['/auth/users/register','/auth/users/register/otp/verify','/auth/users/login/otp/verify','/auth/users/password-reset/otp/verify','/auth/users/password-reset/otp/complete'].includes(path)) {
        if(otps.get(body.challengeNo)!==body.countryCode+body.phone||body.code!=='123456')return fail(422,'USER_REGISTRATION_OTP_INVALID');
        if(path==='/auth/users/register') {
          if(state.registrationState==='device-limit')return fail(409,'USER_REGISTRATION_DEVICE_LIMIT');
          if(state.registrationState==='ip-limit')return fail(409,'USER_REGISTRATION_K1_IP_LIMIT');
          return session({...existing,countryCode:body.countryCode,phone:body.phone},receipt(body.sponsorCode));
        }
        if(path==='/auth/users/login/otp/verify')return session(existing);
        if(path.endsWith('/complete'))return ok({status:'PASSWORD_RESET',revokedSessionCount:0});
        return ok({status:path.includes('/register/')?'REGISTRATION_OTP_VERIFIED':'PASSWORD_RESET_OTP_VERIFIED'});
      }
      return fail(404,'AUTH_PREVIEW_NOT_MODELLED');
    },
  };
}
