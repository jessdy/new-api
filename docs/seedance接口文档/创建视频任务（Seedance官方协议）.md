# 创建视频任务（Seedance官方协议）

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/v3/contents/generations/tasks:
    post:
      summary: 创建视频任务（Seedance官方协议）
      deprecated: false
      description: >-
        Seedance 官方兼容创建入口。请求体与 `POST /v1/videos` 的 Seedance 参数相同，成功只返回 `{ "id":
        "task_xxx" }`。


        查询必须用 `GET /api/v3/contents/generations/tasks/{task_id}`，不要拿这个 ID 去查
        `/v1/videos/{task_id}` 再当官方格式用。


        2.0 与 2.5 的默认值、比例、时长和禁用字段不同，不要混用。


        错误响应中，code 用于识别错误类型，message 用于说明错误原因；参数错误可能附带 param，请求标识可用于联系支持排查。
      operationId: createSeedanceTask
      tags:
        - Seedance
        - Seedance
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required:
                - model
              description: >-
                `prompt` 与 `content` 至少提供一个。顶层标准字段优先于 metadata 中的同名字段。普通 2.5
                模型不支持 frames/fps
                变体、seed、camera_fixed、draft、service_tier；Seedance 售卖模型的输出 FPS 由
                Root 固定配置。首尾帧不能与 reference 媒体混用，last_frame 必须搭配 first_frame。2.0
                与 2.5 的其他约束详见各字段说明。
              properties:
                model:
                  type: string
                  description: >-
                    填写模型名称：AP Seedance-2.0 VIP、AP Seedance-2.0 标准版、AP
                    Seedance-2.0 轻量版、AP Seedance-2.0 高性价比版、AP Seedance-2.5
                    标准版。名称不带分辨率后缀；用 resolution 选择规格，支持的规格与价格见 /api/pricing。
                  example: AP Seedance-2.0 标准版
                prompt:
                  type: string
                  description: 与 content 至少提供一个。2.5 会转换为文本 content
                content:
                  type: array
                  minItems: 1
                  items:
                    type: object
                    required:
                      - type
                    properties:
                      type:
                        type: string
                        enum:
                          - text
                          - image_url
                          - video_url
                          - audio_url
                      text:
                        type: string
                        description: type=text 时填写
                      role:
                        type: string
                        enum:
                          - reference_image
                          - first_frame
                          - last_frame
                          - reference_video
                          - reference_audio
                      image_url:
                        type: object
                        properties:
                          url:
                            type: string
                            description: 公网 URL 或 asset://{asset_id}
                      video_url:
                        type: object
                        properties:
                          url:
                            type: string
                      audio_url:
                        type: object
                        properties:
                          url:
                            type: string
                    description: >-
                      每项只填写与 type 对应的 text/image_url/video_url/audio_url。2.0
                      参考素材：图片最多 9 张、视频最多 3 段、音频最多 3 段，可组合至 15 个媒体素材。2.5
                      参考素材：图片最多 30 张、视频最多 10 段、音频最多 10 段，可组合至 50 个媒体素材。文本不占媒体名额。
                  description: >-
                    2.0 全模态参考：图片最多 9 张、视频最多 3 段、音频最多 3 段，可组合至 15
                    个媒体素材；参考视频、参考音频各自总时长不超过 15 秒，音频参考须搭配至少一张图片或一段视频。2.5
                    全模态参考：图片最多 30 张、视频最多 10 段、音频最多 10 段，可组合至 50
                    个媒体素材；支持纯音频参考，参考视频、参考音频各自总时长不超过 30 秒，单个视频或音频至少 2
                    秒，视频编辑的参考视频至少 4 秒。文本不占媒体名额，因此 50 个媒体素材加一项文本可组成 51 项 content。
                resolution:
                  type: string
                  description: >-
                    目标输出规格，按 model 选择对应路线和价格。默认 720p；未提供该规格的模型须显式指定。2.0
                    标准版/轻量版：480p、720p；VIP：480p、720p、1080p、4k；高性价比版：1080p、4k；2.5
                    标准版：480p、720p、1080p。以 /api/pricing 当前可用规格为准。
                  example: 720p
                ratio:
                  type: string
                  description: >-
                    2.0：16:9/9:16/1:1/4:3/3:4。2.5 另支持 21:9、adaptive，默认
                    adaptive；首尾帧、edit、extend 必须 adaptive
                duration:
                  type: number
                  description: >-
                    2.0：正数秒，默认 5。2.5：-1（自动）或 4–30，默认 -1；edit 必须 -1。自动时长按 30
                    秒预授权，完成后按实际时长结算，多退少补
                seconds:
                  oneOf:
                    - type: string
                      pattern: ^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$
                    - type: number
                  description: duration 的兼容别名；顶层 duration 优先，数字和数字字符串均可
                width:
                  type: integer
                  minimum: 1
                  description: 兼容字段；通常优先使用 resolution + ratio
                height:
                  type: integer
                  minimum: 1
                  description: 兼容字段；通常优先使用 resolution + ratio
                framespersecond:
                  type: integer
                  minimum: 1
                  maximum: 240
                  description: >-
                    仅 Seedance 售卖模型：输出 FPS。可以省略；显式传入时必须与售卖模型固定配置一致，否则返回 400。普通
                    2.5 模型不支持该字段
                image:
                  type: string
                  description: 单图兼容字段，可传公网 URL、Base64 或 asset://{asset_id}
                images:
                  type: array
                  items:
                    type: string
                  description: 多图兼容字段
                generate_audio:
                  type: boolean
                  description: 2.5 默认 true；2.0 默认 false
                watermark:
                  type: boolean
                  default: false
                output_format:
                  type: string
                  enum:
                    - mp4
                    - mov
                  default: mp4
                seed:
                  type: integer
                  description: 仅 2.0
                service_tier:
                  type: string
                  description: 仅 2.0
                priority:
                  type: integer
                  minimum: 0
                  maximum: 9
                  default: 0
                  description: 仅 2.5
                character_id:
                  type: integer
                  format: int64
                  description: 单角色；不能与其他参考素材同传。官方兼容和 /v1/videos 都支持
                callback_url:
                  type: string
                  format: uri
                return_last_frame:
                  type: boolean
                  default: false
                  description: >-
                    仅 2.5；请求返回尾帧图片。结果为可长期访问的图片直链，访问时无需附加本平台的 Authorization
                    请求头；请完整保留 URL
                omni_reference_task_type:
                  type: string
                  enum:
                    - auto
                    - reference
                    - edit
                    - extend
                  default: auto
                  description: >-
                    仅 2.5。reference 需要参考媒体；edit 需要且只能有一个参考视频；extend
                    需要一个参考视频；无参考素材时不转发
                execution_expires_after:
                  type: integer
                  minimum: 3600
                  maximum: 259200
                  default: 172800
                  description: 仅 2.5，任务执行有效期（秒）
                safety_identifier:
                  type: string
                  maxLength: 64
                  description: 仅 2.5
                tools:
                  type: array
                  description: 仅 2.5，当前支持 [{"type":"web_search"}]
                  items:
                    type: object
                    required:
                      - type
                    properties:
                      type:
                        type: string
                        enum:
                          - web_search
                metadata:
                  type: object
                  additionalProperties: true
                  description: 扩展参数；顶层标准字段优先于 metadata 中的同名字段
                media_mode:
                  type: string
                  enum:
                    - first_frame
                    - first_last_frame
                    - start_end_frame
                    - last_frame
                  description: 兼容字段，用于为 images 自动分配首帧/尾帧角色。last_frame 需要同时提供首帧
      responses:
        '200':
          description: 公开任务 ID
          content:
            application/json:
              schema:
                type: object
                required:
                  - id
                properties:
                  id:
                    type: string
                    example: task_xxx
          headers: {}
          x-apifox-name: 成功
        '400':
          description: 请求参数或业务校验失败
          content:
            application/json:
              schema:
                type: object
                description: >-
                  错误响应。个人素材接口会同时返回 success=false 和 message；OpenAI/Seedance
                  入口主要使用 error 对象。
                additionalProperties: true
                properties:
                  success:
                    type: boolean
                    example: false
                  message:
                    type: string
                  error:
                    type: object
                    additionalProperties: true
                    properties:
                      code:
                        type: string
                        description: 稳定的机器可读错误码
                      message:
                        type: string
                      type:
                        type: string
                      param:
                        type: string
          headers: {}
          x-apifox-name: 错误 400
        '401':
          description: Token 缺失、无效或无权访问该资源
          content:
            application/json:
              schema:
                type: object
                description: >-
                  错误响应。个人素材接口会同时返回 success=false 和 message；OpenAI/Seedance
                  入口主要使用 error 对象。
                additionalProperties: true
                properties:
                  success:
                    type: boolean
                    example: false
                  message:
                    type: string
                  error:
                    type: object
                    additionalProperties: true
                    properties:
                      code:
                        type: string
                        description: 稳定的机器可读错误码
                      message:
                        type: string
                      type:
                        type: string
                      param:
                        type: string
          headers: {}
          x-apifox-name: 错误 401
        '502':
          description: 服务处理请求失败
          content:
            application/json:
              schema:
                type: object
                description: >-
                  错误响应。个人素材接口会同时返回 success=false 和 message；OpenAI/Seedance
                  入口主要使用 error 对象。
                additionalProperties: true
                properties:
                  success:
                    type: boolean
                    example: false
                  message:
                    type: string
                  error:
                    type: object
                    additionalProperties: true
                    properties:
                      code:
                        type: string
                        description: 稳定的机器可读错误码
                      message:
                        type: string
                      type:
                        type: string
                      param:
                        type: string
          headers: {}
          x-apifox-name: 错误 502
        '503':
          description: 视频服务暂不可用
          content:
            application/json:
              schema:
                type: object
                description: >-
                  错误响应。个人素材接口会同时返回 success=false 和 message；OpenAI/Seedance
                  入口主要使用 error 对象。
                additionalProperties: true
                properties:
                  success:
                    type: boolean
                    example: false
                  message:
                    type: string
                  error:
                    type: object
                    additionalProperties: true
                    properties:
                      code:
                        type: string
                        description: 稳定的机器可读错误码
                      message:
                        type: string
                      type:
                        type: string
                      param:
                        type: string
          headers: {}
          x-apifox-name: 错误 503
      security:
        - bearer: []
      x-apifox-folder: Seedance
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/8772616/apis/api-508215627-run
components:
  schemas: {}
  securitySchemes:
    BearerAuth:
      type: bearer
      scheme: bearer
      description: 'Authorization: Bearer <NEWAPI_TOKEN>'
    bearer:
      type: http
      scheme: bearer
servers: []
security: []

```