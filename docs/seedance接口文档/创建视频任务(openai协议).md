# 创建视频任务（OpenAI协议）

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/videos:
    post:
      summary: 创建视频任务（OpenAI协议）
      deprecated: false
      description: >-
        **维护说明：Seedance v1 接口后续不再维护，请尽快迁移到 v3。新接入请直接使用 v3。**


        实际路径是 `POST /v1/videos`。请求体与 Seedance 官方兼容入口相同；服务器接受任务后返回 202 与 OpenAI
        Video 对象（`status=queued`）。查询必须用 `GET /v1/videos/{task_id}`，成功状态为
        `completed`，视频地址在 `metadata.url`。


        `prompt` 与 `content` 至少提供一个。2.5 默认
        resolution=720p、ratio=adaptive、duration=-1、generate_audio=true、watermark=false、output_format=mp4。普通
        2.5 模型不支持 frames/fps 变体、seed、camera_fixed、draft、service_tier；Seedance
        售卖模型的输出 FPS 由 Root 固定配置。


        `usage` 为可选的 token 用量信息，任务仅在视频结果与 token
        用量均就绪后返回成功；用量计算重试期间保持处理中，计算最终失败时返回失败状态，不返回视频或尾帧地址，也不可下载成片。查询与成功回调返回相同的用量信息。


        错误响应中，code 用于识别错误类型，message 用于说明错误原因；参数错误可能附带 param，请求标识可用于联系支持排查。
      operationId: createSeedanceOpenAIVideo
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
              properties:
                model:
                  type: string
                  description: >-
                    填写模型名称，例如 AP Seedance-2.0 标准版、AP Seedance-2.5 标准版。名称不带分辨率，用
                    resolution 选择规格；可用规格与价格见 /api/pricing。
                  example: AP Seedance-2.0 标准版
                prompt:
                  type: string
                  description: 与 content 至少提供一个
                content:
                  type: array
                  minItems: 1
                  maxItems: 50
                  description: 2.5 最多 50 项，其中图片 30、视频 10、音频 10
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
                      role:
                        type: string
                        enum:
                          - reference_image
                          - first_frame
                          - last_frame
                          - reference_video
                          - reference_audio
                      text:
                        type: string
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
                resolution:
                  type: string
                  description: 目标输出规格，选择对应路线和价格。默认 720p；没有该档的模型须显式指定。可用规格见 /api/pricing。
                  example: 720p
                ratio:
                  type: string
                  description: 2.5 默认 adaptive；首尾帧、edit、extend 必须 adaptive
                duration:
                  type: number
                  description: >-
                    2.0 默认 5；2.5 为 -1 或 4–30，默认 -1；edit 必须 -1。自动时长按 30
                    秒预授权，完成后按实际时长结算
                seconds:
                  oneOf:
                    - type: string
                      pattern: ^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$
                    - type: number
                  description: duration 的兼容别名；顶层 duration 优先，数字和数字字符串均可
                width:
                  type: integer
                  minimum: 1
                height:
                  type: integer
                  minimum: 1
                framespersecond:
                  type: integer
                  minimum: 1
                  maximum: 240
                  description: >-
                    仅 Seedance 售卖模型：输出 FPS。可以省略；显式传入时必须与售卖模型固定配置一致，否则返回 400。普通
                    2.5 模型不支持该字段
                image:
                  type: string
                  description: 单图兼容字段，可传 URL、Base64 或 asset://{asset_id}
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
                callback_url:
                  type: string
                  format: uri
                return_last_frame:
                  type: boolean
                  default: false
                  description: >-
                    仅 2.5；请求返回尾帧图片。结果为带签名的临时直链，无需附加本平台的 Authorization 请求头；请完整保留
                    URL 参数，图片过期后可能不可用
                omni_reference_task_type:
                  type: string
                  enum:
                    - auto
                    - reference
                    - edit
                    - extend
                  default: auto
                  description: reference 需要参考媒体；edit 需要且只能有一个参考视频；extend 需要一个参考视频
                execution_expires_after:
                  type: integer
                  minimum: 3600
                  maximum: 259200
                  default: 172800
                  description: 仅 2.5，单位秒
                safety_identifier:
                  type: string
                  maxLength: 64
                  description: 仅 2.5
                tools:
                  type: array
                  items:
                    type: object
                    required:
                      - type
                    properties:
                      type:
                        type: string
                        enum:
                          - web_search
                  description: 仅 2.5
                metadata:
                  type: object
                  additionalProperties: true
                  description: 扩展参数；顶层标准字段优先
                media_mode:
                  type: string
                  enum:
                    - first_frame
                    - first_last_frame
                    - start_end_frame
                    - last_frame
                  description: 兼容字段，用于为 images 分配首尾帧角色；last_frame 需要首帧
                character_id:
                  type: integer
                  description: 单角色；不能与其他参考素材同传
      responses:
        '202':
          description: 任务已创建
          content:
            application/json:
              schema:
                type: object
                additionalProperties: false
                properties:
                  id:
                    type: string
                  task_id:
                    type: string
                  object:
                    type: string
                    example: video
                  status:
                    type: string
                    enum:
                      - queued
                      - in_progress
                      - completed
                      - failed
                  model:
                    type: string
                  progress:
                    type: integer
                  created_at:
                    type: integer
                    format: int64
                  completed_at:
                    type: integer
                    format: int64
                  error:
                    type: object
                    additionalProperties: false
                    properties:
                      message:
                        type: string
                      code:
                        type: string
                  metadata:
                    type: object
                    additionalProperties: false
                    properties:
                      url:
                        type: string
                        format: uri
                  usage:
                    type: object
                    additionalProperties: false
                    properties:
                      completion_tokens:
                        type: integer
                        format: int64
                      total_tokens:
                        type: integer
                        format: int64
          headers: {}
          x-apifox-name: 成功
        '400':
          description: 参数或业务校验失败
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true
          headers: {}
          x-apifox-name: 请求错误
        '401':
          description: Token 缺失或无效
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true
          headers: {}
          x-apifox-name: 未认证
        '502':
          description: 创建任务失败
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true
          headers: {}
          x-apifox-name: 服务错误
        '503':
          description: 服务暂不可用
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true
          headers: {}
          x-apifox-name: 服务不可用
      security:
        - bearer: []
      x-apifox-folder: Seedance
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/8772616/apis/api-508215480-run
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