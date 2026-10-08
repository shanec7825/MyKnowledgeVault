// Curated method summaries, not quotations or empirical evidence for a motion.
export const methodSources = [
  ['socrates','苏格拉底／柏拉图','哲学','《欧绪弗洛篇》','https://classics.mit.edu/Plato/euthyfro.html','定义讨论与反例','用反例检验定义能否覆盖其声称解释的对象。','已读取原文'],
  ['aristotle','亚里士多德','哲学','《修辞学》第一卷','https://classics.mit.edu/Aristotle/rhetoric.1.i.html','第一卷第 2 章','区分论证、说话者可信度和听众情感；说服效果不是事实裁决。','已读取原文'],
  ['mill','约翰·斯图亚特·密尔','哲学','《论自由》','https://www.gutenberg.org/files/34901/34901-h/34901-h.htm','第二章：思想与讨论自由','理解反对理由，检验自己立场的理由，而非只背结论。','已读取原文'],
  ['lincoln','林肯与道格拉斯','经典辩论','1858 渥太华辩论','https://www.nps.gov/liho/learn/historyculture/debate1.htm','双方发言及末轮反驳','对照实际主张、指控与回应，检查复述是否准确；历史立场不等于训练认可。','已读取原文'],
  ['freeport','林肯与道格拉斯','经典辩论','弗里波特问题','https://www.nps.gov/liho/learn/historyculture/freeport-doctrine.htm','Lincoln Paints Douglas into a Corner / Douglas Responds','用具体问题揭示原则与实施条件之间的张力，同时允许回答者澄清前提。','已读取官方解说与引文'],
  ['kennedy','肯尼迪与尼克松','经典辩论','1960 年首场总统辩论','https://www.debates.org/voter-education/debate-transcripts/september-26-1960-debate-transcript/','开场、记者提问及回应','把共同目标与实现路径分开，检验数字的口径和比较基线。','已读取原文'],
  ['orwell','乔治·奥威尔','文学','Politics and the English Language','https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/','含混措辞、陈旧隐喻及写作建议','删除空泛修饰，用明确主语和动词表达；精简不能删掉限定条件。','已读取原文'],
  ['lowell','艾米·洛威尔','诗歌','Preface to Some Imagist Poets','https://www.poetryfoundation.org/articles/69404/preface-to-some-Imagist-poets','意象、语言与节奏原则','练习具体意象、准确措辞和适合内容的节奏；诗学原则不是所有文体的硬规则。','已读取原文'],
  ['dubois','W. E. B. 杜波依斯','社会学','《黑人的灵魂》','https://www.gutenberg.org/files/408/408-h/408-h.htm','第一章与第三章','区分当事人经验、社会位置与制度条件；个人叙事不能直接代表总体。','已读取原文'],
  ['boas','弗朗茨·博厄斯','人类学','The Mind of Primitive Man','https://www.gutenberg.org/files/71630/71630-h/71630-h.htm','文化、环境与群体差异讨论','先检查历史、环境与取样，再评价群体差异；不沿用过时分类作现实证据。','已读取原文'],
  ['zhuangzi','庄子与惠子','中国思想','《庄子·秋水》','https://ctext.org/zhuangzi/floods-of-autumn/zh','濠梁问答（全文待复核）','可作为视角与概念歧义的延伸阅读，不据摘要生成逐字引语。','仅检索摘要'],
  ['mozi','墨子与公输班','中国思想','《墨子·公输》','https://ctext.org/mozi/gong-shu/zh','公输篇（全文待复核）','可作为原则一致性与类比的延伸阅读；原文抓取受限。','仅检索摘要'],
  ['pound','埃兹拉·庞德','诗歌','A Few Don’ts by an Imagiste','https://www.poetryfoundation.org/poetrymagazine/articles/58900/a-few-donts-by-an-imagiste','意象与节奏（全文待复核）','延伸阅读：准确意象与凝练措辞；不模仿个人政治立场。','仅检索摘要'],
  ['heaney','谢默斯·希尼','诗歌','Crediting Poetry · 诺贝尔演讲','https://www.nobelprize.org/prizes/literature/1995/heaney/lecture/','1995 诺贝尔演讲（全文待复核）','延伸阅读：语言、个人经验与公共处境的联系。','仅检索摘要']
].map(([id,author,category,title,url,locator,method,access])=>({id,author,category,title,url,locator,method,access,retrievedAt:'2026-10-07'}));

