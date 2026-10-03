import { Widget } from "scripting";
import { loadConfig, loadData, hasCredentials, debug, Result } from "./service";
import { createWidget } from "./views";

async function main() {
  const config = loadConfig();
  const unconfigured = !hasCredentials(config);
  debug(`Widget Family ${Widget.family}`);
  // Widget 入口永远不弹出对话框。
  const result: Result = unconfigured
    ? { data: null, cached: false, timestamp: 0, error: null, warning: null }
    : await loadData(config);
  Widget.present(createWidget(config, result, Widget.family, unconfigured, Widget.displaySize), {
    policy: "after",
    date: new Date(Date.now() + config.refreshMinutes * 60000),
  });
  // Widget.present 后上下文销毁，不能在后面执行保存等操作。
}

// Scripting 的 Widget 入口同样不使用顶层 await。
main();
