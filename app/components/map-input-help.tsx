"use client";
import {useId} from "react";
import {CircleHelp} from "lucide-react";
import {Popover,PopoverTrigger,PopoverContent} from "@/components/ui/popover";
import {useLocale} from "@/components/locale-provider";
import {type MapInputMode,readMapInputMode} from "@/lib/map-input";

export default function MapInputHelp({mode,onChange}:{mode:MapInputMode;onChange:(mode:MapInputMode)=>void}) {
  const {locale}=useLocale(),id=useId(),w=(zh:string,en:string)=>locale==="zh"?zh:en;
  return <Popover><PopoverTrigger aria-label={w("地图操作","Map gestures")} title={w("地图操作","Map gestures")}><CircleHelp size={18}/></PopoverTrigger>
    <PopoverContent side="left" align="end" sideOffset={10} collisionPadding={12} className="map-input-help" aria-labelledby={id}>
      <h2 id={id}>{w("地图操作","Map gestures")}</h2>
      <label>{w("输入设备","Input device")}<select value={mode} onChange={e=>onChange(readMapInputMode(e.target.value))}>
        <option value="auto">{w("自动识别","Auto detect")}</option><option value="trackpad">{w("触控板","Trackpad")}</option><option value="mouse">{w("鼠标","Mouse")}</option>
      </select></label>
      <dl><dt>{w("平移","Pan")}</dt><dd>{w("双指滑动，或按住左键拖动","Slide two fingers, or drag with the left button")}</dd>
        <dt>{w("缩放","Zoom")}</dt><dd>{w("双指捏合，或滚动鼠标滚轮","Pinch, or use the mouse wheel")}</dd>
        <dt>{w("旋转","Rotate")}</dt><dd>{w("Shift + 双指左右滑动，或 Ctrl + 拖动","Shift + two-finger swipe, or Ctrl + drag")}</dd></dl>
      <p>{w("支持原生旋转手势的浏览器也可双指拧转。若自动识别不准，可在上方选择设备。","Browsers with native rotation gestures also support a two-finger twist. Choose a device above if auto detection feels wrong.")}</p>
    </PopoverContent>
  </Popover>;
}
