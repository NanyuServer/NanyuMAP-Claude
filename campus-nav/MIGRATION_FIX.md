# 修复 Road Edge 创建错误

## 问题
当在admin管理端点击两个点创建道路时，系统报错：
```
invalid 'prisma.roadEdge.create()' invocation:
The column `isTrunk` does not exist in the current database.
```

## 原因
Prisma schema 中定义了 `isTrunk` 字段，但数据库中缺少这个列。

## 解决方案

### 方案1：运行 Prisma 迁移（推荐）
执行以下命令将迁移应用到数据库：

```bash
# 安装依赖（如果还未安装）
npm install

# 应用 Prisma 迁移
npm run db:push
```

这将自动执行以下SQL语句：
```sql
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "is_trunk" BOOLEAN NOT NULL DEFAULT false;
```

### 方案2：直接执行 SQL（如果无法使用 npm）
连接到你的 Neon PostgreSQL 数据库并执行以下SQL：

```sql
ALTER TABLE "road_edges" ADD COLUMN IF NOT EXISTS "is_trunk" BOOLEAN NOT NULL DEFAULT false;
```

## 临时修复
API route 已被修改以优雅地处理 `isTrunk` 列缺失的情况。即使在迁移完全应用之前，道路创建功能也应该能够工作。

## 迁移文件
新的迁移文件已创建在：
- `prisma/migrations/20240521000000_add_is_trunk_column/migration.sql`

迁移将在下次运行 `npm run db:push` 时自动应用。
