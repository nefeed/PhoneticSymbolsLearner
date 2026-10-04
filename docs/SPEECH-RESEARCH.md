# 音记语音方案与验证记录

核验日期：2026-10-04（Asia/Shanghai）。本文区分已实现、已验证和后续验收项目。

当前构建包含 **345 条词句 + 41 条单音，共 386 个 MP3**，总计约 4.92 MB / 581.06 秒。课程文本、声音卡和30个核心词条覆盖零缺失；全部音频完成解码、非静音、时长与同形词输入检查。机器可读结果见 `docs/AUDIO-VERIFICATION.json`。人工听音审核尚未完成。

## 实际采用的朗读方案

使用本地 **Kokoro-82M v1.0** 神经语音模型，`lang_code=a`（美式英语）、`am_puck`（官方美式男声音色），速度 `0.90`。课程示范提前生成 MP3 文件并随站点部署；浏览器播放静态文件，不需要访客提供 API 密钥，也不会每次播放消耗云模型额度。模型权重不加入 Git 仓库。

音色选择目标是清晰、连贯、偏明亮的美式男声。官方没有对声音年龄作保证，不能把 `am_puck` 标签当作“年轻程度已验收”的证据。自然度、口音、最小对立词的可辨度仍需真实听音验收；这是 AI 合成音频，不标记为真人录音。

生成脚本为 `scripts/generate-audio.py`，Python 依赖在 `scripts/audio-requirements.txt`。它扫描 `content/*.json` 的 `audioText`、`target`、`word` 字段，去重后生成 24 kHz 单声道、64 kbps MP3。每条合成结果都会检查非空、有限采样值和最低振幅，保存时长与模型实际音素序列，并逐条更新 manifest 以支持断点重跑。

本次检查实际发现 Misaki 把 `I read every day.` 的 `read` 误判为过去式。生成器使用官方支持的内联音素覆盖语法，为课程里的 `read` 同形词逐句指定 `/riːd/` 或 `/rɛd/`，并保存 `synthesisInput` 与真正输入模型的音素序列；对照句中两个时态分别处理。校验脚本会拒绝仍使用旧覆盖规则的音频。

核心词库只合成 `content/core-words.json` 中的 `.word`，不朗读词典定义或例句。30个核心词去重后新增20条录音。孤立的 `read` 仅示范原形/现在时 `/riːd/`，对应 manifest 的中英文 `pronunciationNote` 明确指出过去式与过去分词用 `/rɛd/`；不能从单个播放按钮推断所有语境的读法。

`public/audio/manifest.json` 的 `clips` 按 `text.trim().replace(/\s+/g, ' ').toLowerCase()` 索引，每条含 `url`、`text`、`duration`、`phonemes`、`sources`。前端必须只将 manifest 命中的文件称为预生成男声。未收录的新单词可明确使用设备语音作为降级；其声音、口音和自然度依赖设备，不承诺与本音色一致。

```sh
uv venv .venv-audio --python 3.12
uv pip install --python .venv-audio/bin/python -r scripts/audio-requirements.txt
.venv-audio/bin/python scripts/generate-audio.py --list
.venv-audio/bin/python scripts/generate-audio.py
.venv-audio/bin/python scripts/generate-phonemes.py
.venv-audio/bin/python scripts/check-audio.py
```

Apple Silicon 可加 `--device mps`；CPU 是可复现的通用选项。初次运行会下载官方模型和英语语言资源，后续复用缓存。`--limit N` 可小批验收，`--text 'a new word'` 可追加素材。模型和生成工作目录必须保留在 `.gitignore` 内。

两个生成器共享 manifest，应依次运行。`check-audio.py` 检查课程文本覆盖、41声音卡覆盖、每个MP3解码、非静音及记录时长；不替代听音审核。

## 单音生成与音标教学的边界

单音采用 `scripts/generate-phonemes.py`，调用官方 `KPipeline.generate_from_tokens`，直接输入模型音素序列，绕过普通文本到发音转换。脚本为41张声音卡逐一提供映射，比如 `/eɪ/→ˈA`、`/aɪ/→ˈI`、`/oʊ/→ˈO`、`/tʃ/→ʧ`，美式 `/r/` 使用 `ɹ` 而非颤音。爆破音 `/p t k b d ɡ/` 不附加 `ə`。输入字符还会逐一对照实际模型词表。

