# 查询 Seedance 素材库

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/virtual-characters:
    get:
      summary: 查询 Seedance 素材库
      deprecated: false
      description: 查询官方角色、私有素材或真人角色。只有 `status=active` 的角色能用于出片。真人角色还需有效授权且火山 Asset 正常。
      operationId: listVirtualCharacters
      tags:
        - Seedance
        - Seedance
      parameters:
        - name: scope
          in: query
          description: ''
          required: false
          schema:
            type: string
            enum:
              - public
              - private
            default: public
        - name: source_type
          in: query
          description: volc_preset=官方角色，volc_aigc=私有素材，volc_real_person=真人
          required: false
          schema:
            type: string
            enum:
              - volc_preset
              - volc_aigc
              - volc_real_person
        - name: status
          in: query
          description: ''
          required: false
          schema:
            type: string
            enum:
              - creating
              - active
              - blocked
              - offline
              - deleting
              - failed
        - name: keyword
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: gender
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: nationality
          in: query
          description: ''
          required: false
          schema:
            type: string
        - name: age_band
          in: query
          description: ''
          required: false
          schema:
            type: string
            enum:
              - 0-20
              - 20-40
              - 40-60
              - 60-80
              - 80-100
        - name: asset_type
          in: query
          description: ''
          required: false
          schema:
            type: string
            enum:
              - Image
              - Video
              - Audio
        - name: p
          in: query
          description: 页码，从 1 开始
          required: false
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: page_size
          in: query
          description: 每页条数，兼容别名 ps、size
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: 角色分页
          content:
            application/json:
              schema:
                type: object
                required:
                  - success
                  - data
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    required:
                      - page
                      - used
                      - limit
                      - real_person_used
                      - real_person_limit
                    properties:
                      page:
                        type: object
                        required:
                          - page
                          - page_size
                          - total
                          - items
                        properties:
                          page:
                            type: integer
                          page_size:
                            type: integer
                          total:
                            type: integer
                            format: int64
                          items:
                            type: array
                            items:
                              type: object
                              required:
                                - id
                                - scope
                                - source_type
                                - name
                                - status
                                - validation_status
                                - created_at
                                - updated_at
                              properties:
                                id:
                                  type: integer
                                  format: int64
                                scope:
                                  type: string
                                  enum:
                                    - public
                                    - private
                                source_type:
                                  type: string
                                  enum:
                                    - volc_preset
                                    - volc_aigc
                                    - volc_real_person
                                name:
                                  type: string
                                description:
                                  type: string
                                tags:
                                  type: array
                                  items:
                                    type: string
                                nationality:
                                  type: string
                                gender:
                                  type: string
                                age_min:
                                  type: integer
                                age_max:
                                  type: integer
                                occupation:
                                  type: string
                                temperament:
                                  type: string
                                status:
                                  type: string
                                  enum:
                                    - creating
                                    - active
                                    - blocked
                                    - offline
                                    - deleting
                                    - failed
                                validation_status:
                                  type: string
                                  enum:
                                    - unverified
                                    - accepted
                                    - rejected
                                asset_type:
                                  type: string
                                  enum:
                                    - Image
                                    - Video
                                    - Audio
                                provider_asset_id:
                                  type: string
                                asset_upload_required:
                                  type: boolean
                                cover_url:
                                  type: string
                                  format: uri
                                mime_type:
                                  type: string
                                file_size:
                                  type: integer
                                  format: int64
                                last_error:
                                  type: string
                                created_at:
                                  type: integer
                                  format: int64
                                  description: Unix 时间戳（秒）
                                updated_at:
                                  type: integer
                                  format: int64
                                  description: Unix 时间戳（秒）
                                catalog_version:
                                  type: string
                                authorization:
                                  type: object
                                  properties:
                                    status:
                                      type: string
                                      enum:
                                        - pending
                                        - synchronizing
                                        - active
                                        - ambiguous
                                        - provider_unavailable
                                        - expired
                                        - revoked
                                        - failed
                                    provider_group_status:
                                      type: string
                                    provider_asset_status:
                                      type: string
                                    provider_checked_at:
                                      type: integer
                                      format: int64
                                    authorized_at:
                                      type: integer
                                      format: int64
                                    revoked_at:
                                      type: integer
                                      format: int64
                                    last_error:
                                      type: string
                      used:
                        type: integer
                        description: 当前用户已使用的私有素材数量
                      limit:
                        type: integer
                        description: 当前用户私有素材额度
                      real_person_used:
                        type: integer
                        description: 已使用的真人素材数量
                      real_person_limit:
                        type: integer
                        description: 真人素材额度
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
      x-run-in-apifox: https://app.apifox.com/web/project/8772616/apis/api-508215453-run
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