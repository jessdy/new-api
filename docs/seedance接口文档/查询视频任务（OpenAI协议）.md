# 查询视频任务（OpenAI协议）

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/videos/{task_id}:
    get:
      summary: 查询视频任务（OpenAI协议）
      deprecated: false
      description: >-
        **维护说明：Seedance v1 接口后续不再维护，请尽快迁移到 v3。新接入请直接使用 v3。**


        实际路径是 `GET /v1/videos/{task_id}`。成功状态为 `completed`，视频地址在
        `metadata.url`，时长在
        `metadata.duration`（可选）。视频地址为可长期访问的下载直链，可直接播放或下载，无需附加本平台的 Authorization
        请求头；请完整保留 URL。 请求尾帧且尾帧可用时，图片地址在
        `metadata.last_frame_url`，为可长期访问的图片直链，无需附加本平台的 Authorization 请求头；请完整保留
        URL。`usage` 为可选的 token 用量信息，任务仅在视频结果与 token
        用量均就绪后返回成功；用量计算重试期间保持处理中，计算最终失败时返回失败状态，不返回视频或尾帧地址，也不可下载成片；completion_tokens
        与 total_tokens 相等，与官方兼容查询及成功回调中的用量信息一致。


        错误响应中，code 用于识别错误类型，message 用于说明错误原因；参数错误可能附带 param，请求标识可用于联系支持排查。
      operationId: getSeedanceOpenAIVideo
      tags:
        - Seedance
        - Seedance
      parameters:
        - name: task_id
          in: path
          description: 创建任务时返回的 id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 任务状态
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
                    description: 失败时返回
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
                        description: >-
                          视频地址为可长期访问的下载直链，可直接播放或下载，无需附加本平台的 Authorization
                          请求头；请完整保留 URL。
                      last_frame_url:
                        type: string
                        format: uri
                        description: 尾帧图片地址为可长期访问的图片直链，无需附加本平台的 Authorization 请求头；请完整保留 URL
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
          description: 任务 ID 或请求参数无效
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
        '404':
          description: 任务不存在或不属于当前用户
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true
          headers: {}
          x-apifox-name: 任务不存在
        '502':
          description: 查询任务失败
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
      x-run-in-apifox: https://app.apifox.com/web/project/8772616/apis/api-508215482-run
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