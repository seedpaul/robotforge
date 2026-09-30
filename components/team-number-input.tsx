"use client";

export default function TeamNumberInput({value,onChange}:{value:number;onChange:(team:number)=>void}) {
  return <input aria-label="Team number" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5} placeholder="e.g. 12345" value={value||''} onChange={e=>{if(/^\d{0,5}$/.test(e.target.value))onChange(e.target.value===''?0:Number(e.target.value));}}/>;
}
