import {writeFile,rename} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
// Windows indexers/sync tools can briefly deny replacement even for writable files.
// Keep the old file intact and retry replacement; never delete it as a workaround.
export async function atomicWrite(filename,content,operations={writeFile,rename,delay}){
  const temporary=filename+'.tmp';await operations.writeFile(temporary,content);
  for(let attempt=0;;attempt++){
    try{await operations.rename(temporary,filename);return;}
    catch(error){
      if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=11)throw error;
      await operations.delay(Math.min(25*2**attempt,250));
    }
  }
}
