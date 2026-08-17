# 南渝中学校园智能导航系统

基于 Next.js 15 + TypeScript + Prisma + PostgreSQL 的生产级校园导航系统。支持初中部与高中部双校区，提供 A\* 路径规划、楼层导航、主干道路优先等高级功能。

## 功能特性

- 🗺️ **交互式校园地图** — 双校区切换（初中部 / 高中部），支持平移、缩放、地点标注
- 🔍 **智能模糊搜索** — 基于编辑距离算法，支持地点名称、功能描述等多维度搜索
- 🧭 **A\* 路径规划** — 基于真实道路网络的导航，支持跨楼层路径
- 🏢 **楼层导航** — 楼梯节点/楼梯道路自动识别，0 楼→N 楼自动规划上楼路径
- 🛣️ **双导航模式** — 最近路线优先 / 主干道路优先，主干超出最短距离自动回退并提示
- 🛠️ **后台管理系统** — 地点增删改查、批量新增、批量设置楼层、道路网络可视化编辑
- 🔐 **JWT 认证** — bcrypt 加密 + HttpOnly Cookie，安全管理员登录
- 📱 **响应式设计** — 桌面端与移动端独立适配，毛玻璃 UI 风格
- ✨ **动画效果** — Framer Motion 过渡动画、流动箭头路径指示、呼吸光效节点

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15 App Router + TypeScript |
| 样式方案 | Tailwind CSS |
| 动画 | Framer Motion + CSS Keyframes |
| 状态管理 | Zustand |
| 数据库 | Neon PostgreSQL + Prisma ORM |
| 认证 | JWT (jose) + bcryptjs |
| 寻路算法 | A\* + 跨楼层 A\* |
| 部署 | Vercel |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key"
```

> 从 [neon.tech](https://neon.tech) 获取 Neon 数据库连接字符串。

### 3. 初始化数据库

```bash
npx prisma db push    # 推送 Schema 到数据库
npm run db:seed       # 创建默认管理员账号
```

### 4. 放置校园地图

将地图文件放入 `public/assets/`：

| 文件 | 说明 | 尺寸 |
|------|------|------|
| `map.webp` | 初中部地图 | 1560 × 1008 |
| `map2.webp` | 高中部地图 | 1536 × 1024 |

### 5. 启动开发服务器

```bash
npm run dev
```

访问：
- **前台地图**：http://localhost:3000
- **后台管理**：http://localhost:3000/admin
  - 默认账号：`admin` / `admin123456`

## 数据库表结构

```prisma
model Location {
  id         Int      @id @default(autoincrement())
  category   String                       // 一级地点类型
  detailInfo String   @map("detail_info") // 详细名称
  extraInfo  String?  @map("extra_info")  // 补充说明（搜索用）
  x          Float                        // 地图横坐标 0–100
  y          Float                        // 地图纵坐标 0–100
  campus     String   @default("junior")  // junior / senior
  floor      Int?                         // null=地面
  createdAt  DateTime @default(now())
}

model RoadNode {
  id               Int      @id @default(autoincrement())
  x                Float
  y                Float
  campus           String   @default("junior")
  isStaircase      Boolean  @default(false) @map("is_staircase")
  staircaseFloors  String   @default("[]")  @map("staircase_floors")
  buildingCategory String?  @map("building_category")
}

model RoadEdge {
  id       Int      @id @default(autoincrement())
  fromNode Int      @map("from_node")
  toNode   Int      @map("to_node")
  distance Float
  isTrunk  Boolean  @default(false)
  campus   String   @default("junior")
  floors   String   @default("[]")
  roadType String   @default("default") @map("road_type")
}

