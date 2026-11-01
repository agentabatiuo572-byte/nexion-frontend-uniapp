import { logicalNativePage } from "@/lib/native-tab-navigation";
/** Public promotion disclosure only. Checkout, rewards and account pages remain private. */
export function isPublicPromotionRoute(route:string,activityId:unknown,landingId?:unknown):boolean {
  const path=route.replace(/^#?\/?/,'').split('?')[0];
  if(path==='pages/events/events')return true;
  // The purchase-offer landing page is public only for a named offer, like the store detail.
  if(path==='pages/events/promotion-detail')return typeof landingId==='string'&&landingId.trim().length>0;
  return typeof activityId==='string'&&activityId.trim().length>0&&['pages/store/store','pages/store/detail'].includes(path);
}
export function currentPublicPromotionRoute(route:string):boolean {
  let activityId:unknown,landingId:unknown;
  try {
    const pages=getCurrentPages();
    let page=pages[pages.length-1] as unknown as {route?:string;options?:Record<string,unknown>};
    // #ifdef APP-PLUS
    page=logicalNativePage(page);
    // #endif
    if(page?.route===route){activityId=page.options?.activityId;landingId=page.options?.id;}
  }catch{/* native stack is not available during cold load */}
  // #ifdef H5
  if(typeof window!=='undefined'){
    const hash=window.location.hash.replace(/^#\/?/,'');
    if(hash.split('?')[0]===route){const query=new URLSearchParams(hash.includes('?')?hash.slice(hash.indexOf('?')+1):'');activityId=query.get('activityId')??activityId;landingId=query.get('id')??landingId;}
  }
  // #endif
  return isPublicPromotionRoute(route,activityId,landingId);
}
