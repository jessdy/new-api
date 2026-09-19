# 列出视频任务（Seedance官方协议）

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/v3/contents/generations/tasks:
    get:
      summary: 列出视频任务（Seedance官方协议）
      deprecated: false
      description: 返回当前用户创建的任务快照，支持状态、模型和任务 ID 过滤。成功任务的 `content.video_url` 为可长期访问的下载直链。
      operationId: listSeedanceTasks
      tags:
        - Seedance
        - Seedance
      parameters:
        - name: filter.status
          in: query
          description: ''
          required: false
          schema:
            type: string
            enum:
              - queued
              - running
              - succeeded
              - failed
              - cancelled
        - name: filter.model
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: filter.task_ids
          in: query
          description: 可重复提交，也可用逗号分隔
          required: false
          schema:
            type: array
            items:
              type: string
        - name: filter.service_tier
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: page_size
          in: query
          description: ''
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 500
            default: 20
        - name: page_num
          in: query
          description: ''
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 500
            default: 1
      responses:
        '200':
          description: 当前用户的任务列表
          content:
            application/json:
              schema:
                type: object
                required:
                  - items
                  - total
                properties:
                  items:
                    type: array
                    items:
                      type: object
                      description: >-
                        任务配置字段在有值时返回。resolution、frames、framespersecond
                        在任务成功且最终视频参数可用时返回；暂不可用时省略，不以默认值代替。查询、任务列表及回调遵循相同规则。
                      additionalProperties: false
                      required:
                        - id
                        - status
                      properties:
                        id:
                          type: string
                        model:
                          type: string
                        status:
                          type: string
                          enum:
                            - queued
                            - running
                            - succeeded
                            - failed
                            - cancelled
                        duration:
                          type: number
                          description: 视频实际时长，单位为秒
                        resolution:
                          type: string
                        frames:
                          type: integer
                          format: int64
                          description: 最终视频的实际帧数，可用时返回
                        framespersecond:
                          type: number
                          description: 最终视频的实际平均帧率，可用时返回
                        priority:
                          type: integer
                        safety_identifier:
                          type: string
                        tools:
                          type: array
                          items:
                            type: object
                            additionalProperties: false
                            properties:
                              type:
                                type: string
                                enum:
                                  - web_search
                        output_format:
                          type: string
                          enum:
                            - mp4
                            - mov
                        content:
                          type: object
                          additionalProperties: false
                          properties:
                            video_url:
                              type: string
                              format: uri
                              description: >-
                                视频地址为可长期访问的下载直链，可直接播放或下载，无需附加本平台的 Authorization
                                请求头；请完整保留 URL。
                            last_frame_url:
                              type: string
                              format: uri
                              description: >-
                                请求 return_last_frame
                                且尾帧可用时提供。尾帧图片地址为可长期访问的图片直链，可直接访问，无需附加本平台的
                                Authorization 请求头；请完整保留 URL。
                        usage:
                          type: object
                          description: >-
                            任务的 token 用量信息。任务仅在视频结果与 token
                            用量均就绪后返回成功；用量计算重试期间保持处理中，计算最终失败时返回失败状态，不返回视频或尾帧地址，也不可下载成片。completion_tokens
                            表示输出 token 数，total_tokens 表示总 token
                            数；两者在视频任务中相等。查询与成功回调返回相同的用量信息。
                          additionalProperties: false
                          properties:
                            completion_tokens:
                              type: integer
                              format: int64
                            total_tokens:
                              type: integer
                              format: int64
                        error:
                          type: object
                          description: >-
                            失败时返回。创建、查询、任务列表与回调使用一致的错误说明：可公开的错误保留原始 code，message
                            使用中文，必要时提供 param
                            定位输入参数。未识别的错误码仍保留，说明使用中文兜底；无有效错误信息时返回
                            video_processing_failed。服务不可用时返回中文服务提示。request_id
                            可用于联系支持排障，未提供时请提供任务 id。
                          additionalProperties: false
                          properties:
                            code:
                              type: string
                              description: >-
                                机器可读错误码，例如
                                OutputVideoSensitiveContentDetected.PolicyViolation
                            message:
                              type: string
                              description: 中文错误说明；排障编号单独通过 request_id 返回
                            request_id:
                              type: string
                              description: >-
                                经过处理的排障编号，可提供给支持人员；不是视频任务
                                id。可用时返回，同一错误在查询、任务列表和回调中保持一致。
                            param:
                              type: string
                              description: 相关输入参数路径，例如 content[0].video_url；能确定时返回
                            type:
                              type: string
                              description: 可选的错误类型
                            category:
                              type: string
                              description: 可选的错误分类
                            retryable:
                              type: boolean
                              description: 明确提供时表示该错误是否允许重试；任务提交结果未知时不应盲目重复提交
                  total:
                    type: integer
                    format: int64
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
      security:
        - bearer: []
      x-apifox-folder: Seedance
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/8772616/apis/api-510573903-run
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