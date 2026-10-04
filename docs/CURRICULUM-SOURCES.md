# 音记教学内容：来源、范围与记号约定

更新日期：2026-10-04。课程正文、例句与题目是为本项目原创编排的教学内容；下列一手资料用于核实符号、语法规则及教学边界。未复制外部课程题库、音频或受保护的长段文字。

## 内容资产

- `content/curriculum.json`：7 个阶段，每阶段 5 个学习单元和 1 个综合考核，共 42 课、126 个概念说明、252 道带中英文解析的题。
- 每课都有 3 个相互衔接的概念、真实例句和翻译，以及 6 道题；题型涵盖选择、听辨、词块排序、录音跟读，每课最多 1 道录音题。
- `content/sounds.json`：41 张教学声音卡，每卡 3 个例词和发音动作提示。
- 音频文本字段 `audioText` 仅含英语单词或句子。声音卡播放“包含该声音的示例词”，不把 TTS 朗读 IPA 字符或字母名称冒充独立音素。

## 分阶段设计

| 阶段 | 递进内容 | 完成后的能力 |
| --- | --- | --- |
| 听见声音的地图 | 字母与声音、元辅音、清浊、前后中元音、r 色彩、双元音、考核 | 理解声音不是字母；识别常见美式元音与重弱读差异 |
| 给声音加上轮廓 | 塞音、唇齿和舌齿擦音、其余擦音、塞擦与鼻音、近音与辅音群、考核 | 使用部位、方式、清浊定位一个发音问题 |
| 从拼写读到单词 | CVC/silent e、字母组合与例外、音节重音、弱读、词典核实、考核 | 对陌生词提出候选读法，并知道如何确认 |
| 让单词表达意思 | 词素、名动词、形副词、代词介词、句子结构、考核 | 借助语境判断含义和当前词性，而不是给词贴永久标签 |
| 把动作放进时间 | 一般现在、一般过去、现在进行与将来、现在完成、过去完成、考核 | 从完整动词组、时间参照和事件先后辨认结构 |
| 冠词、数量与词尾 | 可数性、a/an 按声音、规则复数、不规则复数、s/ed 的读法、考核 | 分开处理意义、拼写与发音三个判断 |
| 连贯表达与复习 | 辅音接元音、信息焦点与弱读、不明显释放与轻拍、同化略音、复习方法、考核 | 识别常见自然语流变体，并建立个人复习闭环 |

课程刻意先提供辨别与动作线索，再放入例词、短句、综合考核。考核用于判断下一次该练什么，不能替代面向真实交流能力的标准化考试。

## 美式音标模型

英语不存在一个对所有美式口音和所有音系分析都唯一适用的音位总数。本课以 General American 常见词汇对立作教学基准：24 个辅音，加上 15 个常见元音类别；再把弱读 schwa `/ə/` 和非重读 r 音元音 `/ɚ/` 各单列为学习卡。因此 **41 是教学卡片数，不是宣称“英语只有 41 个音位”**。

- 24 辅音：`p b t d k ɡ f v θ ð s z ʃ ʒ h tʃ dʒ m n ŋ l r w j`。
- 10 非 r 单元音卡：`i ɪ ɛ æ ɑ ɔ ʊ u ʌ ə`。
- 5 双元音卡：`eɪ aɪ ɔɪ aʊ oʊ`。
- 2 r 音元音卡：重读 `/ɝ/`、非重读 `/ɚ/`。

具体约定：

1. 使用 `/ɛ/`；部分学习词典以 `/e/` 记录相应英语元音。采用美式宽式 `/i u ɑ ɔ/`，通常不附长度号。符号差异不自动意味着发音错误。
2. 辅音采用易读的宽式 `/r/`，常见实际美式音值接近 `[ɹ]`，不是要求颤舌。其他元音加 r 的序列（如 car、near、chair）由已学元音与 r 组合，不机械套用英式中心双元音清单。
3. `/ɝ/`、`/ɚ/` 可在其他词典写成 `/ɜr/`、`/ər/` 等形式；标法应与该词典的符号说明一起阅读。
4. **cot–caught 合并**：有些美式口音区分 `/ɑ/` 和 `/ɔ/`，有些合并。声音卡保留两个教学入口，题目明确接受合并与未合并的合理美式口音，不把这一地域差异直接标为错误。
5. `/æ/` 在鼻音前的变化、现代美式 `/u/` 舌位变化、dark l、t/d 轻拍、不明显释放等是实际发音变体。宽式词典音标不会记录每个细节；课程不将它们误作新增独立音位。
6. TTS 模型可能自然合并 `/ɑ ɔ/` 或使用轻拍。教学示例必须如实标注；需要音素级高精度教学时，应由语音教师审核示范声音及最小对立词对，不凭自动转写“正确”推断每个音素都达标。

