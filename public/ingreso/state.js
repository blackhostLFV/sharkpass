export function normalizeCode(value){const code=String(value??'').trim();return code.length>=10&&code.length<=100?code:null;}
export function scanDecision(status,data={}){
 if(status===200&&data.accepted===true&&typeof data.ticketId==='string'&&data.ticketId.length>0)return {state:'accepted',symbol:'✓',kicker:'ENTRADA VALIDADA',title:'Ingreso autorizado',description:'La boleta quedó utilizada. Puede ingresar una persona.'};
 if(status===401)return {state:'unknown',symbol:'!',kicker:'REQUIERE ACCESO',title:'Sesión vencida',description:'Vuelve a iniciar sesión antes de autorizar el ingreso.'};
 if([400,403,404,409,429].includes(status))return {state:'denied',symbol:'×',kicker:'NO AUTORIZAR INGRESO',title:status===409?(String(data.error).includes('utilizada')?'Entrada ya utilizada':String(data.error).includes('anulada')?'Entrada anulada':'Entrada no habilitada'):status===403?'Sin permiso':status===429?'Espera un momento':'Entrada no válida',description:String(data.error||'Esta entrada no fue autorizada por el servidor.')};
 return {state:'unknown',symbol:'!',kicker:'NO AUTORIZAR TODAVÍA',title:'Resultado sin confirmar',description:'Comprueba la conexión y vuelve a leer la misma entrada. Si después aparece utilizada, consulta al coordinador antes de dejar ingresar.'};
}
