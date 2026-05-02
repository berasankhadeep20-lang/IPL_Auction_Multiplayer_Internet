import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useGameRoom } from '../hooks/useGameRoom';
import { ChatMessage } from '../types';

const REACTIONS = ['🔥','👋','💸','😮','🎉','😤','👑','🏏'];
function sp<T>(s:string,fb:T):T{try{return JSON.parse(s) as T;}catch{return fb;}}

export default function ChatPanel({onClose}:{onClose:()=>void}){
  const store=useGameStore();
  const{sendChat}=useGameRoom();
  const[input,setInput]=useState('');
  const bottomRef=useRef<HTMLDivElement>(null);
  const msgs:ChatMessage[]=Object.values(store.roomData?.chat??{}).sort((a,b)=>a.ts-b.ts);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs.length]);

  return(
    <div style={{position:'fixed',bottom:0,right:0,width:Math.min(320,window.innerWidth),
      height:'55vh',background:'var(--surface)',border:'1px solid var(--border)',
      borderRadius:'12px 0 0 0',zIndex:200,display:'flex',flexDirection:'column',
      boxShadow:'-4px -4px 24px rgba(0,0,0,.5)'}}>
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',
        display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,letterSpacing:1}}>💬 CHAT</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      {/* Reactions */}
      <div style={{display:'flex',gap:4,padding:'6px 10px',borderBottom:'1px solid var(--border)',flexWrap:'wrap',flexShrink:0}}>
        {REACTIONS.map(r=>(
          <button key={r} onClick={()=>sendChat(r,true)}
            style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,
              padding:'3px 7px',cursor:'pointer',fontSize:16,transition:'transform .1s'}}
            onMouseDown={e=>(e.currentTarget.style.transform='scale(1.3)')}
            onMouseUp={e=>(e.currentTarget.style.transform='scale(1)')}>
            {r}
          </button>
        ))}
      </div>
      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 12px',display:'flex',flexDirection:'column',gap:5}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:'flex',gap:7,alignItems:'flex-start',
            flexDirection:m.uid===store.uid?'row-reverse':'row'}}>
            {!m.isReaction&&(
              <div style={{background:'var(--surface2)',borderRadius:6,padding:'5px 9px',
                maxWidth:'78%',fontSize:12}}>
                <div style={{fontSize:9,color:'var(--muted)',marginBottom:2}}>{m.name}</div>
                <div>{m.text}</div>
              </div>
            )}
            {m.isReaction&&(
              <div style={{fontSize:22,animation:'slide-up .2s ease'}}>
                {m.text}
                <span style={{fontSize:9,color:'var(--muted)',marginLeft:4}}>{m.name}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      {/* Input */}
      <div style={{padding:'8px 10px',borderTop:'1px solid var(--border)',display:'flex',gap:6,flexShrink:0}}>
        <input className="input" style={{flex:1,padding:'7px 10px',fontSize:13}}
          placeholder="Type a message…" value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&input.trim()){sendChat(input.trim());setInput('');}}}/>
        <button className="btn btn-gold btn-sm" onClick={()=>{if(input.trim()){sendChat(input.trim());setInput('');}}} disabled={!input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
