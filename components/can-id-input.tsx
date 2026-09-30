"use client";

/** A blank address is intentional draft data, never an inferred hardware address. */
export default function CanIdInput({label,value,onChange}:{label:string;value:number|null;onChange:(value:number|null)=>void}){
  return <input aria-label={label} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} placeholder="Enter CAN ID" value={value??''} aria-invalid={value!==null&&(value<0||value>62)} onChange={e=>{if(/^\d{0,2}$/.test(e.target.value))onChange(e.target.value===''?null:Number(e.target.value));}}/>;
}
