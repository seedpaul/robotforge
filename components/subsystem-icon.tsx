import type { SubsystemKind } from '@/lib/subsystem-layout';

/** Functional top/side-view schematics, shared by the parts tray and chassis nodes. */
export default function SubsystemIcon({kind,className}:{kind:SubsystemKind;className?:string}) {
  const drive=['swerve','differential','westCoast','tank','mecanum'].includes(kind);
  return <svg viewBox="0 0 80 64" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {drive?<>
      <rect x="20" y="12" width="40" height="42" rx="5" fill="currentColor" fillOpacity=".06"/>
      <path d="M40 42V22m-5 5 5-5 5 5"/>
      {[0,1,2,3].map(i=>{const x=i%2?58:12,y=i<2?12:40;return <g key={i}>
        {kind==='swerve'&&<circle cx={x+5} cy={y+7} r="10" strokeDasharray="2 3" strokeWidth="1"/>}
        <rect x={x} y={y} width="10" height="15" rx={kind==='swerve'?5:2} fill="var(--part-accent,#ed8241)" strokeWidth="1.5"/>
        {kind==='mecanum'&&<path d={(i===0||i===3)?`M${x+2} ${y+3}l6 5m-6 0 6 5`:`M${x+2} ${y+7}l6-5m-6 11 6-5`} strokeWidth="1.5"/>}
      </g>;})}
      {(kind==='westCoast'||kind==='tank')&&[12,58].map(x=><rect key={x} x={x} y="29" width="10" height="8" rx="2" fill="var(--part-accent,#ed8241)"/>)}
    </>:kind==='turret'?<>
      <circle cx="38" cy="35" r="22"/><circle cx="38" cy="35" r="14" strokeDasharray="3 4"/>
      <path d="M29 54h22M23 59h32"/><path d="m37 36 19-20 8 8-22 17Z" fill="var(--part-accent,#ed8241)"/>
      <path d="M15 17A29 29 0 0 1 54 9m-1-6 2 7-7 1"/>
    </>:kind==='shooter'?<>
      <path d="M12 56V23l9-8h38l9 8v33M19 56h42"/>
      <circle cx="25" cy="34" r="11" fill="var(--part-accent,#ed8241)"/><circle cx="55" cy="34" r="11" fill="var(--part-accent,#ed8241)"/>
      <circle cx="25" cy="34" r="3"/><circle cx="55" cy="34" r="3"/>
      <path d="M40 29V5m-5 6 5-6 5 6M35 47h10"/>
    </>:kind==='indexer'?<>
      <rect x="12" y="14" width="56" height="38" rx="8"/><rect x="17" y="20" width="46" height="26" rx="11" strokeDasharray="3 4"/>
      {[25,40,55].map(x=><circle key={x} cx={x} cy="33" r="6" fill="var(--part-accent,#ed8241)"/>)}
      <path d="M27 7h27m-5-4 5 4-5 4"/>
    </>:kind==='intake'?<>
      <path d="M14 48V20h9M66 48V20h-9M22 40v15h36V40"/>
      <rect x="18" y="21" width="44" height="14" rx="4" fill="var(--part-accent,#ed8241)"/>
      {[26,35,44,53].map(x=><path key={x} d={`M${x} 23v10`} strokeWidth="1.5"/>)}
      <circle cx="40" cy="8" r="5"/><path d="M40 39v9m-4-4 4 4 4-4"/>
    </>:kind==='arm'?<>
      <path d="M14 57h42M21 56v-9h24v9"/><circle cx="33" cy="42" r="8" fill="var(--part-accent,#ed8241)"/>
      <path d="m34 33 19-20 7 7-19 24M55 13l8-6 7 3-3 9-7 1"/>
      <path d="M12 38A28 28 0 0 1 36 15" strokeDasharray="3 4"/>
    </>:kind==='elevator'?<>
      <path d="M16 58h48M24 56V6h32v50M30 8v47M50 8v47"/>
      <rect x="20" y="28" width="40" height="12" rx="3" fill="var(--part-accent,#ed8241)"/>
      <path d="M40 23V12m-4 4 4-4 4 4M40 45v8"/>
    </>:kind==='climber'?<>
      <path d="M17 57h46M25 56V35h30v21M40 34V17c0-13 19-13 19-2v4h-8"/>
      <circle cx="40" cy="44" r="9" fill="var(--part-accent,#ed8241)"/><path d="M35 44h10M40 39v10M17 8h18"/>
    </>:<><rect x="16" y="12" width="48" height="42" rx="8"/><path d="M29 33h22M40 22v22" stroke="var(--part-accent,#ed8241)"/><path d="M24 6v6M40 6v6M56 6v6M24 54v5M40 54v5M56 54v5"/></>}
  </svg>;
}
