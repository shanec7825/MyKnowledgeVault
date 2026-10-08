import {trainingTrack,trackSources,trainingActions} from './public/training-catalog.js';

export function trainingContext(session,action='question'){
  const track=trainingTrack(session.track);
  const previous=[...(session.messages||[])].reverse().find(m=>m.role==='assistant'&&m.report?.exercise)?.report.exercise;
  return {track,action:trainingActions[action],previousExercise:previous||null,
    methodReferences:trackSources(track.id),
    recentAttempts:(session.messages||[]).filter(m=>m.role==='user'&&['answer','rewrite'].includes(m.action)).slice(-2).map(m=>({action:m.action,content:m.content.slice(0,3000)}))};
}

export const practiceProtocol=`训练采用领题—作答—具体反馈—同题重写—迁移的循环。依据 training.action 区分用户是在提问、作答、重写还是请求迁移；不要把提问当练习完成。第一次领题先安排训练目标与约束，不直接交付完整标准答案。作答时按 previousExercise 的标准逐项说明“已体现 / 待改进 / 无法判断”，每项依据真实答案，禁止凭空评分。重写时对照 recentAttempts 和当前稿，指出保留与改变的具体意义；若没有旧稿，先说明缺少比较依据。只选一个优先修正点，给至多两句标明“示范”的局部改写，再让用户同题重练；用户主动要求迁移时换情境，保持训练目标。
语言锤炼必须保护原意：逐一核对否定、量词、因果强度、适用条件、立场与不确定性，不把“可能”改成“一定”。原文引用必须来自用户实际稿件；未提供稿件时请用户提供，或给明确标注的虚构练习素材。节奏训练只评价文本组织，没有音频不能评价发音、真实语速或实际用时。字数和时间是任务约束，不是成绩。
training.methodReferences 是编辑编写的方法摘要与阅读出处，并非原文或本场实证证据；不得据此编造名人引语、历史现场、本人观点或 [S-...] 引用。方法只按题目适配，不能要求每个题目同时套用全部方法。诗歌的凝练、公共辩论的说服、社会科学的解释有不同目标，不把感染力当真理，也不把文化差异当群体本质。`;