## 核查的一手来源

### 发音与符号

- [Cambridge Dictionary：Pronunciation symbols](https://dictionary.cambridge.org/us/help/phonetics.html)：用于核对常见符号、US/UK 标法差异、重音符号和音节说明。课程选择单一的美式宽式记号，并说明其与 Cambridge 常见记法的对应关系。
- [Cambridge Dictionary：English Pronunciation](https://dictionary.cambridge.org/us/pronunciation/)：用于定义核实陌生词的操作流程——US 标签、音标、录音与词条语境并用。没有下载或重发该站音频。
- [University of Iowa：Sounds of Speech 项目说明](https://csi.its.uiowa.edu/our-work/sounds-speech)：美国英语元辅音发音部位、方式和可视化口腔动作的专业参照。当前课程提供文字动作说明，不声称取代其口腔动画或临床评估。
- [Iowa State University：-ed and -s/-’s Endings](https://iastate.pressbooks.pub/teachingpronunciation/chapter/chapter-5-ed-and-s-endings/)：用于核实词尾按末音而非末字母分组的教学方法。
- [British Council TeachingEnglish：Connected speech](https://www.teachingenglish.org.uk/professional-development/teachers/teaching-knowledge-database/c/connected-speech)：用于核实 linking、weak forms、elision 等概念。其泛英语教学例子并非全部直接转用为美式目标；本课程避免把英式 non-rhotic linking-r 规则套在美式上。

### 语法、词形与词义

- [Cambridge：A/an and the](https://dictionary.cambridge.org/grammar/british-grammar/a-an-and-the)：用于核实单数可数性前提、a/an 按紧随音素选择、hour/university 等例外字形。这里使用美英共有的基础规则。
- [Purdue OWL：Articles A versus An](https://owl.purdue.edu/owl/general_writing/grammar/articles_a_versus_an.html)：以美式大学写作教学资料交叉核实“按读音而非字母”的冠词原则。
- [Cambridge：Spelling](https://dictionary.cambridge.org/us/grammar/british-grammar/spelling_2)：用于核实 -s/-es、辅音+y、部分 -o/-f 词及其例外。
- [Cambridge：Nouns, form](https://dictionary.cambridge.org/de/grammatik/british-grammar/nouns-form)：用于核实常见复数词形，并强调词典确认不规则形式。
- [Cambridge：Word formation](https://dictionary.cambridge.org/uk/grammar/british-grammar/word-formation_2)：词缀、转类与合成词的分类参照。
- [British Council TeachingEnglish：Affixes](https://www.teachingenglish.org.uk/professional-development/teachers/teaching-knowledge-database/c/affixes)：用于支持以词缀辅助推測含义和词性，而不把推測当成确认。
- [British Council LearnEnglish：Perfect aspect](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/perfect-aspect)：用于核实从现在或过去参照点回看的完成体概念。
- [British Council LearnEnglish：Past perfect](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/past-perfect)：用于核实 had + 过去分词及两个过去事件的时间关系。

## 产品和评估边界

- **拼读不保证任意陌生词都读对。** 专有名词、借词、不规则拼写、同形异音词需要核对；同形词音频尽量用带时态或词性语境的完整短句消歧。
- **词素不保证准确猜到含义。** uncle、butterfly 等反例用于阻止机械拆词；最终词义要和上下文中的词典义项吻合。
- **词性与时态分开。** book 在不同句子中可以是名词或动词；has booked 是完整动词组的语法结构。单独的 -ing/-ed 后缀不决定整句时态。
- **a/an 是冠词。** 先看当前义项是否可数，再看紧接冠词的声音；中间形容词会影响选择。
- **自然语流不强制吞音。** 同化、略音、弱读和轻拍受语速、强调和语体影响。清晰的慢读先行，正式写作不机械替换为 wanna/gonna。
- **录音反馈须与实际分析能力一致。** 音量/时长检测、自动转写、人工回放对比与音素级评分是不同能力。没有音素级证据时，不能声称已经精确诊断舌位、每个元音或临床问题。
- **复习是主动回忆与迁移。** 保存具体错因、个人词卡与可理解的短句。间隔后用新的语境重练；答对一次与获得长期掌握不能画等号。

## 已执行的内容验证

生成时检查：阶段与课程数量；每阶段末课为 checkpoint；每课 3 概念和至少 6 题；所有阶段、课程、题目 ID 唯一；选择/听辨答案存在于选项中；听辨 `text` 为空且存在音频文本；排序题词块与答案词项相符；录音题 `answer === target`；每课录音题最多一题；41 声音卡均有 3 个例词。

内容验证不等于已审核所有模型音频。生成方法见 [语音方案](SPEECH-RESEARCH.md)，技术校验结果见 [音频校验记录](AUDIO-VERIFICATION.json)。
