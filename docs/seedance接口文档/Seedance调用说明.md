# Seedance 调用说明

# Seedance 2.0 / 2.5

**维护说明：Seedance v1 接口后续不再维护，请尽快迁移到 v3。新接入请直接使用 v3。**

两套创建/查询入口接收同一套请求体，**用哪个协议创建就用对应协议查询**。v1 的 `/v1/video/generations` 与 `/v1/videos` 是相同格式的入口，对应查询路径可互换。

| 格式 | 创建 | 查询 | 成功状态 | 视频地址 |
|---|---|---|---|---|
| 官方兼容 | `POST /api/v3/contents/generations/tasks` | `GET /api/v3/contents/generations/tasks/{task_id}` | `succeeded` | `content.video_url` |
| OpenAI Video | `POST /v1/videos` | `GET /v1/videos/{task_id}` | `completed` | `metadata.url` |

Seedance 的 OpenAI Video 创建成功码为 `202`；官方兼容创建成功码为 `200`。两条协议都在服务器接受任务后返回公开任务 ID。

新接入使用 v3 官方兼容接口。单角色 `character_id` 两条入口都支持，`resolution` / `ratio` 放在请求体顶层。

Seedance 售卖模型会固定输出 FPS，默认 24。调用方可省略 `framespersecond`；若显式传入，必须与售卖模型配置一致，否则返回 400。这里的 FPS 指最终输出视频 FPS，不是输入素材 FPS。普通 2.5 模型仍不接受 FPS 变体。

## 版本差异

| 项目 | 2.0 | 2.5 |
|---|---|---|
| 模型 | `AP Seedance-2.0 VIP` / `标准版` / `轻量版` / `高性价比版` | `AP Seedance-2.5 标准版` |
| 分辨率 | VIP：480p–4k；标准/轻量：480p/720p；高性价比：1080p/4k | 480p / 720p / 1080p，默认 720p |
| 比例 | 16:9 / 9:16 / 1:1 / 4:3 / 3:4 | 另加 21:9、`adaptive`，默认 `adaptive` |
| 时长 | 正数秒，默认 5 | `-1` 或 4–30，默认 `-1` |
| `seed` / `service_tier` | 支持 | 不支持 |

价格以 `GET /api/pricing` 为准。Seedance 新单按百万 token 计费：读取 `task_pricing.unit` 和 `price_unit_quantity`；`unit=token` 时 `*_unit_price` 为元/百万 token，不要按秒计算。官方兼容支持 `GET /api/v3/contents/generations/tasks` 列表与任务删除/取消；OpenAI Video 支持 `DELETE /v1/videos/{task_id}`。两条协议都没有 `/result`，成品统一通过 `GET /v1/videos/{task_id}/content` 获取并支持 Range。

## 素材库

`GET/POST /v1/virtual-characters`。官方角色 `scope=public&source_type=volc_preset`；私有素材 `volc_aigc`；真人先核验再上传肖像。多角色在 `content` 里写已登记的 `asset://{asset_id}`。

## 真人素材：从本人认证到生成视频

流程为：创建核验会话 → 本人扫码完成 H5 → 上传同一人的肖像 → 等待素材生效 → 创建视频 → 查询结果。**H5 认证成功与肖像素材审核通过是两个步骤。**

### 1. 准备 API 请求

服务地址为 `https://susciyuan.com`。以下接口路径均相对于该地址，`{session_id}`、`{character_id}`、`{task_id}` 表示需要替换的路径参数，可使用任意 HTTP 客户端或业务程序调用。

全部 API 请求携带 `Authorization: Bearer <API_KEY>` 请求头，并使用同一用户的 API Key；角色归属于这个用户。JSON 请求设置 `Content-Type: application/json`，文件上传使用 `multipart/form-data`。API Key 应保存在服务端配置或本地环境变量中，不要将真实 API Key、认证链接或真人照片保存为公开请求示例。

准备好由本人完成认证的手机，以及一张与被认证人一致的肖像图片。账号需要有可用的真人素材额度。可先发送 `GET /v1/virtual-characters?scope=private&source_type=volc_real_person`，读取 `data.real_person_used` 和 `data.real_person_limit`。

