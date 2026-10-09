import { existsSync } from 'node:fs';
import { resolveMapConfig } from '../lib/map-config.ts';
const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config = resolveMapConfig(process.env);
console.log(`地图方案：${config.provider === 'cesium-ion' ? 'Cesium ion' : 'Google Maps 直连'}`);
if (!config.validProvider) {
  console.error('VITE_MAP_PROVIDER 只能填 cesium-ion 或 google-maps。');
  process.exitCode = 1;
} else if (!config.configured) {
  console.error(`尚未填写有效的 ${config.provider === 'cesium-ion' ? 'VITE_CESIUM_ION_ACCESS_TOKEN' : 'VITE_GOOGLE_MAPS_API_KEY'}，请编辑 app/.env.local。`);
  process.exitCode = 1;
} else {
  console.log('已检测到本地凭证（不显示内容）。本检查不请求地图，尚未验证凭证权限、余额或实际覆盖。');
  console.log('重启开发服务，然后在城市页面点击「加载实景 3D」。');
}
