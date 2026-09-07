export const deadzone=(v:number)=>Math.abs(v)<.13?0:Math.sign(v)*(Math.abs(v)-.13)/.87;
export function driveImpulse(current:{x:number,z:number},target:{x:number,z:number},mass:number,dt:number){let x=(target.x-current.x)*mass*.12,z=(target.z-current.z)*mass*.12,max=mass*4.7*dt,len=Math.hypot(x,z);if(len>max){x*=max/len;z*=max/len}return {x,z}}
export function launchVelocity(start:{x:number;y:number;z:number},target:{x:number;y:number;z:number}){let distance=Math.hypot(target.x-start.x,target.z-start.z),t=Math.max(.65,Math.min(1.05,distance/3.2));return {x:(target.x-start.x)/t,y:(target.y-start.y+4.905*t*t)/t,z:(target.z-start.z)/t}}
export function inLaunchZone(x:number,z:number){return z<=-Math.abs(x)+.23||z>=1.2192+Math.abs(x)-.23}
export function patternPoints(colors:string[]){return colors.reduce((score,c,i)=>score+(c===(i%3===0?'G':'P')?2:0),0)}