以下 JSON 均为调用示例，ID 请替换为接口实际返回值。素材和核验接口的响应数据位于 `data`；视频接口的任务 `id` 位于响应顶层。

### 2. 创建真人核验会话

发送 `POST /v1/virtual-characters/validation-sessions`，请求体为 JSON：

```json
{
  "name": "我的真人角色",
  "description": "本人授权的演示角色",
  "tags": ["演示"],
  "language": "zh"
}
```

成功后保存 `data.id` 为 `session_id`，保存 `data.character_id` 为 `character_id`，并立即保存 `data.launch_url`。会话查询不会重新提供有效的认证链接。`session_id` 是核验会话标识，`character_id` 是素材库角色数字 ID，两者不能互换。

例如使用 Bash/cURL 发起请求（`API_KEY` 为环境变量）：

```bash
curl --request POST \
  "https://susciyuan.com/v1/virtual-characters/validation-sessions" \
  --header "Authorization: Bearer ${API_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"name":"我的真人角色","description":"本人授权的演示角色","tags":["演示"],"language":"zh"}'
```

业务程序解析响应 JSON 后，应将这三个返回值与当前用户的认证流程关联保存，用于展示认证入口、查询状态和上传肖像。

### 3. 本人扫码认证，查询认证结果

将 `launch_url` 提供给肖像本人在手机打开，或在自己的应用中将此链接转换为二维码供本人扫描。不要使用第三方在线二维码服务处理认证链接，也不要把 API Key 交给扫码人。

当前会话有效期为 30 分钟，以返回的 `expires_at`（Unix 秒）为准。H5 中涉及的身份信息、活体核验和授权步骤由本人完成。完成后保留 H5 的正常返回流程，以便系统接收认证结果。

发送 `GET /v1/virtual-characters/validation-sessions/{session_id}`，检查 `data.status`：

- `pending`：仍在等待认证结果，或本人认证已通过、素材组结果仍在同步，可间隔几秒查询；不要因此重复创建会话。
- `succeeded`：认证成功，继续查询角色详情并上传照片。
- `failed`、`expired`、`cancelled`：终止当前轮询，查看 `last_error`，需要时重新创建会话。

尚未认证完成的预留角色可能不会出现在真人素材列表接口的结果中，应以会话查询为准。不要因为列表暂时为空而重复创建会话。

### 4. 上传已核验本人的肖像

先发送 `GET /v1/virtual-characters/{character_id}`。当 `data.validation_status` 为 `accepted`、`data.asset_upload_required` 为 `true` 时，发送：

`POST /v1/virtual-characters/{character_id}/asset`

请求体使用 `multipart/form-data`，文件字段名为 `file`，内容为本人肖像文件。由 HTTP 客户端的表单上传功能生成 multipart boundary 及对应的 `Content-Type` 请求头，不要将文件作为 JSON 字段发送。

支持 jpg/jpeg/png/webp/gif/heic，最大 30MB。一个真人素材只能成功提交一张肖像；重复上传返回 `asset_already_uploaded`。上传超时后应先查询详情，确认是否已提交成功，再决定是否重试。

Bash/cURL 示例（`API_KEY` 为环境变量，`CHARACTER_ID` 为认证成功后返回的角色数字 ID）：

```bash
curl --request POST \
  "https://susciyuan.com/v1/virtual-characters/${CHARACTER_ID}/asset" \
  --header "Authorization: Bearer ${API_KEY}" \
  --form "file=@./portrait.jpg"
```

成功提交返回 HTTP `201`。这只代表上传已受理，仍需查询素材状态。

### 5. 等待素材生效

继续查询角色详情；需要主动刷新时，可发送 `POST /v1/virtual-characters/{character_id}/sync`。建议查询间隔从 5 秒开始，长时间未完成时增加间隔；这只是客户端建议，不代表服务承诺的处理时间。

`asset_upload_required=true` 表示还需要上传，不能仅看到 `status=creating` 就判断正在审核。上传后 `asset_upload_required` 可能省略；省略不代表素材已经生效。

