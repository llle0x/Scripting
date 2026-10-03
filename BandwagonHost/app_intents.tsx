import { AppIntentManager, AppIntentProtocol, Widget } from "scripting";
import { debug } from "./service";

// 普通 AppIntent 在小组件后台执行，不打开脚本页面，不携带任何凭据。
export const RefreshWidgetIntent = AppIntentManager.register({
  name: "RefreshBandwagonHostWidget",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    debug("请求后台刷新小组件");
    // 由 widget.tsx 重新查询两个只读接口、更新缓存并渲染。
    // Intent 不重复请求 API，避免单次点击查询两遍。
    Widget.reloadAll();
  },
});