顶层 `manifest.phonemes[sound.id]` 含 `url`、`symbol`、实际模型 `input`、`duration`、`kind: phoneme`、`reviewedByHuman: false`。这些音频称为“AI合成单音示范”，同时提供例词、口形、舌位、清浊和近音对比说明。不能把技术生成成功当作已经通过语音教师听审，也不能把普通文字 TTS 直接读出的 IPA 字符当作音素。

Kokoro 官方明确提示很短的片段可能较弱。因此孤立单词和最小对立组是重点抽检项目，不能仅因音频有波形就认定发音教学正确。语流中的弱读、同化等要结合整句音频讲解；不能承诺所有语境采用唯一发音。

## 云 API 实测结果

生成方案选择阶段使用已有授权的官方接口做过短请求验证，没有输出或复制凭证。最终交付的本地生成器与音频播放均不依赖云 API 密钥。

| 模型 | 实际测试 | 结果 |
| --- | --- | --- |
| `qwen3-tts-flash` + `Aiden` | 一条短英语 TTS 请求 | HTTP 403，`AllocationQuota.FreeTierOnly` |
| `qwen3-omni-flash` | 官方公开 WAV + 简短听写指令 | HTTP 400，`AllocationQuota.FreeTierOnly` |
| `qwen3.5-omni-plus` | 同一公开 WAV + 简短听写指令 | HTTP 400，`AllocationQuota.FreeTierOnly` |

服务端返回免费额度已耗尽，继续需要计费设置变更。没有启用付费、绑定支付方式、修改 free-tier-only 设置。上述失败不能作为已实现 AI 发音诊断的证据。Qwen 官方确实提供 `Aiden` 美式年轻男声，但本次没有用它生成成功的素材，界面不得声称用了 Aiden。

## 录音与教学反馈

用户明确同意本轮先忽略录音考核。当前不实施自动打分或上传录音；下文保留后续接入边界，不代表本轮交付。

可实现且无需云服务的基础能力：用户主动授权麦克风后录音、停止、回听、与示范音交替播放、查看对应口形与常见错误、自评并把待练词加入复习册。录音默认仅存在浏览器当前会话，跨设备进度同步不应暗中上传原始声音。

浏览器 SpeechRecognition（如可用）的文字匹配只能说明识别器听出了什么词，不能证明每个音素正确，也不能转换成“发音准确率”“标准音素评分”。噪声、口音、麦克风和浏览器支持都会影响结果。

当运营方明确配置可用云服务后，可加入“AI 口语建议”：必须先取得用户对这次上传的同意，在服务器保存密钥，限制音频时长与大小、频率和并发，并在请求失败时清楚显示不可用。建议浏览器先用 AudioContext 解码并输出单声道 PCM WAV，避免将未经验证的 `webm` 容器直接假设为支持。

官方 Qwen-Omni 请求形式（这是未来接入说明，本次不可用）：

```json
{
  "model": "qwen3-omni-flash",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "input_audio", "input_audio": {"data": "data:;base64,<WAV>", "format": "wav"}},
      {"type": "text", "text": "Target: ship. Listen to the audio. Give a cautious learning tip. Distinguish what you hear from uncertainty. Do not give a phoneme accuracy score."}
    ]
  }],
  "modalities": ["text"],
  "stream": true
}
```

使用已配置官方 `.../compatible-mode/v1/chat/completions`，服务器接收 SSE 并组装文字。AI 的听音意见属于教学参考，不能冒充经过校准的专用发音评测系统。真正的逐音素错误定位应另接经过验证的评测服务，并记录基于真实学习者样本的误报与漏报。

## 来源与许可

- [Kokoro 官方实现与推理示例](https://github.com/hexgrad/kokoro)：代码为 Apache-2.0。
- [Kokoro-82M 官方模型卡](https://huggingface.co/hexgrad/Kokoro-82M)：权重为 Apache-2.0。
- [官方声音说明](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)：美式音色列表、短文本限制、音质主观性。
- [Misaki 官方英语 G2P](https://github.com/hexgrad/misaki)：把文字转换为模型音素序列。
- [Qwen-TTS API](https://docs.qwencloud.com/api-reference/speech-synthesis/qwen-tts)：请求结构、临时下载地址与参数。
- [Qwen-TTS 声音列表](https://docs.qwencloud.com/developer-guides/speech/voice-list/qwen-tts)：Aiden 身份与模型适配范围。
- [Qwen 音频文件理解](https://docs.qwencloud.com/developer-guides/speech/multimodal-speech)：音频输入、Base64 和流式文本响应。

项目的非商业许可只覆盖项目自身有权许可的代码与原创内容，不能把第三方 Apache-2.0 代码或权重改成非商业许可。第三方组件及模型仍遵循各自许可。