创建视频前确认以下条件：`data.status=active`、`data.validation_status=accepted`、`data.authorization.status=active`，并且 `data.provider_asset_id` 非空。失败或被阻止时，查看 `data.last_error` 和 `data.authorization.last_error`，停止自动提交视频。

### 6. 引用真人角色生成视频

最直接的方式是传 `character_id`。发送 `POST /v1/videos`，请求体为 JSON：

```json
{
  "model": "AP Seedance-2.5 标准版",
  "character_id": 123,
  "prompt": "画面中的人物面向镜头自然微笑并轻轻挥手，固定镜头，柔和光线。",
  "resolution": "480p",
  "ratio": "16:9",
  "duration": 4,
  "generate_audio": false
}
```

将 `123` 替换为自己的 `character_id`，在 JSON 中保持为数字类型。使用 `character_id` 时不要同时提供图片、视频、音频等其他参考素材。首次联调可先使用上述 4 秒、480p 示例，再测试其他规格。模型和规格应以账号实际可用项为准，生成视频会按当前价格计费。

接口返回 HTTP `202` 后，保存响应顶层 `id` 为 `task_id`。请求已受理不代表视频已生成。

如果需要组合多个已登记且有权使用的素材，可改用 `content` 中的 `asset://` 引用，且不再传 `character_id`。其中 `asset://` 后填写角色详情返回的 `provider_asset_id`，不要填写角色数字 ID、会话 ID 或组 ID。例如：

```json
{
  "model": "AP Seedance-2.5 标准版",
  "content": [
    { "type": "text", "text": "参考人物面向镜头自然微笑。" },
    {
      "type": "image_url",
      "image_url": { "url": "asset://替换为自己的provider_asset_id" },
      "role": "reference_image"
    }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 4,
  "generate_audio": false
}
```

每个真人引用都必须属于当前调用用户且授权有效。知道其他用户的 Asset ID 不代表有权使用。

### 7. 查询与下载视频

发送 `GET /v1/videos/{task_id}`。状态为 `completed` 时读取 `metadata.url`。视频地址为可长期访问的直链，可直接播放或下载，无需附加本平台的 Authorization 请求头；请完整保留 URL。 也可以通过带 Bearer 鉴权的 `GET /v1/videos/{task_id}/content` 获取视频。失败时读取任务错误信息，停止轮询并排查原因。

如果改用官方兼容接口创建，查询也使用对应的 `/api/v3/contents/generations/tasks/{task_id}`，成功状态为 `succeeded`，视频地址为 `content.video_url`。

### 8. 取消认证与撤回素材

尚未完成认证且不再需要时，调用 `DELETE /v1/virtual-characters/validation-sessions/{session_id}`，并检查 `data.cancelled`。不要用取消会话接口替代已生效素材的撤回。

需要撤回真人素材时，调用 `DELETE /v1/virtual-characters/{character_id}`。撤回会阻止后续生成请求，清理可能需要时间；不要对仍需保留的素材执行这个步骤。已生成的视频应按任务和文件的实际状态另行管理。

### 常见问题

- `real_person_disabled`：当前真人素材功能不可用，联系管理员检查开通情况。
- `character_limit_reached`：真人素材额度已满，检查未完成会话和现有素材。
- `validation_required`：尚未完成本人认证，应先查询核验会话。
- `asset_already_uploaded`：该真人素材已有肖像，查询现有素材状态。
- `authorization_invalid`：当前授权不允许上传，检查授权状态。
- `missing_file` / `invalid_file`：检查 form-data 的 `file` 字段、文件类型与大小。
- 查询不到其他用户的角色或会话：私有素材按账号隔离，应使用创建者的 API Key。
- H5 成功但无法出片：先确认已上传肖像，再确认素材与授权均为 `active`。
- 素材已生效，但创建视频返回 `500 server_error`：保存请求时间、模型、规格和错误响应，交由管理员排查；这不代表真人认证失效。避免反复提交，不要重新创建核验会话或重复上传肖像。

具体参数和响应结构以本分类下对应接口定义为准。本教程中的 ID、照片路径和请求体均为示例。
