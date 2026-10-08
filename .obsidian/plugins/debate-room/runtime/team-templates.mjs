import {validateConfig} from './lib.mjs';
import {randomUUID} from 'node:crypto';

// Save only role snapshots and model names, never connection credentials.
export function teamTemplate(input){
  if(typeof input?.name!=='string'||!input.name.trim()||input.name.length>60)throw new Error('组合名称需为 1–60 字');
  const {agents}=validateConfig({topic:'辩手组合校验',agents:input.agents});
  return {id:randomUUID(),name:input.name.trim(),agents,createdAt:new Date().toISOString()};
}
