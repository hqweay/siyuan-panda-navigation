export const scriptApiReference = {
  plugin: {
    description: "The Plugin instance. Used to access plugin state and lifecycle APIs.",
    properties: {
      app: "App instance containing plugins, elements, and UI state.",
      eventBus: "EventBus instance for listening to or emitting Siyuan events.",
      i18n: "I18n object containing current language strings.",
      data: "Plugin data object.",
      commands: "Array of registered commands.",
      name: "Plugin internal name/ID.",
      displayName: "Plugin display name."
    },
    methods: {
      loadData: "(path: string) => Promise<any> - Load data from plugin storage.",
      saveData: "(path: string, data: any) => Promise<void> - Save data to plugin storage.",
      openSetting: "() => void - Open the plugin setting panel.",
      addCommand: "(options: CommandOptions) => void - Register a command to the command palette.",
      removeData: "(path: string) => Promise<void> - Remove data from plugin storage.",
      addTab: "(options: ITabOptions) => () => Tab - Add a custom tab.",
      addDock: "(options: IDockOptions) => { config, model } - Add a dock panel.",
      addTopBar: "(options: ITopBarOptions) => HTMLElement - Add an icon to the top bar.",
      addStatusBar: "(options: IStatusBarOptions) => HTMLElement - Add an element to the status bar.",
      addIcons: "(svgs: string) => void - Add custom SVG icons.",
      getOpenedTab: "() => Record<string, Tab[]> - Get a list of opened tabs for this plugin."
    }
  },
  siyuan: {
    description: "The Siyuan SDK exposed by the 'siyuan' package.",
    methods: {
      fetchSyncPost: "(url: string, data?: any) => Promise<IWebSocketData> - Call a Siyuan REST/WebSocket API.",
      showMessage: "(msg: string, timeout?: number, type?: 'info'|'error') => void - Show a toast message.",
      openTab: "(options: IOpenTabOptions) => void - Open a document tab or custom tab.",
      getActiveTab: "() => Tab - Get the currently active Tab object.",
      globalCommand: "(id: string) => void - Execute a Siyuan internal command by its ID.",
      openMobileFileById: "(app: App, id: string, action?: string[]) => void - Open a file in the mobile UI.",
      confirm: "(title: string, text: string, confirmCb: () => void, cancelCb?: () => void) => void - Show a native confirm dialog.",
      getFrontend: "() => 'desktop'|'mobile'|'browser'|'desktop-window' - Get the current UI frontend environment.",
      openWindow: "(options: IOpenWindowOptions) => void - Open a new desktop window.",
      getAllTabs: "() => Tab[] - Get all tabs across all docks and editor.",
      getAllEditor: "() => Protyle[] - Get all editor instances.",
      getActiveEditor: "(wndActive?: boolean) => Protyle - Get the currently active editor instance.",
      lockScreen: "() => void - Lock the screen.",
      exitSiYuan: "() => void - Exit the application.",
      saveLayout: "(cb?: () => void) => void - Force save the current UI layout.",
      openSetting: "(app: App) => Dialog | undefined - Open the Siyuan global setting panel.",
      openEmoji: "(options: {element: HTMLElement, appendElement?: HTMLElement, callback: (emoji: string) => void}) => void - Open the emoji panel.",
      hideMessage: "() => void - Hide all messages.",
      getBackend: "() => 'windows'|'linux'|'darwin'|'docker'|'android'|'ios' - Get the backend OS."
    }
  },
  windowSiyuan: {
    description: "The global 'window.siyuan' object containing Siyuan runtime data.",
    properties: {
      config: "Global application configuration (appearance, editor, system, etc.).",
      layout: "Dock and tab layout information.",
      notebooks: "Array of opened notebooks.",
      user: "Current user profile and token information.",
      ws: "The global WebSocket connection instance.",
      languages: "Array of available languages.",
      menus: "Global menu management object.",
      dialogs: "Array of currently open dialogs.",
      zIndex: "Current maximum z-index for UI elements.",
      blockPanels: "Array of block panels (e.g., floating preview panels).",
      mobile: "Mobile specific data and states.",
      isPublish: "Whether the app is currently in publish mode."
    }
  },
  kits: {
    description: "The @frostime/siyuan-plugin-kits high-level toolkits. Extremely useful for document queries and UI dialogs.",
    methods: {
       confirmDialog: "(args: {title: string, content: string|HTMLElement, confirm?: (ele?) => void, cancel?: (ele?) => void}) => void",
       simpleDialog: "(args: {title: string, ele: HTMLElement, width?: string, height?: string}) => void",
       getActiveDoc: "() => Promise<string> | string - Get the ID of the currently active document.",
       createDailynote: "(boxId: string, date?: Date, content?: string, appId?: string) => Promise<string | null>",
       searchDailynote: "(boxId: string, date: Date) => Promise<any>",
       listDailynote: "(options?: {boxId?: string, before?: Date, after?: Date, limit?: number}) => Promise<any[]>",
       isMobile: "() => boolean - Check if current environment is mobile.",
       openBlock: "(id: string) => void - Safely open a document or block by ID.",
       lsOpenedNotebooks: "() => Promise<any[]> - List all opened notebooks.",
       getParentDoc: "(docId: string) => Promise<any> - Get parent document info.",
       listSubDocs: "(root: string, depth?: number) => Promise<any[]> - List child documents.",
       listSiblingDocs: "(docId: string) => Promise<any[]> - List sibling documents.",
       getBlockByID: "(blockId: string) => Promise<any> - Fetch block info.",
       getDocumentMarkdown: "(docId: string) => Promise<string> - Get full markdown of a document.",
       searchBacklinks: "(id: string) => Promise<any[]> - Search backlinks to a block."
    }
  },
  commonPitfalls: [
    "Do NOT use 'plugin.app.tab.currentTab'. Instead, use 'siyuan.getActiveTab()' to get the Tab object.",
    "siyuan.getActiveTab() returns a Tab object, NOT a DOM Element. If you need the DOM element, use tab.headElement or tab.panelElement.",
    "When using 'fetchSyncPost', the URL should start with '/api/' (e.g. '/api/block/getBlockInfo').",
    "On mobile, 'openTab' is not fully supported for documents. Prefer 'openMobileFileById' if targeting a block/doc.",
    "Do NOT use 'window.prompt' or 'window.confirm', use 'kits.confirmDialog' or 'siyuan.confirm'.",
    "Instead of native 'fetch', use 'siyuan.fetchSyncPost' to automatically attach auth tokens.",
    "Do NOT use 'document.querySelector' for components inside an editor tab, because there can be multiple editors. Query from 'tab.panelElement'.",
    "If 'getActiveTab()' returns undefined, the user might be clicking outside an editor. Provide a fallback or user warning.",
    "Do NOT call plugin commands via 'plugin.commands[name].execute()'. Execute them properly or extract their logic to utils.",
    "When listening to events, always register via 'plugin.eventBus.on' instead of native window events if possible."
  ],
  hookScript: {
    description: "当编写钩子（hook）脚本时，以下参数可直接使用（无需声明）:",
    parameters: {
      next: "() => void - 仅在 replace 模式可用。调用 next() 表示执行原始按钮行为。不调则完全替换。",
      trigger: "(buttonId: string) => Promise<void> - 触发另一个导航按钮的动作。按随机唯一 ID 查找（不是钩子匹配用的 actionKey）。支持链式调用（深度上限 5 层）。"
    }
  },
  referenceUrls: {
    officialApiDocs: "https://github.com/siyuan-note/siyuan/blob/master/API.zh_CN.md (Kernel REST API)",
    pluginSample: "https://github.com/siyuan-note/plugin-sample (Official Plugin API & Lifecycle)",
    syFormat: "https://github.com/siyuan-note/siyuan/blob/master/SY-FORMAT.zh_CN.md (Block Data Format)",
    communityDiscussions: "https://ld246.com/domain/siyuan (Siyuan Community Plugin Dev Section)",
    uiComponents: "https://github.com/siyuan-note/siyuan/tree/master/app/src (Check Siyuan front-end source for class names like .b3-button, .b3-dialog)",
  },
  bestPractices: [
    "CRITICAL: ALWAYS prioritize using 'kits' methods over native 'siyuan' APIs when available (e.g., use 'kits.getActiveDoc()' instead of guessing 'tab.model.id'). 'kits' safely abstracts away Siyuan's highly complex internal DOM and object structures.",
    "Prefer using 'siyuan.fetchSyncPost' over native fetch for interacting with the Siyuan backend because it handles auth tokens automatically.",
    "When modifying the DOM, always use 'requestAnimationFrame' or 'setTimeout' if you are waiting for Siyuan to finish rendering a view.",
    "For user inputs, construct a 'siyuan.Dialog' with HTML string in 'content' to maintain the native Siyuan aesthetic, or just use 'kits.confirmDialog'.",
    "To reuse logic, leverage the custom 'utils' object provided by this plugin instead of rewriting kernel API requests from scratch.",
    "Be defensive: verify frontend type ('siyuan.getFrontend()') before calling desktop-only or mobile-only APIs."
  ]
};
