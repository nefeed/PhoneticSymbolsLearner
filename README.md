# 音记 · Yinji

从一个声音开始，逐步学会读词、理解句子、自然连读。

音记是面向英文初学者的非商业学习应用。默认中文，可随时切换基础英文。项目名：**PhoneticSymbolsLearner**。

[打开音记](https://yinji-phonetics.nefeed.chatgpt.site) · [GitHub 仓库](https://github.com/nefeed/PhoneticSymbolsLearner) · [自动检查](https://github.com/nefeed/PhoneticSymbolsLearner/actions/workflows/ci.yml)

2026-10-04 已公开发布，Sites 返回部署成功；源码已推送。首次发布提交为 `4aa0f3776249f89f5ff8a6947051198e25701f2f`。后续提交及其自动检查以 GitHub 对应 SHA 的运行记录为准。生产账号登录和实机体验尚未人工验收。

## 你可以做什么

- 学完 **7 个阶段、42 课、126 个概念块和252道题**：声音基础、辅音、拼读、词义与词性、时态、冠词和复数、连读与综合复习。
- 在 **41 张声音卡**中听单音、看口型/舌位提示、对照例词；播放 **386 段预生成 AI 美式男声**（345 词句 + 41 单音）。
- 每课先讲解再练习，听辨、选择、排序、跟读相互结合；错误有完整解释，达到 80% 通过。跟读为自评，不计入自动分数。
- 用 ChatGPT 账号登录，在不同设备恢复继续位置、成绩、单词与错题；个人数据存于服务端 D1，按用户隔离。访客只在本次页面体验。
- 查询单词读音、词义和词性，添加自己的中文解释与笔记；内置 **30 个基础词条**提供简单解释，外部词条来自 Free Dictionary API / Wiktionary，可能包含不同口音和较难英文。
- 在复习册里翻卡、重练错题；错题间隔为 1、3、7、14、30 天。导出 Markdown / JSON，或通过浏览器打印另存 PDF。
- 在手机、平板、折叠屏内屏使用同一学习界面，题目内容区域可滚动，主要操作保持可达。

首页现在使用闯关路线：每章 6 关，通关收集星章并解锁下一关；已完成关卡可重练。电脑和 iPad 使用横屏式导航、关卡地图与当前任务布局；iPhone 收起常驻菜单，点击顶部菜单按钮后选择声音图鉴、单词和复习册。视觉采用紫色渐变、玻璃按钮与卡片、连续移动的选中透镜，并使用原创粗细流线 Logo。见 [闯关界面与验证说明](docs/UX-REDESIGN.md)。

**按用户确认，首版暂不做录音考核。** 可以主动录音、回听和对照示范；原始录音不上传、不保存到服务器。录音音量不是发音准确率。

英语拼写不能保证任意陌生词的发音或意思。课程教你用规律做推测，再结合词典和上下文核实；同一个词可有不同词性，时态要看句中的动词结构。

## 语音

课程语音由本地 Kokoro-82M `am_puck` 美式男声生成，不需要播放时调用付费 API。单音通过官方原始音素接口生成，避免直接朗读 IPA 字符；`read` 的现在/过去读法使用明确的音素覆盖。386 段素材的覆盖、解码和非静音检查通过，共 4,920,088 字节、581.06 秒；30 个基础词的词音已覆盖，释义正文未生成朗读。**尚未进行语音教师逐条人工听审**。未缓存的新单词使用设备声音，并在播放时标明。

详见 [语音方案](docs/SPEECH-RESEARCH.md)、[机器校验报告](docs/AUDIO-VERIFICATION.json) 与可复现的 `scripts/generate-audio.py`、`scripts/generate-phonemes.py`。

## 开发

需要 Node.js 22.13+（CI 使用 Node 24）。

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wise_morlocks.sql
npm run dev -- --port 5173
```

本地服务地址以终端实际输出为准。首次本地预览执行迁移；已有本地数据库不要重复执行同一迁移。回环地址上的开发登录是模拟账号，仅用于开发；公开部署使用 Sites 管理的真实登录，代码不自行信任浏览器提供的用户 ID。

```sh
npm run typecheck
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

2026-10-04 本地验证：`npm run typecheck` 通过，`npm test` **5 项通过**（含 30 个基础词的音频覆盖）。`tests/app.spec.ts` 首批 **9 个场景 × Chromium / WebKit = 18 项通过**（21.5 秒）；随后新增拼句场景在两引擎中 **另有 2 项通过**，验证选词、撤销及组成 `Please record a song.` 后判对。这是两批共 20 项通过，未声称已一次执行完整 20 项；远程 CI 以同 SHA 的 Actions 记录为准。首批覆盖第一课错题讲解与回练、静态音频响应、词条收藏/笔记、JSON 下载触发和打印样式、基础词 apple 查询，以及保存失败重试和接口访问边界。

跨浏览器上下文恢复使用本地模拟 SIWC 账号与复制的登录 cookie，证实服务器保存的当前题和答案可恢复，**未验证生产登录或真实设备间登录**。布局检查覆盖 402×874、820×1180、1180×820、792×900、360×740 五个 CSS 视口中的首页、第一课讲解与继续按钮；不等同于全部页面或实机测试。延迟麦克风授权释放使用模拟轨道验证，未验证真实麦克风录音回听。JSON 已验证导出的词条与中文笔记内容；Markdown 文件和多页 PDF 排版尚未完整验收。详见 [验收记录](docs/ACCEPTANCE.md)。

本轮闯关改版完整本地验证：类型检查、5 项单元/内容测试、26 项 Chromium/WebKit 浏览器测试全部通过（39.2 秒），覆盖手机弹出菜单、逐关解锁和恢复到后续章节的流程。

## 工程

Vinext / React + Cloudflare Workers + D1。Sites 管理公开部署、登录和数据库。静态音频随构建部署；云端个人记录使用不可缓存 API、参数化查询、服务端算分与幂等事件。

- [工程方案与数据设计](docs/ENGINEERING.md)
- [课程依据与发音约定](docs/CURRICULUM-SOURCES.md)
- [验收清单与已知边界](docs/ACCEPTANCE.md)
- [第三方说明](THIRD_PARTY_NOTICES.md)

`.openai/hosting.json` 是本部署的 Sites 身份和逻辑绑定。复制项目部署到自己的 Sites 时，使用自己创建的项目身份；不要向原站点推送。不要提交密钥、模型缓存、个人数据库或录音。

## 许可

本项目公开源代码，采用 [Yinji Source Available Non-Commercial License](LICENSE)：允许个人和非商业教育/研究、修改、保留许可后分发；**禁止商业使用、出售、商业 SaaS、付费培训和广告变现**。这不是 OSI 定义的开源许可。第三方依赖、模型和词典内容保留各自许可。