export const trainingTracks = [
  ['general','综合诊断','综合','围绕当前问题选择一个最值得改进的目标。',['aristotle','mill'],'写 120–200 字立论，交代主张、理由、证据需求和边界。',['理由确实支持结论','未把假设写成事实','边界明确']],
  ['precision','语言锤炼 · 精简保义','语言','删去空话，保留否定、量词、条件与不确定性。',['orwell'],'提交一段原稿及精简稿；标出删改，并说明保留了哪些限定条件。',['结论强度未改变','没有遗漏否定或条件','每句话有明确任务']],
  ['concrete','语言锤炼 · 抽象变具体','语言','把抽象判断落实到人物、行动和可观察后果。',['lowell','orwell'],'把一个抽象判断改成 80–150 字具体情境，再写一句说明例子不能证明什么。',['细节服务于主张','虚构情境明确标注','未以个案代替总体']],
  ['rhythm','语言锤炼 · 节奏与口语','语言','让听众能跟上信息，不以排比替代理由。',['lowell','aristotle'],'写 120–200 字可朗读短稿，用 / 标停顿，标出一个重音；附一句话中心意思。',['停顿不切断逻辑','重复承担强调功能','文本节奏不冒称真实语音表现']],
  ['analogy','语言锤炼 · 类比边界','语言','解释类比对应的关系，以及何处不再相似。',['aristotle'],'写出本体、喻体、共同关系和一个重要差异；说明差异是否破坏推论。',['比较关系而非表面相似','差异得到处理','类比未冒充经验证据']],
  ['definition','专项 · 定义与反例','论证','检验量词、必要与充分条件。',['socrates'],'先定义关键词，再给符合全部前提的边界例子或反例，说明它否定了什么。',['量词保持一致','反例满足前提','没有从反例推出相反全称']],
  ['steelman','专项 · 最强反方与换位','论证','准确表达反对理由，再回应关键前提。',['mill','lincoln'],'用 80–120 字写最强反方，再用 80–120 字回应；注明什么情况会让你改判。',['没有弱化反方','回应真实前提','改判条件具体']],
  ['questioning','专项 · 连续质询','交锋','每个问题只检验一个前提，允许对方澄清。',['freeport','socrates'],'设计三问：定义、机制、边界；每问附可能回答和相应追问，不强迫虚假二选一。',['问题可回答','追问依赖真实回答','问句本身不充当证明']],
  ['evidence','专项 · 证据与因果','研究','区分出处存在、出处相关与出处足够支持结论。',['kennedy','boas'],'给出主张、所需证据、一个替代解释及区分两种解释的观察；缺来源就写待验证。',['时间与群体口径匹配','相关不冒充因果','说明证据局限']],
  ['weighing','专项 · 价值权衡与结辩','交锋','对实际争点作比较，解释判准本身。',['aristotle','kennedy'],'写 150–220 字结辩：一项争点、双方成立部分、判断标准及未解决前提；无记录则标为模拟。',['不引入突袭证据','判准有理由','承认尚未确定之处']],
  ['perspective','专项 · 社会位置与情境','社会研究','区分个体经验、制度机制和跨文化解释。',['dubois','boas'],'从两个不同社会位置描述同一情境，列出观察、解释和待核查项各一条。',['不把群体视作同质','未替当事人编造经历','解释包含情境与取样限制']],
  ['transfer','专项 · 跨题迁移','综合','换一个情境验证方法，而非记住上一题答案。',['mill','socrates'],'另选一个主题，用上一题的方法作 120–200 字分析，指出一处不适用的条件。',['方法可以明确指出','新题前提重新检查','没有照搬原结论']]
].map(([id,name,category,goal,sourceIds,instruction,checklist])=>({id,name,category,goal,sourceIds,instruction,checklist}));

export function trainingTrack(id){return trainingTracks.find(t=>t.id===id)||trainingTracks[0];}
export function trackSources(id){return trainingTrack(id).sourceIds.map(key=>methodSources.find(s=>s.id===key));}
export const trainingActions={question:'提问 / 领题',answer:'提交作答',rewrite:'同题重写',transfer:'换题迁移'};