model AdminUser {
  id           Int    @id @default(autoincrement())
  username     String @unique
  passwordHash String @map("password_hash")
}
```

## Neon SQL Editor 完整迁移 SQL

```sql
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "campus" TEXT NOT NULL DEFAULT 'junior';
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "floor" INTEGER;
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "campus" TEXT NOT NULL DEFAULT 'junior';
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "is_staircase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "staircase_floors" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "road_nodes" ADD COLUMN IF NOT EXISTS "building_category" TEXT;
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "campus" TEXT NOT NULL DEFAULT 'junior';
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "is_trunk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "floors" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "road_type" TEXT NOT NULL DEFAULT 'default';
```

## 后台管理指南

### 地点管理 (`/admin/locations`)

1. **校区选择**：右上角下拉切换「初中部」/「高中部」
2. **新增地点**：选择类型 → 填写详细信息 → 点击地图选点 → 保存
3. **批量新增**：绿色按钮，适合一次添加多个同类地点
4. **批量设置楼层**：橙色按钮，勾选地点后统一设置楼层
5. **一级地点管理**：可增删改地点分类，初中部与高中部分开管理

### 道路网络编辑 (`/admin/roads`)

**初中部道路类型**：默认道路 | 行政楼内部路 | 教学楼内部路 | 主干道（黄色）

**高中部道路类型**：默认道路（平地）| 楼梯道路（需设置连接 X 楼和 Y 楼）

**操作模式**：添加节点 / 创建路径 / 删除路径 / 删除节点 / 拖拽移动

**上楼点设置（初中部）**：编辑节点 → 勾选「标记为上楼点」→ 选择楼层 → 选择建筑分类

## 寻路算法说明

### 导航模式

| 模式 | 主干道权重 | 逻辑 |
|------|-----------|------|
| 最短路线优先 | ×0.6 | 适度倾斜主干道 |
| 主干道路优先 | ×0.02 | 极度倾向主干道 |
| 自动回退 | — | 主干距离 > 最短距离 ×1.5 → 弹出提示切换 |

### 初中部楼层导航
1. 查找距离目的地最近、建筑分类匹配的楼梯节点
2. 路径强制经过该楼梯（忽略最短/主干优先）
3. 标签：0→1 楼标"上楼梯"，其余标"上 X 楼"

### 高中部楼层导航
1. 楼梯道路 (`roadType=staircase`) 作为跨楼层通道
2. 遍历"连接 X 楼和 Y 楼"数据实现楼层过渡
3. 标签："上到 X 楼" / "下到 X 楼"

## 项目结构

```
src/
├── types/
│   ├── index.ts                  # 全局类型、地点分类、楼层/建筑配置
│   └── navigation.ts             # NavigationNode, NavigationEdge, StaircaseEvent
├── store/
│   └── mapStore.ts               # Zustand 全局状态
├── lib/
│   ├── prisma.ts                 # Prisma 单例
│   ├── auth.ts                   # JWT 认证
│   ├── astar.ts                  # A* + 跨楼层 A*
│   └── roadEdges.ts              # 道路兼容性查询
├── components/
│   ├── admin/AdminShell.tsx      # 后台侧边栏 + 鉴权
│   └── map/
│       ├── CampusMap.tsx         # 主地图（平移/缩放/路径渲染）
│       ├── CampusMapClient.tsx   # 客户端入口（禁用 SSR）
│       ├── CampusSwitchPin.tsx   # 校区切换 Pin
│       ├── DestinationCard.tsx   # 导航目的地卡片
│       ├── LocationPin.tsx       # 地点标记（缩放阻尼 0.5x）
│       ├── Navbar.tsx            # 桌面端导航栏
│       ├── NavigationOverlay.tsx # Canvas 路径 + 流动箭头 + 楼梯标签
│       ├── SearchBar.tsx         # 模糊搜索框
│       └── StartModal.tsx        # 出发点 + 路线模式切换
├── app/
│   ├── layout.tsx/page.tsx       # 根布局 & 首页
│   ├── admin/
│   │   ├── login/page.tsx        # 登录页
│   │   ├── locations/page.tsx    # 地点管理
│   │   └── roads/page.tsx        # 道路网络编辑
│   └── api/
│       ├── auth/login|logout|verify/
│       ├── locations/ & [id]/ & bulk/ & bulk-floor/
│       ├── search/
│       ├── roads/
│       ├── categories/
│       └── navigation/
```

## API 参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/locations?campus=` | GET | 按校区获取地点 |
| `/api/locations` | POST | 新增地点（需认证） |
| `/api/locations/[id]` | PUT/DELETE | 编辑/删除（需认证） |
| `/api/locations/bulk` | POST | 批量新增（需认证） |
| `/api/locations/bulk-floor` | PUT | 批量设置楼层（需认证） |
| `/api/search?q=&campus=` | GET | 模糊搜索 |
| `/api/roads?campus=` | GET | 获取节点和边 |
| `/api/roads` | POST | 管理道路（需认证） |
| `/api/navigation` | POST | A\* 导航（routeMode: shortest/trunk） |
| `/api/categories` | GET/POST | 分类管理 |
| `/api/auth/login\|logout\|verify` | POST/POST/GET | 认证 |

### 导航 API 示例

**请求**：
```json
POST /api/navigation
{ "start": "北门", "destinationId": 42, "campus": "junior", "routeMode": "trunk" }
```

**响应**：
```json
{
  "path": [{ "id": -1, "x": 12.5, "y": 88.3, "campus": "junior" }],
  "totalDistance": 342.5,
  "staircaseEvents": [{ "nodeId": 15, "x": 45.2, "y": 60.1, "fromFloor": 0, "toFloor": 1 }],
  "fallbackToShortest": false
}
```

## Vercel 部署

1. 推送代码到 GitHub
2. 在 Vercel 导入项目，添加环境变量（`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`）
3. 部署后执行 `npx prisma db push && npm run db:seed`

## 修改管理员密码

```bash
npx tsx -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
bcrypt.hash('你的新密码', 12).then(hash => {
  return prisma.adminUser.update({ where: { username: 'admin' }, data: { passwordHash: hash } });
}).then(() => { console.log('密码已更新'); prisma.\$disconnect(); });
"
```

## License

MIT
