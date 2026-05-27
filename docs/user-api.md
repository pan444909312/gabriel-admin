# 用户接口文档

> Base URL: `http://localhost:9079`

---

## 1. 用户登录

**POST** `/api/gabriel/user/login`

**Content-Type:** `application/json`

### 请求参数

| 字段     | 类型   | 必填 | 说明   |
| -------- | ------ | ---- | ------ |
| username | String | 是   | 用户名 |
| password | String | 是   | 密码   |

### 请求示例

```json
{
  "username": "User01",
  "password": "123456"
}
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjMsInVzZXJOYW1lIjoiVXNlcjAxIiwic3ViIjoiVXNlcjAxIiwiaWF0IjoxNzE2NzAwMDAwLCJleHAiOjE3MTY3MDcyMDB9.xxxxx",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjMsInVzZXJOYW1lIjoiVXNlcjAxIiwic3ViIjoiVXNlcjAxIiwiaWF0IjoxNzE2NzAwMDAwLCJleHAiOjE3MTczMDQ4MDB9.xxxxx"
  }
}
```

### 错误响应

| code | message          | 说明                     |
| ---- | ---------------- | ------------------------ |
| 500  | 用户名或密码错误 | 用户名不存在或密码不匹配 |
| 500  | 账号已被禁用     | 用户状态为禁用           |

### 备注

- token 有效期：2 小时
- refreshToken 有效期：7 天
- token payload 包含字段：`userId`、`userName`、`sub`（用户名）、`iat`、`exp`

---

## 2. 获取用户信息

**GET** `/api/gabriel/user/getUserInfo`

### 请求参数（Query）

| 字段   | 类型 | 必填 | 说明   |
| ------ | ---- | ---- | ------ |
| userId | Long | 是   | 用户ID |

### 请求示例

```
GET /api/gabriel/user/getUserInfo?userId=3
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "userId": "3",
    "userName": "User01",
    "roles": ["R_USER_COMMON"],
    "buttons": ["B_CODE3"]
  }
}
```

### 响应字段说明

| 字段     | 类型     | 说明             |
| -------- | -------- | ---------------- |
| userId   | String   | 用户ID           |
| userName | String   | 用户名           |
| roles    | String[] | 角色编码列表     |
| buttons  | String[] | 按钮权限编码列表 |

### 错误响应

| code | message    | 说明                    |
| ---- | ---------- | ----------------------- |
| 500  | 用户不存在 | userId 对应的用户不存在 |
