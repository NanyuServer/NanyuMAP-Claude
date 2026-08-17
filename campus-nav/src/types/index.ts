// src/types/index.ts

export type NavigationStart =
  | { type: 'category'; value: string }
  | { type: 'coords'; x: number; y: number }
  | { type: 'current' }
  | null

export interface SearchResult {
  id: number
  category: string
  detailInfo: string
  extraInfo: string | null
  x: number
  y: number
  floor?: number | null
}

export const NAV_START_POINTS: Record<string, readonly string[]> = {
  junior: ['北门', '东南门'],
  senior: ['大门', '一楼', '二楼', '三楼', '四楼', '五楼'],
}

export interface NavCampusSettings {
  startPoints: Record<string, boolean>
  useCurrentLocation: boolean
  /** 是否允许“在地图上点击位置作为起点” */
  allowClickStart: boolean
  geo: { originLat: number; originLng: number; metersPerWidth: number } | null
}

export interface NavGlobalSettings {
  junior: NavCampusSettings
  senior: NavCampusSettings
}

export const DEFAULT_NAV_SETTINGS: NavGlobalSettings = {
  junior: {
    startPoints: { 北门: true, 东南门: true },
    useCurrentLocation: false,
    allowClickStart: true,
    geo: null,
  },
  senior: {
    startPoints: { 大门: true, 一楼: false, 二楼: false, 三楼: false, 四楼: false, 五楼: false },
    useCurrentLocation: false,
    allowClickStart: true,
    geo: null,
  },
}

export const LOCATION_CATEGORIES: Record<string, readonly string[]> = {
  junior: [
    '北门', '东南门', '教学楼A栋', '教学楼B栋', '教学楼C栋',
    '学术报告厅', '大操场', '风雨操场', '图书馆', '礼堂',
    '行政办公楼', '食堂', '女生公寓', '男生公寓', '网球场',
    '耕读园', '羽毛球场', '篮球场', '乒乓球场', '匹克球场',
    '公能广场', '器材室和健身中心',
  ],
  senior: [
    '大门', '一楼', '二楼', '三楼', '四楼', '五楼', '教学楼', '行政楼', '食堂', '宿舍', '操场', '报告厅', '图书馆',
  ],
}

export type LocationCategory = string

export const FLOOR_BUILDINGS: Record<string, number[]> = {
  '教学楼A栋': [0, 1, 2, 3, 4, 5],
  '教学楼B栋': [0, 1, 2, 3, 4, 5],
  '教学楼C栋': [0, 1, 2, 3, 4, 5],
  '行政办公楼': [0, 1, 2, 3],
  '礼堂': [1, 2],
  '学术报告厅': [0, 1],
  '图书馆': [1, 2, 3, 4],
  '大门': [1],
  '一楼': [1],
  '二楼': [2],
  '三楼': [3],
  '四楼': [4],
  '五楼': [5],
}

export const DEFAULT_FLOORS: Record<string, number> = {
  '耕读园': 1,
  '大门': 1,
  '一楼': 1,
  '二楼': 2,
  '三楼': 3,
  '四楼': 4,
  '五楼': 5,
}

export const BUILDING_CATEGORY_MAP: Record<string, string> = {
  '教学楼A栋': 'teaching_a',
  '教学楼B栋': 'teaching_b',
  '教学楼C栋': 'teaching_c',
  '礼堂': 'teaching_c',
  '行政办公楼': 'admin',
}

export const STAIRCASE_BUILDING_OPTIONS = [
  { label: '无（地面通用）', value: '' },
  { label: '教学楼A栋楼梯点', value: 'teaching_a' },
  { label: '教学楼B栋楼梯点', value: 'teaching_b' },
  { label: '教学楼C栋楼梯点', value: 'teaching_c' },
  { label: '行政楼楼梯点', value: 'admin' },
] as const

export const ROAD_TYPE_OPTIONS: Record<string, readonly { label: string; value: string }[]> = {
  junior: [
    { label: '默认道路', value: 'default' },
    { label: '行政楼内部路', value: 'admin_internal' },
    { label: '教学楼内部路', value: 'teaching_internal' },
  ],
  senior: [
    { label: '默认道路（平地）', value: 'default' },
    { label: '楼梯道路', value: 'staircase' },
  ],
}

export const SLOPE_ROAD_TYPE_OPTIONS: readonly { label: string; value: string }[] = [
  { label: '默认坡度路', value: 'slope_default' },
  { label: '行政楼内部坡度路', value: 'slope_admin_internal' },
  { label: '教学楼内部坡度路', value: 'slope_teaching_internal' },
]

export const STAIRCASE_FLOOR_LABELS = (floors: number[]): string => {
  if (floors.length >= 2) return `连接${floors[0]}楼和${floors[1]}楼`
  return ''
}

export const ROAD_TYPE_PRIORITY_MAP: Record<string, { weight: number; buildingCategories: string[] }> = {
  admin_internal: { weight: 0.4, buildingCategories: ['admin'] },
  teaching_internal: { weight: 0.4, buildingCategories: ['teaching_a', 'teaching_b', 'teaching_c'] },
  slope_admin_internal: { weight: 0.4, buildingCategories: ['admin'] },
  slope_teaching_internal: { weight: 0.4, buildingCategories: ['teaching_a', 'teaching_b', 'teaching_c'] },
}
