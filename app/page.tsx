import Editor from './Editor';
import seed from '../data/seed.json';
import {State,validateState} from '../lib/model';
import {requireChatGPTUser} from './chatgpt-auth';
import {db} from '../lib/server';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');let initial=seed as unknown as State;try{const row=await db().prepare('SELECT state FROM projects WHERE id=?').bind(user.userId).first<{state:string}>();if(row){const saved=JSON.parse(row.state);if(validateState(saved))initial=saved;}}catch{ /* The real vector plan still renders when storage is unavailable. */ }return <Editor initial={initial}/>}
