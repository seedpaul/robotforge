/** CAN ID zero is valid; null means the team has not entered an address yet. */
export const canAddressLabel=(id:number|null)=>id===null?'CAN ID needed':`CAN ${id}`;
