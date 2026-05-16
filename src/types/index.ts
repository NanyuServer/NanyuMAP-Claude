// src/types/index.ts

export interface Location {
  id: number
  category: string
  detailInfo: string
  extraInfo: string | null
  x: number
  y: number
  createdAt: string
}

export interface RoadNode {
  id: number
  x: number
  y: number
}

export interface RoadEdge {
  id: number
  fromNode: number
  toNode: number
  distance: number
}

export interface RoadGraph {
  nodes: RoadNode[]
  edges: RoadEdge[]
}

export interface NavigationPath {
  nodes: RoadNode[]
  totalDistance: number
}

export interface SearchResult {
  id: number
  category: string
  detailInfo: string
  extraInfo: string | null
  x: number
  y: number
}

export const LOCATION_CATEGORIES = [
  '北门',
  '东南门',
  '教学楼A栋',
  '教学楼B栋',
  '教学楼C栋',
  '学术报告厅',
  '大操场',
  '风雨操场',
  '图书馆',
  '礼堂',
  '行政办公楼',
  '食堂',
  '女生公寓',
  '男生公寓',
  '网球场',
  '耕读园',
  '羽毛球场',
  '篮球场',
  '乒乓球场',
  '匹克球场',
] as const

export type LocationCategory = (typeof LOCATION_CATEGORIES)[number]
