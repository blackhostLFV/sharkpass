import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
function check(directory){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory())check(path);
  else if(/\.(?:mjs|js)$/.test(entry.name)){
   const result=spawnSync(process.execPath,['--check',path.pathname],{stdio:'inherit'});
   if(result.status!==0)process.exit(result.status??1);
  }
 }
}
for(const folder of ['src','public','scripts'])check(new URL(`../${folder}/`,import.meta.url));
